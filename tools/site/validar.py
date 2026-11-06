#!/usr/bin/env python3
"""Valida as páginas estáticas geradas antes de publicar no GitHub Pages."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SITE = json.loads((ROOT / 'conteudo/site.json').read_text(encoding='utf-8'))
BASE = SITE['base'].rstrip('/') + '/'
PROJECT_PREFIX = '/' + urlsplit(BASE).path.strip('/') + '/' if urlsplit(BASE).path.strip('/') else '/'
SKIP = {'sistema.html', 'imprimir.html'}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.canonical = None
        self.title = False
        self.description = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title':
            self.title = True
        if tag == 'meta' and a.get('name') == 'description':
            self.description = True
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        for key in ('href', 'src'):
            if key in a:
                self.links.append(a[key])


def resolver(page, link):
    if link.startswith(('#', '//')) or any(link.startswith(p) for p in ('http:', 'https:', 'mailto:', 'tel:', 'data:', 'javascript:')):
        return None
    parsed = urlsplit(link)
    path = unquote(parsed.path)
    if not path:
        return None
    if path.startswith('/'):
        if not path.startswith(PROJECT_PREFIX):
            raise ValueError(f'URL absoluta fora do projeto: {path}')
        path = path[len(PROJECT_PREFIX):]
        components = []
    else:
        components = list(page.parent.relative_to(ROOT).parts)
    for piece in path.split('/'):
        if piece in ('', '.'):
            continue
        if piece == '..':
            if components:
                components.pop()
            else:
                raise ValueError(f'Caminho fora do projeto: {link}')
        else:
            components.append(piece)
    target = ROOT.joinpath(*components)
    if path.endswith('/') or target.is_dir():
        target = target / 'index.html'
    return target


errors = []
pages = sorted(ROOT.glob('*.html')) + sorted((ROOT / 'dicas').glob('*.html')) + sorted((ROOT / 'atendimento').glob('*.html')) + sorted((ROOT / 'ferramentas').glob('*.html'))
for page in pages:
    html = page.read_text(encoding='utf-8')
    parsed = Links()
    parsed.feed(html)
    rel = page.relative_to(ROOT).as_posix()
    if rel not in SKIP and rel != '404.html':
        expected = BASE + (rel[:-10] if rel.endswith('/index.html') else ('' if rel == 'index.html' else rel))
        if parsed.canonical != expected:
            errors.append(f'{rel}: canonical incorreto {parsed.canonical!r}, esperado {expected!r}')
        if not parsed.title or not parsed.description:
            errors.append(f'{rel}: title ou description ausente')
    for link in parsed.links:
        try:
            target = resolver(page, link)
            if target and not target.is_file():
                errors.append(f'{rel}: link sem arquivo -> {link}')
        except ValueError as e:
            errors.append(f'{rel}: {e}')

sitemap = (ROOT / 'sitemap.xml').read_text(encoding='utf-8')
robots = (ROOT / 'robots.txt').read_text(encoding='utf-8')
if BASE + 'sitemap.xml' not in robots:
    errors.append('robots.txt não aponta para o sitemap configurado')
if BASE not in sitemap:
    errors.append('sitemap não contém a URL principal')

if errors:
    for err in errors[:80]:
        print('ERRO:', err)
    raise SystemExit(f'{len(errors)} problemas encontrados')
print(f'OK: {len(pages)} páginas, arquivos internos, metadados e sitemap validados.')
