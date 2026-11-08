import OpenAI from "openai";
import { Agente, type Confirmar } from "./agente.js";
import type { Config, Usuario } from "./config.js";
import { promptDoSistema } from "./prompt.js";
import { carregarSkills, ferramentaSkill } from "./skills.js";
import { ferramentasBase } from "./tools/index.js";
import type { Contexto } from "./tools/tipos.js";

export function criarAgente(
  config: Config,
  usuario: Usuario,
  canal: "terminal" | "whatsapp",
  confirmar: Confirmar,
  aoChamarFerramenta?: (nome: string) => void,
): Agente {
  const ctx: Contexto = { config, usuario, agora: () => new Date() };
  const skills = carregarSkills(config.pastaSkills);
  const ferramentas = skills.length ? [...ferramentasBase, ferramentaSkill(skills)] : ferramentasBase;
  return new Agente(
    new OpenAI({ apiKey: config.apiKey }),
    ctx,
    ferramentas,
    () => promptDoSistema(config, usuario, skills, ctx.agora(), canal),
    confirmar,
    { aoChamarFerramenta },
  );
}

const SIM = /^(s|sim|pode|ok|confirmo|claro|isso|manda|yes|y)\b/i;
const TEMPO_CONFIRMACAO = 5 * 60_000;

/**
 * Conversas pelo WhatsApp: um agente por usuário, uma mensagem por vez,
 * e confirmações respondidas com "sim"/"não" na própria conversa.
 */
export class SessoesWhatsApp {
  private agentes = new Map<string, Agente>();
  private filas = new Map<string, Promise<unknown>>();
  private aguardando = new Map<string, (ok: boolean) => void>();

  constructor(
    private config: Config,
    private enviar: (u: Usuario, texto: string) => Promise<void>,
  ) {}

  async receber(u: Usuario, texto: string): Promise<string | undefined> {
    const pendente = this.aguardando.get(u.id);
    if (pendente) {
      this.aguardando.delete(u.id);
      pendente(SIM.test(texto.trim()));
      return undefined;
    }
    if (/^\/?(limpar|reiniciar)$/i.test(texto.trim())) {
      this.agentes.delete(u.id);
      return "🧹 Conversa reiniciada! (As notas e lembretes continuam salvos.)";
    }
    const anterior = this.filas.get(u.id) ?? Promise.resolve();
    const atual = anterior.catch(() => {}).then(() => this.agente(u).conversar(texto));
    this.filas.set(u.id, atual);
    return atual;
  }

  private agente(u: Usuario): Agente {
    let a = this.agentes.get(u.id);
    if (!a) {
      a = criarAgente(this.config, u, "whatsapp", (pergunta) => this.perguntar(u, pergunta));
      this.agentes.set(u.id, a);
    }
    return a;
  }

  private perguntar(u: Usuario, pergunta: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.aguardando.get(u.id) === fim) {
          this.aguardando.delete(u.id);
          resolve(false);
        }
      }, TEMPO_CONFIRMACAO);
      const fim = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };
      this.aguardando.set(u.id, fim);
      this.enviar(u, `🤔 ${pergunta}\nResponda *sim* ou *não*.`).catch(() => fim(false));
    });
  }
}
