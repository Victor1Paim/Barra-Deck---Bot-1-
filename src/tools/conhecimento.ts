import fs from "node:fs";
import path from "node:path";
import type { Ferramenta, Contexto } from "./tipos.js";

const EXTENSOES = new Set([".md", ".txt", ".csv", ".json"]);
const LIMITE_BYTES = 200_000;

/** Resolve um caminho garantindo que fica dentro da pasta de conhecimento. */
function dentroDaBase(ctx: Contexto, relativo: string): string {
  const base = ctx.config.pastaConhecimento;
  const alvo = path.resolve(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    throw new Error("Acesso negado: caminho fora da pasta de conhecimento.");
  }
  return alvo;
}

function listar(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listar(p, base);
    return EXTENSOES.has(path.extname(e.name).toLowerCase()) ? [path.relative(base, p)] : [];
  });
}

export const listarDocumentos: Ferramenta = {
  nome: "listar_documentos",
  descricao: "Lista os documentos da empresa disponíveis na base de conhecimento.",
  altera: false,
  parametros: { type: "object", properties: {} },
  executar(_args, ctx) {
    return listar(ctx.config.pastaConhecimento, ctx.config.pastaConhecimento);
  },
};

export const lerDocumento: Ferramenta = {
  nome: "ler_documento",
  descricao: "Lê um documento da base de conhecimento (caminho relativo, como aparece em listar_documentos).",
  altera: false,
  parametros: { type: "object", properties: { caminho: { type: "string" } }, required: ["caminho"] },
  executar({ caminho }, ctx) {
    const alvo = dentroDaBase(ctx, caminho);
    if (!fs.existsSync(alvo)) return { erro: `Documento não encontrado: ${caminho}` };
    const conteudo = fs.readFileSync(alvo, "utf8");
    return conteudo.length > LIMITE_BYTES
      ? conteudo.slice(0, LIMITE_BYTES) + "\n[... documento truncado ...]"
      : conteudo;
  },
};
