# Ítalo InfoTec · site + sistema da assistência técnica

O projeto tem duas partes:

- **Site público** (`index.html` e `dicas/`): apresenta os serviços, traz dicas e explicações de problemas e tem o assistente **"Fale comigo"**. O assistente monta o pedido do cliente, manda para o WhatsApp e salva o contato como **lead** no sistema.
- **Sistema** (`sistema.html`, link "área técnica" no rodapé do site): a parte de gestão, descrita abaixo.

### Domínio próprio

- Site oficial preparado: **https://italoinfotec.com.br/**
- Domínio registrado no Registro.br (registro/pagamento informado pelo proprietário em 06/11/2026).
- Hospedagem: GitHub Pages; os dados continuam no Firestore do projeto `high-os`.
- Enquanto o DNS e o HTTPS não estiverem operacionais, mantenha a versão atual na `main` e não incorpore a proposta de migração para evitar indisponibilidade.

### Editar o site (sem programar)

O conteúdo editável do site fica em **`conteudo/`** (restaurado a partir das páginas publicadas). Altere apenas os arquivos dessa pasta pelo GitHub e faça commit na branch `main`; a ação **Gerar site** produzirá as páginas novamente. Antes de editar, confira os dados de empresa e textos restaurados.

| Arquivo | O que controla |
|---|---|
| `site.json` | WhatsApp, e-mail, horário, região, links do Google/Instagram, texto e foto do "Sobre", plano anual |
| `cidades.json` | cidades atendidas. Cada uma vira uma página própria no Google ("Manutenção de notebook em …") |
| `precos.json` | tabela "a partir de". Fica escondida enquanto os valores estiverem vazios |
| `galeria.json` | fotos de antes e depois (envie as fotos para `assets/galeria/`) |
| `avaliacoes.json` | avaliações reais copiadas do seu Perfil no Google |
| `artigos.json` | dicas e artigos (o texto é HTML simples) |

Não edite `index.html`, `dicas/`, `ferramentas/` e as outras páginas geradas: o gerador sobrescreve essas páginas.

**Proteção de páginas editadas à mão:** o gerador guarda em `tools/site/gerado.json` o que ele mesmo gravou. Se uma página foi alterada direto no HTML (como a página inicial, serviços, empresas e problemas), ele **não a sobrescreve** e lista essa página no log do *Gerar site*. Para forçar a regeneração completa (descarta edições manuais): `python tools/site/gerar.py --forcar`.

O `sitemap.xml` é montado varrendo todas as páginas públicas com URL canônica (inclusive as criadas à mão, como `desenvolvimento/` e `planos/`); o `lastmod` só muda quando a página muda. A promoção `sacola-misteriosa/` também entra.

### Ferramentas do site
Check-up do computador, Consertar ou trocar?, Monte seu PC, Teste de velocidade e Teste de teclado/tela/som/microfone/câmera. O resultado de cada uma pode ser enviado ao técnico pelo "Fale comigo".

### Acompanhar OS
Ao salvar uma OS, o sistema publica **status, equipamento, datas, recado e informações do orçamento quando existentes** num identificador calculado a partir do código da OS e dos últimos 8 dígitos do telefone do cliente. Evite dados pessoais ou confidenciais no campo de recados. O cliente consulta em `acompanhar.html` com esses dois dados. O comprovante de entrada já sai com o QR Code dessa página. O campo "Recado para o cliente" da OS aparece lá.

### Captar clientes (leads)

- Cada pedido feito no assistente aparece em **Pedidos do site**, dentro do sistema. Lá dá para responder pelo WhatsApp com um clique, anotar o andamento e transformar o pedido em cliente.
- Em **Divulgação e indicação**, dentro do sistema, você gera links com etiqueta de origem e QR Codes para Instagram, Google, cartão, panfleto e adesivo. Também gera o link de indicação de cada cliente (`?ref=Nome`) e vê de onde vêm os pedidos e quem mais indica.
- Em **Lembretes de manutenção** aparecem os clientes com a última OS entregue há 11 meses ou mais, com a mensagem pronta para o WhatsApp.
- Para aparecer no Google:
  - cadastre o site no **Google Search Console** e envie o `sitemap.xml`;
  - crie ou atualize o **Perfil da Empresa no Google** (Google Meu Negócio) apontando para o site.

