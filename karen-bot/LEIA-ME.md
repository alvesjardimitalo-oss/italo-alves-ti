# Bot da Karen Martins Cosméticos (Discord)

Ferramenta de gestão do **consórcio** e dos **pedidos do site** no Discord. As vendas continuam no Revendi.
Roda no seu PC (Windows 11), de graça. O banco é o mesmo Firebase do painel (`italoinfotec.com.br/sistema.html`):
o que você faz no painel aparece no Discord, e o que você faz no Discord volta para o painel.

## O que ele faz

| Onde | O quê |
| --- | --- |
| **#grupos** | Um tópico por grupo do consórcio (G3, G4, G5…), atualizado sozinho: membros, parcelas pagas, atrasos, prêmio. Menu **Dar baixa na parcela de…** |
| **#cobrancas** | No dia seguinte ao vencimento de cada grupo: quem falta pagar, com menu para **abrir o WhatsApp com a cobrança pronta** e para dar baixa |
| **#pagamentos / #resgates** | Registro de cada parcela paga e de cada resgate (pelo painel ou pelo bot) |
| **#renovacoes** | Cada resposta do formulário de renovação: nota, o que gosta, o que melhorar, sugestões, se renova. Botões **Responder no WhatsApp** e **Marcar respondida** |
| **#banco-de-reserva** | Quem se inscreveu em `/karen/consorcio/` para o próximo grupo |
| **#pedidos-da-loja / #sacola-misteriosa / #roleta** | O que chega pela loja do site |
| **#resumo-do-dia** | Todo dia às 8h: recebido no mês, quem falta, atrasos, próximo grupo e o que chegou nas últimas 24 h |
| **#alertas** | Aviso na hora de renovação, reserva e pedido |
| **🌸 Área das Clientes** | Já criada e **escondida**. `/servidor clientes abrir` mostra para quem tiver o cargo Cliente/Consorciada; `/minhas-parcelas` mostra a situação só para a própria cliente |

Comandos: `/consorcio resumo`, `/consorcio atrasados`, `/consorcio pagou`, `/consorcio desfazer`, `/consorcio membro`,
`/consorcio links`, `/loja pedidos`, `/servidor montar`, `/servidor clientes`, `/servidor vincular`, `/minhas-parcelas`, `/ajuda`.

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
Se o bot do High OS já roda neste PC, o instalador **reaproveita a chave sozinho**.
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
Ele apaga os canais e cargos antigos (menos canais com *storage* no nome, que ficam em 🔒 SISTEMA) e cria tudo.
Depois dê o cargo **👑 Karen** para a Karen.

## Atalhos (pasta "Karen Bot" na Área de Trabalho)
| Atalho | Para quê |
| --- | --- |
| **Status** | bot ligado? conectado ao Discord e ao Firebase? |
| **Ver log** | o que o bot está fazendo |
| **Reiniciar** / **Parar** | liga de novo / desliga até entrar no Windows |
| **Atualizar** | baixa a versão nova do GitHub e reinicia |
| **Editar variaveis** | abre o `.env` (depois use Reiniciar) |

Arquivos em `%LOCALAPPDATA%\KarenBot` (variáveis em `.env`, log em `logs\bot.log`).
O estado do bot (canais, tópicos, vínculos) também fica salvo no Firebase (`ti/base/botKaren`): reinstalar não perde nada.

## Com o PC desligado
O site e o painel funcionam normal. Quando o PC liga, o bot posta o que chegou enquanto esteve desligado
(cada registro é marcado como postado, então nada sai em dobro). O painel mostra em **Loja da Karen › Consórcio**
se o bot está ligado.

## Revendi
O Revendi não tem integração aberta (API), então as vendas ficam só lá. Se um dia ele liberar exportação
automática ou API, dá para o bot ler.
