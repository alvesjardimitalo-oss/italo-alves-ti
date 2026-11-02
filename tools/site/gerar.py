#!/usr/bin/env python3
"""
Gera as páginas estáticas do site público a partir de conteudo/*.json.

Roda sozinho no GitHub Actions a cada alteração em conteudo/ (workflow "Gerar site").
Para rodar no PC (opcional): python tools/site/gerar.py
"""
import datetime
import html
import json
import os
import re
import unicodedata

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
C = lambda nome: json.load(open(os.path.join(RAIZ, 'conteudo', nome), encoding='utf-8'))
SITE = C('site.json')
ARTIGOS = C('artigos.json')
CIDADES = [c for c in C('cidades.json')['cidades'] if c.get('cidade')]
PRECOS = [p for p in C('precos.json')['servicos'] if p.get('a_partir_de')]
GALERIA = C('galeria.json')['itens']
AVALIACOES = C('avaliacoes.json')['itens']
BASE = SITE['base'].rstrip('/') + '/'
NOME = SITE['nome']
HOJE = datetime.date.today().isoformat()
V = '2.0.0'
e = html.escape


def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def gravar(caminho, conteudo):
    p = os.path.join(RAIZ, caminho)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(conteudo)


ICO = {
    'diag': '<path d="M3 12h4l3 7 4-14 3 7h4"/>',
    'fan': '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 4M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-4-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-4M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l4 4"/>',
    'ssd': '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h3"/><circle cx="17" cy="12" r="1.5"/>',
    'win': '<path d="M3 5.5 10.5 4.5v7H3zM12 4.3 21 3v8.5h-9zM3 12.5h7.5v7L3 18.5zM12 12.5h9V21l-9-1.3z"/>',
    'apps': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
    'tool': '<path d="M14.7 6.3a4 4 0 0 0 5.2 5.2L12 19.4a2.1 2.1 0 0 1-3-3z"/><path d="M14.7 6.3 17 4a4 4 0 0 1 3 3l-2.3 2.3"/>',
    'cpu': '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    'remote': '<rect x="2.5" y="4" width="19" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M9 10h6M13 8l2 2-2 2"/>',
    'pin': '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'chat': '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    'book': '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
    'pulse': '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    'scale': '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
    'speed': '<path d="M12 14l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/>',
    'keys': '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'shield': '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    'build': '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
    'calendar': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'gift': '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zM12 8c2-4 6-4 6-1.5S14 8 12 8z"/>',
    'star': '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
}


def ico(n, s=22):
    return f'<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICO[n]}</svg>'


WA_LINK = f"https://wa.me/{SITE['whatsapp']}?text=" + 'Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.' if SITE.get('whatsapp') else '#fale-comigo'


def head(titulo, desc, caminho, raiz, ld=None, tipo='website', noindex=False):
    url = BASE + caminho
    lds = ''.join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in (ld or []))
    return f'''<!DOCTYPE html>
<html lang="pt-BR" data-raiz="{raiz}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(titulo)}</title>
  <meta name="description" content="{e(desc)}">
{'  <meta name="robots" content="noindex">' + chr(10) if noindex else ''}  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="#070b14">
  <meta property="og:type" content="{tipo}">
  <meta property="og:title" content="{e(titulo)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="{e(NOME)}">
  <meta property="og:locale" content="pt_BR">
  <link rel="icon" href="{raiz}assets/img/logo.svg" type="image/svg+xml">
  <link rel="manifest" href="{raiz}site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap">
  <link rel="stylesheet" href="{raiz}assets/css/site.css?v={V}">
{lds}</head>
<body>
  <header class="topo">
    <div class="wrap">
      <a href="{raiz}" class="marca"><img src="{raiz}assets/img/logo.svg" alt="">Ítalo Alves <span class="grad">TI</span></a>
      <nav class="menu" aria-label="Principal">
        <a href="{raiz}#servicos">Serviços</a>
        <a href="{raiz}ferramentas/">Ferramentas</a>
        <a href="{raiz}dicas/">Dicas</a>
        <a href="{raiz}empresas.html">Empresas</a>
        <a href="{raiz}acompanhar.html">Acompanhar OS</a>
      </nav>
      <a href="#fale-comigo" class="btn btn-pri btn-sm btn-topo" data-abrir-chat>Pedir orçamento</a>
      <button class="menu-toggle" type="button" aria-label="Menu">☰</button>
    </div>
  </header>
'''


def rodape(raiz, extra_js=''):
    links_dicas = ''.join(f'<li><a href="{raiz}dicas/{a["slug"]}.html">{e(a["curto"])}</a></li>' for a in ARTIGOS[:5])
    sociais = ''.join(x for x in [
        f'<li><a href="{e(SITE["instagram_url"])}" rel="noopener" target="_blank">Instagram</a></li>' if SITE.get('instagram_url') else '',
        f'<li><a href="{e(SITE["google_perfil_url"])}" rel="noopener" target="_blank">Perfil no Google</a></li>' if SITE.get('google_perfil_url') else '',
    ])
    return f'''
  <footer class="rodape">
    <div class="wrap">
      <div>
        <a href="{raiz}" class="marca"><img src="{raiz}assets/img/logo.svg" alt="">Ítalo Alves <span class="grad">TI</span></a>
        <p>Manutenção de computadores e notebooks. Atendimento presencial em {e(SITE["regiao_presencial"])} e suporte remoto para todo o Brasil.</p>
        {f'<p><b>{e(SITE["horario"])}</b></p>' if SITE.get('horario') else ''}
        {f'<p>WhatsApp: <a href="{WA_LINK}" rel="noopener" target="_blank">{e(SITE["telefone_exibicao"])}</a></p>' if SITE.get('whatsapp') else ''}
      </div>
      <div><h4>Dicas</h4><ul>{links_dicas}<li><a href="{raiz}dicas/">Ver todas</a></li></ul></div>
      <div><h4>Atendimento</h4><ul>
        <li><a href="#fale-comigo" data-abrir-chat>Fale comigo</a></li>
        <li><a href="{raiz}acompanhar.html">Acompanhar minha OS</a></li>
        <li><a href="{raiz}ferramentas/checkup.html">Check-up do computador</a></li>
        <li><a href="{raiz}suporte-remoto.html">Suporte remoto</a></li>
        <li><a href="{raiz}atendimento/">Cidades atendidas</a></li>
        <li><a href="{raiz}garantia.html">Garantia</a></li>
        <li><a href="{raiz}sobre.html">Sobre</a></li>
        {sociais}
        <li><a href="{raiz}politica-de-privacidade.html">Privacidade</a></li>
      </ul></div>
    </div>
    <div class="rodape-base"><span>© <span data-ano></span> {e(NOME)} · {e(SITE["cidade"])}/{e(SITE["uf"])}</span><a class="area-tec" href="{raiz}sistema.html" rel="nofollow">área técnica</a></div>
  </footer>
  {f'<a class="wa-fab" href="{WA_LINK}" target="_blank" rel="noopener" aria-label="Chamar no WhatsApp"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.2z"/></svg></a>' if SITE.get('whatsapp') else ''}
  <script type="module" src="{raiz}assets/js/site.js?v={V}"></script>{extra_js}
</body>
</html>
'''