### Preparação do Firebase App Check (sem bloquear os clientes)

O projeto **high-os** é compartilhado entre a Ítalo InfoTec e outros aplicativos. O App Check é aplicado por **serviço/projeto Firebase** (por exemplo, Cloud Firestore), não somente à coleção `ti/base/leads`. **Não ative o botão de enforcement do Firestore** enquanto os outros aplicativos que usam este projeto não estiverem registrados e enviando App Check: isso poderia interromper o High OS.

O código da Ítalo InfoTec já contém a inicialização opcional em `assets/js/app-check.js`, executada antes da primeira operação Firebase em pedidos, rastreamento e área administrativa. No estado padrão, a variável `APP_CHECK_SITE_KEY` em `assets/js/config.js` está vazia, então **nada é ativado e o funcionamento atual permanece inalterado**.

Passos para completar com segurança:

1. No projeto **high-os**, Google Cloud Console, crie uma **chave pública de site** reCAPTCHA Enterprise do tipo Web / baseada em pontuação. Autorize `italoinfotec.com.br` e, se necessário, `www.italoinfotec.com.br`. Não habilite desafio por checkbox e não autorize `localhost` na chave de produção.
2. No **Firebase Console → Security → App Check → Apps**, registre o aplicativo Web com o mesmo App ID de `assets/js/config.js` usando essa chave Enterprise. Não confunda a chave pública com segredos nem com tokens de depuração.
3. Preencha a **chave pública de site** em `APP_CHECK_SITE_KEY` (arquivo `assets/js/config.js`) e publique pelo fluxo habitual de PR e testes; valide um pedido real autorizado e uma consulta de OS.
4. No console **App Check → APIs → Cloud Firestore**, acompanhe os indicadores de solicitações verificadas/sem token. **Mantenha enforcement desativado nesta etapa**. Só habilite após adaptar e verificar todos os clientes Firebase do mesmo projeto (inclusive o High OS); alternativamente, isole a assistência técnica em um projeto Firebase próprio e planeje a migração de dados e acesso.
5. **Não habilite enforcement de Authentication** até confirmar o suporte a App Check em todos os fluxos de login. O App Check não substitui regras do Firestore, autenticação ou limitação de requisições.

A chave Enterprise do **site** é pública, mas *tokens de depuração, credenciais de servidor e chaves secretas não devem ir para o GitHub*. Atestados podem consumir a cota gratuita da API reCAPTCHA Enterprise e gerar cobranças além dela; confira a cobrança e limites no console antes de registrar a chave.

Para os pedidos funcionarem, as **regras efetivamente publicadas** no Firestore precisam do bloco `ti/base/leads`. O arquivo `firebase/regras-ti.rules` é apenas um trecho (não é um ruleset independente); o `firestore.rules` do projeto `high-os-dev` contém uma cópia. Verifique a versão publicada no Console antes de divulgar. O formulário agora só diz que registrou um pedido após o Firebase confirmar a gravação.

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


## Verificações antes de divulgar

