import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { usuarioDoGrupo, type Config, type Usuario } from "../config.js";
import type { Canal } from "../envios.js";

/** Compara números considerando o 9º dígito de celulares brasileiros (o WhatsApp às vezes omite). */
export function mesmoNumero(a: string, b: string): boolean {
  const x = a.replace(/\D/g, "");
  const y = b.replace(/\D/g, "");
  if (x === y) return true;
  const sem9 = (n: string) => (n.startsWith("55") && n.length === 13 && n[4] === "9" ? n.slice(0, 4) + n.slice(5) : n);
  return sem9(x) === sem9(y);
}

const numeroDoJid = (jid?: string | null) =>
  jid && jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0].split(":")[0] : undefined;

function textoDa(m: WAMessage): string | undefined {
  const msg = m.message;
  return (msg?.conversation ?? msg?.extendedTextMessage?.text ?? msg?.imageMessage?.caption ?? undefined)?.trim() || undefined;
}

/** A mensagem do grupo é para o bot? (menção, resposta a ele, ou começa com "deck") */
export function chamouBot(texto: string, mencionados: string[], citado: string | undefined, idsDoBot: string[]): boolean {
  if (/^\s*(@?deck(\s*one)?)\b/i.test(texto)) return true;
  if (mencionados.some((j) => idsDoBot.includes(j))) return true;
  return !!citado && idsDoBot.includes(citado);
}

/** Tira "@5511…" e o chamado "deck" do começo. */
export function limparChamado(texto: string): string {
  return texto.replace(/@\d+/g, "").replace(/^\s*@?deck(\s*one)?[\s,:!-]*/i, "").trim();
}

export interface Receptor {
  /** autor: nome de quem escreveu (nos grupos). */
  receber(destino: Usuario, texto: string, autor?: string): Promise<string | undefined>;
  /** Há uma pergunta de confirmação esperando resposta deste destino? */
  aguardando(id: string): boolean;
}

/**
 * WhatsApp via Baileys (não oficial). Use um número secundário: o WhatsApp pode banir números
 * que usam clientes não oficiais. A sessão fica salva em dados/whatsapp-sessao.
 */
export class WhatsApp implements Canal {
  nome = "whatsapp";
  private sock?: WASocket;
  private conectado = false;
  private jids = new Map<string, string>();

  private gruposAvisados = new Set<string>();

  constructor(
    private config: Config,
    private receptor: Receptor,
  ) {}

  atende(u: Usuario): boolean {
    return this.conectado && (!!u.whatsapp || !!u.whatsappGrupo);
  }

  async enviar(u: Usuario, texto: string): Promise<void> {
    if (!this.sock || !this.conectado) throw new Error("WhatsApp desconectado");
    await this.sock.sendMessage(u.whatsappGrupo ?? (await this.jidDe(u)), { text: texto });
  }

  private idsDoBot(): string[] {
    const u = this.sock?.user;
    return [u?.id, u?.lid].filter((x): x is string => !!x).map((j) => jidNormalizedUser(j));
  }

  /** Mostra no console os grupos em que o número do bot está, com o JID para liberar. */
  private async listarGrupos(): Promise<void> {
    const mapa = (await this.sock?.groupFetchAllParticipating().catch(() => undefined)) ?? {};
    const todos = Object.values(mapa) as { id: string; subject: string }[];
    const liberados = new Set(this.config.empresa.gruposWhatsApp.map((g) => g.jid));
    if (!todos.length) return console.log("ℹ️ O número do bot não está em nenhum grupo ainda.");
    console.log("👥 Grupos do WhatsApp:");
    for (const g of todos) console.log(`   ${liberados.has(g.id) ? "✅ liberado" : "⛔ não liberado"}  ${g.subject}  →  ${g.id}`);
    if (todos.some((g) => !liberados.has(g.id))) {
      console.log("   Para liberar, adicione o JID em deck.config.json → gruposWhatsApp (com as pastas que ele pode ver).");
    }
  }

