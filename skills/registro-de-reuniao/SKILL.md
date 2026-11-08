---
name: registro-de-reuniao
description: Quando o usuário colar anotações ou contar o que aconteceu numa reunião e quiser registrar.
---

1. Extraia: data, participantes, assunto, decisões tomadas e próximos passos (com responsável e prazo).
2. Salve uma nota com `salvar_nota` no grupo `processos`:
   - título: `Reunião AAAA-MM-DD — <assunto>`
   - unidade: a casa da reunião (ou `todas` se foi geral)
   - tags: `reuniao` + os nomes de clientes/projetos citados
   - conteúdo em tópicos: Participantes, Decisões, Próximos passos.
3. Para cada próximo passo com prazo, crie um lembrete com `criar_lembrete`, com `para` = o responsável (se ele estiver na equipe) e aviso 1 dia antes.
4. Responda com um resumo curto: o que foi salvo e quais lembretes foram criados.
5. Se faltar data ou prazo, pergunte antes de inventar.
