# Bot da Karen Martins Cosméticos (Discord)

Ferramenta de gestão do **consórcio** e dos **pedidos do site** no Discord. As vendas continuam no Revendi.
Roda no seu PC (Windows 11), de graça. O banco é o mesmo Firebase do painel (`italoinfotec.com.br/sistema.html`):
o que você faz no painel aparece no Discord, e o que você faz no Discord volta para o painel.

## O que ele faz

| Onde | O quê |
| --- | --- |
| **#grupos** | Um tópico por grupo do consórcio (G3, G4, G5…), atualizado sozinho: membros, parcelas pagas, atrasos, prêmio. Menu **Dar baixa na parcela de…** |
| **#comprovantes** | Cole o print do Pix: o bot pergunta **de qual grupo** e **de quem** é, dá baixa na parcela, reage ✅ no print e prepara o **recibo** no WhatsApp |
| **#cobrancas** | **2 dias antes** do vencimento: quem ainda não pagou, com lembrete pronto no WhatsApp. **No dia seguinte** ao vencimento: quem atrasou, com cobrança pronta e baixa. A mensagem se atualiza sozinha quando alguém paga |
| **#pagamentos / #resgates** | Registro de cada parcela paga e de cada resgate (pelo painel ou pelo bot) |
| **#renovacoes** | Cada resposta do formulário de renovação: nota, o que gosta, o que melhorar, sugestões, se renova. Botões **Responder no WhatsApp** e **Marcar respondida** |
| **#banco-de-reserva** | Quem se inscreveu em `/karen/consorcio/` para o próximo grupo |
| **#pedidos-da-loja / #sacola-misteriosa / #roleta** | O que chega pela loja do site |
| **#resumo-do-dia** | Todo dia às 8h: recebido no mês, quem falta, atrasos, **quem quitou e não resgatou**, próximo grupo e o que chegou nas últimas 24 h. **No dia 1:** relatório do mês anterior (recebido, %, atraso, renovação, nota média, críticas e sugestões, reservas e resgates) |
| **Fim de grupo** | No penúltimo e no último mês de cada grupo, em #alertas: quitados, resgates pendentes, placar da renovação e menu para mandar o link a quem não respondeu |
| **Renovação no tópico** | Ao lado de cada membro em #grupos: 🔁 renova · 🤔 talvez · ❌ não · ⏳ sem resposta (cruzado pelo WhatsApp do formulário) |
| **#resgates** | Cada resgate vem com o **lembrete para lançar no Revendi** (itens, prêmio e diferença) e o botão *Lançado no Revendi* |
| **Backup** | Todo domingo, um arquivo com os grupos em #logs-do-bot |
| **#alertas** | Aviso na hora de renovação, reserva e pedido |
| **🌸 Área das Clientes** | Já criada e **escondida**. `/servidor clientes abrir` mostra para quem tiver o cargo Cliente/Consorciada; `/minhas-parcelas` mostra a situação só para a própria cliente |

Comandos: `/consorcio resumo`, `/consorcio atrasados`, `/consorcio pagou`, `/consorcio desfazer`, `/consorcio membro`,
`/consorcio novo-grupo` (formulário), `/consorcio adicionar` (puxa do banco de reserva e de quem disse "sim"), `/consorcio links`,
`/consorcio atualizar`, `/loja pedidos`, `/servidor montar`, `/servidor clientes`, `/servidor vincular`, `/minhas-parcelas`, `/ajuda`.

Os grupos (mensalidade, parcelas, prêmio, vagas, membros) são configurados no painel: **Loja da Karen › Consórcio**.