- Abra um pull request: a ação **Validar site** confere o Python do gerador, a sintaxe dos arquivos JavaScript, os links locais, os títulos, as URLs canônicas e o sitemap.
- Após um commit em `conteudo/` na `main`, confira a execução de **Gerar site** no GitHub Actions. Não divulgue a atualização se a ação falhar.
- Faça um pedido de teste no site (sem `?demo`) e confirme que apareceu em **Pedidos do site**; confira também a abertura da mensagem no WhatsApp.
- Faça login no sistema com o usuário autorizado e confira a recusa para contas não autorizadas. Confirme as regras publicadas no Firebase; o código do repositório sozinho não comprova a regra em produção.
- Teste acompanhamento de OS usando uma OS de teste, o código e o telefone correspondentes.
- Para reduzir spam automatizado, considere ativar Firebase App Check (reCAPTCHA Enterprise) no Console e acompanhar custos/limites de escrita. O anti-spam local não é uma garantia contra bots.
- A página pública não usa ferramenta de métricas de visitas por padrão. Para medir campanhas, configure o Search Console e, se usar Analytics, atualize a política de privacidade e as escolhas de consentimento conforme aplicável.

## Trocar para domínio próprio (somente depois de registrar)

1. O domínio **italoinfotec.com.br** foi definido no arquivo `CNAME` nesta alteração. Ao incorporá-la na branch `main`, confirme em **Settings → Pages → Custom domain** que aparece `italoinfotec.com.br`.
   No Registro.br, usando o DNS do Registro.br no **modo avançado**, crie quatro registros **A** para `@` apontando para `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`, além de **CNAME** de `www` para `alvesjardimitalo-oss.github.io`. Salve a zona DNS. Não altere outros registros MX/TXT de e-mail.
2. Antes de publicar os links, verifique que o domínio aponta para o site e que HTTPS pode ser ativado.
3. A configuração `conteudo/site.json` → `base` já foi preparada como `https://italoinfotec.com.br/`. Ao incorporar esta alteração, **Gerar site** atualizará as URLs canônicas, dados estruturados, sitemap e links de compartilhamento.
4. No Firebase Authentication do projeto **high-os**, inclua **`italoinfotec.com.br`** em **Authorized domains** e teste o login pelo novo endereço. Se for utilizar o subdomínio `www` diretamente para login, adicione também `www.italoinfotec.com.br`.
5. Teste links de campanhas, QR Codes e acompanhamento das OS e atualize os links no Perfil da Empresa no Google e no Search Console.

**Atenção:** a ativação deste commit na `main` deve ocorrer depois do apontamento de DNS no Registro.br, pois configurar `CNAME` pode fazer o endereço antigo redirecionar ao novo domínio antes de ele estar acessível. Nunca altere os registros DNS de e-mail ou remova dados do Firebase como parte desta migração.

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
assets/js/site-config.js WhatsApp, horário e região (GERADO; edite conteudo/site.json)
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

## Alvesinho — atendimento virtual e conversão

O **Alvesinho** é o assistente virtual automatizado da Ítalo InfoTec. Não usa API de IA, nem oferece diagnóstico remoto definitivo:
- possui avatar próprio em `assets/img/alvesinho.svg`;
- usa aproximadamente 28 situações da base `assets/js/alvesinho-conhecimento.js` para responder por sintomas e orientar cuidados seguros;
- permite selecionar categorias ou escrever uma descrição livre, encaminhando para o formulário de orçamento existente e WhatsApp;
- a página inicial mostra 8 situações em destaque; o catálogo com 20 sintomas fica em `problemas/`, administrado em `conteudo/sintomas.json` (não renomear seus IDs sem ajustar a base do Alvesinho);
- o simulador `ferramentas/upgrade.html` ajuda a avaliar SSD/RAM por uso e configuração, sem prometer ganho ou preço;
- dados de contato só são enviados ao Firebase após o visitante preencher e concluir o fluxo de orçamento, preservando App Check e `?demo`.
- em caso de líquidos, bateria estufada ou risco elétrico, o assistente prioriza cuidado e interromper o uso, em vez de ensinar intervenções arriscadas.

Para editar a home, altere `conteudo/sintomas.json`; os arquivos HTML são regenerados pelo workflow `Gerar site`. Para adicionar conhecimento, ajuste `assets/js/alvesinho-conhecimento.js`. Para estilo, use `assets/css/site.css`. Os fluxos estão em `assets/js/site.js`.

