# Questionário de direção — Deck One

Responda direto neste arquivo (escreva embaixo de cada pergunta ou marque `[x]`).
Não precisa responder tudo de uma vez: o que ficar em branco vira uma decisão para depois.
Cada bloco diz **o que a resposta muda no bot**, para você saber por que estamos perguntando.

---

## 1. A empresa

> Muda: o "conhecimento de fundo" no prompt do sistema e os documentos iniciais em `conhecimento/`.

1.1. Qual é o nome da empresa e o que ela faz, em 2 ou 3 frases?

1.2. Ramo / setor:
- [ ] Comércio / loja
- [ ] Serviços
- [ ] Indústria
- [ ] Tecnologia / digital
- [ ] Mídia / conteúdo
- [ ] Outro: ___

1.3. Quantas pessoas trabalham nela? E quantas vão **usar** o Deck One?

1.4. Quais são as áreas/departamentos (ex.: vendas, financeiro, produção, RH)?

1.5. Quais termos, siglas ou apelidos internos o bot precisa entender? (ex.: "o Zé do estoque", "NF", "pedido ouro")

---

## 2. Quem usa e como

> Muda: se o bot é de uma pessoa só ou multiusuário (login, separação de dados).

2.1. No começo, o Deck One é só seu ou outras pessoas também vão conversar com ele?
- [ ] Só eu
- [ ] Eu e mais algumas pessoas (quantas? ___)
- [ ] A empresa toda

2.2. Se for mais de uma pessoa: todos veem tudo, ou cada um tem suas notas e lembretes?

2.3. Onde você vai usar no dia a dia?
- [ ] PowerShell / terminal do Windows
- [ ] Terminal dentro do VS Code / Cursor
- [ ] Gostaria também no celular (Telegram / WhatsApp) — fase futura
- [ ] Gostaria de uma tela web — fase futura

2.4. Quantas vezes por dia imagina usar? (ajuda a estimar custo da API)

---

## 3. Informações que ele guarda

> Muda: os tipos de nota, as tags padrão e se precisamos de "fichas" com campos fixos (ex.: cliente com telefone, CNPJ...).

3.1. Que tipo de informação você mais quer salvar? Marque e ordene por importância (1 = mais importante):
- [ ] ___ Clientes (contato, histórico, preferências)
- [ ] ___ Fornecedores
- [ ] ___ Processos ("como fazemos X")
- [ ] ___ Decisões e atas de reunião
- [ ] ___ Senhas/acessos — ⚠️ **não recomendado**; usar um gerenciador de senhas
- [ ] ___ Financeiro (contas a pagar/receber, valores)
- [ ] ___ Projetos e tarefas
- [ ] ___ Ideias
- [ ] ___ Outro: ___

3.2. Dê 3 exemplos reais (pode trocar nomes) de coisas que você diria para ele salvar:
1.
2.
3.

3.3. Dê 3 exemplos de perguntas que você gostaria de fazer e ele responder com o que foi salvo:
1.
2.
3.

3.4. Você já tem documentos prontos para dar a ele (planilhas, PDFs, manuais)? Em que formato?

3.5. Hoje essas informações estão onde? (cabeça, caderno, WhatsApp, planilha, Notion, Drive...)

---

## 4. Lembretes e rotina

> Muda: como os avisos chegam até você e se ele precisa rodar em segundo plano.

4.1. Que tipo de lembrete você mais usaria?
- [ ] Pontual ("amanhã às 9h ligar para o cliente X")
- [ ] Recorrente ("todo dia 5 pagar aluguel", "toda segunda revisar estoque")
- [ ] Prazos com antecedência ("avisar 3 dias antes do vencimento")

4.2. Como você quer ser avisado? Hoje o aviso só aparece quando o bot está aberto no terminal.
- [ ] Assim já serve
- [ ] Notificação do Windows (mesmo com o bot fechado)
- [ ] Mensagem no celular (Telegram / WhatsApp)
- [ ] E-mail

4.3. Gostaria de um **resumo diário** automático? ("Bom dia: hoje você tem 3 lembretes e 2 prazos")
- [ ] Sim, de manhã — horário: ___
- [ ] Sim, no fim do dia
- [ ] Não

---

## 5. Autonomia e limites

> Muda: o modo de permissão padrão e quais ações exigem confirmação.