  /** Descobre o JID real do número (resolve a questão do 9º dígito). */
  private async jidDe(u: Usuario): Promise<string> {
    const num = u.whatsapp!.replace(/\D/g, "");
    const cache = this.jids.get(num);
    if (cache) return cache;
    const [r] = (await this.sock!.onWhatsApp(num)) ?? [];
    if (!r?.exists) throw new Error(`O número ${num} não tem WhatsApp`);
    this.jids.set(num, r.jid);
    return r.jid;
  }

  private async usuarioDa(m: WAMessage): Promise<Usuario | undefined> {
    const k = m.key;
    let numero = numeroDoJid(k.remoteJid) ?? numeroDoJid(k.remoteJidAlt);
    if (!numero && k.remoteJid?.endsWith("@lid")) {
      numero = numeroDoJid(await this.sock?.signalRepository.lidMapping.getPNForLID(k.remoteJid));
    }
    if (!numero) return undefined;
    return this.config.empresa.usuarios.find((u) => u.whatsapp && mesmoNumero(u.whatsapp, numero));
  }

  async conectar(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(this.config.pastaDados, "whatsapp-sessao"));
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const sock = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log("\n📱 Escaneie com o WhatsApp do número do bot (Aparelhos conectados → Conectar aparelho):");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        this.conectado = true;
        console.log("✅ WhatsApp conectado.");
        void this.listarGrupos();
      }
      if (connection === "close") {
        this.conectado = false;
        const codigo = (lastDisconnect?.error as any)?.output?.statusCode;
        if (codigo === DisconnectReason.loggedOut) {
          console.error("❌ WhatsApp desconectado pelo celular. Apague dados/whatsapp-sessao e rode de novo para escanear.");
          return;
        }
        console.warn(`⚠️ WhatsApp caiu (código ${codigo ?? "?"}). Reconectando em 5s…`);
        setTimeout(() => void this.conectar().catch((e) => console.error(`[whatsapp] ${e.message}`)), 5000);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        if (m.key.fromMe || !m.key.remoteJid) continue;
        let texto = textoDa(m);
        if (!texto) continue;
        const jid = m.key.remoteJid;
        let destino: Usuario | undefined;
        let autor: string | undefined;

        if (jid.endsWith("@g.us")) {
          const grupo = this.config.empresa.gruposWhatsApp.find((g) => g.jid === jid);
          if (!grupo) {
            if (!this.gruposAvisados.has(jid)) {
              this.gruposAvisados.add(jid);
              console.log(`⛔ Mensagem num grupo não liberado (${jid}). Ignorando.`);
            }
            continue;
          }
          destino = usuarioDoGrupo(grupo);
          const ctxInfo = m.message?.extendedTextMessage?.contextInfo;
          const mencionados = (ctxInfo?.mentionedJid ?? []).map((j) => jidNormalizedUser(j));
          const citado = ctxInfo?.participant ? jidNormalizedUser(ctxInfo.participant) : undefined;
          const paraOBot = (grupo.responder ?? "mencao") === "tudo" || chamouBot(texto, mencionados, citado, this.idsDoBot());
          if (!paraOBot && !this.receptor.aguardando(destino.id)) continue;
          texto = limparChamado(texto) || texto;
          autor = m.pushName ?? "alguém";
        } else {
          if (this.config.empresa.canais.whatsapp.conversaPrivada === false) continue;
          destino = await this.usuarioDa(m);
          if (!destino) continue; // Ignora quem não está cadastrado em deck.config.json.
        }

        try {
          await sock.readMessages([m.key]);
          await sock.sendPresenceUpdate("composing", jid);
          const resposta = await this.receptor.receber(destino, texto, autor);
          if (resposta) await sock.sendMessage(jid, { text: resposta }, { quoted: m });
        } catch (e) {
          console.error(`[whatsapp] ${e instanceof Error ? e.message : e}`);
          await sock.sendMessage(jid, { text: "😵 Deu um erro aqui do meu lado. Tenta de novo em instantes?" }).catch(() => {});
        }
      }
    });
  }
}
