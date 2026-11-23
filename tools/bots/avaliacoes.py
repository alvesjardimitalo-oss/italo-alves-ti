"""Leva para o site (conteudo/avaliacoes.json) as avaliações do Discord que o cliente autorizou:
nota 4 ou 5, com comentário e primeiro nome. As avaliações colocadas à mão continuam."""
import datetime as dt
import json
import os

from firestore_rest import conectar, consultar

ARQ = os.path.join(os.path.dirname(__file__), '..', '..', 'conteudo', 'avaliacoes.json')
MESES = 'jan fev mar abr mai jun jul ago set out nov dez'.split()

sessao, base = conectar()
docs = consultar(sessao, base, 'discord_infotec_avaliacoes', 'publicarSite', True)
docs = [d for d in docs if (d.get('nota') or 0) >= 4 and (d.get('comentario') or '').strip() and (d.get('nomeSite') or '').strip()]
docs.sort(key=lambda d: d.get('criadoEm') or 0, reverse=True)

atual = json.load(open(ARQ, encoding='utf-8'))
manuais = [a for a in atual.get('itens', []) if a.get('origem') != 'discord']
do_discord = []
for d in docs[:12]:
    quando = dt.datetime.fromtimestamp((d.get('criadoEm') or 0) / 1000)
    do_discord.append({'nome': d['nomeSite'].strip()[:30], 'nota': int(d['nota']), 'texto': d['comentario'].strip()[:400],
                       'data': f'{MESES[quando.month - 1]}/{quando.year}', 'servico': d.get('servicoNome') or '', 'origem': 'discord'})
novo = {**atual, 'itens': manuais + do_discord}
if novo != atual:
    with open(ARQ, 'w', encoding='utf-8') as f:
        json.dump(novo, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'{len(do_discord)} avaliação(ões) do Discord no site.')
else:
    print('Nada mudou.')
