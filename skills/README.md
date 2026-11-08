# Skills do Deck One

Uma skill ensina o Deck One a fazer uma tarefa específica. O bot vê o **nome** e a **descrição**
de todas e carrega o corpo só quando o pedido combina.

Dois formatos aceitos (o segundo é o padrão `SKILL.md` usado por outros agentes, como o OpenMausBot,
então dá para trazer skills de lá):

```
skills/registro-de-reuniao.md
skills/fechamento-de-caixa/SKILL.md   ← pode ter arquivos de apoio na mesma pasta
```

```markdown
---
name: nome-da-skill
description: Quando usar (o modelo decide por esta frase, então seja específico)
---

Instruções passo a passo, em linguagem natural.
Pode citar as ferramentas: salvar_nota, buscar_notas, criar_lembrete, ler_documento...
```

`nome`/`descricao` em português também funcionam. Basta criar o arquivo e reiniciar o bot.
