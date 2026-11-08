import path from "node:path";
import { Colecao, novoId } from "./armazenamento.js";
import type { Config, Usuario } from "./config.js";

/** Um canal entrega mensagens a um usuário (WhatsApp, e-mail, terminal...). */
export interface Canal {
  nome: string;
  /** Este canal consegue entregar a este usuário agora? */
  atende(usuario: Usuario): boolean;
  enviar(usuario: Usuario, texto: string, assunto?: string): Promise<void>;
}

export interface Envio {
  id: string;
  para: string;
  texto: string;
  assunto?: string;
  /** Canais por onde já foi entregue. */
  entregue: string[];
  tentativas: number;
  proximaTentativa: string;
  ultimoErro?: string;
  criadoEm: string;
  /** Entregue em pelo menos um canal = concluído. */
  concluido: boolean;
}

export const colecaoEnvios = (config: Config) =>
  new Colecao<Envio>(path.join(config.pastaDados, "envios.json"), config.chaveDados);

export function enfileirar(config: Config, para: string, texto: string, agora: Date, assunto?: string): Envio {
  return colecaoEnvios(config).adicionar({
    id: novoId("env"),
    para,
    texto,
    assunto,
    entregue: [],
    tentativas: 0,
    proximaTentativa: agora.toISOString(),
    criadoEm: agora.toISOString(),
    concluido: false,
  });
}

/** Espera entre tentativas: 1, 2, 4, 8 ... até 30 minutos. Nunca desiste. */
export function esperaMs(tentativas: number): number {
  return Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, tentativas - 1));
}

/**
 * Tenta entregar o que está pendente. Uma mensagem é considerada entregue quando chega por
 * QUALQUER canal disponível do usuário; tenta todos para garantir (WhatsApp + e-mail).
 */
export async function despachar(config: Config, canais: Canal[], agora: () => Date): Promise<number> {
  const col = colecaoEnvios(config);
  const t = agora().getTime();
  const pendentes = col.ler().filter((e) => !e.concluido && new Date(e.proximaTentativa).getTime() <= t);
  let entregues = 0;

  for (const envio of pendentes) {
    const usuario = config.empresa.usuarios.find((u) => u.id === envio.para);
    const erros: string[] = [];
    const ok: string[] = [];
    if (!usuario) erros.push(`usuário ${envio.para} não existe`);
    else {
      const disponiveis = canais.filter((c) => c.atende(usuario) && !envio.entregue.includes(c.nome));
      if (!disponiveis.length && !envio.entregue.length) erros.push("nenhum canal disponível");
      for (const c of disponiveis) {
        try {
          await c.enviar(usuario, envio.texto, envio.assunto);
          ok.push(c.nome);
        } catch (e) {
          erros.push(`${c.nome}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    col.atualizar(envio.id, (e) => {
      const entregue = [...new Set([...e.entregue, ...ok])];
      const tentativas = e.tentativas + 1;
      return {
        ...e,
        entregue,
        tentativas,
        concluido: entregue.length > 0,
        ultimoErro: erros.join("; ") || undefined,
        proximaTentativa: new Date(agora().getTime() + esperaMs(tentativas)).toISOString(),
      };
    });
    if (ok.length) entregues++;
  }

  // Limpa histórico de envios concluídos com mais de 30 dias.
  const limite = t - 30 * 86_400_000;
  col.transacao((itens) => ({
    itens: itens.filter((e) => !e.concluido || new Date(e.criadoEm).getTime() > limite),
    resultado: undefined,
  }));
  return entregues;
}
