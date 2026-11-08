import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import type { Config, Usuario } from "../config.js";
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

export type AoReceber = (usuario: Usuario, texto: string) => Promise<string | undefined>;

/**
 * WhatsApp via Baileys (não oficial). Use um número secundário: o WhatsApp pode banir números
 * que usam clientes não oficiais. A sessão fica salva em dados/whatsapp-sessao.
 */
export class WhatsApp implements Canal {
  nome = "whatsapp";
  private sock?: WASocket;
  private conectado = false;
  private jids = new Map<string, string>();

  constructor(
    private config: Config,
    private aoReceber: AoReceber,
  ) {}

  atende(u: Usuario): boolean {
    return this.conectado && !!u.whatsapp;
  }

  async enviar(u: Usuario, texto: string): Promise<void> {
    if (!this.sock || !this.conectado) throw new Error("WhatsApp desconectado");
    await this.sock.sendMessage(await this.jidDe(u), { text: texto });
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
        if (m.key.fromMe || !m.key.remoteJid || m.key.remoteJid.endsWith("@g.us")) continue;
        const texto = textoDa(m);
        if (!texto) continue;
        const usuario = await this.usuarioDa(m);
        if (!usuario) continue; // Ignora quem não está cadastrado em deck.config.json.
        try {
          await sock.readMessages([m.key]);
          await sock.sendPresenceUpdate("composing", m.key.remoteJid);
          const resposta = await this.aoReceber(usuario, texto);
          if (resposta) await sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
        } catch (e) {
          console.error(`[whatsapp] ${e instanceof Error ? e.message : e}`);
          await sock.sendMessage(m.key.remoteJid, { text: "😵 Deu um erro aqui do meu lado. Tenta de novo em instantes?" }).catch(() => {});
        }
      }
    });
  }
}
