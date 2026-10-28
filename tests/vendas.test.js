/* Página de vendas (vendas/index.html): fica fora do app e não pode prometer o que o app não faz. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const pag=fs.readFileSync(path.join(raiz,'vendas','index.html'),'utf8');
const sw=fs.readFileSync(path.join(raiz,'sw.js'),'utf8');

test('a página existe, aponta para o app e as imagens existem',()=>{
  assert.match(pag,/<title>Marmofácil/);assert.ok(pag.includes('href="../"'),'botão para abrir o app');
  for(const m of pag.matchAll(/src="(img\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(raiz,'vendas',m[1])),'imagem faltando: '+m[1]);
});
test('não promete o que o app não faz hoje',()=>{
  const proibido=[/nossos clientes/i,/horas para minutos/i,/e-mail/i,/solicitar demonstra/i,/come[cç]ar gratuitamente/i,/todos os direitos reservados/i,/mais seguro/i];
  for(const r of proibido)assert.ok(!r.test(pag),'frase proibida: '+r);
  const brev=pag.slice(pag.indexOf('id="roadmap"'));
  assert.ok(/Em breve/.test(brev)&&/vidraçarias/.test(brev),'outros segmentos só aparecem como "em breve"');
  assert.ok(!/vidraçaria/i.test(pag.slice(0,pag.indexOf('id="roadmap"'))),'vidraçaria não aparece antes da seção "em breve"');
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
