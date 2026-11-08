#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import OpenAI from "openai";
import { carregarConfig } from "./config.js";
import { Agente } from "./agente.js";
import { ferramentasBase } from "./tools/index.js";
import { lembretesVencidos } from "./tools/lembretes.js";
import { carregarSkills, ferramentaSkill } from "./skills.js";
import { promptDoSistema } from "./prompt.js";
import type { Contexto } from "./tools/tipos.js";

const cor = {
  cinza: (s: string) => `\x1b[90m${s}\x1b[0m`,
  ciano: (s: string) => `\x1b[36m${s}\x1b[0m`,
  amarelo: (s: string) => `\x1b[33m${s}\x1b[0m`,
  negrito: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function main() {
  const config = carregarConfig();
  if (!config.apiKey) {
    console.error("Falta OPENAI_API_KEY. Copie .env.example para .env e preencha a chave.");
    process.exit(1);
  }

  const ctx: Contexto = { config, agora: () => new Date() };
  const skills = carregarSkills(config.pastaSkills);
  const ferramentas = skills.length ? [...ferramentasBase, ferramentaSkill(skills)] : ferramentasBase;
  const rl = readline.createInterface({ input, output });

  const agente = new Agente(
    new OpenAI({ apiKey: config.apiKey }),
    ctx,
    ferramentas,
    () => promptDoSistema(config, skills, ctx.agora()),
    async (f, args) => {
      const r = await rl.question(cor.amarelo(`  Permitir ${f.nome} ${JSON.stringify(args)}? [s/N] `));
      return /^s(im)?$/i.test(r.trim());
    },
    { aoChamarFerramenta: (nome) => console.log(cor.cinza(`  · ${nome}`)) },
  );

  const avisarLembretes = () => {
    for (const l of lembretesVencidos(ctx)) {
      const hora = new Date(l.quando).toLocaleString("pt-BR", { timeZone: config.fuso });
      console.log(cor.amarelo(`\n⏰ Lembrete (${hora}): ${l.texto}  [${l.id}]`));
    }
  };

  // Pedido único: deck-one "lembre-me amanhã às 9h de pagar o fornecedor"
  const pedido = process.argv.slice(2).join(" ").trim();
  if (pedido) {
    avisarLembretes();
    console.log(await agente.conversar(pedido));
    rl.close();
    return;
  }

  console.log(cor.negrito("Deck One") + cor.cinza(`  · modelo ${config.modelo} · modo ${config.modo}`));
  console.log(cor.cinza("Comandos: /limpar (nova conversa), /sair. Skills: " + (skills.map((s) => s.nome).join(", ") || "nenhuma")));
  avisarLembretes();
  const timer = setInterval(avisarLembretes, 30_000);

  try {
    while (true) {
      const texto = (await rl.question(cor.ciano("\nvocê › "))).trim();
      if (!texto) continue;
      if (texto === "/sair") break;
      if (texto === "/limpar") {
        agente.limpar();
        console.log(cor.cinza("Conversa reiniciada."));
        continue;
      }
      try {
        const resposta = await agente.conversar(texto);
        console.log(`\n${cor.negrito("deck one ›")} ${resposta}`);
      } catch (e) {
        console.error(cor.amarelo(`Erro: ${e instanceof Error ? e.message : e}`));
      }
    }
  } finally {
    clearInterval(timer);
    rl.close();
  }
}

main().catch((e) => {
  console.error(cor.amarelo(`Erro: ${e instanceof Error ? e.message : e}`));
  process.exit(1);
});
