#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buscarUsuario, carregarConfig, empresaPadrao, type Config } from "./config.js";
import { gerarChave } from "./cripto.js";
import { criarAgente, SessoesWhatsApp } from "./sessoes.js";
import { iniciarAgendador } from "./agendador.js";
import { canalEmail } from "./canais/email.js";
import { canalConsole } from "./canais/console.js";
import { WhatsApp } from "./canais/whatsapp.js";
import type { Canal } from "./envios.js";
import { textoDoResumo } from "./resumo.js";

const cor = {
  cinza: (s: string) => `\x1b[90m${s}\x1b[0m`,
  ciano: (s: string) => `\x1b[36m${s}\x1b[0m`,
  amarelo: (s: string) => `\x1b[33m${s}\x1b[0m`,
  negrito: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const AJUDA = `Deck One — assistente pessoal da empresa

Uso:
  deck-one                    conversa no terminal
  deck-one "pedido"           faz um pedido só e sai
  deck-one servico            liga lembretes, resumo diário e WhatsApp (deixe rodando)
  deck-one iniciar            cria o deck.config.json (empresa, grupos, equipe)
  deck-one gerar-chave        gera uma chave para criptografar os dados

Variável DECK_USUARIO escolhe quem está usando o terminal (padrão: o primeiro admin).`;

function exigirChaveApi(config: Config) {
  if (!config.apiKey || config.apiKey === "sk-..." || !config.apiKey.startsWith("sk-")) {
    console.error(
      "Falta a chave da OpenAI.\n" +
        "1. Abra o arquivo .env (no PowerShell: notepad .env)\n" +
        "2. Na linha OPENAI_API_KEY= coloque sua chave (começa com sk-), sem espaços nem aspas\n" +
        "3. Salve e rode de novo.\n" +
        "Nunca cole a chave na conversa: ela vai para o histórico.",
    );
    process.exit(1);
  }
}

async function conversar(config: Config, pedido: string) {
  exigirChaveApi(config);
  const usuario = buscarUsuario(config, process.env.DECK_USUARIO);
  const rl = readline.createInterface({ input, output });
  const agente = criarAgente(
    config,
    usuario,
    "terminal",
    async (pergunta) => /^s(im)?$/i.test((await rl.question(cor.amarelo(`  🤔 ${pergunta} [s/N] `))).trim()),
    (nome) => console.log(cor.cinza(`  · ${nome}`)),
  );

  try {
    if (pedido) {
      console.log(await agente.conversar(pedido));
      return;
    }
    console.log(cor.negrito("Deck One 🃏") + cor.cinza(`  · ${usuario.nome} · modelo ${config.modelo} · modo ${config.modo}`));
    console.log(cor.cinza("Comandos: /hoje, /limpar, /sair"));
    console.log(cor.cinza(textoDoResumo(config, usuario, new Date()).replace(/\*/g, "")));

    while (true) {
      const texto = (await rl.question(cor.ciano("\nvocê › "))).trim();
      if (!texto) continue;
      if (texto === "/sair") break;
      if (texto === "/hoje") {
        console.log(textoDoResumo(config, usuario, new Date()).replace(/\*/g, ""));
        continue;
      }
      if (texto === "/limpar") {
        agente.limpar();
        console.log(cor.cinza("Conversa reiniciada (notas e lembretes continuam salvos)."));
        continue;
      }
      if (/\bsk-[A-Za-z0-9_-]{20,}/.test(texto)) {
        console.log(cor.amarelo("⚠️ Isso parece uma chave da OpenAI. Não mandei para ninguém. Coloque no arquivo .env (notepad .env) e revogue esta chave se ela já foi colada em algum lugar."));
        continue;
      }
      try {
        console.log(`\n${cor.negrito("deck one ›")} ${await agente.conversar(texto)}`);
      } catch (e) {
        console.error(cor.amarelo(`Erro: ${e instanceof Error ? e.message : e}`));
      }
    }
  } finally {
    rl.close();
  }
}

/** Impede dois serviços ao mesmo tempo (avisos duplicados e sessão do WhatsApp brigando). */
function travarServico(config: Config) {
  fs.mkdirSync(config.pastaDados, { recursive: true });
  const arquivo = path.join(config.pastaDados, "servico.pid");
  if (fs.existsSync(arquivo)) {
    const pid = Number(fs.readFileSync(arquivo, "utf8"));
    try {
      process.kill(pid, 0);
      console.error(`O serviço já está rodando (pid ${pid}).`);
      process.exit(1);
    } catch {}
  }
  fs.writeFileSync(arquivo, String(process.pid));
  const soltar = () => fs.rmSync(arquivo, { force: true });
  process.on("exit", soltar);
  for (const s of ["SIGINT", "SIGTERM"] as const) process.on(s, () => process.exit(0));
}

async function servico(config: Config) {
  travarServico(config);
  const canais: Canal[] = [canalConsole];
  const email = canalEmail(config);
  if (email) canais.push(email);

  if (config.empresa.canais.whatsapp.ativo) {
    exigirChaveApi(config);
    let wa: WhatsApp;
    const sessoes = new SessoesWhatsApp(config, (u, t) => wa.enviar(u, t));
    wa = new WhatsApp(config, sessoes);
    canais.push(wa);
    await wa.conectar();
  }

  const nomes = canais.map((c) => c.nome).join(", ");
  console.log(cor.negrito("Deck One 🃏 serviço ligado") + cor.cinza(` · canais: ${nomes} · Ctrl+C para parar`));
  if (!email && !config.empresa.canais.whatsapp.ativo) {
    console.log(cor.amarelo("Nenhum canal externo ativo: os avisos aparecem só nesta janela. Veja deck.config.json → canais."));
  }
  iniciarAgendador(config, canais);
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);

  if (comando === "ajuda" || comando === "--help" || comando === "-h") return console.log(AJUDA);
  if (comando === "gerar-chave") {
    console.log(`Coloque no .env (e guarde uma cópia em lugar seguro — sem ela os dados não abrem):\n\nDECK_CHAVE_DADOS=${gerarChave()}`);
    return;
  }
  if (comando === "iniciar") {
    const arquivo = path.resolve(process.env.DECK_CONFIG ?? "deck.config.json");
    if (fs.existsSync(arquivo)) return console.log(`${arquivo} já existe.`);
    fs.writeFileSync(arquivo, JSON.stringify(empresaPadrao(), null, 2) + "\n");
    return console.log(`Criei ${arquivo}. Edite com o nome da empresa, a equipe e os canais.`);
  }

  const config = carregarConfig();
  if (comando === "servico" || comando === "serviço") return servico(config);
  return conversar(config, [comando, ...resto].filter(Boolean).join(" ").trim());
}

main().catch((e) => {
  console.error(cor.amarelo(`Erro: ${e instanceof Error ? e.message : e}`));
  process.exit(1);
});
