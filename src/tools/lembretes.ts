import path from "node:path";
import { Colecao, novoId } from "../armazenamento.js";
import type { Ferramenta, Contexto } from "./tipos.js";

export interface Lembrete {
  id: string;
  texto: string;
  /** Data/hora ISO 8601 com fuso, ex.: 2026-11-10T09:00:00-03:00 */
  quando: string;
  concluido: boolean;
  avisado: boolean;
  criadoEm: string;
}

export const colecaoLembretes = (ctx: Contexto) =>
  new Colecao<Lembrete>(path.join(ctx.config.pastaDados, "lembretes.json"));

export const criarLembrete: Ferramenta = {
  nome: "criar_lembrete",
  descricao:
    "Cria um lembrete para uma data/hora. Converta expressões como 'amanhã às 9h' para ISO 8601 com o fuso do usuário.",
  altera: true,
  parametros: {
    type: "object",
    properties: {
      texto: { type: "string" },
      quando: { type: "string", description: "ISO 8601 com fuso, ex.: 2026-11-10T09:00:00-03:00" },
    },
    required: ["texto", "quando"],
  },
  executar({ texto, quando }, ctx) {
    const data = new Date(quando);
    if (Number.isNaN(data.getTime())) return { erro: `Data inválida: ${quando}` };
    return colecaoLembretes(ctx).adicionar({
      id: novoId("lemb"),
      texto,
      quando: data.toISOString(),
      concluido: false,
      avisado: false,
      criadoEm: ctx.agora().toISOString(),
    });
  },
};

export const listarLembretes: Ferramenta = {
  nome: "listar_lembretes",
  descricao: "Lista lembretes. Por padrão só os pendentes, em ordem de data.",
  altera: false,
  parametros: {
    type: "object",
    properties: { incluirConcluidos: { type: "boolean" } },
  },
  executar({ incluirConcluidos = false }, ctx) {
    return colecaoLembretes(ctx)
      .ler()
      .filter((l) => incluirConcluidos || !l.concluido)
      .sort((a, b) => a.quando.localeCompare(b.quando));
  },
};

export const concluirLembrete: Ferramenta = {
  nome: "concluir_lembrete",
  descricao: "Marca um lembrete como concluído (pelo id).",
  altera: true,
  parametros: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  executar({ id }, ctx) {
    return colecaoLembretes(ctx).atualizar(id, (l) => ({ ...l, concluido: true })) ?? {
      erro: `Lembrete ${id} não encontrado.`,
    };
  },
};

/** Lembretes vencidos e ainda não avisados; marca como avisados. */
export function lembretesVencidos(ctx: Contexto): Lembrete[] {
  const col = colecaoLembretes(ctx);
  const agora = ctx.agora().getTime();
  const todos = col.ler();
  const vencidos = todos.filter((l) => !l.concluido && !l.avisado && new Date(l.quando).getTime() <= agora);
  if (vencidos.length) {
    const ids = new Set(vencidos.map((l) => l.id));
    col.gravar(todos.map((l) => (ids.has(l.id) ? { ...l, avisado: true } : l)));
  }
  return vencidos;
}