## Novidades (23/11/2026)
| O quê | Como funciona |
| --- | --- |
| **⏰ Cobrança de resposta** | Ticket sem resposta da equipe em 15 min → aviso em #alertas; em 1 h → alerta vermelho. Só no horário de atendimento (`HORARIO_ATENDIMENTO=8-20`, seg. a sáb.). Assumir ou responder conta como resposta. |
| **🔔 Aguardando a cada 30 s** | Enquanto a cliente estiver na call ⏳ Aguardando, #alertas avisa toda a equipe e a liderança (@here + Karen/Admin/equipe) **a cada 30 segundos** (até 1 h), apagando o aviso anterior. Para quando alguém puxa ou ela sai. |
| **💬 `/resposta`** | Respostas prontas no ticket: recebido, pedir foto, tem na pronta-entrega, é por encomenda, comprovante do Pix, pedido chegou, combinar entrega, consórcio, troca, pode fechar, ainda está aí. Edite em `RESPOSTAS_PRONTAS` no index.js. |
| **🔊 Call do ticket** | Botão **Abrir call** dentro do ticket: cria uma call só da cliente com a equipe, que some sozinha quando fica vazia. |
| **✅ Ticket aberto** | A cliente recebe a confirmação na tela e no privado ("em breve alguém da equipe responde"), com botão para ir ao ticket. |
| **📄 Conversa em HTML** | Ao fechar, a conversa vai num `.zip` com o HTML (com fotos) para 🗂️ tickets-fechados **e para o privado da cliente**. Para o texto das mensagens aparecer: ligue **Message Content Intent** no Developer Portal (Bot) e ponha `LER_CONVERSAS=sim` no .env. |
| **💌 Convite** | O bot cria um convite permanente para 👋 boas-vindas, publica em 💌 convide-amigas e liga o widget do servidor. A página **italoinfotec.com.br/karen/discord** pega o link sozinha. `/convite` mostra o link. |
| **🌸 Pós-venda** | Uns 60 dias depois de uma compra, a cliente com set recebe por mensagem: "Já está acabando?", com o nome do produto e o botão da pronta-entrega (respeita o "Não quero lembretes"). |
| **🚨 Bot fora do ar** | O bot cria um webhook em #alertas. A cada 15 min o GitHub confere se ele está vivo; se os dois PCs pararem, avisa em #alertas e por e-mail, e de novo quando voltar (precisa do secret `FIREBASE_SERVICE_ACCOUNT` no GitHub). |
| **🔁 Troca rápida entre PCs** | A reserva assume em ~35 s (antes 3 min). Ponha `PRIORIDADE=1` no PC preferido (trabalho) e `PRIORIDADE=2` no outro (casa): quando o preferido volta, pega o bot de volta sozinho. **`/servidor trocar-pc`** passa o bot para o outro PC na hora (e ele fica lá até a próxima troca ou até aquele PC parar). |

## Instalar (uma vez, ~10 minutos)

### 1. Criar o bot no Discord
1. Abra <https://discord.com/developers/applications> → **New Application** → nome **Karen Cosméticos** → Create.
2. Menu **Bot** → **Reset Token** → **Copy**. Guarde: é o `DISCORD_TOKEN`.
3. Ainda em **Bot**, deixe as três *Privileged Gateway Intents* **desligadas** (o bot não precisa).
4. Menu **OAuth2** → copie o **Client ID**. Monte o link abaixo trocando `CLIENT_ID` e abra no navegador:
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=8`
   Escolha o servidor do High OS → Autorizar. (permissions=8 = Administrador, necessário para reorganizar o servidor.)
5. No Discord: **Configurações do usuário › Avançado › Modo desenvolvedor** ligado. Botão direito no ícone do servidor → **Copiar ID do servidor**: é o `DISCORD_GUILD_ID`.

### 2. Chave do Firebase
Se o bot do High OS ainda estiver neste PC, o instalador **reaproveita a chave sozinho** e depois oferece **remover o bot do High OS** do PC (tarefa, atalhos, arquivos e o Tailscale Funnel).
Senão: Console do Firebase → projeto **high-os** → ⚙️ Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada**.
Abra o arquivo baixado, junte tudo numa linha só e cole em `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 3. Instalar no PC
Botão direito no **Iniciar** → **Terminal (Administrador)** → cole e aperte ENTER:
```powershell
irm https://raw.githubusercontent.com/alvesjardimitalo-oss/italo-alves-ti/main/karen-bot/windows/instalar-karen-bot.ps1 | iex
```
Ele abre o Bloco de Notas: cole o token e o ID do servidor, **Ctrl+S** e feche.

### 4. Montar o servidor
No Discord, em qualquer canal do servidor, digite **`/servidor montar`** → **Sim, apagar tudo e montar**.
Ele apaga **todos** os canais e cargos antigos do High OS e cria tudo. Depois remova o bot antigo do High OS do servidor (botão direito nele › Expulsar).
Depois dê o cargo **👑 Karen** para a Karen.

