import fs from "node:fs";
import path from "node:path";
import type { Ferramenta } from "./tools/tipos.js";

export interface Skill {
  nome: string;
  descricao: string;
  corpo: string;
}

/**
 * Skills em dois formatos (compatível com o padrão SKILL.md usado por outros agentes, como o OpenMausBot):
 *   skills/<nome>.md
 *   skills/<nome>/SKILL.md   (a pasta pode ter arquivos de apoio)
 * Cabeçalho com nome/descricao (ou name/description):
 * ---
 * name: registro-de-reuniao
 * description: Quando usar esta skill
 * ---
 */
export function carregarSkills(pasta: string): Skill[] {
  if (!fs.existsSync(pasta)) return [];
  const arquivos = fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      const s = path.join(pasta, e.name, "SKILL.md");
      return fs.existsSync(s) ? [s] : [];
    }
    return e.name.endsWith(".md") && e.name.toLowerCase() !== "readme.md" ? [path.join(pasta, e.name)] : [];
  });
  const skills = arquivos.map(lerSkill).filter((s): s is Skill => s !== undefined);
  return [...new Map(skills.map((s) => [s.nome, s])).values()];
}

const semAspas = (v: string) => v.replace(/^(["'])(.*)\1$/, "$2");

export function lerSkill(arquivo: string): Skill | undefined {
  const texto = fs.readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return undefined;
  const meta: Record<string, string> = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i > 0 && !/^\s/.test(linha)) meta[linha.slice(0, i).trim()] = semAspas(linha.slice(i + 1).trim());
  }
  const nome = meta.nome ?? meta.name;
  const descricao = meta.descricao ?? meta.description;
  if (!nome || !descricao) return undefined;
  const corpo = m[2].trim();
  const pasta = path.dirname(arquivo);
  // Skill em pasta: avisa o modelo onde ficam os arquivos de apoio.
  const apoio = path.basename(arquivo) === "SKILL.md" ? `\n\n(Arquivos de apoio desta skill: ${pasta})` : "";
  return { nome, descricao, corpo: corpo + apoio };
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
