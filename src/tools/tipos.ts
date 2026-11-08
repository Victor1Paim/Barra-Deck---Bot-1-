import type { Config } from "../config.js";

export interface Contexto {
  config: Config;
  agora: () => Date;
}

export interface Ferramenta {
  nome: string;
  descricao: string;
  /** JSON Schema dos parâmetros. */
  parametros: Record<string, unknown>;
  /** true = grava ou altera algo; passa pelo controle de permissão. */
  altera: boolean;
  executar: (args: any, ctx: Contexto) => Promise<unknown> | unknown;
}