5.1. Hoje existem 3 modos: `perguntar` (confirma antes de gravar), `auto` (faz sozinho) e `leitura` (só consulta).
Qual quer como padrão?
- [ ] perguntar
- [ ] auto
- [ ] Misto: auto para salvar/criar, perguntar para apagar/editar

5.2. Ele deve agir **sem você pedir**? (ex.: perceber que você citou um prazo e criar o lembrete sozinho)
- [ ] Sim, sempre
- [ ] Sim, mas me avisando o que fez
- [ ] Não, só quando eu pedir

5.3. O que ele **nunca** deve fazer? (ex.: apagar dados, mandar mensagem para cliente, mexer em valores)

5.4. No futuro, ele pode agir fora do próprio bot? Marque o que faria sentido:
- [ ] Ler/enviar e-mails
- [ ] Mexer na agenda (Google Calendar / Outlook)
- [ ] Ler/editar planilhas (Excel / Google Sheets)
- [ ] Rodar comandos no computador
- [ ] Buscar na internet
- [ ] Outro: ___

---

## 6. Personalidade

> Muda: o tom do prompt do sistema.

6.1. Como o Deck One deve falar?
- [ ] Formal e profissional
- [ ] Direto e objetivo, sem enrolação
- [ ] Amigável e descontraído
- [ ] Outro: ___

6.2. Respostas curtas ou detalhadas por padrão?

6.3. Ele deve ter uma "persona" (nome já é Deck One — algum jeito, bordão, emoji)? Ou neutro?

---

## 7. Privacidade, segurança e custo

> Muda: onde os dados ficam, criptografia, limites de gasto.

7.1. Os dados da empresa são sensíveis (dados de clientes, CPF/CNPJ, valores)?
- [ ] Sim, muito — precisamos de cuidado extra (criptografia, LGPD)
- [ ] Um pouco
- [ ] Não

7.2. Tudo bem as conversas passarem pela API da OpenAI? (Os dados saem do seu computador a cada pergunta.)
- [ ] Sim
- [ ] Sim, mas quero esconder certos dados antes de enviar
- [ ] Prefiro avaliar um modelo local no futuro

7.3. Onde os dados devem ficar?
- [ ] Só no meu computador (como está hoje: pasta `dados/`)
- [ ] Na nuvem, para acessar de vários lugares
- [ ] Backup automático em: ___

7.4. Quanto aceita gastar por mês com a API da OpenAI? (dá para colocar um limite no painel da OpenAI)
- [ ] Até US$ 5
- [ ] Até US$ 20
- [ ] Até US$ 50
- [ ] Mais / tanto faz

---

## 8. Projeto open source

> Muda: README, documentação para colaboradores, o que é genérico e o que é só seu.

8.1. O objetivo do open source é:
- [ ] Mostrar o projeto / portfólio
- [ ] Que outras empresas possam usar o Deck One
- [ ] Atrair colaboradores
- [ ] Só deixar público, sem pretensão

8.2. O código vai ser genérico (qualquer empresa usa, configurando) e as informações da sua empresa ficam só no seu computador? (recomendado)
- [ ] Sim
- [ ] Não, explique: ___

8.3. Idioma do projeto: só português, ou README também em inglês?

---

## 9. Prioridades

> Muda: a ordem do roadmap.

9.1. Se o Deck One só pudesse fazer **uma** coisa muito bem no primeiro mês, qual seria?

9.2. Ordene as próximas funcionalidades (1 = primeiro):
- [ ] ___ Lembretes recorrentes
- [ ] ___ Notificação mesmo com o bot fechado
- [ ] ___ Ler PDFs e planilhas na base de conhecimento
- [ ] ___ Busca por significado (não só por palavra exata)
- [ ] ___ Resumo diário automático
- [ ] ___ Acesso pelo celular (Telegram/WhatsApp)
- [ ] ___ Integração com agenda / e-mail
- [ ] ___ Várias pessoas usando com login
- [ ] ___ Outro: ___

9.3. O que faria você parar de usar o Deck One? (lento, caro, erra informação, muito chato de confirmar...)

---

Quando terminar, é só avisar: com as respostas a gente transforma isso num roadmap em `docs/roadmap.md`
e ajusta o prompt e as ferramentas do bot.
