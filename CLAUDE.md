# Deck One

Assistente pessoal autônomo de terminal (TypeScript/Node, cérebro na API da OpenAI) para informações da empresa: notas, lembretes, base de conhecimento.

- Idioma: português do Brasil (código, mensagens e docs).
- Skills do bot ficam em `skills/` (Markdown com cabeçalho `nome`/`descricao`). Não reaproveitar skills de outros projetos.
- Nova ferramenta: `src/tools/*.ts` + registrar em `src/tools/index.ts`; `altera: true` se grava algo.
- Dados da empresa (`dados/`, `conhecimento/*`) nunca vão para o Git.
- Antes de entregar: `npm run typecheck && npm test`.
- Direção do produto: `docs/questionario.md` (respostas do dono) → `docs/roadmap.md`.
