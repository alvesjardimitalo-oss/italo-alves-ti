# Ítalo Alves TI · sistema da assistência técnica

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

Abra `…/italo-alves-ti/?demo` para testar sem tocar nos dados reais. Nesse modo os dados ficam só no navegador.

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
index.html              app (login + telas)
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
ti/base/notas/{id}         cópia congelada do orçamento e dos pagamentos, garantia
ti/base/meta/config        dados da empresa e PIX
ti/base/meta/contadores    numeração sequencial (os, orcamento, recibo, nota)
```