def pagina_simples(caminho, raiz, titulo, desc, crumb, h1, sub, corpo, ld=None, lateral=True, extra_js=''):
    lat = f'''<aside class="lateral">
        <div class="card"><h3>Precisa de ajuda?</h3><p>Atendimento presencial em {e(SITE["regiao_presencial"])} e remoto para todo o Brasil.</p>
          <a href="#fale-comigo" class="btn btn-pri btn-sm" style="margin-top:14px;width:100%" data-abrir-chat>Pedir orçamento</a></div>
        <div class="card"><h3>Ferramentas grátis</h3><ul class="lista-links">
          <li><a href="{raiz}ferramentas/checkup.html">Check-up do computador</a></li>
          <li><a href="{raiz}ferramentas/consertar-ou-trocar.html">Consertar ou trocar?</a></li>
          <li><a href="{raiz}ferramentas/monte-seu-pc.html">Monte seu PC</a></li>
          <li><a href="{raiz}ferramentas/velocidade.html">Teste de velocidade</a></li>
          <li><a href="{raiz}ferramentas/testes.html">Teste de teclado, tela e som</a></li></ul></div>
      </aside>''' if lateral else ''
    gravar(caminho, head(titulo, desc, caminho, raiz, ld) + f'''
  <main>
    <div class="artigo-hero"><div class="wrap">
      <div class="crumb">{crumb}</div>
      <h1>{h1}</h1>{f'<p>{sub}</p>' if sub else ''}
    </div></div>
    <div class="wrap {'artigo' if lateral else 'pagina-larga'}">
      <article class="conteudo">
{corpo}
      </article>
      {lat}
    </div>
  </main>
''' + rodape(raiz, extra_js))


def cta(titulo='Quer que eu dê uma olhada?', texto='Conte o que está acontecendo e receba o orçamento antes de qualquer serviço.', botao='Fale comigo', servico=''):
    ds = f' data-servico="{e(servico)}"' if servico else ''
    return f'''<div class="cta" style="margin-top:40px;padding:34px 20px"><h2 style="font-size:1.4rem">{e(titulo)}</h2><p>{e(texto)}</p>
        <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat{ds}>{e(botao)}</a></div>'''


# ==================================================================
# Dados usados em várias páginas
# ==================================================================
SERVICOS = [
    ('diag', 'Diagnóstico técnico', 'Descobrimos a causa do defeito e você recebe o orçamento antes de qualquer serviço.'),
    ('fan', 'Limpeza e pasta térmica', 'Fim do superaquecimento e dos desligamentos: limpeza interna, pasta e thermal pads.'),
    ('ssd', 'Upgrade de SSD e memória', 'O jeito mais barato de deixar um computador antigo rápido de novo, com seus arquivos migrados.'),
    ('win', 'Formatação e Windows 11', 'Sistema limpo e atualizado, com backup dos seus arquivos e programas essenciais.'),
    ('apps', 'Programas e configuração', 'Instalação e configuração de programas, impressoras, e-mail, Wi-Fi e contas.'),
    ('tool', 'Troca de peças', 'Carcaça, tampa, dobradiça, teclado, tela, fonte e conectores de notebooks e PCs.'),
    ('cpu', 'Montagem de computadores', 'Montagem e testes de PCs para trabalho, estudo e jogos, com peças escolhidas para o seu uso.'),
    ('remote', 'Suporte remoto', 'Problemas de programa e configuração resolvidos à distância, em qualquer cidade do Brasil.'),
]
FERRAMENTAS = [
    ('pulse', 'Check-up do computador', 'Análise rápida do seu aparelho + perguntas sobre os sintomas = laudo prévio com as causas prováveis.', 'checkup.html'),
    ('scale', 'Consertar ou trocar?', 'Descubra se vale mais a pena consertar, fazer upgrade ou comprar um equipamento novo.', 'consertar-ou-trocar.html'),
    ('cpu', 'Monte seu PC', 'Diga para que vai usar e receba uma configuração equilibrada, sem peça sobrando nem faltando.', 'monte-seu-pc.html'),
    ('speed', 'Teste de velocidade', 'Meça a internet do seu aparelho e entenda se a lentidão é do computador ou da rede.', 'velocidade.html'),
    ('keys', 'Teclado, tela e som', 'Teste teclas, pixels mortos, alto-falantes, microfone e câmera direto no navegador.', 'testes.html'),
]
PROBLEMAS = [
    ('Meu notebook esquenta e desliga sozinho', 'Quase sempre é poeira acumulada no cooler e pasta térmica ressecada. O processador passa do limite de temperatura e o notebook desliga para se proteger. Insistir no uso assim pode danificar a placa.', 'notebook-esquentando'),
    ('O computador ficou muito lento', 'As causas mais comuns são HD mecânico (o principal vilão), pouca memória RAM, programas que abrem com o sistema e vírus. Trocar o HD por um SSD costuma ser a melhor relação custo-benefício.', 'computador-lento'),
    ('Aperto o botão e nada acontece', 'Pode ser a fonte, o carregador, a bateria, o botão ou a placa-mãe. Antes de levar ao técnico, há verificações simples que resolvem parte dos casos.', 'computador-nao-liga'),
    ('Apareceu uma tela azul com erro', 'A "tela azul" indica uma falha grave: driver com problema, memória RAM, disco com defeito ou atualização mal instalada. O código do erro ajuda muito no diagnóstico. Anote ou tire uma foto.', 'tela-azul'),
    ('Abrem propagandas e páginas sozinhas', 'É sinal de programa indesejado ou de extensão maliciosa no navegador. Evite digitar senhas e dados de banco nesse computador até que ele seja limpo.', 'virus-e-golpes'),
    ('A bateria do notebook não dura nada', 'Bateria é peça de desgaste. Depois de alguns anos ela perde capacidade. Se estiver estufada, pare de usar na hora: há risco de incêndio.', 'bateria-notebook'),
    ('O Wi-Fi não conecta ou fica caindo', 'Pode ser o roteador, a configuração de rede do Windows, o driver ou a placa Wi-Fi. Dá para descobrir em poucos passos.', 'wifi-nao-conecta'),
]
FAQ = [
    ('Vou pagar só para saber o defeito?', 'O diagnóstico vem antes de tudo e o orçamento é passado para você aprovar. Nenhum serviço é feito sem a sua autorização.'),
    ('Vou perder meus arquivos?', 'Sempre que possível, os arquivos são preservados. Antes de formatar, fazemos a cópia dos seus documentos, fotos e pastas importantes, combinado com você.'),
    ('Quanto tempo demora?', 'Depende do defeito e da disponibilidade de peças. Serviços como limpeza, formatação e troca de SSD costumam ser rápidos. O prazo é informado junto com o orçamento.'),
    ('Como acompanho o meu conserto?', 'Pela página "Acompanhar OS": digite o código da ordem de serviço e o seu telefone para ver o status, sem precisar ligar.'),
    ('O serviço tem garantia?', f'Sim. A garantia dos serviços ({SITE.get("garantia_dias", 90)} dias) vem descrita na nota de serviço que você recebe na entrega.'),
    ('Atende fora da minha cidade?', f'O atendimento presencial é em {SITE["regiao_presencial"]}. Para outras cidades, muitos problemas de programa e configuração são resolvidos por suporte remoto, com você acompanhando tudo pela tela.'),
    ('Quais as formas de pagamento?', 'PIX, dinheiro e cartão. O orçamento e a nota já saem com QR Code PIX para facilitar.'),
]


