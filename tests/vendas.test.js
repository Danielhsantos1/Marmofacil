/* Página de vendas (vendas/index.html): fica fora do app e não pode prometer o que o app não faz. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const pag=fs.readFileSync(path.join(raiz,'vendas','index.html'),'utf8');
const sw=fs.readFileSync(path.join(raiz,'sw.js'),'utf8');

test('a página existe, aponta para o app e as imagens existem',()=>{
  assert.match(pag,/<title>Projetta/);assert.ok(pag.includes('href="../"'),'botão para abrir o app');
  for(const m of pag.matchAll(/src="(img\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(raiz,'vendas',m[1])),'imagem faltando: '+m[1]);
  for(const m of pag.matchAll(/<img\b[^>]*>/g))assert.ok(/width="\d+"/.test(m[0])&&/height="\d+"/.test(m[0])&&/alt="[^"]+"/.test(m[0]),'img sem largura/altura/alt: '+m[0].slice(0,60));
});
test('não inventa números, depoimentos nem preços',()=>{
  const proibido=[/\+\s?\d+\s?%/,/\+\s?1000/,/depoimento/i,/nossos clientes/i,/R\$\s?\d/,/todos os direitos reservados/i,/lighthouse/i,/mais seguro/i];
  for(const r of proibido)assert.ok(!r.test(pag),'frase proibida: '+r);
});
test('o que ainda não existe leva o selo "Em breve"',()=>{
  for(const nome of ['Marcenaria','Esquadrias','Área externa']){
    const m=new RegExp('<article class="seg[^>]*>(?:(?!</article>).)*<h3>'+nome+'</h3>(?:(?!</article>).)*</article>','s').exec(pag);
    assert.ok(m,'card '+nome);assert.ok(/class="tag">Em breve/.test(m[0]),nome+' sem selo Em breve');
  }
  for(const nome of ['Ambientes','Marmoraria','Vidraçaria']){
    const m=new RegExp('<article class="seg[^>]*>(?:(?!</article>).)*<h3>'+nome+'</h3>(?:(?!</article>).)*</article>','s').exec(pag);
    assert.ok(m&&/tag on">Disponível/.test(m[0]),nome+' deve estar Disponível');
  }
  for(const nome of ['Planta baixa inteligente','Pronto para nuvem'])assert.ok(new RegExp(nome+'(?:(?!</div>).)*').test(pag)&&new RegExp('Em breve</span><h3>'+nome).test(pag),nome+' sem selo');
  assert.ok((pag.match(/<div class="card plan[^>]*><span class="tag">Em breve/g)||[]).length===3,'planos em breve');
});
test('configuração de contato: só números no WhatsApp; sem contato, o formulário fica escondido',()=>{
  const c=/const CONFIG=\{whatsapp:"([^"]*)",endpoint:"([^"]*)"\}/.exec(pag);assert.ok(c,'CONFIG');
  assert.match(c[1],/^(\d{12,13})?$/,'whatsapp = vazio ou DDI+DDD+número, só dígitos');
  assert.match(c[2],/^(https:\/\/\S+)?$/,'endpoint = vazio ou https');
  assert.ok(/<form id="lead" hidden/.test(pag));
});
test('o service worker não intercepta a página de vendas',()=>{
  assert.ok(/pathname\.includes\('\/vendas\/'\)\)return/.test(sw));
});
