"""Geração dos artigos e do índice de dicas (conteúdo educativo)."""

def gerar_dicas(ctx):
    ARTIGOS = ctx["ARTIGOS"]
    NOME = ctx["NOME"]
    SITE = ctx["SITE"]
    BASE = ctx["BASE"]
    HOJE = ctx["HOJE"]
    head = ctx["head"]
    rodape = ctx["rodape"]
    cta = ctx["cta"]
    ico = ctx["ico"]
    e = ctx["e"]
    gravar = ctx["gravar"]
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
  <main data-lista-conteudo>
    <div class="artigo-hero"><div class="wrap"><div class="crumb"><a href="../">início</a> / dicas</div>
      <h1>Dicas e explicações</h1><p>Entenda o que está acontecendo com o seu equipamento e como fazer ele durar mais.</p>
      <div class="busca-site"><label for="buscar-dica">Buscar uma dica ou tutorial</label>
        <div class="busca-site-campo"><input type="search" id="buscar-dica" maxlength="100" placeholder="Ex.: limpeza, SSD, Wi-Fi..." data-busca-conteudo autocomplete="off"><button type="button" data-busca-limpar hidden>Limpar</button></div>
        <p class="busca-site-contagem" data-busca-contagem aria-live="polite"></p></div></div></div>
    <section class="sec" style="padding-top:44px"><div class="wrap"><div class="grid g3">
      {''.join(f'<a class="card" data-item-busca="{e(a["titulo"])} {e(a["resumo"])}" href="{a["slug"]}.html"><div class="ico-box">{ico("book")}</div><h3>{e(a["titulo"])}</h3><p>{e(a["resumo"])}</p><span class="mais">Ler →</span></a>' for a in sorted(ARTIGOS, key=lambda item: item.get('data', ''), reverse=True))}
    </div><p class="busca-sem-resultados" data-busca-vazio hidden>Nenhuma dica encontrada. <a href="#fale-comigo" data-abrir-chat>Conte sua dúvida ao Alvesinho</a>.</p></div></section>
  </main>
''' + rodape('../', '<script type="module" src="../assets/js/busca-conteudo.js?v=2.4.0"></script>')
    gravar('dicas/index.html', idx)
