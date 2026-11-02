# Ítalo Alves TI · site + sistema da assistência técnica

O projeto tem duas partes:

- **Site público** (`index.html` e `dicas/`): apresenta os serviços, traz dicas e explicações de problemas e tem o assistente **"Fale comigo"**. O assistente monta o pedido do cliente, manda para o WhatsApp e salva o contato como **lead** no sistema.
- **Sistema** (`sistema.html`, link "área técnica" no rodapé do site): a parte de gestão, descrita abaixo.

### Editar o site (sem programar)

O conteúdo do site fica na pasta **`conteudo/`**. Edite pelo GitHub (botão de lápis) e salve. Em cerca de 1 minuto, a ação **"Gerar site"** (aba *Actions*) cria as páginas de novo.

| Arquivo | O que controla |
|---|---|
| `site.json` | WhatsApp, e-mail, horário, região, links do Google/Instagram, texto e foto do "Sobre", plano anual |
| `cidades.json` | cidades atendidas. Cada uma vira uma página própria no Google ("Manutenção de notebook em …") |
| `precos.json` | tabela "a partir de". Fica escondida enquanto os valores estiverem vazios |
| `galeria.json` | fotos de antes e depois (envie as fotos para `assets/galeria/`) |
| `avaliacoes.json` | avaliações reais copiadas do seu Perfil no Google |
| `artigos.json` | dicas e artigos (o texto é HTML simples) |

Não edite `index.html`, `dicas/`, `ferramentas/` e as outras páginas geradas: o gerador sobrescreve essas páginas.

### Ferramentas do site
Check-up do computador, Consertar ou trocar?, Monte seu PC, Teste de velocidade e Teste de teclado/tela/som/microfone/câmera. O resultado de cada uma pode ser enviado ao técnico pelo "Fale comigo".

### Acompanhar OS
Ao salvar uma OS, o sistema publica só o **status** dela num endereço secreto, calculado a partir do código da OS e do telefone do cliente. O cliente consulta em `acompanhar.html` com esses dois dados. O comprovante de entrada já sai com o QR Code dessa página. O campo "Recado para o cliente" da OS aparece lá.

### Captar clientes (leads)

- Cada pedido feito no assistente aparece em **Pedidos do site**, dentro do sistema. Lá dá para responder pelo WhatsApp com um clique, anotar o andamento e transformar o pedido em cliente.
- Em **Divulgação e indicação**, dentro do sistema, você gera links com etiqueta de origem e QR Codes para Instagram, Google, cartão, panfleto e adesivo. Também gera o link de indicação de cada cliente (`?ref=Nome`) e vê de onde vêm os pedidos e quem mais indica.
- Em **Lembretes de manutenção** aparecem os clientes com a última OS entregue há 11 meses ou mais, com a mensagem pronta para o WhatsApp.
- Para aparecer no Google:
  - cadastre o site no **Google Search Console** e envie o `sitemap.xml`;
  - crie ou atualize o **Perfil da Empresa no Google** (Google Meu Negócio) apontando para o site.

Para os pedidos funcionarem, as regras do Firestore precisam do bloco `ti/base/leads` (já incluído em `firebase/regras-ti.rules` e no `firestore.rules` do `high-os-dev`).

Sistema web para a assistência técnica em informática. Controla:

- clientes;
- ordens de serviço (entrada de equipamento, status e laudo);
- orçamentos;
- notas de serviço (não fiscais);
- pagamentos parciais e recibos;
- catálogo de peças e serviços.

Imprime em **A4** e em **impressora térmica de bobina 80 mm**, com **QR Code PIX** válido no valor do saldo.

- **Hospedagem:** GitHub Pages (HTML, CSS e JS puros, sem build e sem Node).
- **Dados:** Firebase Firestore, no mesmo projeto `high-os`, separados em `ti/base/...`.
- **Login:** conta Google. Só os e-mails autorizados entram.

## Primeira configuração (uma vez só)

