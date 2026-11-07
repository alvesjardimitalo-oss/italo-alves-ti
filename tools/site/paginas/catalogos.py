"""Páginas independentes para explorar problemas e serviços, sem alongar a home."""

def gerar_catalogos(ctx):
    SITE = ctx["SITE"]
    SINTOMAS_HOME = ctx["SINTOMAS_HOME"]
    SERVICOS = ctx["SERVICOS"]
    NOME = ctx["NOME"]
    head = ctx["head"]
    rodape = ctx["rodape"]
    gravar = ctx["gravar"]
    ico = ctx["ico"]
    e = ctx["e"]
    secao_precos = ctx["secao_precos"]
    secao_galeria = ctx["secao_galeria"]
    secao_avaliacoes = ctx["secao_avaliacoes"]
    secao_plano = ctx["secao_plano"]
    cta = ctx["cta"]

    # O leitor pode partir do sintoma e escolher: orientação do Alvesinho ou artigo.
    grupos = [
        "Energia e inicialização",
        "Desempenho",
        "Tela e componentes",
        "Internet e sistema",
        "Calor e manutenção",
    ]
    blocos = []
    for nome in grupos:
        itens = [item for item in SINTOMAS_HOME if item.get("categoria") == nome]
        if not itens:
            continue
        cards = []
        for item in itens:
            artigo = item.get("dica", "")
            link = (f'<a href="../dicas/{e(artigo)}.html" class="mais">Ler explicação detalhada →</a>'
                    if artigo else '')
            cards.append(f'''
              <article class="card sintoma-hub-card">
                <span class="problema-icon" aria-hidden="true">{e(item["icone"])}</span>
                <h3>{e(item["titulo"])}</h3>
                <p>Encontre uma orientação inicial para esse sintoma e saiba quando pedir uma avaliação.</p>
                <button class="btn btn-pri btn-sm" type="button" data-abrir-chat data-sintoma="{e(item["id"])}">Perguntar ao Alvesinho</button>
                {link}
              </article>''')
        blocos.append(f'''
        <section class="sec sec-grupo-problemas" id="grupo-{grupos.index(nome) + 1}">
          <div class="wrap"><h2>{e(nome)}</h2><div class="grid g4">{''.join(cards)}</div></div>
        </section>''')

    total = len(SINTOMAS_HOME)
    h = head(f'Problemas comuns de notebook e computador · {NOME}',
             'Notebook lento, computador que não liga, tela quebrada, bateria, Wi-Fi e outros sintomas. Descubra cuidados iniciais e solicite avaliação técnica.',
             'problemas/', '../')
    h += f'''
      <main>
        <div class="artigo-hero"><div class="wrap">
          <div class="crumb"><a href="../">início</a> / problemas</div>
          <h1>O que aconteceu com seu computador?</h1>
          <p>Explore {total} situações comuns, leia explicações práticas ou converse com o Alvesinho sobre o sintoma. Nenhuma resposta substitui um diagnóstico técnico.</p>
          <div class="hero-acoes"><a href="#fale-comigo" class="btn btn-pri" data-abrir-chat data-servico="Diagnóstico por sintomas">Conversar com Alvesinho</a>
            <a href="../ferramentas/checkup.html" class="btn">Fazer check-up gratuito</a></div>
        </div></div>
        <nav class="wrap categorias-problemas" aria-label="Categorias de problemas">
          {''.join(f'<a href="#grupo-{i+1}">{e(n)}</a>' for i, n in enumerate(grupos))}
        </nav>
        {''.join(blocos)}
        <section class="sec"><div class="wrap">
          <div class="callout alerta"><strong>Atenção:</strong> se houver cheiro de queimado, fumaça, bateria estufada ou líquido no aparelho, pare de utilizar e carregar se puder fazê-lo com segurança. Não tente desmontar componentes energizados.</div>
          {cta('Quer descobrir o que realmente causou o defeito?', 'Informe o modelo e os sintomas. O orçamento depende da avaliação técnica.')}
        </div></section>
      </main>
    ''' + rodape('../')
    gravar('problemas/index.html', h)

    # Serviços, planos e opções de investimento deixam de ocupar a home.
    h = head(f'Serviços de manutenção de computadores e notebooks · {NOME}',
             f'Manutenção, diagnóstico, limpeza, SSD, memória RAM, Windows e suporte remoto em {SITE["regiao_presencial"]} e para todo o Brasil.',
             'servicos/', '../')
    h += f'''
    <main>
      <div class="artigo-hero"><div class="wrap">
        <div class="crumb"><a href="../">início</a> / serviços</div>
        <h1>Serviços de manutenção e suporte técnico</h1>
        <p>Escolha o atendimento que precisa. Explicamos as possibilidades e apresentamos orçamento antes de executar qualquer serviço.</p>
        <div class="hero-acoes"><a href="#fale-comigo" class="btn btn-pri" data-abrir-chat>Solicitar avaliação</a>
        <a href="../problemas/" class="btn">Buscar pelo sintoma</a></div>
      </div></div>
      <section class="sec"><div class="wrap">
        <div class="sec-head"><span class="kicker">// assistência técnica</span>
          <h2>Como podemos ajudar seu equipamento</h2><p>Presencial em {e(SITE["regiao_presencial"])} e remoto para problemas compatíveis com atendimento à distância.</p></div>
        <div class="grid g4">
          {''.join(f'<a class="card" href="#fale-comigo" data-abrir-chat data-servico="{e(t)}"><div class="ico-box">{ico(i)}</div><h3>{e(t)}</h3><p>{e(d)}</p><span class="mais">Pedir orçamento →</span></a>' for i,t,d in SERVICOS)}
        </div>
      </div></section>
      {secao_precos('../')}
      {secao_galeria('../')}
      {secao_avaliacoes()}
      {secao_plano('../')}
      <section class="sec"><div class="wrap">
        {cta('Seu equipamento merece uma avaliação adequada', 'Descreva o problema e receba os próximos passos antes de aprovar qualquer manutenção.')}
      </div></section>
    </main>
    ''' + rodape('../')
    gravar('servicos/index.html', h)
