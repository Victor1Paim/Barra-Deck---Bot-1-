import { podeVerGrupo } from "../config.js";
import { colecaoLembretes, novoLembrete, type Lembrete, type Recorrencia } from "../lembretes.js";
import { formatarData } from "../tempo.js";
import type { Ferramenta, Contexto } from "./tipos.js";

const UNIDADES: Record<string, number> = { minutos: 1, horas: 60, dias: 1440, semanas: 10080 };

const esquemaRecorrencia = {
  type: "object",
  description: "Só para lembretes que se repetem",
  properties: {
    tipo: { type: "string", enum: ["diaria", "semanal", "mensal", "anual"] },
    intervalo: { type: "number", description: "A cada N (padrão 1). Ex.: a cada 2 semanas = 2" },
    diasSemana: { type: "array", items: { type: "number" }, description: "Semanal: 0=dom … 6=sáb" },
    ate: { type: "string", description: "Data final ISO (opcional)" },
  },
  required: ["tipo"],
};

const esquemaAntecedencia = {
  type: "array",
  description: "Avisos antes do horário. Ex.: 3 dias antes e 1 hora antes",
  items: {
    type: "object",
    properties: { quantidade: { type: "number" }, unidade: { type: "string", enum: Object.keys(UNIDADES) } },
    required: ["quantidade", "unidade"],
  },
};

function visivel(ctx: Contexto, l: Lembrete): boolean {
  const meu = l.autor === ctx.usuario.id || l.para.includes(ctx.usuario.id) || !!ctx.usuario.admin;
  return meu && (!l.grupo || podeVerGrupo(ctx.config, ctx.usuario, l.grupo));
}

function buscar(ctx: Contexto, id: string): Lembrete | undefined {
  const l = colecaoLembretes(ctx.config).ler().find((x) => x.id === id);
  return l && visivel(ctx, l) ? l : undefined;
}

function validarPara(ctx: Contexto, para?: string[]): string[] | { erro: string } {
  const lista = para?.length ? para : [ctx.usuario.id];
  const ids = ctx.config.empresa.usuarios.map((u) => u.id);
  const invalidos = lista.filter((p) => !ids.includes(p));
  return invalidos.length ? { erro: `Usuários desconhecidos: ${invalidos.join(", ")}. Válidos: ${ids.join(", ")}` } : lista;
}

function paraExibir(ctx: Contexto, l: Lembrete) {
  return {
    id: l.id,
    texto: l.texto,
    quando: formatarData(new Date(l.quando), ctx.config.fuso),
    quandoISO: l.quando,
    para: l.para,
    grupo: l.grupo,
    recorrencia: l.recorrencia,
    antecedenciasMin: l.antecedencias,
    situacao: l.concluido ? "concluido" : l.disparado ? "atrasado (já disparou, falta concluir)" : "pendente",
  };
}

const sensivel = (ctx: Contexto, grupo?: string) => !!ctx.config.empresa.grupos.find((g) => g.id === grupo)?.sensivel;

export const criarLembrete: Ferramenta = {
  nome: "criar_lembrete",
  descricao:
    "Cria um lembrete (pontual ou recorrente, com avisos antecipados). Converta 'amanhã às 9h', 'todo dia 5', 'toda segunda' para os campos. Para vencimentos, sugira aviso com antecedência.",
  nivel: "criar",
  parametros: {
    type: "object",
    properties: {
      texto: { type: "string", description: "O que lembrar, claro e autoexplicativo" },
      quando: { type: "string", description: "Primeira ocorrência, ISO 8601 com fuso. Ex.: 2026-11-10T09:00:00-03:00" },
      recorrencia: esquemaRecorrencia,
      avisarAntes: esquemaAntecedencia,
      para: { type: "array", items: { type: "string" }, description: "ids dos usuários avisados (padrão: quem pediu)" },
      grupo: { type: "string", description: "Grupo relacionado (ex.: financeiro)" },
    },
    required: ["texto", "quando"],
  },
  resumir: (a) => `criar lembrete "${a.texto}" para ${a.quando}`,
  executar({ texto, quando, recorrencia, avisarAntes = [], para, grupo }, ctx) {
    const data = new Date(quando);
    if (Number.isNaN(data.getTime())) return { erro: `Data inválida: ${quando}` };
    if (!recorrencia && data.getTime() < ctx.agora().getTime() - 60_000) return { erro: "Essa data já passou." };
    if (grupo && !podeVerGrupo(ctx.config, ctx.usuario, grupo)) return { erro: `Sem acesso ao grupo ${grupo}.` };
    const destinatarios = validarPara(ctx, para);
    if ("erro" in destinatarios) return destinatarios;
    const antecedencias = (avisarAntes as { quantidade: number; unidade: string }[]).map(
      (a) => a.quantidade * (UNIDADES[a.unidade] ?? 1),
    );
    const l = novoLembrete(
      { texto, autor: ctx.usuario.id, para: destinatarios, grupo, recorrencia: recorrencia as Recorrencia, quando: data, antecedencias },
      ctx.config,
      ctx.agora(),
    );
    colecaoLembretes(ctx.config).adicionar(l);
    return paraExibir(ctx, l);
  },
};

