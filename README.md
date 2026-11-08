# Deck One

Assistente pessoal **autônomo** de terminal para as informações da empresa. Ele guarda notas,
cria lembretes e consulta documentos internos. O "cérebro" é a API da OpenAI, e o bot decide
sozinho quais ferramentas usar para cumprir cada pedido.

> Status: v0.1, estrutura inicial. Direção do projeto em [`docs/questionario.md`](docs/questionario.md).

## O que ele faz hoje

| Ferramenta | O que faz |
|---|---|
| `salvar_nota`, `buscar_notas`, `editar_nota`, `apagar_nota` | Memória da empresa (clientes, processos, decisões...) |
| `criar_lembrete`, `listar_lembretes`, `concluir_lembrete` | Lembretes com data/hora; avisa no terminal quando vencem |
| `listar_documentos`, `ler_documento` | Lê documentos da pasta `conhecimento/` |
| `carregar_skill` | Carrega instruções de uma skill da pasta `skills/` |

## Instalação

Requer **Node.js 20+** e uma chave da API da OpenAI.

```powershell
git clone https://github.com/Victor1Paim/Barra-Deck---Bot-1-.git deck-one
cd deck-one
npm install
copy .env.example .env   # no Linux/Mac: cp .env.example .env
```

Abra o `.env` e coloque sua `OPENAI_API_KEY`.

## Uso

Conversa interativa (PowerShell ou terminal da IDE):

```powershell
npm run dev
```

Pedido único, sem abrir a conversa:

```powershell
npm run dev -- "lembre-me amanhã às 9h de ligar para o fornecedor"
```

Para usar o comando `deck-one` em qualquer pasta:

```powershell
npm run build
npm link
deck-one
```

Comandos dentro da conversa: `/limpar` (começa do zero) e `/sair`.

## Autonomia e permissões

Defina `DECK_MODO` no `.env`:

- `perguntar` (padrão): faz consultas sozinho e pede confirmação antes de gravar, editar ou apagar.
- `auto`: faz tudo sozinho.
- `leitura`: só consulta, nunca grava.

## Configuração (`.env`)

| Variável | Padrão | |
|---|---|---|
| `OPENAI_API_KEY` | — | obrigatória |
| `OPENAI_MODEL` | `gpt-5.4-mini` | qualquer modelo de chat com suporte a ferramentas |
| `DECK_MODO` | `perguntar` | `perguntar` / `auto` / `leitura` |
| `DECK_DADOS` | `./dados` | onde ficam `notas.json` e `lembretes.json` |
| `DECK_CONHECIMENTO` | `./conhecimento` | documentos que o bot pode ler |
| `DECK_SKILLS` | `./skills` | skills do bot |
| `DECK_FUSO` | `America/Sao_Paulo` | fuso das datas |
| `DECK_MAX_PASSOS` | `12` | limite de passos por pedido |

**Privacidade:** `dados/` e o conteúdo de `conhecimento/` ficam fora do Git, então as informações
da empresa não vão para o repositório público. Lembre que cada conversa é enviada à API da OpenAI.

## Skills

Crie um `.md` em `skills/` com nome e descrição no cabeçalho. Veja [`skills/README.md`](skills/README.md)
e o exemplo [`registro-de-reuniao`](skills/registro-de-reuniao.md).

## Estrutura

```
src/
  index.ts          CLI (conversa, pedido único, aviso de lembretes)
  agente.ts         ciclo do agente: modelo → ferramentas → modelo
  prompt.ts         prompt do sistema (personalidade e regras)
  config.ts         leitura do .env
  skills.ts         carregamento das skills
  armazenamento.ts  coleções em JSON
  tools/            ferramentas (notas, lembretes, conhecimento)
skills/             skills do bot (Markdown)
conhecimento/       documentos da empresa (fora do Git)
docs/               questionário e roadmap
test/               testes (npm test)
```

## Desenvolvimento

```powershell
npm test
npm run typecheck
```

Para adicionar uma ferramenta, crie um objeto `Ferramenta` em `src/tools/` e registre em `src/tools/index.ts`.
Marque `altera: true` se ela grava ou muda algo, para passar pelo controle de permissão.

## Licença

[MIT](LICENSE)