def ld_negocio():
    d = {
        "@context": "https://schema.org", "@type": "ComputerStore", "name": NOME, "url": BASE,
        "image": BASE + "assets/img/logo.svg", "email": SITE.get('email'),
        "address": {"@type": "PostalAddress", "streetAddress": SITE['endereco'], "addressLocality": SITE['cidade'],
                    "addressRegion": SITE['uf'], "postalCode": SITE.get('cep', ''), "addressCountry": "BR"},
        "areaServed": [{"@type": "City", "name": c['cidade']} for c in CIDADES] + [{"@type": "Country", "name": "Brasil"}],
        "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s[1]}} for s in SERVICOS],
    }
    if SITE.get('whatsapp'):
        d['telephone'] = '+' + SITE['whatsapp']
    if '24 horas' in (SITE.get('horario') or ''):
        d['openingHours'] = 'Mo-Su 00:00-23:59'
    if AVALIACOES:
        notas = [float(a.get('nota', 5)) for a in AVALIACOES]
        d['aggregateRating'] = {"@type": "AggregateRating", "ratingValue": round(sum(notas) / len(notas), 1), "reviewCount": len(notas)}
    return d


def estrelas(n):
    n = int(round(float(n or 5)))
    return '<span class="estrelas" aria-label="%d de 5">%s</span>' % (n, '★' * n + '☆' * (5 - n))


def secao_precos(raiz):
    if not PRECOS:
        return ''
    linhas = ''.join(f'<tr><td>{e(p["servico"])}{('<div class="sub">' + e(p["obs"]) + '</div>') if p.get("obs") else ""}</td><td class="r mono">a partir de {e(p["a_partir_de"])}</td></tr>' for p in PRECOS)
    return f'''<section class="sec alt" id="precos"><div class="wrap">
      <div class="sec-head"><span class="kicker">// preços de referência</span><h2>Quanto custa</h2><p>Valores de referência. O preço final depende do equipamento e vem no orçamento, antes de qualquer serviço.</p></div>
      <div class="card" style="padding:0;overflow:hidden"><table class="tabela-precos">{linhas}</table></div>
    </div></section>'''


def secao_galeria(raiz):
    if not GALERIA:
        return ''
    itens = ''.join(f'''<figure class="antes-depois">
        <div class="ad-fotos"><div><img src="{raiz}{e(g["antes"])}" alt="Antes: {e(g.get("titulo",""))}" loading="lazy"><span>antes</span></div>
        <div><img src="{raiz}{e(g["depois"])}" alt="Depois: {e(g.get("titulo",""))}" loading="lazy"><span>depois</span></div></div>
        <figcaption><b>{e(g.get("titulo",""))}</b>{f"<br>{e(g['texto'])}" if g.get("texto") else ""}</figcaption></figure>''' for g in GALERIA)
    return f'''<section class="sec" id="galeria"><div class="wrap">
      <div class="sec-head"><span class="kicker">// antes e depois</span><h2>Serviços realizados</h2></div>
      <div class="grid g3">{itens}</div></div></section>'''


def secao_avaliacoes():
    if not AVALIACOES:
        return ''
    itens = ''.join(f'<div class="card avaliacao">{estrelas(a.get("nota", 5))}<p>“{e(a["texto"])}”</p><div class="sub">— {e(a["nome"])}{" · " + e(a["data"]) if a.get("data") else ""}</div></div>' for a in AVALIACOES[:6])
    bot = f'<p style="margin-top:20px"><a class="btn" href="{e(SITE["google_perfil_url"])}" target="_blank" rel="noopener">Ver todas no Google</a></p>' if SITE.get('google_perfil_url') else ''
    return f'''<section class="sec alt" id="avaliacoes"><div class="wrap">
      <div class="sec-head"><span class="kicker">// avaliações</span><h2>O que dizem os clientes</h2><p>Avaliações publicadas no Google.</p></div>
      <div class="grid g3">{itens}</div>{bot}</div></section>'''


def secao_plano(raiz):
    p = SITE.get('plano_anual') or {}
    if not p.get('ativo'):
        return ''
    preco = f'<div class="plano-preco mono">{e(p["preco"])}<small>/ano</small></div>' if p.get('preco') else '<div class="plano-preco" style="font-size:1.1rem">Valor sob consulta</div>'
    return f'''<section class="sec" id="plano"><div class="wrap">
      <div class="plano card">
        <div><span class="kicker mono">// plano de manutenção anual</span><h2>Seu computador cuidado o ano todo</h2>
          <p>Para quem depende do computador e não quer ser pego de surpresa. Você recebe o lembrete e a manutenção é feita no tempo certo.</p>
          <ul class="lista-check">{''.join(f"<li>{e(i)}</li>" for i in p.get("itens", []))}</ul></div>
        <div class="plano-lado">{preco}<a href="#fale-comigo" class="btn btn-pri" data-abrir-chat data-servico="Plano de manutenção anual">Quero o plano</a>
          <p class="sub">Ideal também para escritórios. <a href="{raiz}empresas.html">Ver planos para empresas</a></p></div>
      </div></div></section>'''


