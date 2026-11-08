import { test } from "node:test";
import assert from "node:assert/strict";
import { novoLembrete, processarVencidos, proximaOcorrencia, colecaoLembretes } from "../src/lembretes.js";
import { despachar, enfileirar, colecaoEnvios, type Canal } from "../src/envios.js";
import { tique } from "../src/agendador.js";
import { resumosDevidos } from "../src/resumo.js";
import { configTemp, VICTOR } from "./ajuda.js";

const FUSO = "America/Sao_Paulo";
const config = configTemp();
const local = (s: string) => new Date(`${s}-03:00`);

function lemb(quando: string, extra: Partial<Parameters<typeof novoLembrete>[0]> = {}, criado = "2026-01-01T00:00") {
  return novoLembrete({ texto: "x", autor: "victor", para: ["victor"], quando: local(quando), ...extra }, config, local(criado));
}

test("mensal no dia 31 não escorrega: jan 31 → fev 28 → mar 31", () => {
  const l = lemb("2026-01-31T09:00", { recorrencia: { tipo: "mensal" } });
  const fev = proximaOcorrencia(l, new Date(l.quando), FUSO)!;
  assert.equal(fev.toISOString(), local("2026-02-28T09:00").toISOString());
  assert.equal(proximaOcorrencia(l, fev, FUSO)!.toISOString(), local("2026-03-31T09:00").toISOString());
});

test("semanal em segunda e quarta", () => {
  // 2026-11-09 é segunda-feira
  const l = lemb("2026-11-09T08:30", { recorrencia: { tipo: "semanal", diasSemana: [1, 3] } });
  const qua = proximaOcorrencia(l, new Date(l.quando), FUSO)!;
  assert.equal(qua.toISOString(), local("2026-11-11T08:30").toISOString());
  assert.equal(proximaOcorrencia(l, qua, FUSO)!.toISOString(), local("2026-11-16T08:30").toISOString());
});

test("quinzenal (a cada 2 semanas)", () => {
  const l = lemb("2026-11-09T08:30", { recorrencia: { tipo: "semanal", intervalo: 2 } });
  assert.equal(proximaOcorrencia(l, new Date(l.quando), FUSO)!.toISOString(), local("2026-11-23T08:30").toISOString());
});

test("recorrência respeita data final", () => {
  const l = lemb("2026-11-09T08:00", { recorrencia: { tipo: "diaria", ate: local("2026-11-10T12:00").toISOString() } });
  const ter = proximaOcorrencia(l, new Date(l.quando), FUSO)!;
  assert.equal(proximaOcorrencia(l, ter, FUSO), undefined);
});

test("pontual: avisa uma vez na hora e fica como atrasado", () => {
  const l = lemb("2026-11-10T09:00");
  assert.equal(processarVencidos([l], local("2026-11-10T08:59"), FUSO).avisos.length, 0);
  const r = processarVencidos([l], local("2026-11-10T09:00"), FUSO);
  assert.equal(r.avisos.length, 1);
  assert.equal(r.avisos[0].atrasado, false);
  assert.equal(r.lembretes[0].disparado, true);
  assert.equal(processarVencidos(r.lembretes, local("2026-11-10T10:00"), FUSO).avisos.length, 0);
});

test("antecedência de 3 dias e 1 hora, cada uma uma vez só", () => {
  const l = lemb("2026-11-15T10:00", { antecedencias: [4320, 60] });
  let ls = [l];
  const em = (t: string) => {
    const r = processarVencidos(ls, local(t), FUSO);
    ls = r.lembretes;
    return r.avisos.map((a) => a.minutosAntes);
  };
  assert.deepEqual(em("2026-11-12T09:59"), []);
  assert.deepEqual(em("2026-11-12T10:00"), [4320]);
  assert.deepEqual(em("2026-11-13T10:00"), []);
  assert.deepEqual(em("2026-11-15T09:00"), [60]);
  assert.deepEqual(em("2026-11-15T10:00"), [0]);
});

test("antecedência que já tinha passado na criação não é avisada", () => {
  const l = lemb("2026-11-10T10:00", { antecedencias: [4320] }, "2026-11-09T10:00");
  assert.deepEqual(processarVencidos([l], local("2026-11-09T10:01"), FUSO).avisos, []);
});

test("PC desligado 5 dias: diário avisa uma vez (atrasado) e pula para a próxima futura", () => {
  const l = lemb("2026-11-01T09:00", { recorrencia: { tipo: "diaria" } });
  const r = processarVencidos([l], local("2026-11-05T14:00"), FUSO);
  assert.equal(r.avisos.length, 1);
  assert.equal(r.avisos[0].atrasado, true);
  assert.equal(r.avisos[0].ocorrencia.toISOString(), local("2026-11-05T09:00").toISOString());
  assert.equal(r.lembretes[0].quando, local("2026-11-06T09:00").toISOString());
  assert.equal(r.lembretes[0].disparado, false);
});

test("fila de envios: falha, tenta de novo depois e entrega", async () => {
  const c = configTemp();
  let falhar = true;
  const recebidos: string[] = [];
  const canal: Canal = {
    nome: "teste",
    atende: () => true,
    async enviar(_u, t) {
      if (falhar) throw new Error("sem internet");
      recebidos.push(t);
    },
  };
  let agora = local("2026-11-10T09:00");
  enfileirar(c, "victor", "oi", agora);
  assert.equal(await despachar(c, [canal], () => agora), 0);
  assert.match(colecaoEnvios(c).ler()[0].ultimoErro!, /sem internet/);
  falhar = false;
  assert.equal(await despachar(c, [canal], () => agora), 0, "ainda não é hora de tentar de novo");
  agora = new Date(agora.getTime() + 61_000);
  assert.equal(await despachar(c, [canal], () => agora), 1);
  assert.deepEqual(recebidos, ["oi"]);
  assert.equal(colecaoEnvios(c).ler()[0].concluido, true);
});

test("tique: lembrete vencido vira mensagem entregue para todos os destinatários", async () => {
  const c = configTemp();
  c.empresa.usuarios = c.empresa.usuarios.map((u) => ({ ...u, resumoDiario: undefined }));
  const agora = local("2026-11-10T09:00");
  colecaoLembretes(c).adicionar(
    novoLembrete({ texto: "Pagar aluguel", autor: "victor", para: ["victor", "ana"], quando: agora }, c, local("2026-11-01T00:00")),
  );
  const recebidos: string[] = [];
  const canal: Canal = { nome: "t", atende: () => true, enviar: async (u, t) => void recebidos.push(`${u.id}:${t}`) };
  await tique(c, [canal], () => agora);
  await tique(c, [canal], () => agora);
  assert.equal(recebidos.length, 2);
  assert.ok(recebidos.every((r) => r.includes("Pagar aluguel")));
});

test("resumo diário sai uma vez por dia, depois do horário", () => {
  const c = configTemp();
  assert.deepEqual(resumosDevidos(c, local("2026-11-10T07:59")), []);
  assert.deepEqual(resumosDevidos(c, local("2026-11-10T08:00")).map((u) => u.id), ["victor", "ana"]);
  assert.deepEqual(resumosDevidos(c, local("2026-11-10T20:00")), []);
  assert.equal(resumosDevidos(c, local("2026-11-11T09:30")).length, 2, "PC ligado tarde: sai assim que liga");
  void VICTOR;
});
