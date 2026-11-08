import path from "node:path";
import { Colecao, novoId } from "../armazenamento.js";
import type { Ferramenta, Contexto } from "./tipos.js";

export interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  criadaEm: string;
  atualizadaEm: string;
}

const colecao = (ctx: Contexto) => new Colecao<Nota>(path.join(ctx.config.pastaDados, "notas.json"));

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const salvarNota: Ferramenta = {
  nome: "salvar_nota",
  descricao:
    "Salva uma informação da empresa para lembrar depois (processo, contato, decisão, dado). Use tags para organizar.",
  altera: true,
  parametros: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título curto e buscável" },
      conteudo: { type: "string", description: "O conteúdo completo da nota" },
      tags: { type: "array", items: { type: "string" }, description: "Ex.: cliente, financeiro, rh" },
    },
    required: ["titulo", "conteudo"],
  },
  executar({ titulo, conteudo, tags = [] }, ctx) {
    const agora = ctx.agora().toISOString();
    return colecao(ctx).adicionar({
      id: novoId("nota"),
      titulo,
      conteudo,
      tags: tags.map(normalizar),
      criadaEm: agora,
      atualizadaEm: agora,
    });
  },
};

export const buscarNotas: Ferramenta = {
  nome: "buscar_notas",
  descricao:
    "Busca notas salvas por palavras (título, conteúdo e tags) e/ou por tag. Sem filtros, lista as mais recentes.",
  altera: false,
  parametros: {
    type: "object",
    properties: {
      termo: { type: "string", description: "Palavras a procurar" },
      tag: { type: "string" },
      limite: { type: "number", description: "Máximo de resultados (padrão 10)" },
    },
  },
  executar({ termo, tag, limite = 10 }, ctx) {
    const palavras = termo ? normalizar(termo).split(/\s+/).filter(Boolean) : [];
    const tagN = tag ? normalizar(tag) : undefined;
    return colecao(ctx)
      .ler()
      .filter((n) => !tagN || n.tags.includes(tagN))
      .map((n) => {
        const texto = normalizar(`${n.titulo} ${n.conteudo} ${n.tags.join(" ")}`);
        const pontos = palavras.filter((p) => texto.includes(p)).length;
        return { n, pontos };
      })
      .filter(({ pontos }) => palavras.length === 0 || pontos > 0)
      .sort((a, b) => b.pontos - a.pontos || b.n.atualizadaEm.localeCompare(a.n.atualizadaEm))
      .slice(0, limite)
      .map(({ n }) => n);
  },
};

export const editarNota: Ferramenta = {
  nome: "editar_nota",
  descricao: "Atualiza título, conteúdo ou tags de uma nota existente (pelo id).",
  altera: true,
  parametros: {
    type: "object",
    properties: {
      id: { type: "string" },
      titulo: { type: "string" },
      conteudo: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
  },
  executar({ id, titulo, conteudo, tags }, ctx) {
    const nota = colecao(ctx).atualizar(id, (n) => ({
      ...n,
      titulo: titulo ?? n.titulo,
      conteudo: conteudo ?? n.conteudo,
      tags: tags ? tags.map(normalizar) : n.tags,
      atualizadaEm: ctx.agora().toISOString(),
    }));
    return nota ?? { erro: `Nota ${id} não encontrada.` };
  },
};

export const apagarNota: Ferramenta = {
  nome: "apagar_nota",
  descricao: "Apaga uma nota pelo id. Confirme com o usuário antes se houver dúvida.",
  altera: true,
  parametros: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  executar({ id }, ctx) {
    return colecao(ctx).remover(id) ? { ok: true } : { erro: `Nota ${id} não encontrada.` };
  },
};
