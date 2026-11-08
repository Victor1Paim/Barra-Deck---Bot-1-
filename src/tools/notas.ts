import path from "node:path";
import { Colecao, novoId } from "../armazenamento.js";
import { podeVerGrupo } from "../config.js";
import type { Ferramenta, Contexto } from "./tipos.js";

export interface Nota {
  id: string;
  grupo: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  autor: string;
  criadaEm: string;
  atualizadaEm: string;
  atualizadaPor: string;
}

export const colecaoNotas = (ctx: Contexto) =>
  new Colecao<Nota>(path.join(ctx.config.pastaDados, "notas.json"), ctx.config.chaveDados);

export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const idsGrupos = (ctx: Contexto) => ctx.config.empresa.grupos.map((g) => g.id);
const grupoSensivel = (ctx: Contexto, id?: string) => !!ctx.config.empresa.grupos.find((g) => g.id === id)?.sensivel;

/** Nota visível para o usuário atual, ou undefined (não revela que existe). */
function notaVisivel(ctx: Contexto, id: string): Nota | undefined {
  const n = colecaoNotas(ctx).ler().find((x) => x.id === id);
  return n && podeVerGrupo(ctx.config, ctx.usuario, n.grupo) ? n : undefined;
}

const naoEncontrada = (id: string) => ({ erro: `Nota ${id} não encontrada.` });

export const salvarNota: Ferramenta = {
  nome: "salvar_nota",
  descricao:
    "Salva uma informação da empresa num grupo (clientes, processos, financeiro...). Antes, busque se já existe nota sobre o mesmo assunto: se existir, prefira editar_nota.",
  nivel: "criar",
  parametros: {
    type: "object",
    properties: {
      grupo: { type: "string", description: "id do grupo (veja a lista no prompt)" },
      titulo: { type: "string", description: "Título curto e buscável" },
      conteudo: { type: "string", description: "O conteúdo completo da nota" },
      tags: { type: "array", items: { type: "string" }, description: "Ex.: nome do cliente, projeto" },
    },
    required: ["grupo", "titulo", "conteudo"],
  },
  resumir: (a) => `salvar em ${a.grupo}: "${a.titulo}"`,
  executar({ grupo, titulo, conteudo, tags = [] }, ctx) {
    if (!idsGrupos(ctx).includes(grupo)) return { erro: `Grupo inválido: ${grupo}. Use: ${idsGrupos(ctx).join(", ")}` };
    if (!podeVerGrupo(ctx.config, ctx.usuario, grupo)) return { erro: `Você não tem acesso ao grupo ${grupo}.` };
    const agora = ctx.agora().toISOString();
    return colecaoNotas(ctx).adicionar({
      id: novoId("nota"),
      grupo,
      titulo,
      conteudo,
      tags: tags.map(normalizar),
      autor: ctx.usuario.id,
      criadaEm: agora,
      atualizadaEm: agora,
      atualizadaPor: ctx.usuario.id,
    });
  },
};

export const buscarNotas: Ferramenta = {
  nome: "buscar_notas",
  descricao:
    "Busca notas por palavras (título, conteúdo e tags), opcionalmente num grupo. Sem termo, lista as mais recentes.",
  nivel: "leitura",
  parametros: {
    type: "object",
    properties: {
      termo: { type: "string", description: "Palavras a procurar" },
      grupo: { type: "string" },
      tag: { type: "string" },
      limite: { type: "number", description: "Máximo de resultados (padrão 10)" },
    },
  },
  executar({ termo, grupo, tag, limite = 10 }, ctx) {
    const palavras = termo ? normalizar(termo).split(/\s+/).filter((p) => p.length > 1) : [];
    const tagN = tag ? normalizar(tag) : undefined;
    return colecaoNotas(ctx)
      .ler()
      .filter((n) => podeVerGrupo(ctx.config, ctx.usuario, n.grupo))
      .filter((n) => !grupo || n.grupo === grupo)
      .filter((n) => !tagN || n.tags.includes(tagN))
      .map((n) => {
        const texto = normalizar(`${n.titulo} ${n.conteudo} ${n.tags.join(" ")}`);
        return { n, pontos: palavras.filter((p) => texto.includes(p)).length };
      })
      .filter(({ pontos }) => palavras.length === 0 || pontos > 0)
      .sort((a, b) => b.pontos - a.pontos || b.n.atualizadaEm.localeCompare(a.n.atualizadaEm))
      .slice(0, limite)
      .map(({ n }) => n);
  },
};

export const editarNota: Ferramenta = {
  nome: "editar_nota",
  descricao: "Atualiza grupo, título, conteúdo ou tags de uma nota existente (pelo id). Envie o conteúdo completo, não só a mudança.",
  nivel: "editar",
  parametros: {
    type: "object",
    properties: {
      id: { type: "string" },
      grupo: { type: "string" },
      titulo: { type: "string" },
      conteudo: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
  },
  exigeConfirmacao: (a, ctx) => grupoSensivel(ctx, a.grupo) || grupoSensivel(ctx, notaVisivel(ctx, a.id)?.grupo),
  resumir: (a, ctx) => `editar a nota "${notaVisivel(ctx, a.id)?.titulo ?? a.id}"`,
  executar({ id, grupo, titulo, conteudo, tags }, ctx) {
    if (!notaVisivel(ctx, id)) return naoEncontrada(id);
    if (grupo && (!idsGrupos(ctx).includes(grupo) || !podeVerGrupo(ctx.config, ctx.usuario, grupo))) {
      return { erro: `Grupo inválido ou sem acesso: ${grupo}` };
    }
    return colecaoNotas(ctx).atualizar(id, (n) => ({
      ...n,
      grupo: grupo ?? n.grupo,
      titulo: titulo ?? n.titulo,
      conteudo: conteudo ?? n.conteudo,
      tags: tags ? tags.map(normalizar) : n.tags,
      atualizadaEm: ctx.agora().toISOString(),
      atualizadaPor: ctx.usuario.id,
    }));
  },
};

export const apagarNota: Ferramenta = {
  nome: "apagar_nota",
  descricao: "Apaga uma nota pelo id (o usuário sempre confirma).",
  nivel: "apagar",
  parametros: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  resumir: (a, ctx) => `APAGAR a nota "${notaVisivel(ctx, a.id)?.titulo ?? a.id}"`,
  executar({ id }, ctx) {
    if (!notaVisivel(ctx, id)) return naoEncontrada(id);
    return colecaoNotas(ctx).remover(id) ? { ok: true } : naoEncontrada(id);
  },
};