# ==================================================================
# Página inicial
# ==================================================================
def gerar_home():
    cidades_txt = ', '.join(c['cidade'] for c in CIDADES if c.get('presencial'))
    ld_faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}
    h = head(f'{NOME} · Manutenção de computadores e notebooks', f'Manutenção de computadores e notebooks em {SITE["cidade"]}/{SITE["uf"]} e suporte remoto para todo o Brasil. Diagnóstico, limpeza, SSD, formatação, Windows 11 e troca de peças, com orçamento antes do serviço.', '', './', [ld_negocio(), ld_faq])
    fato24 = f'<div><b>24 horas</b>atendimento a qualquer hora</div>' if '24' in (SITE.get('horario') or '') else ''
    h += f'''
  <main>
  <section class="hero">
    <div class="wrap">
      <div>
        <span class="selo">assistência técnica em informática</span>
        <h1>Seu computador <span class="grad">de volta ao trabalho</span>, sem enrolação.</h1>
        <p class="lead">Manutenção de notebooks e computadores com diagnóstico claro e orçamento antes de qualquer serviço. Atendimento presencial em {e(SITE["regiao_presencial"])} e suporte remoto para todo o Brasil.</p>
        <div class="hero-acoes">
          <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat>{ico("chat", 20)} Pedir orçamento</a>
          <a href="ferramentas/checkup.html" class="btn">{ico("pulse", 20)} Fazer check-up grátis</a>
        </div>
        <div class="hero-fatos">
          <div><b>Orçamento antes</b>nada é feito sem sua aprovação</div>
          <div><b>Garantia</b>descrita na nota de serviço</div>
          <div><b>Brasil todo</b>por suporte remoto</div>
          {fato24}
        </div>
      </div>
      <a class="terminal" href="ferramentas/checkup.html" id="hero-checkup" aria-label="Fazer o check-up do meu computador">
        <div class="terminal-top"><i></i><i></i><i></i><span>check-up · seu aparelho</span></div>
        <div class="terminal-body">
          <div class="diag"><span>Sistema</span><span class="ok" data-hc="so">…</span></div>
          <div class="diag"><span>Navegador</span><span class="ok" data-hc="nav">…</span></div>
          <div class="diag"><span>Processador</span><span data-hc="cpu">…</span></div>
          <div class="diag"><span>Memória (aprox.)</span><span data-hc="ram">…</span></div>
          <div class="diag"><span>Tela</span><span class="ok" data-hc="tela">…</span></div>
          <div class="barra-diag"><span></span></div>
          <div class="terminal-cta">→ faça o check-up completo e receba o laudo prévio</div>
        </div>
      </a>
    </div>
  </section>

  <section class="sec alt" id="servicos">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// serviços</span><h2>O que eu resolvo</h2><p>Do notebook que esquenta ao computador que não liga, com explicação do que foi feito e por quê.</p></div>
      <div class="grid g4">
        {''.join(f'<a class="card" href="#fale-comigo" data-abrir-chat data-servico="{e(t)}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Pedir orçamento →</span></a>' for i, t, d in SERVICOS)}
      </div>
    </div>
  </section>

  <section class="sec" id="ferramentas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// ferramentas grátis</span><h2>Descubra o problema antes de sair de casa</h2><p>Testes que rodam direto no navegador. Sem instalar nada.</p></div>
      <div class="grid g5">
        {''.join(f'<a class="card" href="ferramentas/{h_}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Usar →</span></a>' for i, t, d, h_ in FERRAMENTAS)}
      </div>
    </div>
  </section>

  <section class="sec alt" id="como-funciona">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// como funciona</span><h2>Do problema à entrega, em 4 passos</h2></div>
      <div class="grid g4 passos">
        <div class="card passo"><h3>Conte o problema</h3><p>Pelo assistente "Fale comigo" ou WhatsApp. Leva menos de um minuto.</p></div>
        <div class="card passo"><h3>Diagnóstico e orçamento</h3><p>O equipamento é avaliado e você recebe o orçamento detalhado, peça por peça.</p></div>
        <div class="card passo"><h3>Aprovação e conserto</h3><p>Só depois do seu "pode fazer". Você acompanha o status pela página <a href="acompanhar.html">Acompanhar OS</a>.</p></div>
        <div class="card passo"><h3>Entrega com garantia</h3><p>Você recebe a nota de serviço com tudo o que foi feito e o prazo de garantia.</p></div>
      </div>
    </div>
  </section>

  <section class="sec" id="atendimento">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// atendimento</span><h2>Perto de você ou à distância</h2></div>
      <div class="atend">
        <div class="card"><div class="ico-box">{ico("pin")}</div><h3>Presencial</h3><p>Em {e(SITE["regiao_presencial"])}{f" ({e(cidades_txt)})" if cidades_txt and cidades_txt != SITE["cidade"] else ""}. <a href="atendimento/">Ver cidades e busca do equipamento</a></p>
          <ul><li>Consertos de hardware e troca de peças</li><li>Limpeza, pasta térmica e upgrades</li><li>Formatação com backup</li><li>Montagem de computadores</li></ul></div>
        <div class="card"><div class="ico-box">{ico("globe")}</div><h3>Remoto · todo o Brasil</h3><p>Você acompanha tudo pela tela. <a href="suporte-remoto.html">Como funciona</a></p>
          <ul><li>Programas travando ou com erro</li><li>Configuração de impressora, e-mail e contas</li><li>Remoção de vírus e propagandas</li><li>Orientação antes de comprar peças ou um PC</li></ul></div>
      </div>
    </div>
  </section>
  {secao_precos('./')}
  {secao_galeria('./')}
  {secao_avaliacoes()}
  {secao_plano('./')}
  <section class="sec alt" id="problemas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// problemas comuns</span><h2>O que pode estar acontecendo com o seu equipamento</h2><p>Explicações rápidas. Toque para abrir.</p></div>
      <div class="acordeao">
        {''.join(f'<details><summary>{e(t)}</summary><div class="resp"><p>{e(r)}</p><a href="dicas/{s}.html">Entender melhor →</a></div></details>' for t, r, s in PROBLEMAS)}
      </div>
    </div>
  </section>

  <section class="sec" id="dicas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// dicas</span><h2>Como fazer seu equipamento durar mais</h2></div>
      <div class="grid g4">
        {''.join(f'<a class="card" href="dicas/{a["slug"]}.html"><div class="ico-box">{ico("book")}</div><h3>{e(a["curto"])}</h3><p>{e(a["resumo"])}</p><span class="mais">Ler dica →</span></a>' for a in ARTIGOS[:8])}
      </div>
      <p style="margin-top:22px"><a class="btn" href="dicas/">Ver todas as {len(ARTIGOS)} dicas</a></p>
    </div>
  </section>

  <section class="sec alt" id="duvidas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// dúvidas</span><h2>Perguntas frequentes</h2></div>
      <div class="acordeao">
        {''.join(f'<details><summary>{e(q)}</summary><div class="resp"><p>{e(a)}</p></div></details>' for q, a in FAQ)}
      </div>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="cta">
        <h2>Seu equipamento está dando problema?</h2>
        <p>Conte o que está acontecendo. O pedido chega direto no WhatsApp do técnico.</p>
        <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat>{ico("chat", 20)} Fale comigo</a>
      </div>
    </div>
  </section>
  </main>
'''
    h += rodape('./', '\n  <script type="module" src="assets/js/ferramentas/hero.js?v=' + V + '"></script>')
    gravar('index.html', h)