## Atalhos (pasta "Karen Bot" na Área de Trabalho)
| Atalho | Para quê |
| --- | --- |
| **Status** | bot ligado? conectado ao Discord e ao Firebase? |
| **Ver log** | o que o bot está fazendo |
| **Reiniciar** / **Parar** | liga de novo / desliga até entrar no Windows |
| **Atualizar** | baixa a versão nova do GitHub e reinicia |
| **Editar variaveis** | abre o `.env` (depois use Reiniciar) |

Canais novos de versões futuras (ex.: #comprovantes) são criados sozinhos quando o bot atualiza.

Arquivos em `%LOCALAPPDATA%\KarenBot` (variáveis em `.env`, log em `logs\bot.log`).
O estado do bot (canais, tópicos, vínculos) também fica salvo no Firebase (`ti/base/botKaren`): reinstalar não perde nada.

## Dois PCs (principal e reserva)
Pode instalar em mais de um PC (ex.: trabalho e casa) com o **mesmo token**. Só um fica ligado ao Discord por vez:
o primeiro que liga vira o **principal**; o outro fica de **reserva** e assume sozinho se o principal ficar
35 segundos sem sinal (desligou, dormiu, caiu a internet). Com `PRIORIDADE=1` no PC preferido e `PRIORIDADE=2`
no outro, o preferido pega o bot de volta quando volta; `/servidor trocar-pc` troca na hora pelo Discord. O atalho **Status** mostra o papel de cada PC, e o painel mostra em qual PC o bot está.
O controle fica em `ti/base/botKaren/lider` no Firebase.

## Com o PC desligado
O site e o painel funcionam normal. Quando o PC liga, o bot posta o que chegou enquanto esteve desligado
(cada registro é marcado como postado, então nada sai em dobro). O painel mostra em **Loja da Karen › Consórcio**
se o bot está ligado.

## Revendi (crediário e vendas)
Feito com o exemplo oficial do suporte do Revendi (19/11/2026). Usa a **API interna** do Revendi (não é API pública):
se ela mudar, a sincronização para e avisa em #logs-do-bot, e o resto do bot segue normal. O bot **só lê**.

- A cada 30 min: login com o usuário de integração (token de 1 dia renovado sozinho; após 30 dias, login de novo),
  leitura das parcelas de **crediário/fiado** com vencimento de 180 dias atrás a 150 dias à frente, e dos totais de vendas.
- Grava as parcelas em `ti/base/crediario` (cliente, WhatsApp, valor, vencimento, pago) e só os totais de vendas por dia
  em `ti/base/botKaren/revendiVendas`. Telefones sem DDD recebem o DDD 33.
- No Discord: 💳 Crediário e 🛍️ Vendas no **resumo do dia**, *Crediário de hoje* em **#cobrancas** às 9h com cobrança
  pronta no WhatsApp, **`/cliente`** com consórcios + crediário, e crediário e vendas no **relatório do mês**.

### Categoria 🛍️ REVENDI no Discord (criada sozinha ao atualizar)
| Canal | O quê |
| --- | --- |
| **#vendas** | Cada venda nova lançada no Revendi: cliente, itens, valor, pagamento, lucro e entrega, com botão **Agradecer no WhatsApp** |
| **#crediario** | Todo dia às 9h: parcelas que vencem hoje e atrasadas, com cobrança pronta no WhatsApp |
| **#entregas** | Painel fixo (se atualiza sozinho) com as vendas não entregues e há quantos dias esperam; menu para combinar a entrega |
| **#estoque** | Painel fixo: vencendo em 60 dias, esgotados que vendem (repor) e parados há 90 dias (ideia de promoção) |
| **#aniversarios** | 8h: aniversariantes do dia com parabéns pronto; segunda: os da semana |
| **#clientes-sumidas** | Segunda 10h: quem não compra há 60+ dias, por valor gasto, com mensagem citando a marca favorita |
| **#desempenho** | Segunda 9h: a semana em números (vendas, lucro, margem, ticket, mais vendidos, clientes, marcas) comparada com a anterior; dia 1: o mês |

Também: **🛍️ Revendi hoje** no resumo das 8h, **`/cliente`** com histórico de compras, aniversário, marca favorita e etiquetas,
e **`/revendi`** (`vendas`, `entregas`, `estoque`, `aniversarios`, `sumidas`, `sincronizar`).
**Clientes no Discord:** quem entra vê só **👋 boas-vindas** (com o botão **🌸 Entrar**). Ao tocar, informa nome e
WhatsApp (opcional): ganha o cargo **🌸 Cliente** (e **💳 Consorciada** se o WhatsApp está num grupo), fica ligada ao
`/minhas-parcelas`, e a equipe recebe aviso em #alertas (diz se ela já é cliente no Revendi). Clientes veem: ✨ novidades (lê),
💬 fale-com-a-karen (escreve), 🎧 Atendimento (call) e, se consorciada, 💳 meu-consorcio. Todo o resto é só da equipe.
**Set das clientes:** em #boas-vindas a pessoa toca **🌸 Entrar · pedir set** e informa nome e WhatsApp. Se o WhatsApp está
no Revendi ou num grupo do consórcio, o set sai na hora: cargo **🌸 Cliente** e apelido **[CLIENTE] - Nome do Revendi**; se está
num grupo em vigência, ganha o cargo do grupo (**💳 G3**, criado sozinho) e o apelido vira **[G3] - Nome** (dois grupos: [G1/G3]).
Se não achar, vai para #alertas com **Aprovar**, **Corrigir WhatsApp e aprovar** ou **Recusar**. A cada 30 min o bot revisa:
grupo terminou → tira o cargo do grupo, apaga o cargo e o apelido volta a [CLIENTE]. Grupos vêm do painel do consórcio e das
etiquetas "Consorcio G… a <mês> <ano>" do Revendi. `/servidor vincular` também faz o set.

**Fidelização:** 💳 **lembrete de parcela por mensagem (DM)** 2 dias antes do vencimento, para quem tem set e não pagou o mês
(botão "Não quero lembretes") · ⭐ **avaliação** de 1 a 5 enviada por DM quando o ticket fecha (nota em 🗂️ tickets-fechados,
média no 📈 desempenho) · 🔔 **Me avise quando chegar** na vitrine (produtos esgotados que já venderam): DM com "Quero este"
quando voltam ao estoque · 💎 **pontos e níveis**: R$ 1 comprado nos últimos 12 meses = 1 ponto; cargos 🥉 Bronze (300),
🥈 Prata (800), 🥇 Ouro (1.500), ajustáveis com `NIVEL_BRONZE`/`NIVEL_PRATA`/`NIVEL_OURO` no .env; botão **💎 Meus pontos**
em #boas-vindas. O nível aparece na ficha do ticket.

**Guias e painéis da equipe:** cada canal da equipe tem um **📌 guia fixado** (o que chega ali, quando e o que fazer).
#pagamentos ganha o painel fixado **📅 Pagamentos do mês** (barra por grupo, recebido e quem falta) e #resgates o painel
**🎁 Quitados aguardando resgate**. Para mudar o texto de um guia: edite `GUIAS` no index.js e aumente `GUIA_VERSAO`.

**Para as clientes (atualiza sozinho):** **ℹ️ como-funciona** (comprar, pagar, receber, consórcio, voz + botões para a loja,
reservar vaga, sacola misteriosa e meus pedidos) · **🛍️ pronta-entrega** (vitrine com tudo que tem no estoque do Revendi, foto
do catálogo, preço e menu **🛒 Quero este** que abre o ticket de pedido já preenchido) · **✨ novidades** (posta sozinho quando um
produto chega ou volta ao estoque) · **💳 meu-consorcio** (botão Ver minhas parcelas, só ela vê). Boas-vindas, como-funciona,
pronta-entrega e novidades ficam visíveis até para quem ainda não pediu set (vitrine aberta atrai).

**Tickets:** em **🎫 abrir-ticket** a cliente escolhe o assunto (Pedido/encomenda, Consórcio, Pagamento/crediário,
Troca/defeito, Outro) e escreve o que precisa. O bot cria um canal privado (só ela + equipe) na categoria 🎫 TICKETS, avisa a
equipe em #alertas com a ficha dela (WhatsApp, compras no Revendi, grupos, crediário em atraso) e põe os botões **✋ Assumir** e
**🔒 Fechar**. Ao fechar, a conversa vai como .txt para **🗂️ tickets-fechados** e o canal é apagado. Sem mensagens: aviso em 48 h
e fecha sozinho em 72 h. Máximo de 2 tickets abertos por cliente.

**Atendimento por voz:** a cliente só vê a call **Aguardando**: entra, mas não fala nem escreve. Ao entrar, #alertas avisa
toda a equipe (@here + cargos) com WhatsApp, consórcio e crediário dela e os botões **Puxar para a minha call** (quem já está
numa call de atendimento) ou **Atendimento 01/02/03** (mostra se está ocupada). O bot libera aquela call só para essa cliente,
move ela e, quando ela sai, tira a liberação: as calls de atendimento e as da equipe continuam invisíveis para clientes.
Calls que já existem são adotadas pelo nome ("aguard"/"espera" = espera; "atendimento"/"suporte" = 01, 02, 03;
"equipe"/"vendas"/"reuni" = equipe), sem renomear nem criar outras. Cargos criados à mão com Equipe, Vendas, Suporte,
Atendente, Staff, Colaboradora, Moderação ou Gerente no nome contam como equipe. Precisa estar aberta: `/servidor clientes abrir`. Calls/canais criados à mão: `/servidor acesso` escolhe quem acessa;
`/servidor mapa` mostra quem vê cada canal (também gravado em `dados/servidor-mapa.json` a cada hora).

**Visual:** foto, banner e cores da Karen (monograma KC, vinho, rosé e dourado) no bot e no ícone do servidor; logo no topo e
no rodapé de todo post; cores fixas (rosé = resumo, rosa = venda, verde = pago, amarelo = atenção, vermelho = atraso,
roxo = crediário, azul = informação); emojis das marcas (oB, Eu, QDB, OUi) nos produtos; barras de progresso no consórcio;
pódio 🥇🥈🥉 no desempenho; status ao vivo do bot ("🛍️ 3 vendas hoje · 🚚 1 entrega"). Canal novo **🌸 hoje** no topo:
painel ao vivo com vendas de hoje e do mês, **meta do mês** (`/revendi meta 5000`) com barra, ritmo e quanto falta por dia,
crediário, consórcio, entregas, aniversários e estoque. Imagens em `karen-bot/assets`.

**Central e limpeza:** o canal **🎛️ central** (antigo #comandos) tem uma mensagem fixa com botões (vendas de hoje/semana/mês,
crediário, estoque, entregas, aniversários, sumidas, consórcio, atrasados, atualizar Revendi). As respostas aparecem só para
quem tocou e somem sozinhas; o que for digitado ali some em 1 minuto. Todo dia o bot apaga as mensagens antigas dele em:
#crediario (3 dias), #aniversarios (7), #clientes-sumidas (8), #resumo-do-dia (15), #alertas (7), #logs-do-bot (10),
#cobrancas e #comprovantes (40). Fixadas, painéis, relatórios do mês e backups ficam. Vendas, pagamentos, resgates, grupos,
renovações, pedidos e desempenho guardam tudo. Ajuste: `LIMPEZA_CREDIARIO=5` (etc.) ou `LIMPEZA=nao` no .env.

**Gráficos** (imagem anexada na mensagem): vendas dos últimos 14 dias no resumo das 8h, vendas por dia (este período × anterior)
e mais vendidos em #desempenho e no `/revendi vendas`, crediário a receber por semana em #crediario e % que pagou por grupo no
relatório do consórcio. Desenhados pelo QuickChart: só vão números e nomes de produtos/grupos, nunca nome ou telefone de cliente.
Para desligar: `GRAFICOS=nao` no .env.

**`/produto`** busca no catálogo das marcas (O Boticário, Eudora, Quem Disse Berenice, O.U.i) pelo código da revista ou pelo nome,
com foto, descrição, preço sugerido e se tem no estoque da Karen. As vendas em #vendas mostram a foto do produto.
Para outras marcas, ponha os IDs em `REVENDI_MARCAS` no .env (padrão `7,5,57,222`). Só funciona no PC que tem o login do Revendi.
O retrato do Revendi (vendas do último ano, clientes e estoque) fica em `ti/base/botKaren/revendiPainel`.

**Para ligar:** atalho **Editar variaveis** → preencha e salve:
```
REVENDI_ATIVO=sim
REVENDI_EMAIL=e-mail do usuário de integração
REVENDI_SENHA=senha desse usuário
```
Depois **Reiniciar**. O atalho **Status** mostra se a sincronização está funcionando.
Crie no Revendi um usuário da equipe só para isso, com **leitura** em Vendas (marcando "ver vendas de todos"), Clientes e Financeiro.
