import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarConfig, usuarioDoGrupo, type GrupoWhatsApp } from "../src/config.js";
import { salvarNota, buscarNotas } from "../src/tools/notas.js";
import { criarLembrete, listarLembretes } from "../src/tools/lembretes.js";
import { despachar, enfileirar, type Canal } from "../src/envios.js";
import { chamouBot, limparChamado } from "../src/canais/whatsapp.js";
import { carregarSkills } from "../src/skills.js";
import { configTemp, ctx, VICTOR } from "./ajuda.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOUNGE: GrupoWhatsApp = { jid: "111@g.us", nome: "Equipe Lounge", unidade: "lounge", pastas: ["clientes", "processos"] };
const SOCIOS: GrupoWhatsApp = { jid: "222@g.us", nome: "Sócios", pastas: ["clientes", "financeiro"] };

function config() {
  const c = configTemp();
  c.empresa.unidades = [
    { id: "restaurante", nome: "Barra Deck Restaurante" },
    { id: "lounge", nome: "BD Lounge" },
  ];
  c.empresa.gruposWhatsApp = [LOUNGE, SOCIOS];
  return c;
}

test("grupo do WhatsApp só enxerga as pastas liberadas, independente de quem fala", () => {
  const c = config();
  const v = ctx(c, VICTOR);
  salvarNota.executar({ grupo: "financeiro", titulo: "Conta de luz", conteudo: "R$ 800", unidade: "lounge" }, v);
  salvarNota.executar({ grupo: "projetos", titulo: "Reforma", conteudo: "...", unidade: "lounge" }, v);
  salvarNota.executar({ grupo: "clientes", titulo: "Fornecedor de gelo", conteudo: "...", unidade: "lounge" }, v);
  const lounge = ctx(c, usuarioDoGrupo(LOUNGE));
  assert.deepEqual((buscarNotas.executar({}, lounge) as any[]).map((n) => n.titulo), ["Fornecedor de gelo"]);
  const socios = ctx(c, usuarioDoGrupo(SOCIOS));
  assert.deepEqual((buscarNotas.executar({}, socios) as any[]).map((n) => n.titulo).sort(), ["Conta de luz", "Fornecedor de gelo"]);
  assert.ok((salvarNota.executar({ grupo: "financeiro", titulo: "x", conteudo: "y" }, lounge) as any).erro);
});

test("etiqueta de unidade: grupo do Lounge não vê o Restaurante, mas vê o que é das duas", () => {
  const c = config();
  const v = ctx(c, VICTOR);
  salvarNota.executar({ grupo: "clientes", titulo: "Fornecedor de carne", conteudo: "...", unidade: "restaurante" }, v);
  salvarNota.executar({ grupo: "clientes", titulo: "Fornecedor de bebidas", conteudo: "...", unidade: "todas" }, v);
  const lounge = ctx(c, usuarioDoGrupo(LOUNGE));
  assert.deepEqual((buscarNotas.executar({ grupo: "clientes" }, lounge) as any[]).map((n) => n.titulo), ["Fornecedor de bebidas"]);
  const nova = salvarNota.executar({ grupo: "clientes", titulo: "DJ de sexta", conteudo: "..." }, lounge) as any;
  assert.equal(nova.unidade, "lounge", "no grupo do Lounge, a unidade padrão é lounge");
  assert.ok((salvarNota.executar({ grupo: "clientes", titulo: "x", conteudo: "y", unidade: "restaurante" }, lounge) as any).erro);
  assert.ok((salvarNota.executar({ grupo: "clientes", titulo: "x", conteudo: "y", unidade: "bar" }, v) as any).erro);
  assert.equal((buscarNotas.executar({ unidade: "restaurante" }, v) as any[]).length, 2);
});

test("lembrete criado no grupo é avisado no próprio grupo", async () => {
  const c = config();
  const lounge = ctx(c, usuarioDoGrupo(LOUNGE));
  const r = criarLembrete.executar({ texto: "Conferir estoque de gelo", quando: "2026-12-01T18:00:00-03:00" }, lounge) as any;
  assert.deepEqual(r.para, ["wa:111@g.us"]);
  assert.equal(r.unidade, "lounge");
  assert.equal((listarLembretes.executar({}, lounge) as any[]).length, 1);
  const enviados: string[] = [];
  const canal: Canal = { nome: "whatsapp", atende: (u) => !!u.whatsappGrupo, enviar: async (u) => void enviados.push(u.whatsappGrupo!) };
  enfileirar(c, "wa:111@g.us", "oi", new Date("2026-12-01T21:00:00Z"));
  await despachar(c, [canal], () => new Date("2026-12-01T21:00:00Z"));
  assert.deepEqual(enviados, ["111@g.us"]);
});

test("no grupo, só responde quando chamam o bot", () => {
  const bot = ["5511999990000@s.whatsapp.net", "987654@lid"];
  assert.ok(chamouBot("Deck, quanto custa o gelo?", [], undefined, bot));
  assert.ok(chamouBot("deck one me lembra amanhã", [], undefined, bot));
  assert.ok(chamouBot("@987654 oi", ["987654@lid"], undefined, bot));
  assert.ok(chamouBot("sim", [], "5511999990000@s.whatsapp.net", bot), "respondendo mensagem do bot");
  assert.ok(!chamouBot("o decker chegou?", [], undefined, bot));
  assert.ok(!chamouBot("bom dia pessoal", ["5511000000000@s.whatsapp.net"], undefined, bot));
  assert.equal(limparChamado("Deck, quanto custa o gelo?"), "quanto custa o gelo?");
  assert.equal(limparChamado("@987654 me lembra"), "me lembra");
});

test("config valida pastas e unidades dos grupos do WhatsApp", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-"));
  const arq = path.join(dir, "deck.config.json");
  fs.writeFileSync(arq, JSON.stringify({ unidades: [{ id: "lounge", nome: "BD" }], gruposWhatsApp: [{ jid: "1@g.us", nome: "X", pastas: ["inventada"] }] }));
  assert.throws(() => carregarConfig({ DECK_CONFIG: arq }), /pastas inexistentes/);
  fs.writeFileSync(arq, JSON.stringify({ unidades: [], gruposWhatsApp: [{ jid: "1@g.us", nome: "X", pastas: ["geral"], unidade: "bar" }] }));
  assert.throws(() => carregarConfig({ DECK_CONFIG: arq }), /unidade inexistente/);
  const exemplo = carregarConfig({ DECK_CONFIG: path.resolve("deck.config.example.json") });
  assert.equal(exemplo.empresa.unidades.length, 2);
});

test("skills nos dois formatos (arquivo .md e pasta com SKILL.md)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
  fs.writeFileSync(path.join(dir, "a.md"), "---\nnome: a\ndescricao: skill a\n---\ncorpo a");
  fs.mkdirSync(path.join(dir, "b"));
  fs.writeFileSync(path.join(dir, "b", "SKILL.md"), '---\nname: b\ndescription: "skill b"\n---\ncorpo b');
  const s = carregarSkills(dir);
  assert.deepEqual(s.map((x) => x.nome).sort(), ["a", "b"]);
  assert.equal(s.find((x) => x.nome === "b")!.descricao, "skill b");
});
