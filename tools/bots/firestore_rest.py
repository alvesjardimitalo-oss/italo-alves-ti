"""Acesso mínimo ao Firestore (REST) com a conta de serviço do secret FIREBASE_SERVICE_ACCOUNT."""
import json
import os
import sys

import google.auth.transport.requests
import requests
from google.oauth2 import service_account


def conectar():
    bruto = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '').strip()
    if not bruto:
        print('::notice::Secret FIREBASE_SERVICE_ACCOUNT não configurado — nada a fazer.')
        sys.exit(0)
    info = json.loads(bruto)
    cred = service_account.Credentials.from_service_account_info(info, scopes=['https://www.googleapis.com/auth/datastore'])
    cred.refresh(google.auth.transport.requests.Request())
    base = f'https://firestore.googleapis.com/v1/projects/{info["project_id"]}/databases/(default)/documents'
    sessao = requests.Session()
    sessao.headers['Authorization'] = 'Bearer ' + cred.token
    return sessao, base


def ler_valor(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    if 'mapValue' in v: return {k: ler_valor(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v: return [ler_valor(x) for x in v['arrayValue'].get('values', [])]
    return None


def obter(sessao, base, caminho):
    r = sessao.get(f'{base}/{caminho}', timeout=30)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return {k: ler_valor(v) for k, v in r.json().get('fields', {}).items()}


def gravar(sessao, base, caminho, campos):
    def valor(x):
        if isinstance(x, bool): return {'booleanValue': x}
        if isinstance(x, int): return {'integerValue': str(x)}
        return {'stringValue': str(x)}
    mascara = '&'.join(f'updateMask.fieldPaths={k}' for k in campos)
    r = sessao.patch(f'{base}/{caminho}?{mascara}', json={'fields': {k: valor(v) for k, v in campos.items()}}, timeout=30)
    r.raise_for_status()


def consultar(sessao, base, colecao, campo, valor):
    corpo = {'structuredQuery': {'from': [{'collectionId': colecao}],
             'where': {'fieldFilter': {'field': {'fieldPath': campo}, 'op': 'EQUAL', 'value': {'booleanValue': valor} if isinstance(valor, bool) else {'stringValue': valor}}}}}
    r = sessao.post(f'{base}:runQuery', json=corpo, timeout=30)
    r.raise_for_status()
    return [{k: ler_valor(v) for k, v in x['document'].get('fields', {}).items()} for x in r.json() if 'document' in x]
