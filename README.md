# Deck One 🃏

Assistente pessoal **autônomo** da empresa: guarda as informações organizadas em grupos, cria
lembretes que **nunca falham** e conversa pelo **terminal** ou pelo **WhatsApp**. O "cérebro" é a
API da OpenAI, que decide sozinha quais ferramentas usar para cumprir cada pedido.

> v0.2: Fase 1 do [roadmap](docs/roadmap.md), feita a partir das respostas do [questionário](docs/questionario.md).

## O que ele faz

- **Memória por grupos**: clientes e fornecedores · processos e reuniões · financeiro · projetos, tarefas e ideias.
- **Equipe**: várias pessoas, e o financeiro só aparece para quem tem acesso.
- **Lembretes**: pontuais, recorrentes ("todo dia 5", "toda segunda e quarta"), com aviso antecipado ("3 dias antes").
- **Resumo diário** no horário de cada pessoa.
- **Avisos por WhatsApp e e-mail**, com fila e novas tentativas. Se o PC estava desligado, avisa o que passou assim que liga.
- **Iniciativa**: você cita um vencimento e ele já cria o lembrete, e avisa que criou.
- **Segurança**: apagar e mexer no financeiro sempre pedem confirmação, e os dados podem ser criptografados.

## Instalação (Windows / PowerShell)

Requer **Node.js 20+** ([nodejs.org](https://nodejs.org)) e uma chave da API da OpenAI.

```powershell
git clone https://github.com/Victor1Paim/Barra-Deck---Bot-1-.git deck-one
cd deck-one
npm install
copy .env.example .env
copy deck.config.example.json deck.config.json
```

1. No `.env`, coloque a `OPENAI_API_KEY`.
2. Gere a chave de criptografia com `npm run dev -- gerar-chave`, cole no `.env` e **guarde uma cópia fora do PC**.
3. No `deck.config.json`, preencha a empresa, a equipe (WhatsApp com DDI+DDD, só números) e quem vê o financeiro (`"grupos": ["*"]` = tudo).

## Uso

| Comando | O que faz |
|---|---|
| `npm run dev` | Conversa no terminal (`/hoje`, `/limpar`, `/sair`) |
| `npm run dev -- "pedido"` | Um pedido só, sem abrir a conversa |
| `npm run servico` | **Deixe rodando.** Dispara lembretes e resumos e liga o WhatsApp |

Exemplos:
- "o fornecedor de papel é a Gráfica Sol, contato Marta (11) 99999-0000"
- "todo dia 5 às 9h lembrar a Ana e eu de pagar o aluguel, avisando 2 dias antes"
- "o que combinamos com a Gráfica Sol?"

### WhatsApp

1. Em `deck.config.json`, coloque `"canais": { "whatsapp": { "ativo": true } }`.
2. Rode `npm run servico` e escaneie o QR Code com o WhatsApp **do número do bot**
   (Configurações → Aparelhos conectados → Conectar aparelho).
3. A equipe cadastrada manda mensagem para esse número e conversa com o Deck One. Quem não está cadastrado é ignorado.

> ⚠️ Usa uma biblioteca **não oficial** (Baileys). Use um **chip secundário** só para o bot:
> o WhatsApp pode banir números que usam clientes não oficiais.

### E-mail

Preencha `SMTP_*` no `.env` e ative `"email": { "ativo": true }` no `deck.config.json`.
No Gmail, use uma [senha de app](https://myaccount.google.com/apppasswords).

## Permissões (`DECK_MODO`)

| Modo | Criar | Editar | Apagar / financeiro |
|---|---|---|---|
| `misto` (padrão) | sozinho | confirma | **sempre confirma** |
| `perguntar` | confirma | confirma | **sempre confirma** |
| `auto` | sozinho | sozinho | **sempre confirma** |
| `leitura` | bloqueado | bloqueado | bloqueado |

## Privacidade

- `dados/`, o conteúdo de `conhecimento/`, `deck.config.json` e `.env` ficam **fora do Git**.
- Com `DECK_CHAVE_DADOS`, notas, lembretes e a fila de envios ficam criptografados (AES-256-GCM).
- As conversas passam pela API da OpenAI.

## Skills

Arquivos `.md` em `skills/` ensinam tarefas específicas. Veja [`skills/README.md`](skills/README.md).

## Estrutura

```
src/
  index.ts          comandos (conversa, serviço, iniciar, gerar-chave)
  agente.ts         ciclo do agente: modelo → ferramentas → modelo
  prompt.ts         personalidade e regras
  sessoes.ts        um agente por pessoa no WhatsApp + confirmações
  lembretes.ts      recorrência, antecedência, avisos vencidos
  envios.ts         fila de entrega com novas tentativas
  agendador.ts      relógio do serviço
  resumo.ts         textos de aviso e resumo diário
  config.ts         .env + deck.config.json (empresa, grupos, equipe)
  cripto.ts         criptografia dos dados
  armazenamento.ts  coleções JSON com trava entre processos
  canais/           whatsapp, email, console
  tools/            ferramentas do agente (notas, lembretes, conhecimento)
skills/  conhecimento/  docs/  test/
```

## Desenvolvimento

```powershell
npm run typecheck
npm test
```

## Licença

[MIT](LICENSE)
