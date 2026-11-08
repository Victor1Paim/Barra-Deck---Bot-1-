# Deck One

Assistente pessoal autônomo de terminal (TypeScript/Node, cérebro na API da OpenAI) para informações da empresa: notas, lembretes, base de conhecimento.

- Idioma: português do Brasil (código, mensagens e docs).
- Skills do bot ficam em `skills/` (formato `SKILL.md`, cabeçalho `name`/`description` ou `nome`/`descricao`). Não reaproveitar skills de outros projetos sem o dono pedir.
- Empresa: Barra Deck (unidades `restaurante` e `lounge`). Acesso aos dados é por grupo de WhatsApp → pastas liberadas (`gruposWhatsApp` em `deck.config.json`).
- Nova ferramenta: `src/tools/*.ts` + registrar em `src/tools/index.ts`; defina `nivel` (leitura/criar/editar/apagar) e `exigeConfirmacao` se mexe em algo sensível.
- Dados da empresa (`dados/`, `conhecimento/*`) nunca vão para o Git.
- Antes de entregar: `npm run typecheck && npm test`.
- Direção do produto: `docs/questionario.md` (respostas do dono) → `docs/roadmap.md`.
