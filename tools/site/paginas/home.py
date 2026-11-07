"""Geração exclusiva da página inicial da Ítalo InfoTec."""

def gerar_home(ctx):
    CIDADES = ctx["CIDADES"]
    SITE = ctx["SITE"]
    FAQ = ctx["FAQ"]
    NOME = ctx["NOME"]
    head = ctx["head"]
    ld_negocio = ctx["ld_negocio"]
    e = ctx["e"]
    ico = ctx["ico"]
    V = ctx["V"]
    SINTOMAS_HOME = ctx["SINTOMAS_HOME"]
    SERVICOS = ctx["SERVICOS"]
    FERRAMENTAS = ctx["FERRAMENTAS"]
    secao_precos = ctx["secao_precos"]
    secao_galeria = ctx["secao_galeria"]
    secao_avaliacoes = ctx["secao_avaliacoes"]
    secao_plano = ctx["secao_plano"]
    PROBLEMAS = ctx["PROBLEMAS"]
    ARTIGOS = ctx["ARTIGOS"]
    rodape = ctx["rodape"]
    gravar = ctx["gravar"]
    cidades_txt = ', '.join(c['cidade'] for c in CIDADES if c.get('presencial'))
    ld_faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ[:4]]}
    h = head(f'{NOME} · Manutenção de computadores e notebooks', f'Manutenção de computadores e notebooks em {SITE["cidade"]}/{SITE["uf"]} e suporte remoto para todo o Brasil. Diagnóstico, limpeza, SSD, formatação, Windows 11 e troca de peças, com orçamento antes do serviço.', '', './', [ld_negocio(), ld_faq])
    fato24 = f'<div><b>24 horas</b>atendimento a qualquer hora</div>' if '24' in (SITE.get('horario') or '') else ''
    h += f'''
  <main>
  <section class="hero">
    <div class="wrap">
      <div>
        <span class="selo">assistência técnica em informática</span>
        <h1>Seu notebook ou computador <span class="grad">deu problema?</span> Descubra o próximo passo.</h1>
        <p class="lead">Está lento, não liga, esquentando ou com a tela quebrada? Converse com o Alvesinho, receba uma orientação inicial gratuita e peça uma avaliação técnica com orçamento antes do serviço. Atendimento em {e(SITE["regiao_presencial"])} e suporte remoto no Brasil.</p>
        <div class="hero-acoes">
          <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat>{ico("chat", 20)} Conversar com Alvesinho</a>
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


  <section class="sec alt" id="sintomas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// o que aconteceu?</span>
        <h2>Qual destes problemas parece com o seu?</h2>
        <p>Escolha um sintoma. O Alvesinho explica as causas possíveis, cuidados iniciais e como solicitar atendimento, sem prometer diagnóstico à distância.</p></div>
      <div class="problemas-rapidos">
        {''.join(f'<button type="button" class="sintoma-card" data-abrir-chat data-sintoma="{e(item["id"])}"><span class="problema-icon" aria-hidden="true">{e(item["icone"])}</span><strong>{e(item["titulo"])}</strong><small>Ver orientação →</small></button>' for item in SINTOMAS_HOME[:8])}
      </div>
      <p class="pagina-link"><a href="problemas/" class="btn">Ver todos os 20 problemas e orientações →</a></p>
      <p class="sintoma-nota">Orientações educativas: problemas elétricos, líquidos ou baterias estufadas exigem cuidados especiais. Não abra fontes nem componentes energizados.</p>
    </div>
  </section>

  <section class="sec alt" id="servicos">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// serviços</span><h2>O que eu resolvo</h2><p>Do notebook que esquenta ao computador que não liga, com explicação do que foi feito e por quê.</p></div>
      <div class="grid g4">
        {''.join(f'<a class="card" href="#fale-comigo" data-abrir-chat data-servico="{e(t)}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Pedir orçamento →</span></a>' for i, t, d in SERVICOS[:4])}
      </div>
      <p class="pagina-link"><a href="servicos/" class="btn">Conhecer todos os serviços e opções de atendimento →</a></p>
    </div>
  </section>

  <section class="sec" id="ferramentas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// ferramentas grátis</span><h2>Descubra o problema antes de sair de casa</h2><p>Testes que rodam direto no navegador. Sem instalar nada.</p></div>
      <div class="grid g5">
        {''.join(f'<a class="card" href="ferramentas/{h_}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Usar →</span></a>' for i, t, d, h_ in FERRAMENTAS[:3])}
      </div>
      <p class="pagina-link"><a href="ferramentas/" class="btn">Explorar todas as ferramentas gratuitas →</a></p>
    </div>
  </section>


  <section class="sec alt" id="alvesinho">
    <div class="wrap">
      <div class="alvesinho-destaque">
        <img src="assets/img/alvesinho.svg" width="160" height="160" loading="lazy" alt="Alvesinho, mascote técnico e atendente virtual da Ítalo InfoTec">
        <div>
          <span class="kicker">// atendimento guiado</span>
          <h2>Conheça o Alvesinho, seu assistente virtual</h2>
          <p>Ele conversa com você sobre os sintomas, sugere verificações seguras e organiza seu pedido para o técnico. É um assistente automatizado — não um diagnóstico humano ou orçamento definitivo.</p>
          <div class="hero-acoes">
            <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat data-servico="Diagnóstico por sintomas">Contar meu problema</a>
            <a href="ferramentas/upgrade.html" class="btn">Qual upgrade vale mais?</a>
            <a href="acompanhar.html" class="btn">Acompanhar OS</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="sec alt" id="como-funciona">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// como funciona</span><h2>Do problema à entrega, em 4 passos</h2></div>
      <div class="grid g4 passos">
        <div class="card passo"><h3>Conte o problema</h3><p>Pelo Alvesinho ou WhatsApp: informe o equipamento e o sintoma em poucos passos.</p></div>
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
  {secao_avaliacoes()}
  <section class="sec" id="dicas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// dicas</span><h2>Como fazer seu equipamento durar mais</h2></div>
      <div class="grid g4">
        {''.join(f'<a class="card" href="dicas/{a["slug"]}.html"><div class="ico-box">{ico("book")}</div><h3>{e(a["curto"])}</h3><p>{e(a["resumo"])}</p><span class="mais">Ler dica →</span></a>' for a in ARTIGOS[:3])}
      </div>
      <p class="pagina-link"><a class="btn" href="dicas/">Ver todos os {len(ARTIGOS)} artigos e tutoriais</a></p>
    </div>
  </section>

  <section class="sec alt" id="duvidas">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">// dúvidas</span><h2>Perguntas frequentes</h2></div>
      <div class="acordeao">
        {''.join(f'<details><summary>{e(q)}</summary><div class="resp"><p>{e(a)}</p></div></details>' for q, a in FAQ[:4])}
      </div>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="cta">
        <h2>Seu equipamento está dando problema?</h2>
        <p>Conte para o Alvesinho o que aconteceu. Ele orienta inicialmente e prepara seu pedido para atendimento pelo WhatsApp.</p>
        <a href="#fale-comigo" class="btn btn-pri" data-abrir-chat>{ico("chat", 20)} Pedir ajuda ao Alvesinho</a>
      </div>
    </div>
  </section>
  </main>
'''
    h += rodape('./', '\n  <script type="module" src="assets/js/ferramentas/hero.js?v=' + V + '"></script>')
    gravar('index.html', h)