1. **Ativar o GitHub Pages:** no repositório, abra *Settings › Pages › Build and deployment*. Escolha *Deploy from a branch*, branch `main` e pasta `/ (root)`. O endereço fica `https://alvesjardimitalo-oss.github.io/italo-alves-ti/`.
2. **Liberar o acesso no Firestore:**
   - abra *Firebase Console › projeto high-os › Firestore Database › Regras*;
   - cole o bloco de [`firebase/regras-ti.rules`](firebase/regras-ti.rules) **antes** da regra final `match /{document=**}`. O `firestore.rules` do repositório `high-os-dev` já está com esse bloco, então basta colar o arquivo inteiro de lá;
   - clique em **Publicar**.
3. **Domínio autorizado:** em *Authentication › Settings › Authorized domains*, confira se `alvesjardimitalo-oss.github.io` está na lista. Ele já está lá por causa do High OS.
4. Entre no sistema, abra **Configurações** e preencha os dados da empresa e a **chave PIX**.

## Trazer os dados do sistema antigo (WAMP)

1. Copie `tools/exportar_para_firebase.php` para `C:\wamp64\www\italo_alves_ti\`.
2. Abra `http://localhost/italo_alves_ti/exportar_para_firebase.php`. Ele baixa um arquivo `.json`.
3. No sistema novo, abra **Configurações › Importar do sistema antigo** e escolha esse arquivo.
4. Apague o `.php` da pasta do WAMP.

Os números das OS, dos orçamentos e dos recibos continuam de onde pararam.

## Modo demonstração

Abra `…/italo-alves-ti/sistema.html?demo` para testar sem tocar nos dados reais. Nesse modo os dados ficam só no navegador.

## Impressora de bobina (80 mm)

Na janela de impressão:
- escolha a impressora térmica;
- papel **80 mm** (em algumas impressoras aparece como "Roll Paper 80 x 297 mm");
- margens **Nenhuma**;
- escala **100%**;
- desmarque **Cabeçalhos e rodapés**.

O Chrome guarda essas opções para as próximas impressões.

## Estrutura

```
index.html              site público (serviços, problemas, dicas, FAQ)
dicas/                  artigos de dicas (um HTML por artigo)
sistema.html            sistema (login + telas)
assets/css/site.css     visual do site
assets/js/site.js       assistente "Fale comigo"
assets/js/site-config.js WhatsApp, horário e região (edite aqui)
assets/js/leads.js      grava o pedido no Firestore
imprimir.html           impressão A4 / 80 mm
assets/css/app.css      identidade visual (tema escuro e claro)
assets/css/imprimir.css layout dos documentos
assets/js/app.js        rotas, menu, busca global
assets/js/store.js      dados: Firestore ou demo (localStorage)
assets/js/negocio.js    regras (saldo, a receber, busca)
assets/js/views/        telas: painel, clientes, OS, orçamentos, notas, financeiro, catálogo, configurações
assets/js/imprimir.js   documentos: entrada, orçamento, nota de serviço, recibo
assets/js/pix.js        PIX copia e cola (padrão BCB, CRC16)
assets/vendor/qrcode.js gerador de QR Code (MIT, Kazuhiko Arase)
firebase/regras-ti.rules regras de acesso do Firestore
tools/exportar_para_firebase.php  exportação do sistema antigo
```

## Dados no Firestore

```
ti/base/clientes/{id}
ti/base/catalogo/{id}
ti/base/os/{id}            numero, codigo (OS000123), status, defeito, laudo…
ti/base/orcamentos/{id}    itens[], desconto, total, status
ti/base/pagamentos/{id}    numero do recibo, valor, forma, data
ti/base/leads/{id}         pedidos do site (o público só consegue criar)
ti/base/notas/{id}         cópia congelada do orçamento e dos pagamentos, garantia
ti/base/meta/config        dados da empresa e PIX
ti/base/meta/contadores    numeração sequencial (os, orcamento, recibo, nota)
```
