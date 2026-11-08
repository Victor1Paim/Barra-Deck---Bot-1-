import "dotenv/config";
import path from "node:path";

export type Modo = "perguntar" | "auto" | "leitura";

export interface Config {
  apiKey: string;
  modelo: string;
  modo: Modo;
  pastaDados: string;
  pastaConhecimento: string;
  pastaSkills: string;
  fuso: string;
  maxPassos: number;
}

const MODOS: Modo[] = ["perguntar", "auto", "leitura"];

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const modo = (env.DECK_MODO ?? "perguntar") as Modo;
  if (!MODOS.includes(modo)) {
    throw new Error(`DECK_MODO inválido: "${modo}". Use: ${MODOS.join(", ")}.`);
  }
  return {
    apiKey: env.OPENAI_API_KEY ?? "",
    modelo: env.OPENAI_MODEL ?? "gpt-5.4-mini",
    modo,
    pastaDados: path.resolve(env.DECK_DADOS ?? "./dados"),
    pastaConhecimento: path.resolve(env.DECK_CONHECIMENTO ?? "./conhecimento"),
    pastaSkills: path.resolve(env.DECK_SKILLS ?? "./skills"),
    fuso: env.DECK_FUSO ?? "America/Sao_Paulo",
    maxPassos: Number(env.DECK_MAX_PASSOS ?? 12),
  };
}
