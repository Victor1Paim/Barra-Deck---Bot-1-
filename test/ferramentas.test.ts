import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { salvarNota, buscarNotas, editarNota, apagarNota, colecaoNotas } from "../src/tools/notas.js";
import { criarLembrete, listarLembretes } from "../src/tools/lembretes.js";
import { lerDocumento } from "../src/tools/conhecimento.js";
import { precisaConfirmar } from "../src/tools/tipos.js";
import { lerSkill } from "../src/skills.js";
import { mesmoNumero } from "../src/canais/whatsapp.js";
import { configTemp, ctx, VICTOR, ANA } from "./ajuda.js";

test("nota vai para o grupo e é achada ignorando acentos", () => {
  const c = ctx(configTemp(), VICTOR);
  salvarNota.executar({ grupo: "clientes", titulo: "Fornecedor de papel", conteudo: "Contato: João", tags: ["Gráfica Sol"] }, c);
  const achadas = buscarNotas.executar({ termo: "joao" }, c) as any[];
  assert.equal(achadas.length, 1);
  assert.equal(achadas[0].autor, "victor");
  assert.deepEqual(achadas[0].tags, ["grafica sol"]);
  assert.ok((salvarNota.executar({ grupo: "inventado", titulo: "a", conteudo: "b" }, c) as any).erro);
});

test("financeiro é invisível para quem não tem acesso", () => {
  const config = configTemp();
  const v = ctx(config, VICTOR);
  const a = ctx(config, ANA);
  const nota = salvarNota.executar({ grupo: "financeiro", titulo: "Conta de luz", conteudo: "R$ 800" }, v) as any;
  salvarNota.executar({ grupo: "processos", titulo: "Conta como fechar caixa", conteudo: "..." }, v);
  assert.deepEqual((buscarNotas.executar({ termo: "conta" }, a) as any[]).map((n) => n.grupo), ["processos"]);
  assert.ok((editarNota.executar({ id: nota.id, conteudo: "R$ 0" }, a) as any).erro);
  assert.ok((apagarNota.executar({ id: nota.id }, a) as any).erro);
  assert.ok((salvarNota.executar({ grupo: "financeiro", titulo: "x", conteudo: "y" }, a) as any).erro);
  assert.equal(colecaoNotas(v).ler().find((n) => n.id === nota.id)!.conteudo, "R$ 800");
});

test("confirmações: apagar e financeiro sempre; editar no modo misto; criar nunca", () => {
  const config = configTemp({ DECK_MODO: "auto" });
  const c = ctx(config, VICTOR);
  const fin = salvarNota.executar({ grupo: "financeiro", titulo: "Boleto", conteudo: "R$ 1" }, c) as any;
  const proc = salvarNota.executar({ grupo: "processos", titulo: "P", conteudo: "p" }, c) as any;
  assert.equal(precisaConfirmar(apagarNota, { id: proc.id }, c), true);
  assert.equal(precisaConfirmar(editarNota, { id: fin.id }, c), true, "financeiro mesmo no auto");
  assert.equal(precisaConfirmar(editarNota, { id: proc.id }, c), false);
  config.modo = "misto";
  assert.equal(precisaConfirmar(editarNota, { id: proc.id }, c), true);
  assert.equal(precisaConfirmar(salvarNota, {}, c), false);
  config.modo = "perguntar";
  assert.equal(precisaConfirmar(salvarNota, {}, c), true);
});

test("criar_lembrete com recorrência, antecedência e destinatários", () => {
  const config = configTemp();
  const c = ctx(config, VICTOR);
  const r = criarLembrete.executar(
    {
      texto: "Pagar aluguel",
      quando: "2026-12-05T09:00:00-03:00",
      recorrencia: { tipo: "mensal" },
      avisarAntes: [{ quantidade: 3, unidade: "dias" }],
      para: ["victor", "ana"],
    },
    c,
  ) as any;
  assert.deepEqual(r.antecedenciasMin, [4320]);
  assert.equal((listarLembretes.executar({}, ctx(config, ANA)) as any[]).length, 1);
  assert.ok((criarLembrete.executar({ texto: "x", quando: "amanhã" }, c) as any).erro);
  assert.ok((criarLembrete.executar({ texto: "x", quando: "2020-01-01T00:00:00Z" }, c) as any).erro);
  assert.ok((criarLembrete.executar({ texto: "x", quando: "2026-12-01T00:00:00Z", para: ["fulano"] }, c) as any).erro);
});

test("dados criptografados: arquivo ilegível sem a chave", () => {
  const config = configTemp({ DECK_CHAVE_DADOS: "segredo-de-teste" });
  const c = ctx(config, VICTOR);
  salvarNota.executar({ grupo: "clientes", titulo: "CNPJ do cliente", conteudo: "12.345.678/0001-90" }, c);
  const bruto = fs.readFileSync(path.join(config.pastaDados, "notas.json"), "utf8");
  assert.ok(!bruto.includes("12.345.678"));
  assert.equal((buscarNotas.executar({ termo: "cnpj" }, c) as any[]).length, 1);
  config.chaveDados = "";
  assert.throws(() => buscarNotas.executar({}, c), /DECK_CHAVE_DADOS/);
  config.chaveDados = "chave-errada";
  assert.throws(() => buscarNotas.executar({}, c), /errada/);
});

test("não lê fora da pasta de conhecimento", () => {
  assert.throws(() => lerDocumento.executar({ caminho: "../dados/notas.json" }, ctx(configTemp(), VICTOR)), /Acesso negado/);
});

test("lê skill com cabeçalho", () => {
  assert.equal(lerSkill(path.resolve("skills/registro-de-reuniao/SKILL.md"))?.nome, "registro-de-reuniao");
});

test("número de WhatsApp com e sem o 9º dígito", () => {
  assert.ok(mesmoNumero("5511987654321", "551187654321"));
  assert.ok(mesmoNumero("+55 (11) 98765-4321", "5511987654321"));
  assert.ok(!mesmoNumero("5511987654321", "5511987654322"));
});
