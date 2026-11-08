import type { Config, Usuario } from "../config.js";

export interface Contexto {
  config: Config;
  usuario: Usuario;
  agora: () => Date;
}

/** leitura: só consulta · criar: adiciona algo novo · editar: muda algo existente · apagar: remove */
export type Nivel = "leitura" | "criar" | "editar" | "apagar";

export interface Ferramenta {
  nome: string;
  descricao: string;
  /** JSON Schema dos parâmetros. */
  parametros: Record<string, unknown>;
  nivel: Nivel;
  /** Regra extra: true = confirma com o usuário em qualquer modo (ex.: mexer em financeiro). */
  exigeConfirmacao?: (args: any, ctx: Contexto) => boolean;
  /** Descrição curta para a pergunta de confirmação. */
  resumir?: (args: any, ctx: Contexto) => string;
  executar: (args: any, ctx: Contexto) => Promise<unknown> | unknown;
}

export function precisaConfirmar(f: Ferramenta, args: unknown, ctx: Contexto): boolean {
  if (f.nivel === "leitura") return false;
  if (f.nivel === "apagar") return true;
  if (f.exigeConfirmacao?.(args, ctx)) return true;
  switch (ctx.config.modo) {
    case "perguntar":
      return true;
    case "misto":
      return f.nivel === "editar";
    default:
      return false;
  }
}