Métricas de conversão (contatos, origem de campanha, status) continuam disponíveis em **Pedidos do site**. Não há automação de envio de mensagens ou contato não solicitado.


## Painel de conversões e métricas com consentimento

O painel está no **Sistema → Conversões do site** (`sistema.html#/conversoes`). Ele mostra:
- Pedidos e conversões de clientes (fonte: `ti/base/leads`, disponíveis independentemente do consentimento de métricas).
- Sessões monitoradas, chats abertos, sintomas, ferramentas e cliques em links do WhatsApp (fonte: `ti/base/metricasSite`, **somente quando o visitante permite a coleta**).
- Evolução por dia, canais de origem agregados, ferramentas, problemas e exportação CSV **sem contato ou dados pessoais**.

### Privacidade
O visitante pode clicar **Permitir** ou **Não permitir**. A preferência é salva no seu próprio navegador e pode ser alterada em **Preferências de métricas**, no rodapé. A coleta não registra nome, telefone, IP, conteúdo de conversa, URL de referência completa nem identificador permanente do visitante. Uma contagem é feita por tipo/categoria em cada sessão de navegador, portanto **não representa pessoas únicas nem visitas totais**. Um clique em WhatsApp não prova envio de mensagem. Em `?demo`, os eventos são gravados apenas no localStorage da demonstração e não no Firestore real.

### Etapa obrigatória para ativar coleta em produção
A nova regra de Firestore em `firebase/regras-ti.rules` deve ser **incorporada ao arquivo COMPLETO de regras do projeto high-os** e publicada no Firebase Console. Não copie apenas o fragmento isolado para substituir as regras existentes. A regra autoriza somente a criação de eventos com cinco campos validados e mantém a leitura restrita ao dono. No sistema publicado, antes da regra, os pedidos reais continuam visíveis no painel; as sessões poderão ficar zeradas.

O Firebase `high-os` é compartilhado. **Não ative enforcement geral do App Check** para o Firestore enquanto o High OS e os demais aplicativos não estiverem preparados. A API pública de métricas não possui limite de escrita imposto pelo Firestore Rules; monitore as cotas e eventuais abusos. Para alto tráfego, prefira mover a coleta para uma função server-side com App Check obrigatório e rate limiting.

Quando a regra for publicada, abra o site, permita métricas, converse com o Alvesinho e confira depois `sistema.html#/conversoes`. No modo demo, utilize `?demo` em ambas as páginas para verificar os eventos sem gravar no Firebase.

## Arquitetura modular do site (novembro de 2026)

**A home é uma vitrine, não um catálogo inteiro.** Oferece oito sintomas, quatro serviços, três ferramentas, Alvesinho, passo a passo, informações de atendimento, avaliações, três artigos recentes e perguntas frequentes. As páginas internas apresentam o conteúdo completo.

| Mudança desejada | Arquivo de origem |
| --- | --- |
| Texto, blocos e links da **home** | `tools/site/paginas/home.py` |
| Catálogo **Problemas comuns** e **Serviços** | `tools/site/paginas/catalogos.py` |
| Geração de páginas de artigos | `tools/site/paginas/dicas.py` |
| Criar/alterar artigos | `conteudo/artigos.json` |
| Sintomas do catálogo, categoria, vínculo com artigo | `conteudo/sintomas.json` |
| Respostas técnicas do Alvesinho | `assets/js/alvesinho-conhecimento.js` |
| Chat e botões do site | `assets/js/site.js` |
| Aparência e responsividade | `assets/css/site.css` |
| Layout compartilhado, páginas administrativas e sitemap | `tools/site/gerar.py` |
| Verificação de links e arquivos | `tools/site/validar.py` |
| Testes de conteúdo e arquitetura | `tools/site/testar-arquitetura.mjs` |

