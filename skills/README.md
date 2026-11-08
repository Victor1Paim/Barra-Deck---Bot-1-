# Skills do Deck One

Uma skill é um arquivo `.md` nesta pasta que ensina o Deck One a fazer uma tarefa específica.
O bot vê o **nome** e a **descrição** de todas as skills e carrega o corpo só quando o pedido combina.

```markdown
---
nome: nome-da-skill
descricao: Quando usar (o modelo decide por esta frase, então seja específico)
---

Instruções passo a passo, em linguagem natural.
Pode citar as ferramentas: salvar_nota, buscar_notas, criar_lembrete, ler_documento...
```

Basta criar o arquivo e reiniciar o bot.
