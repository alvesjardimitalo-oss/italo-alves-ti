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
3 minutos sem sinal (desligou, dormiu, caiu a internet). Quando o principal volta, ele vê que o outro está
com o bot e fica de reserva. O atalho **Status** mostra o papel de cada PC, e o painel mostra em qual PC o bot está.
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