Ao editar arquivos em `conteudo/` ou `tools/site/`, o GitHub Actions **Gerar site** recria as páginas e sitemap automaticamente após o merge na branch principal. Não edite `index.html`, `dicas/*.html`, `servicos/index.html` ou `problemas/index.html` manualmente: são arquivos gerados.

**Diagnóstico de falhas:** se apenas uma área apresentar problema, verifique primeiro seu módulo específico. Os testes automáticos percorrem as páginas, conferem referências internas, URLs canônicas, catálogo, artigos e sitemap antes da publicação. O painel administrativo e a coleção de clientes não foram alterados nesta reorganização.

**Produção:** não se alteram dados de clientes, Firestore, autenticação Google, App Check ou métricas nesta mudança. A integração de orçamento e acompanhamento de OS continua a mesma.

## Busca local e navegação aprimorada

- As páginas `problemas/` e `dicas/` oferecem filtro instantâneo: o texto é processado **inteiramente no navegador**, sem envio de consulta ao Firebase nem armazenamento.
- O campo ignora diferença entre maiúsculas e minúsculas e acentos, aceita várias palavras e exibe quantidade de resultados; se nenhum resultado combina, apresenta caminho para atendimento via Alvesinho.
- O menu do celular usa `aria-expanded`, fecha ao selecionar link, ao pressionar Escape ou ao tocar fora dele.
- O componente isolado está em `assets/js/busca-conteudo.js`. A marcação fica em `tools/site/paginas/catalogos.py` e `dicas.py`. Estilos estão em `assets/css/site.css`.
- Os testes de regressão estão em `tools/site/testar-busca.mjs`. Sem mudança no banco, regras Firebase, login, orçamentos ou OS.

## Black Friday da Karen: roleta, carrinho e Pix

- Página: `/sacola-misteriosa/roleta/`. Perfumes e preços cheios em `assets/js/perfumes-bf.js` (lista única, usada pela página e pelo painel). Fotos em `sacola-misteriosa/perfumes/<foto>.webp`.
- **Cupom:** 1% a 10% (roleta), 1 por compra, aplicado no carrinho sobre o preço cheio. Com 10% o preço fica igual ao preço Black Friday da loja.
- **Compra:** cada frasco é uma **vaga numerada** em `ti/base/vagas-bf/{foto}-{n}` (sem dados pessoais). O carrinho grava as vagas num lote só; as regras do Firebase recusam vaga ocupada, então duas clientes nunca pegam o mesmo frasco (o carrinho tenta outra vaga ou avisa que esgotou). Depois registra o pedido em `leads` (origem `black-friday-pedido`) e mostra o Pix (copia e cola + QR) com **10 minutos** para pagar.
- **Sem pagamento em 10 min:** a vaga vence e pode ser reservada de novo (o frasco volta ao site sozinho), o pedido aparece como cancelado no painel e o cupom fica **perdido**.
- **Estoque no painel = total de frascos à venda.** Vendidos e reservados são descontados automaticamente; a Karen só aumenta o número quando chegar mais produto.
- **Painel › Sacolas Misteriosas:** chave Pix da Karen (configuração da promoção), estoque dos perfumes, pedidos com prazo ao vivo, aviso sonoro de compra nova e botões *Pix recebido* (marca os frascos como vendidos e o cupom como usado), *Cancelar* e *Desfazer*.
- **Regra do Firestore obrigatória:** o bloco `vagas-bf` de `firebase/regras-ti.rules` precisa estar publicado no Console (*Firestore Database › Regras*), junto com os demais blocos da TI, **antes** da regra final `match /{document=**}`. Sem ele, o carrinho mostra "Não foi possível reservar os perfumes" e nenhuma compra é registrada.
- Limitação: a confirmação do Pix é manual (a Karen confere no banco). Se ela confirmar um Pix depois do prazo e o frasco já tiver sido reservado por outra cliente, o painel avisa.