# ==================================================================
# Dicas
# ==================================================================
def gerar_dicas():
    for a in ARTIGOS:
        ld = {"@context": "https://schema.org", "@type": "Article", "headline": a['titulo'], "description": a['resumo'],
              "author": {"@type": "Organization", "name": NOME}, "publisher": {"@type": "Organization", "name": NOME},
              "datePublished": a.get('data', HOJE), "dateModified": a.get('data', HOJE), "mainEntityOfPage": BASE + 'dicas/' + a['slug'] + '.html', "inLanguage": "pt-BR"}
        outros = [x for x in ARTIGOS if x['slug'] != a['slug']][:6]
        pg = head(f'{a["titulo"]} · {NOME}', a['resumo'], 'dicas/' + a['slug'] + '.html', '../', [ld], 'article')
        pg += f'''
  <main>
    <div class="artigo-hero"><div class="wrap">
      <div class="crumb"><a href="../">início</a> / <a href="./">dicas</a> / {e(a["curto"].lower())}</div>
      <h1>{e(a["titulo"])}</h1><p>{e(a["resumo"])}</p>
    </div></div>
    <div class="wrap artigo">
      <article class="conteudo">
{a["corpo"]}
        {cta()}
      </article>
      <aside class="lateral">
        <div class="card"><h3>Precisa de ajuda?</h3><p>Atendimento presencial em {e(SITE["regiao_presencial"])} e remoto para todo o Brasil.</p>
          <a href="#fale-comigo" class="btn btn-pri btn-sm" style="margin-top:14px;width:100%" data-abrir-chat>Pedir orçamento</a></div>
        <div class="card"><h3>Faça o check-up</h3><p>Descubra em 1 minuto as causas prováveis do problema.</p><a class="btn btn-sm" style="margin-top:12px;width:100%" href="../ferramentas/checkup.html">Abrir check-up</a></div>
        <div class="card"><h3>Outras dicas</h3><ul class="lista-links">{''.join(f'<li><a href="{x["slug"]}.html">{e(x["curto"])}</a></li>' for x in outros)}</ul></div>
      </aside>
    </div>
  </main>
''' + rodape('../')
        gravar('dicas/' + a['slug'] + '.html', pg)
    idx = head(f'Dicas de manutenção de computadores e notebooks · {NOME}', 'Dicas práticas para cuidar do seu computador e notebook: superaquecimento, lentidão, bateria, SSD, Wi-Fi, impressora, backup, vírus e golpes.', 'dicas/', '../')
    idx += f'''
  <main>
    <div class="artigo-hero"><div class="wrap"><div class="crumb"><a href="../">início</a> / dicas</div>
      <h1>Dicas e explicações</h1><p>Entenda o que está acontecendo com o seu equipamento e como fazer ele durar mais.</p></div></div>
    <section class="sec" style="padding-top:44px"><div class="wrap"><div class="grid g3">
      {''.join(f'<a class="card" href="{a["slug"]}.html"><div class="ico-box">{ico("book")}</div><h3>{e(a["titulo"])}</h3><p>{e(a["resumo"])}</p><span class="mais">Ler →</span></a>' for a in ARTIGOS)}
    </div></div></section>
  </main>
''' + rodape('../')
    gravar('dicas/index.html', idx)


# ==================================================================
# Ferramentas
# ==================================================================
def ferramenta(arquivo, titulo, desc, h1, sub, corpo, js):
    pg = head(f'{titulo} · {NOME}', desc, 'ferramentas/' + arquivo, '../')
    pg += f'''
  <main>
    <div class="artigo-hero"><div class="wrap">
      <div class="crumb"><a href="../">início</a> / <a href="./">ferramentas</a> / {e(titulo.lower())}</div>
      <h1>{h1}</h1><p>{sub}</p>
    </div></div>
    <div class="wrap ferramenta">
{corpo}
    </div>
  </main>
''' + rodape('../', f'\n  <script type="module" src="../assets/js/ferramentas/{js}?v={V}"></script>')
    gravar('ferramentas/' + arquivo, pg)


def gerar_ferramentas():
    idx = head(f'Ferramentas grátis para testar seu computador · {NOME}', 'Check-up do computador, consertar ou trocar, monte seu PC, teste de velocidade da internet e teste de teclado, tela, som, microfone e câmera. Grátis e sem instalar nada.', 'ferramentas/', '../')
    idx += f'''
  <main>
    <div class="artigo-hero"><div class="wrap"><div class="crumb"><a href="../">início</a> / ferramentas</div>
      <h1>Ferramentas grátis</h1><p>Testes que rodam direto no navegador, sem instalar nada. Use antes de pedir o orçamento: ajuda a chegar no problema mais rápido.</p></div></div>
    <section class="sec" style="padding-top:44px"><div class="wrap"><div class="grid g3">
      {''.join(f'<a class="card" href="{h_}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Usar →</span></a>' for i, t, d, h_ in FERRAMENTAS)}
    </div></div></section>
  </main>
''' + rodape('../')
    gravar('ferramentas/index.html', idx)

    ferramenta('checkup.html', 'Check-up do computador', 'Check-up grátis do computador ou notebook: análise do aparelho pelo navegador e perguntas sobre os sintomas geram um laudo prévio com as causas prováveis.',
               'Check-up do computador', 'Responda algumas perguntas. Junto com o que o navegador consegue ler do seu aparelho, você recebe um laudo prévio com as causas prováveis e o que fazer.',
               '<div id="app-ferramenta" class="ferr-app"><noscript>Ative o JavaScript para usar o check-up.</noscript></div>', 'checkup.js')
    ferramenta('consertar-ou-trocar.html', 'Consertar ou trocar?', 'Descubra se vale mais a pena consertar, fazer upgrade ou trocar o computador ou notebook, de acordo com a idade, o defeito e o uso.',
               'Consertar ou trocar?', 'Responda 5 perguntas e veja a recomendação, com os motivos.',
               '<div id="app-ferramenta" class="ferr-app"></div>', 'consertar.js')
    ferramenta('monte-seu-pc.html', 'Monte seu PC', 'Configuração de computador recomendada para estudo, escritório, jogos ou edição, de acordo com o seu orçamento.',
               'Monte seu PC', 'Diga para que vai usar e qual faixa de investimento. Você recebe uma configuração equilibrada e pode pedir para eu montar.',
               '<div id="app-ferramenta" class="ferr-app"></div>', 'monte.js')
    ferramenta('velocidade.html', 'Teste de velocidade', 'Teste a velocidade de download e a latência da sua internet e entenda se a lentidão é do computador ou da rede.',
               'Teste de velocidade', 'Mede o download e o tempo de resposta (latência) a partir do seu aparelho. Para um resultado fiel, feche downloads e vídeos antes.',
               '<div id="app-ferramenta" class="ferr-app"></div>', 'velocidade.js')
    ferramenta('testes.html', 'Teste de teclado, tela e som', 'Teste de teclado online, teste de pixel morto na tela, teste de alto-falantes esquerdo/direito, microfone e câmera. Grátis, direto no navegador.',
               'Teclado, tela, som, microfone e câmera', 'Escolha o teste. Nada é gravado nem enviado: tudo acontece só no seu aparelho.',
               '<div id="app-ferramenta" class="ferr-app"></div>', 'testes.js')


