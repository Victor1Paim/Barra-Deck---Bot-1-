import fs from "node:fs";
import path from "node:path";
import type { Ferramenta } from "./tools/tipos.js";

export interface Skill {
  nome: string;
  descricao: string;
  corpo: string;
}

/**
 * Skills são arquivos Markdown em skills/<nome>.md com um cabeçalho:
 * ---
 * nome: registro-de-reuniao
 * descricao: Quando usar esta skill
 * ---
 */
export function carregarSkills(pasta: string): Skill[] {
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => lerSkill(path.join(pasta, f)))
    .filter((s): s is Skill => s !== undefined);
}

export function lerSkill(arquivo: string): Skill | undefined {
  const texto = fs.readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return undefined;
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  if (!meta.nome || !meta.descricao) return undefined;
  return { nome: meta.nome, descricao: meta.descricao, corpo: m[2].trim() };
}

export function ferramentaSkill(skills: Skill[]): Ferramenta {
  return {
    nome: "carregar_skill",
    descricao: "Carrega as instruções completas de uma skill antes de executar a tarefa dela.",
    nivel: "leitura",
    parametros: {
      type: "object",
      properties: { nome: { type: "string", enum: skills.map((s) => s.nome) } },
      required: ["nome"],
    },
    executar({ nome }) {
      return skills.find((s) => s.nome === nome)?.corpo ?? { erro: `Skill ${nome} não existe.` };
    },
  };
}
