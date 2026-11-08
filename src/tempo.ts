/** Utilitários de data no fuso da empresa (sem dependências externas). */

export interface Partes {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

const formatadores = new Map<string, Intl.DateTimeFormat>();
function fmt(fuso: string) {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

const SEMANA = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function partesLocais(d: Date, fuso: string): Partes {
  const p = Object.fromEntries(fmt(fuso).formatToParts(d).map((x) => [x.type, x.value]));
  return {
    ano: +p.year,
    mes: +p.month,
    dia: +p.day,
    hora: +p.hour,
    minuto: +p.minute,
    diaSemana: SEMANA.indexOf(p.weekday),
  };
}

/** Converte um horário "de parede" no fuso para um instante UTC. */
export function deLocal(ano: number, mes: number, dia: number, hora: number, minuto: number, fuso: string): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  // Ajusta pelo deslocamento do fuso (duas passadas cobrem mudança de horário de verão).
  let t = palpite;
  for (let i = 0; i < 2; i++) {
    const p = partesLocais(new Date(t), fuso);
    const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
    t += palpite - comoUtc;
  }
  return new Date(t);
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Data local AAAA-MM-DD. */
export function dataLocal(d: Date, fuso: string): string {
  const p = partesLocais(d, fuso);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

export function formatarData(d: Date, fuso: string): string {
  return d.toLocaleString("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatarDuracao(minutos: number): string {
  if (minutos % 1440 === 0) return `${minutos / 1440} dia${minutos === 1440 ? "" : "s"}`;
  if (minutos % 60 === 0) return `${minutos / 60} hora${minutos === 60 ? "" : "s"}`;
  return `${minutos} minutos`;
}