# ==================================================================
# Páginas institucionais
# ==================================================================
def gerar_institucionais():
    g = SITE.get('garantia_dias', 90)
    # Acompanhar OS
    pagina_simples('acompanhar.html', './', f'Acompanhar ordem de serviço · {NOME}', 'Consulte o status do conserto do seu computador ou notebook com o código da OS e o seu telefone.',
                   '<a href="./">início</a> / acompanhar OS', 'Acompanhe o seu conserto', 'Digite o código que está no comprovante de entrada (ex.: OS000123) e o telefone cadastrado.',
                   '''<form id="form-rastreio" class="card rastreio" autocomplete="on">
          <div class="campo"><label for="r-cod">Código da OS</label><input id="r-cod" name="codigo" placeholder="OS000123" required style="text-transform:uppercase"></div>
          <div class="campo"><label for="r-tel">Telefone cadastrado (com DDD)</label><input id="r-tel" name="telefone" type="tel" inputmode="tel" placeholder="(33) 9 9999-9999" required></div>
          <button class="btn btn-pri" type="submit">Consultar</button>
        </form>
        <div id="resultado-rastreio" aria-live="polite"></div>
        <p class="sub" style="margin-top:18px">Por segurança, só mostramos o status do equipamento. Os dados pessoais não aparecem nesta página.</p>''',
                   extra_js=f'\n  <script type="module" src="assets/js/ferramentas/rastreio.js?v={V}"></script>')

    # Garantia
    pagina_simples('garantia.html', './', f'Garantia dos serviços · {NOME}', f'Como funciona a garantia de {g} dias dos serviços da {NOME}: o que cobre, o que não cobre e como acionar.',
                   '<a href="./">início</a> / garantia', 'Garantia dos serviços', f'{g} dias de garantia para os serviços executados, descrita na nota de serviço.', f'''
        <h2>O que a garantia cobre</h2>
        <p>O <strong>serviço executado</strong> descrito na nota de serviço, por {g} dias a partir da data de conclusão. Se o mesmo problema voltar por causa do serviço, o reparo é refeito sem custo de mão de obra.</p>
        <p>As <strong>peças novas</strong> instaladas têm a garantia do fabricante ou do fornecedor, que varia conforme a peça. Ela é informada no orçamento.</p>
        <h2>O que não cobre</h2>
        <ul>
          <li>Defeitos diferentes do que foi consertado.</li>
          <li>Mau uso, quedas, contato com líquidos, surtos ou quedas de energia.</li>
          <li>Equipamento aberto ou mexido por outra pessoa depois do serviço.</li>
          <li>Vírus, programas instalados depois da entrega e perda de arquivos que não estavam no backup combinado.</li>
        </ul>
        <h2>Como acionar</h2>
        <ol>
          <li>Fale pelo <a href="#fale-comigo" data-abrir-chat>Fale comigo</a> ou WhatsApp informando o <strong>número da nota de serviço</strong>.</li>
          <li>O equipamento é avaliado para confirmar se o problema é coberto.</li>
          <li>Coberto: o reparo é feito sem custo de mão de obra. Não coberto: você recebe um novo orçamento para aprovar.</li>
        </ol>
        <div class="callout">Guarde a nota de serviço: ela traz a data e o prazo final da garantia.</div>''')

    # Suporte remoto
    pagina_simples('suporte-remoto.html', './', f'Suporte técnico remoto para todo o Brasil · {NOME}', 'Suporte técnico remoto para computadores e notebooks em qualquer cidade do Brasil: programas, configurações, vírus, impressoras e orientação de compra. Seguro e acompanhado.',
                   '<a href="./">início</a> / suporte remoto', 'Suporte remoto para todo o Brasil', 'Muitos problemas se resolvem sem sair de casa. Você acompanha tudo pela tela e encerra a conexão quando quiser.', '''
        <h2>O que dá para resolver à distância</h2>
        <ul>
          <li>Programas travando, com erro ou que não instalam.</li>
          <li>Lentidão causada por programas, inicialização e configurações.</li>
          <li>Remoção de vírus, propagandas e extensões maliciosas.</li>
          <li>Configuração de impressora, e-mail, contas, Wi-Fi e backup na nuvem.</li>
          <li>Instalação e configuração de programas de trabalho e estudo.</li>
          <li>Orientação antes de comprar peças, notebook ou PC.</li>
        </ul>
        <div class="callout alerta">Problemas físicos (não liga, tela quebrada, superaquecimento, peça com defeito) precisam de atendimento presencial.</div>
        <h2>Como funciona</h2>
        <ol>
          <li>Você conta o problema pelo <a href="#fale-comigo" data-abrir-chat data-servico="Suporte remoto">Fale comigo</a> e combinamos o valor e o horário.</li>
          <li>No horário combinado, você baixa um programa de acesso remoto conhecido, do <strong>site oficial</strong> dele (o link é enviado pelo WhatsApp).</li>
          <li>Você me passa o código de acesso. A conexão só acontece com a sua autorização.</li>
          <li>Você acompanha tudo pela tela e pode encerrar a qualquer momento.</li>
          <li>Ao final, a conexão é encerrada e você recebe o resumo do que foi feito.</li>
        </ol>
        <h2>Segurança</h2>
        <ul>
          <li>Nunca peço senha de banco nem dados de cartão.</li>
          <li>A sessão só existe enquanto você mantiver o programa aberto.</li>
          <li>Desconfie de quem liga oferecendo "suporte" sem você ter pedido: isso é golpe. <a href="dicas/virus-e-golpes.html">Saiba mais</a>.</li>
        </ul>''' + cta('Vamos resolver à distância?', 'Conte o problema. Se der para resolver remoto, combinamos o horário.', 'Pedir suporte remoto', 'Suporte remoto'))

    # Empresas
    pagina_simples('empresas.html', './', f'Suporte de TI para empresas e escritórios · {NOME}', f'Manutenção preventiva, suporte e organização de TI para escritórios, comércios e pequenas empresas em {SITE["regiao_presencial"]} e remoto.',
                   '<a href="./">início</a> / empresas', 'TI para escritórios, comércios e pequenas empresas', 'Computador parado é cliente esperando e trabalho atrasado. Cuidado preventivo custa menos que a emergência.', '''
        <h2>O que eu faço pela sua empresa</h2>
        <div class="grid g2" style="margin:16px 0 8px">
          <div class="card"><h3>Manutenção preventiva</h3><p>Visitas programadas para limpeza, atualização, verificação de discos e temperatura de todas as máquinas.</p></div>
          <div class="card"><h3>Backup que funciona</h3><p>Rotina automática de cópia dos arquivos importantes, com cópia fora do escritório e teste de restauração.</p></div>
          <div class="card"><h3>Rede e impressoras</h3><p>Wi-Fi estável, compartilhamento de pastas e impressoras configuradas para todos.</p></div>
          <div class="card"><h3>Suporte rápido</h3><p>Atendimento remoto para o dia a dia e presencial quando precisar, com prioridade para clientes do plano.</p></div>
          <div class="card"><h3>Segurança</h3><p>Antivírus, atualizações, contas e senhas organizadas, e orientação da equipe contra golpes.</p></div>
          <div class="card"><h3>Compra de equipamentos</h3><p>Especificação de computadores e peças certos para cada função, sem gastar a mais.</p></div>
        </div>
        <h2>Para quem</h2>
        <p>Escritórios de contabilidade e advocacia, consultórios, lojas, igrejas, escolas e repartições. Qualquer lugar onde alguns computadores parados atrapalham o dia.</p>
        <h2>Como começa</h2>
        <ol><li>Conversa rápida para entender quantos equipamentos e o que mais incomoda.</li>
        <li>Visita de diagnóstico com um relatório do estado de cada máquina.</li>
        <li>Proposta de plano mensal ou anual, ou de serviços avulsos, como você preferir.</li></ol>''' + cta('Vamos conversar sobre a sua empresa?', 'Conte quantos computadores são e o que mais dá problema hoje.', 'Pedir proposta', 'Empresas / plano de manutenção'))

    # Sobre
    sobre = SITE.get('sobre') or {}
    foto = f'<img class="sobre-foto" src="{e(sobre["foto"])}" alt="Foto de {e(NOME)}">' if sobre.get('foto') else ''
    texto = ''.join(f'<p>{e(p)}</p>' for p in (sobre.get('texto') or '').split('\n') if p.strip()) or f'''
        <p>A {e(NOME)} é uma assistência técnica em informática de {e(SITE["cidade"])}/{e(SITE["uf"])}, focada em computadores e notebooks.</p>
        <p>O trabalho segue três regras simples: <strong>diagnóstico antes do orçamento</strong>, <strong>nenhum serviço sem a sua aprovação</strong> e <strong>tudo documentado</strong>. Você recebe o comprovante de entrada, o orçamento detalhado e a nota de serviço com a garantia.</p>'''
    pagina_simples('sobre.html', './', f'Sobre · {NOME}', f'Conheça a {NOME}, assistência técnica em informática em {SITE["cidade"]}/{SITE["uf"]}.',
                   '<a href="./">início</a> / sobre', e(sobre.get('titulo') or 'Sobre'), '', f'''
        <div class="sobre">{foto}<div>{texto}</div></div>
        <h2>Como trabalho</h2>
        <ul class="lista-check">
          <li>Comprovante de entrada com os acessórios e o defeito relatado</li>
          <li>Orçamento detalhado, peça por peça, antes de qualquer serviço</li>
          <li>Acompanhamento do status pela internet (<a href="acompanhar.html">Acompanhar OS</a>)</li>
          <li>Nota de serviço com o que foi feito e o prazo de garantia</li>
          <li>Pagamento por PIX, dinheiro ou cartão</li>
        </ul>
        {secao_galeria('./').replace('class="sec"', 'class=""')}''' + cta())

    # Cidades
    cards = ''.join(f'''<a class="card" href="{slug(c["cidade"])}-{c["uf"].lower()}.html"><div class="ico-box">{ico("pin")}</div><h3>{e(c["cidade"])}/{e(c["uf"])}</h3>
        <p>{"Atendimento presencial" if c.get("presencial") else "Atendimento remoto"}{" · busca e entrega" if c.get("busca") else ""}{f" · prazo {e(c['prazo'])}" if c.get("prazo") else ""}</p></a>''' for c in CIDADES)
    pg = head(f'Cidades atendidas · {NOME}', f'Cidades com atendimento presencial, busca e entrega de equipamentos da {NOME}, e suporte remoto para todo o Brasil.', 'atendimento/', '../')
    pg += f'''
  <main>
    <div class="artigo-hero"><div class="wrap"><div class="crumb"><a href="../">início</a> / cidades atendidas</div>
      <h1>Cidades atendidas</h1><p>Atendimento presencial, busca e entrega nas cidades abaixo e suporte remoto para qualquer lugar do Brasil.</p></div></div>
    <section class="sec" style="padding-top:44px"><div class="wrap">
      <div class="grid g3">{cards}</div>
      <div class="card" style="margin-top:22px"><h3 style="margin-top:0">Sua cidade não está na lista?</h3><p>Muitos problemas se resolvem por <a href="../suporte-remoto.html">suporte remoto</a>. Para consertos físicos, fale comigo: dá para combinar o envio do equipamento.</p>
        <a href="#fale-comigo" class="btn btn-pri btn-sm" style="margin-top:12px" data-abrir-chat>Fale comigo</a></div>
    </div></section>
  </main>
''' + rodape('../')
    gravar('atendimento/index.html', pg)
    for c in CIDADES:
        nome_c = f'{c["cidade"]}/{c["uf"]}'
        arq = f'atendimento/{slug(c["cidade"])}-{c["uf"].lower()}.html'
        ld = ld_negocio()
        ld['areaServed'] = [{"@type": "City", "name": c['cidade']}]
        detalhes = ''.join(x for x in [
            '<li>Atendimento presencial</li>' if c.get('presencial') else '<li>Atendimento remoto</li>',
            '<li>Busca e entrega do equipamento</li>' if c.get('busca') else '',
            f'<li>Prazo médio: {e(c["prazo"])}</li>' if c.get('prazo') else '',
            f'<li>Taxa de deslocamento: {e(c["taxa"])}</li>' if c.get('taxa') else '',
        ])
        extra = ''.join(f'<p>{e(p)}</p>' for p in (c.get('texto') or '').split('\n') if p.strip())
        pagina_simples(arq, '../', f'Manutenção de computadores e notebooks em {nome_c} · {NOME}',
                       f'Conserto e manutenção de notebooks e computadores em {nome_c}: diagnóstico, limpeza, SSD, formatação, Windows 11 e troca de peças, com orçamento antes do serviço.',
                       f'<a href="../">início</a> / <a href="./">cidades</a> / {e(c["cidade"].lower())}', f'Manutenção de computadores e notebooks em {e(nome_c)}',
                       'Diagnóstico claro, orçamento antes do serviço e garantia na nota.', f'''
        {extra}
        <h2>Atendimento em {e(c["cidade"])}</h2><ul class="lista-check">{detalhes}</ul>
        <h2>Serviços</h2>
        <div class="grid g2" style="margin-top:14px">{''.join(f'<div class="card"><h3 style="margin-top:0">{e(t)}</h3><p>{e(d)}</p></div>' for _, t, d in SERVICOS)}</div>
        <h2>Problemas mais comuns</h2>
        <ul>{''.join(f'<li><a href="../dicas/{s}.html">{e(t)}</a></li>' for t, _, s in PROBLEMAS)}</ul>''' + cta(f'Atendimento em {c["cidade"]}', 'Conte o problema e receba o orçamento antes de qualquer serviço.'), [ld])

    # Privacidade
    pagina_simples('politica-de-privacidade.html', './', f'Política de privacidade · {NOME}', f'Como a {NOME} trata os dados enviados pelo site.',
                   '<a href="./">início</a> / privacidade', 'Política de privacidade', 'Resumo simples de como os seus dados são usados, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).', f'''
        <h2>Quais dados são coletados</h2>
        <p>Quando você usa o assistente "Fale comigo" ou envia o resultado de uma ferramenta, são coletados: nome, cidade, número de WhatsApp, tipo de equipamento, descrição do problema, preferência de atendimento e, se você enviar, o resumo do check-up. Também são registradas a página de onde o pedido foi enviado e, se houver, quem indicou.</p>
        <p>As ferramentas de teste (teclado, tela, som, microfone, câmera e velocidade) funcionam só no seu aparelho. Nada é gravado nem enviado.</p>
        <h2>Para que são usados</h2>
        <p>Exclusivamente para responder ao seu pedido: entrar em contato, enviar orçamento e prestar o serviço solicitado. Os dados não são vendidos nem compartilhados com terceiros para fins de propaganda.</p>
        <h2>Onde ficam guardados</h2>
        <p>Em um banco de dados na nuvem (Google Firebase), com acesso restrito ao responsável pelo atendimento. Ao tocar em "Enviar pelo WhatsApp", a mensagem segue também pelo aplicativo WhatsApp, sujeito às regras dele.</p>
        <p>Na página "Acompanhar OS" só aparecem o status e o tipo de equipamento, nunca nome, endereço ou documento.</p>
        <h2>Por quanto tempo</h2>
        <p>Pelo tempo necessário para o atendimento e para cumprir obrigações legais (por exemplo, garantia do serviço). Pedidos que não viraram atendimento podem ser apagados a qualquer momento.</p>
        <h2>Seus direitos</h2>
        <p>Você pode pedir para ver, corrigir ou apagar os seus dados a qualquer momento pelo e-mail <a href="mailto:{e(SITE["email"])}">{e(SITE["email"])}</a> ou pelo WhatsApp de atendimento.</p>''', lateral=False)

    # 404
    raiz_abs = '/' + BASE.split('/', 3)[3] if BASE.count('/') > 3 else '/'
    p404 = head(f'Página não encontrada · {NOME}', 'Página não encontrada.', '404.html', raiz_abs, noindex=True)
    p404 += f'''<main><section class="sec"><div class="wrap" style="text-align:center"><span class="selo">erro 404</span><h1 style="margin:18px 0">Página não encontrada</h1>
<p style="color:var(--text-2)">O endereço pode ter mudado. Volte ao início ou fale comigo.</p><p><a class="btn btn-pri" href="{raiz_abs}">Ir para o início</a></p></div></section></main>''' + rodape(raiz_abs)
    gravar('404.html', p404)


