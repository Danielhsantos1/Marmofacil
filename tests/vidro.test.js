/* Testes do motor de Vidraçaria (motor/vidro.js).
   Referência manual: box 120 × 190 cm, 8 mm, 1 peça => 2,28 m²; 2,28 × 8 × 2,5 = 45,6 kg; perímetro 6,2 m. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {VID_TIPOS,VID_LIM,criarVidro,validarVidro,medidasVidro,quantitativoVidro}=require('../motor/vidro.js');
const {orcarItens}=require('../nucleo/orcamento.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const box=(o={})=>({id:'a',tipo:'box',largura:120,altura:190,espessura:8,qtd:1,...o});
const proj=(o={})=>({nome:'Banheiro',itens:[box()],ferragens:[],...o});

test('referência: box 120 × 190 × 8 mm',()=>{
  const m=medidasVidro(proj());assert.equal(m.ok,true);
  near(m.areaTotal,2.28,'área');near(m.peso,45.6,'peso');near(m.perimetro,6.2,'perímetro');near(m.metrosLineares,1.2,'metro linear');assert.equal(m.pecas,1);
});
test('quantidade multiplica área, peso e perímetro',()=>{
  const m=medidasVidro(proj({itens:[box({qtd:3})]}));near(m.areaTotal,6.84,'área');near(m.peso,136.8,'peso');near(m.perimetro,18.6,'perímetro');assert.equal(m.pecas,3);
});
test('mínimo de cobrança só vale se informado e nunca reduz a área real',()=>{
  const p=proj({itens:[box({largura:40,altura:50})]});
  near(medidasVidro(p).areaCobrada,0.2,'sem mínimo: cobra a área real');
  near(medidasVidro({...p,minimo:1}).areaCobrada,1,'mínimo de 1 m² sobe a cobrança');
  near(medidasVidro({...p,minimo:1}).areaTotal,0.2,'a área real não muda');
  near(medidasVidro({...p,minimo:'0,15'}).areaCobrada,0.2,'mínimo menor que a peça não reduz');
});
test('quantitativo agrupa por tipo, espessura e cobrança, e soma as áreas',()=>{
  const q=quantitativoVidro(proj({itens:[box({id:'1'}),box({id:'2',largura:100,altura:100}),box({id:'3',espessura:10}),{id:'4',tipo:'espelho',largura:60,altura:80,espessura:4,qtd:1,cobranca:'m2'}]}));
  assert.equal(q.ok,true);const c=x=>q.itens.find(i=>i.codigo===x);
  near(c('VID-box-8mm-m2').quantidade,2.28+1,'box 8 mm');assert.match(c('VID-box-8mm-m2').descricao,/Box 8 mm \(2 peças\)/);
  near(c('VID-box-10mm-m2').quantidade,2.28,'box 10 mm');near(c('VID-espelho-4mm-m2').quantidade,0.48,'espelho');
  assert.equal(q.itens.length,3);
});
test('espessura decimal não deixa ponto no código (o código vira caminho de campo na tela)',()=>{
  const q=quantitativoVidro(proj({itens:[box({espessura:8.5})]}));assert.equal(q.itens[0].codigo,'VID-box-8p5mm-m2');assert.ok(!q.itens[0].codigo.includes('.'));
});
test('guarda-corpo cobrado por metro linear usa só a largura',()=>{
  const q=quantitativoVidro(proj({itens:[{id:'g',tipo:'guardacorpo',largura:250,altura:110,espessura:10,qtd:2,cobranca:'ml'}]}));
  const g=q.itens[0];assert.equal(g.unidade,'m');near(g.quantidade,5,'2 × 2,50 m');assert.match(g.codigo,/-ml$/);
});
test('perda do vidro só entra se informada e não vale para película nem ferragens',()=>{
  const e=proj({itens:[box({pelicula:true})],ferragens:[{id:'f',nome:'Kit de box',unidade:'kit',qtd:1}]});
  let q=quantitativoVidro(e);near(q.itens[0].quantidadeComPerda,2.28,'sem perda');
  q=quantitativoVidro({...e,perdas:{vidro:10}});const c=x=>q.itens.find(i=>i.codigo===x);
  near(c('VID-box-8mm-m2').quantidadeComPerda,2.28*1.1,'vidro com 10%');near(c('VID-PELICULA').quantidadeComPerda,2.28,'película sem perda');near(c('VID-FERR-f').quantidadeComPerda,1,'ferragem sem perda');
});
test('película: só as peças marcadas, pela área real',()=>{
  const e=proj({itens:[box({pelicula:true,qtd:2}),box({id:'b',largura:100,altura:100})]});
  near(medidasVidro(e).peliculaArea,4.56,'2 peças de 2,28 m²');
  assert.equal(quantitativoVidro(proj()).itens.some(i=>i.codigo==='VID-PELICULA'),false);
});
test('ferragens viram uma linha cada, com o código pelo id (o preço não muda de linha ao apagar outra)',()=>{
  const q=quantitativoVidro(proj({ferragens:[{id:'x1',nome:'Roldana',unidade:'un',qtd:4},{id:'x2',nome:'Silicone',unidade:'tubo',qtd:'2,5'}]}));
  const f=q.itens.filter(i=>i.codigo.startsWith('VID-FERR-'));assert.deepEqual(f.map(i=>i.codigo),['VID-FERR-x1','VID-FERR-x2']);near(f[1].quantidade,2.5,'quantidade com vírgula');
});
test('validação: tipo, medidas, espessura, quantidade, ferragem, mínimo e perda',()=>{
  const ruim=o=>validarVidro(proj(o)).ok;
  assert.equal(ruim({}),true);
  assert.equal(ruim({itens:[box({tipo:''})]}),false,'sem tipo');assert.equal(ruim({itens:[box({tipo:'xyz'})]}),false,'tipo desconhecido');
  assert.equal(ruim({itens:[box({largura:2})]}),false);assert.equal(ruim({itens:[box({altura:5000})]}),false);assert.equal(ruim({itens:[box({largura:''})]}),false);
  assert.equal(ruim({itens:[box({espessura:1})]}),false);assert.equal(ruim({itens:[box({espessura:40})]}),false);
  assert.equal(ruim({itens:[box({qtd:0})]}),false);assert.equal(ruim({itens:[box({qtd:1.5})]}),false);assert.equal(ruim({itens:[box({qtd:9999})]}),false);
  assert.equal(ruim({ferragens:[{nome:'',unidade:'un',qtd:1}]}),false);assert.equal(ruim({ferragens:[{nome:'x',unidade:'',qtd:1}]}),false);assert.equal(ruim({ferragens:[{nome:'x',unidade:'un',qtd:-1}]}),false);
  assert.equal(ruim({minimo:-1}),false);assert.equal(ruim({minimo:'abc'}),false);assert.equal(ruim({perdas:{vidro:150}}),false);assert.equal(ruim({perdas:{vidro:'x'}}),false);
});
test('entradas estranhas não derrubam o motor',()=>{
  for(const x of [null,undefined,'texto',42,{},{itens:'x'},{itens:[null,undefined,1]}]){
    assert.doesNotThrow(()=>{validarVidro(x);medidasVidro(x);quantitativoVidro(x)});
  }
  assert.equal(medidasVidro(null).ok,true,'projeto vazio é válido, com tudo zero');near(medidasVidro(null).areaTotal,0,'zero');
});
test('projeto sem peças: quantitativo vazio e orçamento nunca "completo"',()=>{
  const q=quantitativoVidro(proj({itens:[]}));assert.equal(q.ok,true);assert.equal(q.itens.length,0);
  assert.equal(orcarItens(q.itens,{}).completo,false);
});
test('ponta a ponta com o orçamento genérico: box 2,28 m² a R$ 400 e kit de R$ 150, margem 30% e impostos 10%',()=>{
  const q=quantitativoVidro(proj({ferragens:[{id:'k',nome:'Kit',unidade:'kit',qtd:1}]}));
  const itens=q.itens.map(i=>({...i,precoUnit:i.codigo==='VID-FERR-k'?150:400}));
  const o=orcarItens(itens,{margem:30,impostos:10});assert.equal(o.completo,true);
  near(o.custo,2.28*400+150,'custo',0.01);near(o.preco,(2.28*400+150)/0.6,'preço',0.01);
});
test('os tipos pedidos existem',()=>{
  for(const t of ['box','espelho','divisoria','guardacorpo','porta','janela','vitrine','cobertura'])assert.ok(VID_TIPOS[t],t);
});
test('propriedade: 800 projetos aleatórios; áreas, pesos e agrupamento coerentes',()=>{
  let s=4242;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  const tipos=Object.keys(VID_TIPOS);
  for(let k=0;k<800;k++){
    const itens=Array.from({length:int(1,6)},(_,i)=>({id:'i'+i,tipo:tipos[int(0,tipos.length-1)],largura:int(VID_LIM.min,400),altura:int(VID_LIM.min,300),espessura:int(VID_LIM.espMin,VID_LIM.espMax),qtd:int(1,5),cobranca:rnd()<.3?'ml':'m2',pelicula:rnd()<.3}));
    const e={itens,minimo:rnd()<.5?0:int(0,200)/100,perdas:{vidro:int(0,20)}},m=medidasVidro(e),q=quantitativoVidro(e);
    assert.equal(m.ok,true);assert.equal(q.ok,true);
    near(m.areaTotal,itens.reduce((t,x)=>t+x.largura*x.altura*x.qtd/1e4,0),'área '+k,1e-9);
    assert.ok(m.areaCobrada>=m.areaTotal-1e-12,'cobrada >= real');
    near(m.peso,itens.reduce((t,x)=>t+x.largura*x.altura/1e4*x.espessura*2.5*x.qtd,0),'peso '+k,1e-9);
    const m2=q.itens.filter(i=>i.codigo.endsWith('-m2')).reduce((t,i)=>t+i.quantidade,0);
    near(m2,itens.filter(x=>x.cobranca==='m2').reduce((t,x)=>t+Math.max(x.largura*x.altura/1e4,e.minimo)*x.qtd,0),'soma por grupo '+k,1e-9);
    q.itens.forEach(i=>near(i.quantidadeComPerda,i.quantidade*(1+i.perdaPct/100),'perda '+i.codigo,1e-9));
    assert.equal(new Set(q.itens.map(i=>i.codigo)).size,q.itens.length,'códigos únicos');
  }
});
