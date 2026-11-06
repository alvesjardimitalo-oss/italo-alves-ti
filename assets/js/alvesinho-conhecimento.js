// Base de conhecimento local do Alvesinho: respostas específicas, sem prometer diagnóstico remoto.
// Mantida no próprio site, sem enviar o texto digitado a serviços de IA externos.
export const CATEGORIAS = [
  { id: 'energia', titulo: 'Não liga / energia' },
  { id: 'lentidao', titulo: 'Lentidão / desempenho' },
  { id: 'imagem', titulo: 'Tela / imagem' },
  { id: 'temperatura', titulo: 'Aquecimento / ruídos' },
  { id: 'sistema', titulo: 'Windows / segurança' },
  { id: 'componentes', titulo: 'Bateria / teclado / peças' },
  { id: 'rede', titulo: 'Internet / impressora' },
];

export const SINTOMAS = [
  { id: 'molhou', cat: 'energia', titulo: 'Caiu líquido no equipamento', termos: ['molhou','derramei agua','caiu agua','caiu liquido','derramou cafe','caiu cafe','cerveja no notebook','liquido'], possiveis: 'Umidade pode causar curto e corrosão, mesmo que pareça funcionar.', passo: 'Desligue, retire o carregador se for seguro e não tente ligar ou secar com calor. Procure avaliação quanto antes.', alerta: true },
  { id: 'cheiro-queimado', cat: 'energia', titulo: 'Cheiro de queimado ou fumaça', termos: ['cheiro queimado','cheiro de queimado','saiu fumaca','pegando fogo','fumaca','faísca','faisca'], possiveis: 'Pode haver falha elétrica, na fonte ou na placa.', passo: 'Pare de usar e desconecte da energia somente se for seguro. Não volte a ligar até uma inspeção técnica.', alerta: true },
  { id: 'nao-carrega', cat: 'componentes', titulo: 'Notebook não carrega', termos: ['nao carrega','parou de carregar','nao reconhece carregador','carregador falhando','conector de carga','conector quebrado'], possiveis: 'Carregador, conector, bateria ou circuito de carga podem estar envolvidos.', passo: 'Evite forçar a entrada de carga. Se houver aquecimento, cheiro estranho ou inchaço na bateria, pare de usar.', alerta: true },
  { id: 'bateria-estufada', cat: 'componentes', titulo: 'Bateria estufada', termos: ['bateria estufada','bateria inchada','bateria inflada','tampa levantando','bateria expandindo'], possiveis: 'Uma bateria de lítio danificada pode oferecer risco de incêndio.', passo: 'Pare de carregar e usar; não pressione nem perfure a bateria. Procure assistência para retirada segura.', alerta: true },
  { id: 'liga-sem-imagem', cat: 'imagem', titulo: 'Liga, mas não dá vídeo', termos: ['nao da video','sem video','liga mas tela preta','acende luz sem imagem','liga sem imagem','monitor sem sinal','sem sinal'], possiveis: 'Tela, memória, conexão de vídeo ou placa podem estar relacionados.', passo: 'Confira o cabo e a entrada do monitor, se houver. Não force conectores; uma avaliação distingue tela de placa.' },
  { id: 'liga-desliga', cat: 'energia', titulo: 'Liga e desliga sozinho', termos: ['liga e desliga','reinicia sozinho','desliga do nada','liga e reinicia','fica reiniciando'], possiveis: 'Superaquecimento, alimentação, memória ou falha do sistema podem causar isso.', passo: 'Evite insistir em sucessivas tentativas de ligar. Informe quando o desligamento acontece.' },
  { id: 'nao-liga', cat: 'energia', titulo: 'Computador não liga', termos: ['nao liga','nao acende','nao inicia','sem energia','nao da sinal de vida','morto'], possiveis: 'Fonte, carregador, bateria, botão ou placa podem estar envolvidos.', passo: 'Confira se a tomada funciona e se o cabo está firme. Não abra a fonte nem equipamentos energizados.', dica: 'dicas/computador-nao-liga.html' },
  { id: 'lento-iniciar', cat: 'lentidao', titulo: 'Demora para iniciar', termos: ['demora para ligar','demora para iniciar','muito tempo para iniciar','inicializacao lenta','lento para ligar'], possiveis: 'HD antigo, programas na inicialização ou armazenamento com problemas são causas comuns.', passo: 'Observe quanto tempo leva para chegar à área de trabalho. Um SSD pode ajudar, após verificar a saúde do disco.', dica: 'dicas/ssd-ou-hd.html' },
  { id: 'travando', cat: 'lentidao', titulo: 'Computador travando', termos: ['travando','congelando','trava tudo','trava muito','tela congelada','nao responde'], possiveis: 'Pouca memória, falha no armazenamento, superaquecimento ou software podem causar travamentos.', passo: 'Anote em quais programas acontece e salve seus arquivos importantes quando possível.', dica: 'dicas/computador-lento.html' },
  { id: 'lento', cat: 'lentidao', titulo: 'Notebook ou PC lento', termos: ['muito lento','esta lento','computador lento','notebook lento','lentidao','programa demora','pc fraco','desempenho ruim'], possiveis: 'HD, pouca RAM, sistema sobrecarregado ou falta de manutenção.', passo: 'Conte se usa SSD ou HD e para que utiliza o aparelho. O check-up ajuda a orientar um possível upgrade.', dica: 'dicas/computador-lento.html' },
  { id: 'ssd-hd', cat: 'lentidao', titulo: 'HD ou SSD com problema', termos: ['ssd com problema','hd com problema','hd fazendo barulho','disco com defeito','ssd sumiu','hd sumiu','arquivos corrompidos'], possiveis: 'Falha de disco pode causar lentidão, corrupção de arquivos e perda de dados.', passo: 'Se há ruídos, sumiço de arquivos ou erros recorrentes, evite instalações e cópias desnecessárias. Priorize os dados.', alerta: true, dica: 'dicas/ssd-ou-hd.html' },
  { id: 'upgrade', cat: 'lentidao', titulo: 'Quero SSD ou mais memória RAM', termos: ['upgrade','colocar ssd','trocar hd por ssd','aumentar ram','mais memoria','memoria ram','melhorar pc'], possiveis: 'SSD e RAM podem melhorar a experiência dependendo da configuração e do uso.', passo: 'Precisamos do modelo, do uso e de saber o que já está instalado para confirmar compatibilidade.', dica: 'dicas/ssd-ou-hd.html' },
  { id: 'tela-quebrada', cat: 'imagem', titulo: 'Tela quebrada ou com manchas', termos: ['tela quebrada','tela trincada','mancha na tela','tela rachada','display quebrado','listras na tela','linha na tela'], possiveis: 'Pode ser dano no painel, no cabo de vídeo ou em outra conexão.', passo: 'Evite pressionar a tela. Uma foto do defeito e o modelo ajudam a orçar a peça compatível.' },
  { id: 'tela-piscando', cat: 'imagem', titulo: 'Tela piscando ou apagando', termos: ['tela piscando','imagem piscando','tela apagando','imagem sumindo','tela preta intermitente'], possiveis: 'Cabo, tela, driver ou circuito de vídeo podem estar relacionados.', passo: 'Observe se ocorre ao mover a tampa ou apenas com certos programas. Isso ajuda no diagnóstico.' },
  { id: 'superaquece', cat: 'temperatura', titulo: 'Esquenta demais', termos: ['esquentando','esquenta muito','superaquecimento','muito quente','temperatura alta','quente demais'], possiveis: 'Poeira, ventilação obstruída, pasta térmica degradada ou esforço excessivo podem elevar a temperatura.', passo: 'Use sobre uma superfície firme, nunca sobre cobertores. Se desliga por calor, pare o uso até avaliar.', dica: 'dicas/notebook-esquentando.html' },
  { id: 'barulho', cat: 'temperatura', titulo: 'Ventoinha faz muito barulho', termos: ['ventoinha barulhenta','ventoinha alta','cooler barulhento','faz barulho','barulho estranho','ruido alto','ventoinha'], possiveis: 'Poeira, ventilador desgastado ou aquecimento podem causar ruídos.', passo: 'Se houver estalos vindos do HD, interrompa tarefas desnecessárias e proteja seus arquivos.', dica: 'dicas/notebook-esquentando.html' },
  { id: 'tela-azul', cat: 'sistema', titulo: 'Tela azul no Windows', termos: ['tela azul','blue screen','bsod','erro azul','stop code'], possiveis: 'Drivers, memória, armazenamento ou corrupção do sistema podem provocar erros.', passo: 'Fotografe o código de parada e anote quando ocorre. Isso ajuda a investigar sem adivinhar a causa.', dica: 'dicas/tela-azul.html' },
  { id: 'travado-logo', cat: 'sistema', titulo: 'Travou no logotipo ao iniciar', termos: ['travado na logo','fica no logo','preso no logo','travado na inicializacao','loop na logo','nao passa da logo'], possiveis: 'Falha de inicialização, disco, atualizações ou hardware podem estar envolvidos.', passo: 'Evite reiniciar repetidamente se existirem arquivos importantes. Podemos avaliar antes de formatar.' },
  { id: 'windows', cat: 'sistema', titulo: 'Windows com erro ou não inicia', termos: ['windows nao inicia','erro no windows','windows corrompido','formatar','instalar windows','atualizacao falhou','erro no boot'], possiveis: 'Atualização, drivers, arquivos corrompidos ou disco podem estar relacionados.', passo: 'Não formate antes de verificar a necessidade de backup. Informe a mensagem de erro exibida.' },
  { id: 'virus', cat: 'sistema', titulo: 'Vírus ou propagandas', termos: ['virus','propaganda abrindo','pop up','navegador abre sozinho','malware','pc infectado','antivirus','conta invadida'], possiveis: 'Programas indesejados, extensões ou malware podem alterar o navegador e afetar o desempenho.', passo: 'Evite clicar em alertas suspeitos e trocar senhas no aparelho comprometido. Podemos orientar uma limpeza segura.', dica: 'dicas/virus-e-golpes.html' },
  { id: 'arquivos', cat: 'sistema', titulo: 'Arquivos sumindo ou sem backup', termos: ['arquivos sumiram','perdi arquivos','apagou arquivos','recuperar dados','fazer backup','documentos perdidos','fotos perdidas'], possiveis: 'Exclusão acidental, falha de disco ou sincronização podem causar perda de arquivos.', passo: 'Evite instalar programas no disco afetado para não sobrescrever dados. Informe se houve queda ou ruído.', alerta: true, dica: 'dicas/backup.html' },
  { id: 'teclado', cat: 'componentes', titulo: 'Teclado ou touchpad falhando', termos: ['teclado nao funciona','tecla falhando','tecla parou','touchpad','mouse nao funciona','teclado falhando'], possiveis: 'Sujeira, líquidos, cabo flat, periférico ou software podem ser a causa.', passo: 'Observe se falham teclas específicas ou todo o teclado. Não force teclas ou conectores.' },
  { id: 'usb', cat: 'componentes', titulo: 'USB, HDMI ou áudio sem funcionar', termos: ['usb nao funciona','porta usb','hdmi nao funciona','sem som','audio nao sai','microfone nao funciona','webcam nao funciona'], possiveis: 'Conector, driver, cabo ou configuração podem estar envolvidos.', passo: 'Experimente outro cabo ou periférico confiável, sem forçar as portas.' },
  { id: 'bateria', cat: 'componentes', titulo: 'Bateria dura pouco', termos: ['bateria dura pouco','bateria descarrega','bateria viciada','so funciona na tomada','autonomia ruim'], possiveis: 'Desgaste da bateria, consumo elevado ou falha de carregamento são possibilidades.', passo: 'Anote a autonomia aproximada e o modelo. Se a bateria estiver estufada, não use nem carregue.', dica: 'dicas/bateria-notebook.html' },
  { id: 'wifi', cat: 'rede', titulo: 'Wi-Fi não conecta ou cai', termos: ['wifi cai','wi-fi cai','sem wifi','wifi nao conecta','sem internet','rede nao funciona','internet cai','internet lenta'], possiveis: 'Roteador, sinal, driver ou adaptador podem ser responsáveis.', passo: 'Veja se outros aparelhos também perdem a conexão. Isso ajuda a separar rede de problema no computador.' },
  { id: 'impressora', cat: 'rede', titulo: 'Impressora não imprime', termos: ['impressora','nao imprime','nao digitaliza','fila de impressao','imprimir nao funciona'], possiveis: 'Fila de impressão, conexão, driver, cartucho ou hardware podem estar envolvidos.', passo: 'Informe o modelo e o aviso no visor. Veja se ela faz cópia diretamente, se tiver essa função.' },
  { id: 'limpeza', cat: 'temperatura', titulo: 'Limpeza e manutenção preventiva', termos: ['limpeza interna','limpar notebook','limpeza preventiva','troca pasta termica','manutencao preventiva','pasta termica'], possiveis: 'A manutenção preventiva ajuda a verificar ventilação, sujeira e sinais de desgaste.', passo: 'Uma inspeção define se precisa de limpeza interna e troca de pasta térmica, conforme o equipamento.' },
  { id: 'nao-sabe', cat: 'sistema', titulo: 'Não sei explicar o defeito', termos: ['nao sei o problema','nao sei explicar','outro problema','deu defeito','quero ajuda'], possiveis: 'Nem sempre é possível identificar a origem apenas pelos sintomas.', passo: 'Conte quando começou, o que aparece na tela e se houve queda, líquido ou atualização.' },
];