# ==================================================================
# Arquivos de apoio
# ==================================================================
def gerar_apoio():
    urls = ['', 'dicas/', 'ferramentas/', 'atendimento/', 'acompanhar.html', 'sobre.html', 'garantia.html', 'suporte-remoto.html', 'empresas.html', 'politica-de-privacidade.html']
    urls += ['dicas/' + a['slug'] + '.html' for a in ARTIGOS]
    urls += ['ferramentas/' + f[3] for f in FERRAMENTAS]
    urls += [f'atendimento/{slug(c["cidade"])}-{c["uf"].lower()}.html' for c in CIDADES]
    gravar('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + ''.join(f'  <url><loc>{BASE}{u}</loc><lastmod>{HOJE}</lastmod></url>\n' for u in urls) + '</urlset>\n')
    caminho = '/' + BASE.split('/', 3)[3] if BASE.count('/') > 3 else '/'
    gravar('robots.txt', f'User-agent: *\nAllow: /\nDisallow: {caminho}sistema.html\nDisallow: {caminho}imprimir.html\nDisallow: {caminho}tools/\nSitemap: {BASE}sitemap.xml\n')
    gravar('assets/js/site-config.js', '// GERADO AUTOMATICAMENTE a partir de conteudo/site.json — edite lá, não aqui.\nexport const SITE = '
           + json.dumps({k: SITE.get(k, '') for k in ['nome', 'whatsapp', 'email', 'cidade', 'uf', 'horario']} | {'regiaoPresencial': SITE['regiao_presencial']}, ensure_ascii=False, indent=2) + ';\n')
    gravar('site.webmanifest', json.dumps({
        "name": NOME, "short_name": "Ítalo TI", "description": "Manutenção de computadores e notebooks",
        "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#070b14", "theme_color": "#070b14", "lang": "pt-BR",
        "icons": [{"src": "assets/img/logo.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
                  {"src": "assets/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "assets/img/icon-512.png", "sizes": "512x512", "type": "image/png"}],
        "shortcuts": [{"name": "Acompanhar OS", "url": "acompanhar.html"}, {"name": "Check-up", "url": "ferramentas/checkup.html"}],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    gerar_home()
    gerar_dicas()
    gerar_ferramentas()
    gerar_institucionais()
    gerar_apoio()
    print(f'Site gerado: {len(ARTIGOS)} artigos, {len(CIDADES)} cidade(s), {len(FERRAMENTAS)} ferramentas.')
