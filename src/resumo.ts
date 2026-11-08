import path from "node:path";
import { Colecao } from "./armazenamento.js";
import { destinatarios, podeVerGrupo, podeVerUnidade, type Config, type Usuario } from "./config.js";
import { colecaoLembretes, type Aviso, type Lembrete } from "./lembretes.js";
import { dataLocal, formatarData, formatarDuracao, partesLocais } from "./tempo.js";

interface EstadoResumo {
  id: string; // id do usuário
  ultimo: string; // AAAA-MM-DD
}

const colecaoResumos = (config: Config) =>
  new Colecao<EstadoResumo>(path.join(config.pastaDados, "resumos.json"), config.chaveDados);

export function textoDoAviso(a: Aviso, config: Config, agora: Date): string {
  const quando = formatarData(a.ocorrencia, config.fuso);
  if (a.minutosAntes > 0) {
    const faltam = Math.max(1, Math.round((a.ocorrencia.getTime() - agora.getTime()) / 60_000));
    return `⏳ Faltam ${formatarDuracao(arredondar(faltam))}: *${a.lembrete.texto}*\n📅 ${quando}`;
  }
  let t = `⏰ Lembrete: *${a.lembrete.texto}*`;
  if (a.atrasado) t += `\n⚠️ Era para ${quando} (eu estava desligado e só consegui avisar agora).`;
  if (a.lembrete.recorrencia && !a.lembrete.disparado) t += `\n🔁 Próxima vez: ${formatarData(new Date(a.lembrete.quando), config.fuso)}`;
  return t;
}

/** Arredonda para a unidade mais legível (evita "faltam 4319 minutos"). */
function arredondar(min: number): number {
  if (min >= 1440) return Math.round(min / 1440) * 1440;
  if (min >= 60) return Math.round(min / 60) * 60;
  return min;
}

function doUsuario(config: Config, u: Usuario, l: Lembrete) {
  return !l.concluido && l.para.includes(u.id) && (!l.grupo || podeVerGrupo(config, u, l.grupo)) && podeVerUnidade(u, l.unidade);
}

export function textoDoResumo(config: Config, u: Usuario, agora: Date): string {
  const hoje = dataLocal(agora, config.fuso);
  const em3dias = agora.getTime() + 3 * 86_400_000;
  const todos = colecaoLembretes(config).ler().filter((l) => doUsuario(config, u, l));
  const atrasados = todos.filter((l) => l.disparado);
  const deHoje = todos.filter((l) => !l.disparado && dataLocal(new Date(l.quando), config.fuso) === hoje);
  const proximos = todos.filter((l) => {
    const t = new Date(l.quando).getTime();
    return !l.disparado && dataLocal(new Date(l.quando), config.fuso) !== hoje && t > agora.getTime() && t <= em3dias;
  });
  const linha = (l: Lembrete) => `• ${formatarData(new Date(l.quando), config.fuso)} — ${l.texto}`;
  const ordenar = (ls: Lembrete[]) => [...ls].sort((a, b) => a.quando.localeCompare(b.quando));

  const h = partesLocais(agora, config.fuso).hora;
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const partes = [u.whatsappGrupo ? `☀️ ${saudacao}, pessoal do ${u.nome}! Resumo de hoje:` : `☀️ ${saudacao}, ${u.nome}! Seu resumo de hoje:`];
  if (deHoje.length) partes.push(`\n*Hoje*\n${ordenar(deHoje).map(linha).join("\n")}`);
  if (atrasados.length) partes.push(`\n*Pendentes (já passaram)*\n${ordenar(atrasados).map(linha).join("\n")}`);
  if (proximos.length) partes.push(`\n*Próximos 3 dias*\n${ordenar(proximos).map(linha).join("\n")}`);
  if (partes.length === 1) partes.push("Nada marcado pra hoje nem pros próximos dias. Dia livre! 🎉");
  return partes.join("\n");
}

/** Usuários cujo resumo diário já deve sair hoje (e ainda não saiu). Marca como enviado. */
export function resumosDevidos(config: Config, agora: Date): Usuario[] {
  const hoje = dataLocal(agora, config.fuso);
  const p = partesLocais(agora, config.fuso);
  const minutoAgora = p.hora * 60 + p.minuto;
  return colecaoResumos(config).transacao((estado) => {
    const devidos = destinatarios(config).filter((u) => {
      const m = u.resumoDiario?.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return false;
      const ja = estado.find((e) => e.id === u.id)?.ultimo === hoje;
      return !ja && minutoAgora >= +m[1] * 60 + +m[2];
    });
    const ids = new Set(devidos.map((u) => u.id));
    const itens = [...estado.filter((e) => !ids.has(e.id)), ...devidos.map((u) => ({ id: u.id, ultimo: hoje }))];
    return { itens, resultado: devidos };
  });
}