export const listarLembretes: Ferramenta = {
  nome: "listar_lembretes",
  descricao: "Lista os lembretes do usuário (pendentes e atrasados), em ordem de data. Pode filtrar por período.",
  nivel: "leitura",
  parametros: {
    type: "object",
    properties: {
      incluirConcluidos: { type: "boolean" },
      ate: { type: "string", description: "Só até esta data (ISO)" },
    },
  },
  executar({ incluirConcluidos = false, ate }, ctx) {
    const limite = ate ? new Date(ate).getTime() : Infinity;
    return colecaoLembretes(ctx.config)
      .ler()
      .filter((l) => visivel(ctx, l))
      .filter((l) => incluirConcluidos || !l.concluido)
      .filter((l) => new Date(l.quando).getTime() <= limite)
      .sort((a, b) => a.quando.localeCompare(b.quando))
      .map((l) => paraExibir(ctx, l));
  },
};

export const concluirLembrete: Ferramenta = {
  nome: "concluir_lembrete",
  descricao: "Marca um lembrete pontual como feito. Num recorrente, encerra a repetição (use só se o usuário quiser parar de vez).",
  nivel: "criar",
  parametros: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  resumir: (a, ctx) => `concluir "${buscar(ctx, a.id)?.texto ?? a.id}"`,
  executar({ id }, ctx) {
    if (!buscar(ctx, id)) return { erro: `Lembrete ${id} não encontrado.` };
    return paraExibir(ctx, colecaoLembretes(ctx.config).atualizar(id, (l) => ({ ...l, concluido: true }))!);
  },
};

export const editarLembrete: Ferramenta = {
  nome: "editar_lembrete",
  descricao: "Muda texto, data, recorrência, avisos antecipados ou destinatários de um lembrete.",
  nivel: "editar",
  parametros: {
    type: "object",
    properties: {
      id: { type: "string" },
      texto: { type: "string" },
      quando: { type: "string", description: "Nova data ISO 8601 com fuso" },
      recorrencia: { ...esquemaRecorrencia, description: "Nova recorrência; envie {tipo:'nenhuma'} para tirar" },
      avisarAntes: esquemaAntecedencia,
      para: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
  },
  exigeConfirmacao: (a, ctx) => sensivel(ctx, buscar(ctx, a.id)?.grupo),
  resumir: (a, ctx) => `editar o lembrete "${buscar(ctx, a.id)?.texto ?? a.id}"`,
  executar({ id, texto, quando, recorrencia, avisarAntes, para }, ctx) {
    const atual = buscar(ctx, id);
    if (!atual) return { erro: `Lembrete ${id} não encontrado.` };
    const data = quando ? new Date(quando) : new Date(atual.quando);
    if (Number.isNaN(data.getTime())) return { erro: `Data inválida: ${quando}` };
    const destinatarios = para ? validarPara(ctx, para) : atual.para;
    if ("erro" in destinatarios) return destinatarios;
    const base = novoLembrete(
      {
        texto: texto ?? atual.texto,
        autor: atual.autor,
        para: destinatarios,
        grupo: atual.grupo,
        quando: data,
        recorrencia: recorrencia ? (recorrencia.tipo === "nenhuma" ? undefined : recorrencia) : atual.recorrencia,
        antecedencias: avisarAntes
          ? (avisarAntes as { quantidade: number; unidade: string }[]).map((a) => a.quantidade * (UNIDADES[a.unidade] ?? 1))
          : atual.antecedencias,
      },
      ctx.config,
      ctx.agora(),
    );
    // Mudou a data: os avisos recomeçam. Senão, mantém o que já foi avisado.
    const mudouData = data.toISOString() !== atual.quando;
    const novo = colecaoLembretes(ctx.config).atualizar(id, () => ({
      ...base,
      id,
      criadoEm: mudouData ? base.criadoEm : atual.criadoEm,
      avisados: mudouData ? [] : atual.avisados,
      disparado: mudouData ? false : atual.disparado,
    }))!;
    return paraExibir(ctx, novo);
  },
};

export const apagarLembrete: Ferramenta = {
  nome: "apagar_lembrete",
  descricao: "Apaga um lembrete (o usuário sempre confirma).",
  nivel: "apagar",
  parametros: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  resumir: (a, ctx) => `APAGAR o lembrete "${buscar(ctx, a.id)?.texto ?? a.id}"`,
  executar({ id }, ctx) {
    if (!buscar(ctx, id)) return { erro: `Lembrete ${id} não encontrado.` };
    return { ok: colecaoLembretes(ctx.config).remover(id) };
  },
};
