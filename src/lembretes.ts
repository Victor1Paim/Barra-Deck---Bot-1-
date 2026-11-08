import path from "node:path";
import { Colecao, novoId } from "./armazenamento.js";
import type { Config } from "./config.js";
import { deLocal, diasNoMes, partesLocais } from "./tempo.js";

export type TipoRecorrencia = "diaria" | "semanal" | "mensal" | "anual";

export interface Recorrencia {
  tipo: TipoRecorrencia;
  /** A cada N (dias/semanas/meses/anos). Padrão 1. */
  intervalo?: number;
  /** Só para semanal: 0 = domingo … 6 = sábado. Vazio = o mesmo dia da semana do início. */
  diasSemana?: number[];
  /** Data final (ISO), opcional. */
  ate?: string;
}

export interface Lembrete {
  id: string;
  texto: string;
  autor: string;
  /** Usuários que recebem o aviso. */
  para: string[];
  grupo?: string;
  /** Unidade da empresa ou "todas". */
  unidade?: string;
  /** Próxima ocorrência (ISO UTC). */
  quando: string;
  /** Dia/hora originais no fuso, para recorrências não "escorregarem" (ex.: dia 31). */
  ancora: { dia: number; mes: number; hora: number; minuto: number };
  recorrencia?: Recorrencia;
  /** Avisos antecipados, em minutos antes (ex.: 4320 = 3 dias). */
  antecedencias: number[];
  /** Chaves dos avisos já colocados na fila: "<quando>|<minutosAntes>". */
  avisados: string[];
  /** Pontual que já disparou (fica visível como "atrasado" até concluir). */
  disparado: boolean;
  concluido: boolean;
  criadoEm: string;
}

export const colecaoLembretes = (config: Config) =>
  new Colecao<Lembrete>(path.join(config.pastaDados, "lembretes.json"), config.chaveDados);

export function novoLembrete(
  dados: Pick<Lembrete, "texto" | "autor" | "para" | "grupo" | "recorrencia"> & {
    unidade?: string; quando: Date; antecedencias?: number[] },
  config: Config,
  agora: Date,
): Lembrete {
  const p = partesLocais(dados.quando, config.fuso);
  return {
    id: novoId("lemb"),
    texto: dados.texto,
    autor: dados.autor,
    para: dados.para,
    grupo: dados.grupo,
    unidade: dados.unidade,
    quando: dados.quando.toISOString(),
    ancora: { dia: p.dia, mes: p.mes, hora: p.hora, minuto: p.minuto },
    recorrencia: dados.recorrencia,
    antecedencias: [...new Set(dados.antecedencias ?? [])].filter((m) => m > 0).sort((a, b) => b - a),
    avisados: [],
    disparado: false,
    concluido: false,
    criadoEm: agora.toISOString(),
  };
}

/** Ocorrência seguinte à `atual` (ou undefined se a recorrência acabou). */
export function proximaOcorrencia(l: Lembrete, atual: Date, fuso: string): Date | undefined {
  const r = l.recorrencia;
  if (!r) return undefined;
  const n = Math.max(1, r.intervalo ?? 1);
  const p = partesLocais(atual, fuso);
  const { hora, minuto } = l.ancora;
  let prox: Date;

  switch (r.tipo) {
    case "diaria":
      prox = deLocal(p.ano, p.mes, p.dia + n, hora, minuto, fuso);
      break;
    case "semanal": {
      const dias = r.diasSemana?.length ? [...r.diasSemana].sort() : [p.diaSemana];
      const depois = dias.find((d) => d > p.diaSemana);
      if (depois !== undefined) {
        prox = deLocal(p.ano, p.mes, p.dia + (depois - p.diaSemana), hora, minuto, fuso);
      } else {
        // Volta ao primeiro dia da lista, pulando (n-1) semanas.
        const salto = 7 * (n - 1) + (7 - p.diaSemana + dias[0]);
        prox = deLocal(p.ano, p.mes, p.dia + salto, hora, minuto, fuso);
      }
      break;
    }
    case "mensal": {
      const total = p.mes - 1 + n;
      const ano = p.ano + Math.floor(total / 12);
      const mes = (total % 12) + 1;
      prox = deLocal(ano, mes, Math.min(l.ancora.dia, diasNoMes(ano, mes)), hora, minuto, fuso);
      break;
    }
    case "anual": {
      const ano = p.ano + n;
      prox = deLocal(ano, l.ancora.mes, Math.min(l.ancora.dia, diasNoMes(ano, l.ancora.mes)), hora, minuto, fuso);
      break;
    }
  }
  if (r.ate && prox.getTime() > new Date(r.ate).getTime()) return undefined;
  return prox;
}

export interface Aviso {
  lembrete: Lembrete;
  /** 0 = na hora; >0 = minutos de antecedência. */
  minutosAntes: number;
  /** Disparou com mais de 15 min de atraso (ex.: PC estava desligado). */
  atrasado: boolean;
  ocorrencia: Date;
}

const TOLERANCIA_ATRASO = 15 * 60_000;

/**
 * Calcula os avisos que vencem até `agora`, já marcando-os no lembrete (para não repetir).
 * Recorrentes avançam para a próxima ocorrência futura; ocorrências perdidas geram um único aviso "atrasado".
 */
export function processarVencidos(lembretes: Lembrete[], agora: Date, fuso: string): { lembretes: Lembrete[]; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const t = agora.getTime();

  const atualizados = lembretes.map((original) => {
    if (original.concluido || original.disparado) return original;
    const l: Lembrete = { ...original, avisados: [...original.avisados] };

    for (let guarda = 0; guarda < 1000; guarda++) {
      const ocorrencia = new Date(l.quando);
      const oc = ocorrencia.getTime();
      if (oc > t) {
        // Ainda não chegou: só os avisos antecipados que já venceram.
        for (const m of l.antecedencias) {
          const chave = `${l.quando}|${m}`;
          const momento = oc - m * 60_000;
          // Antecedência que já tinha passado quando o lembrete foi criado não faz sentido avisar.
          const antesDeCriar = momento < new Date(l.criadoEm).getTime();
          if (momento <= t && !l.avisados.includes(chave) && !antesDeCriar) {
            l.avisados.push(chave);
            avisos.push({ lembrete: l, minutosAntes: m, atrasado: t - momento > TOLERANCIA_ATRASO, ocorrencia });
          }
        }
        break;
      }
      // A ocorrência chegou.
      const chave = `${l.quando}|0`;
      const proxima = proximaOcorrencia(l, ocorrencia, fuso);
      const proximaJaPassou = proxima && proxima.getTime() <= t;
      if (!l.avisados.includes(chave) && !proximaJaPassou) {
        // Se várias ocorrências foram perdidas, avisa só a mais recente.
        avisos.push({ lembrete: l, minutosAntes: 0, atrasado: t - oc > TOLERANCIA_ATRASO, ocorrencia });
      }
      l.avisados.push(chave);
      if (!proxima) {
        l.disparado = true;
        break;
      }
      l.quando = proxima.toISOString();
      // Mantém só as chaves da ocorrência atual.
      l.avisados = l.avisados.filter((k) => k.startsWith(l.quando));
    }
    return l;
  });

  return { lembretes: atualizados, avisos };
}
