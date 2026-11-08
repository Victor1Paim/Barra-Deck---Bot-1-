import type { Config } from "./config.js";
import { despachar, enfileirar, type Canal } from "./envios.js";
import { colecaoLembretes, processarVencidos } from "./lembretes.js";
import { resumosDevidos, textoDoAviso, textoDoResumo } from "./resumo.js";

/**
 * Um "tique" do relógio: transforma lembretes vencidos e resumos diários em envios na fila
 * e tenta entregar a fila. A fila é gravada ANTES de marcar o lembrete como avisado:
 * se o processo cair no meio, no pior caso o aviso sai duplicado, nunca perdido.
 */
export async function tique(config: Config, canais: Canal[], agora: () => Date): Promise<void> {
  const t = agora();

  colecaoLembretes(config).transacao((lembretes) => {
    const { lembretes: atualizados, avisos } = processarVencidos(lembretes, t, config.fuso);
    for (const a of avisos) {
      const texto = textoDoAviso(a, config, t);
      for (const para of a.lembrete.para) enfileirar(config, para, texto, t, `Deck One: ${a.lembrete.texto}`);
    }
    return { itens: atualizados, resultado: undefined };
  });

  for (const u of resumosDevidos(config, t)) {
    enfileirar(config, u.id, textoDoResumo(config, u, t), t, "Deck One: seu resumo do dia");
  }

  await despachar(config, canais, agora);
}

export function iniciarAgendador(config: Config, canais: Canal[], agora: () => Date = () => new Date(), intervaloMs = 20_000) {
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await tique(config, canais, agora);
    } catch (e) {
      console.error(`[agendador] ${e instanceof Error ? e.message : e}`);
    } finally {
      rodando = false;
    }
  };
  void rodar();
  const timer = setInterval(rodar, intervaloMs);
  return () => clearInterval(timer);
}
