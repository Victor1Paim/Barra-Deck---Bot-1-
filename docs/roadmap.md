# Roadmap — Deck One

Baseado nas respostas de [`questionario.md`](questionario.md). Prioridade número 1: **lembretes que nunca falham**.

## ✅ Fase 1 — Lembretes confiáveis + base multiusuário (v0.2, PC)

- [x] **Grupos de informação**: clientes · processos · financeiro · projetos · geral (configuráveis em `deck.config.json`)
- [x] **Equipe**: vários usuários, cada nota e lembrete sabe quem criou e para quem é
- [x] **Acesso por grupo**: financeiro é restrito; quem não tem acesso nem fica sabendo que a nota existe
- [x] **Modo misto** (padrão): cria sozinho, confirma editar. Apagar e mexer no financeiro **sempre** confirmam
- [x] **Iniciativa avisada**: o bot cria lembretes/notas quando você cita prazos e conta o que fez
- [x] **Tom amigável e descontraído**
- [x] **Lembretes**: pontuais, recorrentes (diário, semanal em dias escolhidos, mensal, anual, "a cada N"), com data final
- [x] **Antecedência**: "3 dias antes", "1 hora antes" (vários por lembrete)
- [x] **Resumo diário** no horário de cada pessoa (hoje · pendentes · próximos 3 dias), gerado sem gastar API
- [x] **Nunca falham**:
  - fila de envios gravada em disco antes de marcar como avisado (no pior caso, duplica; nunca perde)
  - novas tentativas sem desistir (1, 2, 4 … até 30 min de intervalo)
  - PC desligado: ao ligar, avisa o que passou marcado como atrasado (uma vez só, sem enxurrada)
  - recorrência mensal no dia 31 não "escorrega" (fev 28 → mar 31)
  - tenta WhatsApp **e** e-mail
- [x] **WhatsApp (Baileys)**: avisos + conversar com o bot pelo celular; confirmação respondendo "sim/não"
- [x] **E-mail (SMTP)** para avisos
- [x] **Criptografia** AES-256-GCM dos dados com `DECK_CHAVE_DADOS`
- [x] Trava entre processos (terminal e serviço juntos sem corromper dados)

## Fase 2 — Memória da empresa melhor

- [ ] Importar conversas exportadas do WhatsApp ("Exportar conversa" → `.txt`) e extrair notas e prazos
- [ ] Ler PDFs e planilhas (Excel/CSV) na base de conhecimento
- [ ] Busca por significado (embeddings), não só por palavra
- [ ] Histórico de alterações das notas (quem mudou o quê) e lixeira em vez de apagar de vez
- [ ] Áudio do WhatsApp → texto (transcrição)
- [ ] Controle de gasto: contador de tokens por dia e aviso perto do limite de US$ 20/mês

## Fase 3 — Servidor online

- [ ] Rodar 24h num servidor (Docker + VPS barata)
- [ ] Trocar arquivos JSON por SQLite/Postgres
- [ ] Avaliar migrar para a API oficial do WhatsApp (Meta), sem risco de banimento
- [ ] Backup automático criptografado
- [ ] LGPD: exportar/apagar dados de um cliente a pedido

## Fase 4 — Open source para outras empresas

- [ ] Assistente de instalação (`deck-one iniciar` interativo)
- [ ] README em inglês, guia de contribuição, exemplos de skills
- [ ] Publicar no npm (`npx deck-one`)

## Riscos conhecidos

- **WhatsApp não oficial**: o número pode ser banido. Use um chip secundário só para o bot, não mande mensagem para quem não é da equipe e não faça envios em massa.
- **Dados na OpenAI**: cada conversa passa pela API. A OpenAI não usa dados da API para treino por padrão, mas eles saem do seu PC. Evite colar senhas.
- **Chave de criptografia**: se perder `DECK_CHAVE_DADOS`, os dados não abrem. Guarde uma cópia fora do PC.
