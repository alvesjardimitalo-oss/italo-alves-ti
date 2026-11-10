// Regressão de arquitetura: páginas especializadas, links e conteúdo sem tornar a home interminável.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const raiz=resolve(import.meta.dirname,'../..');
const read=p=>readFileSync(resolve(raiz,p),'utf8');
const home=read('index.html'),problemas=read('problemas/index.html'),servicos=read('servicos/index.html'),dicas=read('dicas/index.html'),sitemap=read('sitemap.xml');
const art=JSON.parse(read('conteudo/artigos.json'));
const sintomas=JSON.parse(read('conteudo/sintomas.json')).itens;

assert(existsSync(resolve(raiz,'tools/site/paginas/home.py')),'Módulo home não existe');
assert(existsSync(resolve(raiz,'tools/site/paginas/dicas.py')),'Módulo dicas não existe');
assert(existsSync(resolve(raiz,'tools/site/paginas/catalogos.py')),'Módulo catálogos não existe');
// A home foi refeita à mão (vitrine animada do Alvesinho): até 8 destaques.
assert((home.match(/data-alves-escolher="/g)||[]).length<=8,'Home longa: deveria ter no máximo 8 destaques');
assert((problemas.match(/data-sintoma="/g)||[]).length===sintomas.length,'Lista de sintomas incompleta');
assert(home.includes('href="problemas/"'),'Falta chamada para catálogo de sintomas');
assert(/href="(\.\/)?servicos\/"/.test(home),'Falta chamada para serviços');
assert(/href="(\.\/)?ferramentas\//.test(home),'Falta chamada para ferramentas');
assert(!home.includes('id="problemas"'),'A home ainda duplica o catálogo longo');
assert(home.includes('Alvesinho'),'Alvesinho precisa permanecer visível');
assert(home.includes('data-alves-apresentacao'),'Home precisa continuar mostrando sintomas');
assert(home.includes('id="solucoes"'),'Home precisa manter uma prévia de serviços');
assert(home.length < 33000,'Home continua excessivamente extensa');
assert(problemas.includes('Categorias de problemas'),'Catálogo sem navegação por categorias');
assert(/<h1>[^<]{10,}/.test(servicos),'Catálogo de serviços sem título');
assert(servicos.includes('Pedir orçamento') || servicos.includes('Solicitar avaliação'),'Serviços sem CTA');
assert(servicos.length>10000,'Páginas completas de serviços foram eliminadas');
for(const caminho of ['problemas/','servicos/','dicas/','ferramentas/']) {
  assert(sitemap.includes('https://italoinfotec.com.br/'+caminho),'Sitemap não contém '+caminho);
}
assert(art.length>=18,'Novos conteúdos não publicados');
const slugs=new Set(art.map(a=>a.slug));
assert(slugs.size===art.length,'Slugs de artigos repetidos');
for(const a of art) {
  assert(a.titulo.length>=20 && a.resumo.length>=50 && a.corpo.length>=300,'Conteúdo curto demais: '+a.slug);
  assert(existsSync(resolve(raiz,'dicas/'+a.slug+'.html')),'Página de artigo não gerada: '+a.slug);
}
for(const item of sintomas) {
  assert(item.categoria,'Sintoma não categorizado: '+item.id);
  if(item.dica) {
    assert(slugs.has(item.dica),'Sintoma aponta para guia inexistente: '+item.id+' / '+item.dica);
    assert(problemas.includes('dicas/'+item.dica+'.html'),'Guia não aparece no catálogo: '+item.dica);
  }
}
assert(dicas.includes('Caiu água, café ou outra bebida') || dicas.includes('Caiu água, café ou outra bebida'.replace('á','&aacute;')),'Novos artigos não destacados no índice');
console.log('OK: home compacta, páginas específicas, '+sintomas.length+' sintomas categorizados e '+art.length+' artigos, com navegação e links válidos.');
