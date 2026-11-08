import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { carregarConfig } from "../src/config.js";
import { salvarNota, buscarNotas } from "../src/tools/notas.js";
import { criarLembrete, lembretesVencidos } from "../src/tools/lembretes.js";
import { lerDocumento } from "../src/tools/conhecimento.js";
import { lerSkill } from "../src/skills.js";
import type { Contexto } from "../src/tools/tipos.js";

function ctxTemp(agora = new Date("2026-11-08T12:00:00Z")): Contexto {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-"));
  fs.mkdirSync(path.join(dir, "conhecimento"));
  const config = carregarConfig({ DECK_DADOS: path.join(dir, "dados"), DECK_CONHECIMENTO: path.join(dir, "conhecimento") });
  return { config, agora: () => agora };
}

test("salva e encontra nota ignorando acentos", () => {
  const ctx = ctxTemp();
  salvarNota.executar({ titulo: "Fornecedor de papel", conteudo: "Contato: João, prazo 30 dias", tags: ["Compras"] }, ctx);
  const achadas = buscarNotas.executar({ termo: "joao" }, ctx) as any[];
  assert.equal(achadas.length, 1);
  assert.deepEqual(achadas[0].tags, ["compras"]);
  assert.equal((buscarNotas.executar({ termo: "inexistente" }, ctx) as any[]).length, 0);
});

test("lembrete vencido é avisado uma única vez", () => {
  const ctx = ctxTemp();
  criarLembrete.executar({ texto: "Pagar boleto", quando: "2026-11-08T08:00:00-03:00" }, ctx);
  criarLembrete.executar({ texto: "Reunião", quando: "2026-11-20T08:00:00-03:00" }, ctx);
  assert.deepEqual(lembretesVencidos(ctx).map((l) => l.texto), ["Pagar boleto"]);
  assert.equal(lembretesVencidos(ctx).length, 0);
});

test("rejeita data inválida", () => {
  assert.ok((criarLembrete.executar({ texto: "x", quando: "amanhã" }, ctxTemp()) as any).erro);
});

test("não lê fora da pasta de conhecimento", () => {
  assert.throws(() => lerDocumento.executar({ caminho: "../dados/notas.json" }, ctxTemp()), /Acesso negado/);
});

test("lê skill com cabeçalho", () => {
  const s = lerSkill(path.resolve("skills/registro-de-reuniao.md"));
  assert.equal(s?.nome, "registro-de-reuniao");
});