export function normalizarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function encontrarSintoma(texto) {
  const entrada = normalizarTexto(texto);
  if (!entrada) return null;
  const porId = SINTOMAS.find((s) => s.id === entrada || normalizarTexto(s.titulo) === entrada);
  if (porId) return porId;
  let melhor = null, pontos = 0;
  for (const item of SINTOMAS) {
    const marcadores = [item.titulo, ...item.termos].map(normalizarTexto);
    for (const termo of marcadores) {
      if (termo.length >= 4 && (' ' + entrada + ' ').includes(' ' + termo + ' ')) {
        const nota = termo.split(' ').length * 10 + termo.length;
        if (nota > pontos) { melhor = item; pontos = nota; }
      }
    }
  }
  return melhor;
}

export function orientarSintoma(entrada) {
  const s = typeof entrada === 'string' ? encontrarSintoma(entrada) : entrada;
  if (!s) return {
    conhecido: false,
    titulo: 'Vamos entender melhor o problema',
    possiveis: 'Esse sintoma precisa de mais detalhes para orientar uma hipótese.',
    passo: 'Conte o que ocorre, desde quando e se aparece algum aviso. Uma avaliação técnica pode identificar a causa.',
    alerta: false,
  };
  return { conhecido: true, ...s };
}

export function sintomasPorCategoria(cat) {
  return SINTOMAS.filter((s) => s.cat === cat);
}
