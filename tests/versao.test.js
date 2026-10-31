/* Confere que a versão do app é a mesma em todos os lugares. Se esquecer de subir um deles, o celular
   pode misturar arquivos de versões diferentes e abrir em branco. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const ler=f=>fs.readFileSync(path.join(raiz,f),'utf8');
const sw=ler('sw.js'),html=ler('index.html');

const V=+/const V='marmofacil-v(\d+)'/.exec(sw)[1];

test('V do sw.js, APP_V do index.html e todos os ?v= são o mesmo número',()=>{
  assert.equal(+/const APP_V=(\d+)/.exec(html)[1],V,'APP_V no index.html');
  const versoes=[...(html+sw).matchAll(/\?v=(\d+)/g)].map(m=>+m[1]);
  assert.ok(versoes.length>=4,'esperava os scripts versionados');
  for(const v of versoes)assert.equal(v,V,'um ?v= está diferente de V');
});

test('todo arquivo da lista de instalação (CORE) existe',()=>{
  const core=/const CORE=\[(.*?)\];/s.exec(sw)[1].split(',').map(x=>x.trim().replace(/^'|'$/g,''));
  for(const f of core){
    const p=f==='./'?'index.html':f.split('?')[0];
    assert.ok(fs.existsSync(path.join(raiz,p)),'não existe: '+p);
  }
});

test('os scripts do index.html e o import do 3D estão versionados e estão no CORE',()=>{
  const core=/const CORE=\[(.*?)\];/s.exec(sw)[1];
  for(const f of ['calc.js','catalogo.js','model3d.js','viewer3d.js','motor/ambiente.js','motor/planta.js','nucleo/registro-modulos.js','nucleo/orcamento.js','motor/vidro.js','telas/vidracaria.js','motor/esquadria.js','telas/esquadrias.js']){
    assert.ok(html.includes(f+'?v='+V),f+' sem ?v= no index.html');
    assert.ok(core.includes(f+'?v='+V),f+' sem ?v= no CORE');
  }
  assert.ok(!/<script src="(calc|catalogo|model3d|motor\/ambiente|motor\/planta|nucleo\/registro-modulos|nucleo\/orcamento|motor\/vidro|telas\/vidracaria|motor\/esquadria|telas\/esquadrias)\.js"/.test(html),'script sem versão');
});

test('o service worker só apaga caches do Marmofácil (o github.io é compartilhado com outros projetos)',()=>{
  assert.match(sw,/const MEUS=\/\^\(marmofacil\|pedra-facil\)-\//);
  assert.ok(/filter\(x=>MEUS\.test\(x\)&&x!==V\)/.test(sw));
});

test('a rede de segurança de abertura nunca mexe nos dados salvos',()=>{
  const guard=html.slice(html.indexOf('Rede de segurança de abertura'),html.indexOf('<script src="vendor/jspdf'));
  assert.ok(guard.length>500);
  assert.ok(!/localStorage\.(setItem|removeItem|clear)/.test(guard),'a rede de segurança não pode escrever no localStorage');
  assert.ok(/localStorage\.getItem\('pedrafacil\.v1'\)/.test(guard),'deve poder ler os dados para o backup');
});
