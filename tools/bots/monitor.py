"""Confere se os bots do Discord (Ítalo InfoTec e Karen) estão vivos.
Se um deles parar (os dois PCs desligados), avisa no próprio Discord pelo webhook
e faz este job falhar uma vez — o GitHub manda e-mail. Avisa de novo quando voltar."""
import datetime as dt
import sys
import time

import requests

from firestore_rest import conectar, gravar, obter

sessao, base = conectar()
agora = time.time()
LIMITE = 4 * 60  # segundos sem sinal para considerar fora do ar


def iso_para_seg(s):
    try:
        return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00')).timestamp()
    except ValueError:
        return 0


def avisar(webhook, texto):
    if not webhook:
        return
    try:
        requests.post(webhook, json={'username': 'Monitor do bot', 'content': texto}, timeout=20)
    except requests.RequestException as e:
        print('webhook falhou:', e)


lider_ti = obter(sessao, base, 'discord_infotec/lider') or {}
lider_k = obter(sessao, base, 'ti/base/botKaren/lider') or {}
mon_ti = obter(sessao, base, 'discord_infotec/monitor') or {}
mon_k = obter(sessao, base, 'ti/base/botKaren/monitor') or {}

bots = [
    ('infotec', 'Bot da Ítalo InfoTec', (lider_ti.get('expiraEm') or 0) / 1000 - 30, lider_ti.get('nome') or lider_ti.get('host'), mon_ti.get('webhook')),
    ('karen', 'Bot da Karen', iso_para_seg(lider_k.get('vistoEm')), lider_k.get('dono'), mon_k.get('webhook')),
]
estado = obter(sessao, base, 'discord_infotec/monitorEstado') or {}
novo, caiu = {}, []
for chave, nome, ultimo, pc, webhook in bots:
    parado = agora - ultimo if ultimo else None
    ok = parado is not None and parado < LIMITE
    novo[chave] = 'ok' if ok else 'fora'
    print(f'{nome}: {"OK" if ok else "FORA DO AR"} · último sinal há {int(parado) if parado is not None else "?"} s · PC: {pc or "?"}')
    if not ultimo:
        continue  # bot ainda não registrou nada: não alarma
    if not ok and estado.get(chave) != 'fora':
        caiu.append(nome)
        avisar(webhook, f'🚨 **{nome} fora do ar** há {int(parado // 60)} min (último PC: {pc or "?"}). Os dois PCs podem estar desligados ou sem internet.')
    if ok and estado.get(chave) == 'fora':
        avisar(webhook, f'✅ **{nome} voltou** (PC: {pc or "?"}).')

gravar(sessao, base, 'discord_infotec/monitorEstado', novo)
if caiu:
    print('::error::' + ', '.join(caiu) + ' fora do ar')
    sys.exit(1)
