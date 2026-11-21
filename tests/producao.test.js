/* Testes da ficha do projeto (producao.js). Referência manual: chapa 300 × 180 cm = 5,4 m².
   Peça única 157 × 60 e 141 × 50 na mesma chapa: 1 chapa, mínimo por área 1. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {nestParts,calcQuote,shape}=require('../calc.js');
const {PROD_SOBRA_MIN,rotuloPeca,listaPecas,minimoChapas,sobrasUteis,resumoProducao}=require('../producao.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const SL=300,SW=180;
const ctx=parts=>{const nest=nestParts(parts,SL,SW),area=parts.reduce((t,a)=>t+a.w*a.h*(a.q||1),0)/1e4,slabArea=SL*SW/1e4,n=nest.slabs.length;
  return {nest,area,slabArea,nSlabs:n,SL,SW,util:n?nest.used/(n*slabArea):0}};
const sobrepoe=(a,b)=>{const o=(p,q,r,s)=>Math.max(0,Math.min(p+q,r+s)-Math.max(p,r));return o(a.x,a.w,b.x,b.w)*o(a.y,a.h,b.y,b.h)>1e-6};

test('rótulos: peça inteira "4"; peça dividida "3-2"; sem referência vazio',()=>{
  assert.equal(rotuloPeca({n:4,sub:0,de:1}),'4');assert.equal(rotuloPeca({n:3,sub:2,de:2}),'3-2');assert.equal(rotuloPeca(null),'');assert.equal(rotuloPeca({}),'');
});
test('o plano de corte numera as peças e as partes (e não muda nenhuma conta)',()=>{
  const parts=[{w:250,h:60,l:'Tampo',q:1},{w:500,h:10,l:'Rodabanca',q:1},{w:60,h:60,l:'Lateral',q:2}];
  const nest=nestParts(parts,SL,SW),itens=nest.slabs.flatMap(s=>s.items);
  assert.ok(itens.every(i=>i.ref&&i.ref.n>=1),'toda peça posta tem número');
  assert.deepEqual(itens.filter(i=>i.ref.n===2).map(i=>rotuloPeca(i.ref)).sort(),['2-1','2-2'],'rodabanca de 500 cm sai em 2 partes');
  assert.equal(itens.filter(i=>i.ref.n===3).length,2,'duas laterais iguais, mesmo número');
  assert.equal(nest.emendas,1);
});
test('listaPecas: números, girada e partes',()=>{
  const l=listaPecas([{w:157,h:60,l:'Tampo'},{w:60,h:157,l:'Lado',q:2},{w:500,h:10,l:'Roda'}],SL,SW);
  assert.deepEqual(l.map(x=>x.n),[1,2,3]);assert.equal(l[0].girada,false);assert.equal(l[1].girada,true);assert.equal(l[1].q,2);
  assert.equal(l[2].partes,2);assert.equal(l[2].emendas,1);assert.equal(l[0].partes,1);
});
test('minimoChapas: piso pela área',()=>{
  assert.equal(minimoChapas(0,5.4),0);assert.equal(minimoChapas(5.4,5.4),1);assert.equal(minimoChapas(5.41,5.4),2);assert.equal(minimoChapas(1,5.4),1);assert.equal(minimoChapas(10,0),0);
});
test('sobras: cada retângulo com os dois lados ≥ mínimo, dentro da chapa, sem tocar nas peças nem umas nas outras',()=>{
  const c=ctx([{w:157,h:60,l:'A'},{w:141,h:50,l:'B'},{w:65.6,h:60,l:'C'}]);
  const r=sobrasUteis(c.nest,SL,SW);assert.ok(r.total>0);
  r.porChapa.forEach((lista,i)=>{
    const itens=c.nest.slabs[i].items;
    lista.forEach((s,a)=>{
      assert.ok(s.w>=PROD_SOBRA_MIN-1e-9&&s.h>=PROD_SOBRA_MIN-1e-9,'tamanho mínimo');
      assert.ok(s.x>=-1e-9&&s.y>=-1e-9&&s.x+s.w<=SL+1e-6&&s.y+s.h<=SW+1e-6,'dentro da chapa');
      itens.forEach(it=>assert.ok(!sobrepoe(s,it),'não toca peça'));
      lista.slice(a+1).forEach(o=>assert.ok(!sobrepoe(s,o),'sobras não se sobrepõem'));
      near(s.area,s.w*s.h/1e4,'área');
    });
  });
});
test('sobras + peças nunca passam da área da chapa; chapa vazia de peças não existe',()=>{
  const c=ctx([{w:100,h:100,l:'A'}]),r=sobrasUteis(c.nest,SL,SW);
  assert.ok(r.total+c.nest.used<=c.slabArea+1e-6);assert.equal(sobrasUteis({slabs:[]},SL,SW).total,0);assert.equal(sobrasUteis(null,SL,SW).total,0);
});
test('mínimo maior corta sobras; mínimo zero nunca dá menos',()=>{
  const c=ctx([{w:157,h:60,l:'A'},{w:141,h:50,l:'B'}]);
  const a=sobrasUteis(c.nest,SL,SW,15).total,b=sobrasUteis(c.nest,SL,SW,60).total,z=sobrasUteis(c.nest,SL,SW,1).total;
  assert.ok(b<=a+1e-9&&a<=z+1e-9);
});
test('vão em cima de peça mais baixa vira sobra, e vizinhas de mesma altura se juntam',()=>{
  const c=ctx([{w:100,h:60,l:'Alta'},{w:50,h:30,l:'Baixa',q:2}]);                  // prateleira de 60 cm; duas peças de 30 ao lado
  const r=sobrasUteis(c.nest,SL,SW),topo=r.porChapa[0].filter(s=>Math.abs(s.h-(60-30-0.4))<1e-6);
  assert.ok(topo.length>=1,'há vão de ~29,6 cm de altura em cima das peças baixas');
});
test('resumo: mensagem "menor número" só quando o plano usa o mínimo pela área',()=>{
  const parts=[{w:157,h:60,l:'A'},{w:141,h:50,l:'B'}],c=ctx(parts),r=resumoProducao(c,parts);
  assert.equal(r.chapas,1);assert.equal(r.minimoChapas,1);assert.equal(r.mensagem.tipo,'bom');assert.match(r.mensagem.texto,/menor número de chapas possível pela área/);
  near(r.sobraUtil,r.sobras.total,'sobra útil');
});
test('resumo: se usa mais chapas que o mínimo pela área, avisa que é estimativa e NÃO promete o melhor encaixe',()=>{
  const parts=[{w:290,h:100,l:'A'},{w:290,h:100,l:'B'}],c=ctx(parts),r=resumoProducao(c,parts);   // 2 peças que não cabem juntas, área 5,8 m² vs chapa 5,4
  assert.ok(c.nSlabs>=2);assert.equal(r.mensagem.tipo,c.nSlabs<=r.minimoChapas?'bom':'aviso');
  assert.doesNotMatch(r.mensagem.texto,/melhor encaixe possível|não existe jeito/i);
});
test('resumo: avisos de peça maior que a chapa e projeto sem peças',()=>{
  const parts=[{w:500,h:10,l:'Rodabanca'}],c=ctx(parts),r=resumoProducao(c,parts);
  assert.equal(r.avisos.length,1);assert.match(r.avisos[0],/Rodabanca \(500 × 10 cm\) é maior que a chapa: sai em 2 partes, com emenda\./);
  const v=resumoProducao(ctx([]),[]);assert.equal(v.mensagem.tipo,'neutro');assert.equal(v.chapas,0);assert.equal(v.avisos.length,0);
});
test('ponta a ponta com um orçamento do app: bancada em L com saia e rodabanca',()=>{
  const q={pieces:[{id:'a',type:'L',name:'L',d:{A:300,B:250,P:60},saiaH:4,rodaH:7}],lines:[],materialId:'m',params:{margin:30,tax:6,moM2:100,instalM2:50,instalFixo:0,frete:0,charge:'chapa',lossPct:10}};
  const mats=[{id:'m',name:'X',slabL:SL,slabW:SW,priceSlab:1000,priceM2:300}],c=calcQuote(q,mats,[]),parts=[];q.pieces.forEach(p=>parts.push(...shape(p).parts));
  const r=resumoProducao(c,parts);assert.equal(r.pecas.length,parts.length);assert.equal(r.chapas,c.nSlabs);
  const itens=c.nest.slabs.flatMap(s=>s.items);assert.ok(itens.every(i=>i.ref&&r.pecas.some(p=>p.n===i.ref.n)),'todo item aponta para uma peça da lista');
});
test('propriedade: 400 projetos aleatórios; sobras válidas e sem mudar o número de chapas',()=>{
  let s=2024;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  for(let k=0;k<400;k++){
    const parts=Array.from({length:int(1,6)},(_,i)=>({w:int(20,280),h:int(5,170),l:'P'+i,q:int(1,3)}));
    const c=ctx(parts),r=sobrasUteis(c.nest,SL,SW),res=resumoProducao(c,parts);
    assert.equal(res.chapas,c.nest.slabs.length);assert.ok(res.minimoChapas<=res.chapas,'o plano nunca usa menos que o piso pela área');
    r.porChapa.forEach((lista,i)=>lista.forEach((x,a)=>{
      assert.ok(x.w>=14.999&&x.h>=14.999,'mínimo');assert.ok(x.x+x.w<=SL+1e-6&&x.y+x.h<=SW+1e-6&&x.x>=-1e-9&&x.y>=-1e-9,'dentro');
      c.nest.slabs[i].items.forEach(it=>assert.ok(!sobrepoe(x,it),'não toca peça (k='+k+')'));
      lista.slice(a+1).forEach(o=>assert.ok(!sobrepoe(x,o),'sem sobreposição (k='+k+')'));
    }));
    const areaChapas=c.nSlabs*c.slabArea;assert.ok(r.total+c.nest.used<=areaChapas+1e-6,'sobra + peças cabem nas chapas');
  }
});

/* ===== Estoque de sobras ===== */
const {retalhosParaGuardar,mesclarEstoque,cabeNoRetalho,sugerirRetalhos}=require('../producao.js');
const todas=[{x:0,y:0,w:100,h:40,area:0.4,chapa:1},{x:0,y:50,w:30,h:200,area:0.6,chapa:2}];

test('retalhosParaGuardar: normaliza w >= h, guarda origem e material',()=>{
  const r=retalhosParaGuardar(todas,{materialId:'m1',qid:'q1',num:1001,em:5});
  assert.equal(r.length,2);assert.deepEqual([r[0].w,r[0].h],[100,40]);assert.deepEqual([r[1].w,r[1].h],[200,30],'a maior medida vira w');
  assert.ok(r.every(x=>x.materialId==='m1'&&x.origem==='ficha'&&x.qid==='q1'&&x.usada===false&&x.num===1001));assert.equal(new Set(r.map(x=>x.id)).size,2,'ids únicos');
});
test('mesclarEstoque: guardar de novo substitui só as não usadas do mesmo orçamento',()=>{
  const a=retalhosParaGuardar(todas,{materialId:'m1',qid:'q1'}),outro=retalhosParaGuardar(todas,{materialId:'m1',qid:'q2'}),manual={id:'x',materialId:'m1',w:50,h:50,origem:'manual',usada:false};
  let est=mesclarEstoque([],a,'q1');assert.equal(est.length,2);
  est=mesclarEstoque(est,a,'q1');assert.equal(est.length,2,'repetir não duplica');
  est=mesclarEstoque(est.concat(outro,[manual]),a,'q1');assert.equal(est.length,5,'outros orçamentos e o manual ficam');
  est[0].usada=true;const novo=retalhosParaGuardar([todas[1]],{materialId:'m1',qid:'q1'});
  const e2=mesclarEstoque(est,novo,'q1');assert.ok(e2.some(r=>r.id===est[0].id&&r.usada),'o retalho já usado continua');
});
test('mesclarEstoque não altera o que recebe',()=>{
  const est=[{id:'a',origem:'ficha',qid:'q1',usada:false}],copia=JSON.stringify(est);mesclarEstoque(est,[],'q1');assert.equal(JSON.stringify(est),copia);
});
test('cabeNoRetalho: serve nas duas orientações, no limite e recusa o que passa',()=>{
  assert.equal(cabeNoRetalho({w:60,h:150},{w:200,h:70}),true);assert.equal(cabeNoRetalho({w:150,h:60},{w:70,h:200}),true);
  assert.equal(cabeNoRetalho({w:200,h:70},{w:200,h:70}),true,'exato');assert.equal(cabeNoRetalho({w:201,h:70},{w:200,h:70}),false);assert.equal(cabeNoRetalho({w:100,h:71},{w:200,h:70}),false);
});
test('sugerirRetalhos: só retalhos livres do mesmo material; cada um serve uma peça; menor retalho em que cabe',()=>{
  const est=[{id:'g',materialId:'m1',w:200,h:70,usada:false},{id:'p',materialId:'m1',w:80,h:40,usada:false},{id:'u',materialId:'m1',w:300,h:100,usada:true},{id:'o',materialId:'m2',w:300,h:100,usada:false}];
  const parts=[{w:60,h:30,l:'Prateleira'},{w:150,h:60,l:'Tampo'},{w:150,h:60,l:'Tampo2'}];
  const r=sugerirRetalhos(parts,est,'m1',SL,SW);
  assert.equal(r.retalhosLivres,2);assert.equal(r.sugestoes.length,2,'só 2 retalhos livres do material');
  const por=n=>r.sugestoes.find(x=>x.n===n);assert.equal(por(1).retalhoId,'p','prateleira vai no menor retalho');assert.equal(por(2).retalhoId,'g');
  assert.equal(r.semRetalho.length,1);assert.equal(r.semRetalho[0].n,3);
});
test('sugerirRetalhos: sem material, sem estoque ou peça maior que a chapa não sugere nada',()=>{
  const est=[{id:'g',materialId:'m1',w:200,h:70,usada:false}];
  assert.equal(sugerirRetalhos([{w:60,h:30}],est,'',SL,SW).sugestoes.length,0);assert.equal(sugerirRetalhos([{w:60,h:30}],[],'m1',SL,SW).sugestoes.length,0);
  assert.equal(sugerirRetalhos([{w:500,h:10}],[{id:'g',materialId:'m1',w:600,h:20,usada:false}],'m1',SL,SW).sugestoes.length,0,'peça com emenda não entra');
  assert.doesNotThrow(()=>sugerirRetalhos(null,null,'m1',SL,SW));
});
test('sugerirRetalhos respeita a quantidade q e nunca usa o mesmo retalho duas vezes (200 casos)',()=>{
  let s=11;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  for(let k=0;k<200;k++){
    const est=Array.from({length:int(0,6)},(_,i)=>({id:'r'+i,materialId:'m',w:int(20,250),h:int(15,150),usada:rnd()<.2}));
    const parts=Array.from({length:int(1,4)},(_,i)=>({w:int(10,200),h:int(10,120),l:'P'+i,q:int(1,3)}));
    const r=sugerirRetalhos(parts,est,'m',SL,SW);
    assert.equal(new Set(r.sugestoes.map(x=>x.retalhoId)).size,r.sugestoes.length,'retalho usado uma vez');
    r.sugestoes.forEach(x=>{const ret=est.find(e=>e.id===x.retalhoId);assert.ok(!ret.usada&&cabeNoRetalho(x,ret),'cabe e está livre')});
    const esperadas=parts.reduce((t,a)=>t+((Math.max(a.w,a.h)>SL||Math.min(a.w,a.h)>SW)?0:(a.q||1)),0);
    assert.equal(r.sugestoes.length+r.semRetalho.length,esperadas,'toda peça elegível ou tem retalho ou está em semRetalho');
  }
});

/* ===== Ordem de produção ===== */
const {ajustarCaixa,mapaPecas,linhasOrdem}=require('../producao.js');
test('ajustarCaixa: cabe na caixa mantendo a proporção; limite de ampliação; entradas inválidas',()=>{
  const a=ajustarCaixa(300,100,150,150);near(a.k,0.5,'fator');near(a.w,150,'largura');near(a.h,50,'altura');
  const b=ajustarCaixa(100,300,150,150);near(b.k,0.5,'fator vertical');near(b.h,150,'altura');
  const c=ajustarCaixa(10,10,150,150,2);near(c.k,2,'não amplia além do limite');near(c.w,20,'largura limitada');
  for(const x of [[0,1,1,1],[1,0,1,1],[1,1,0,1],[1,1,1,-1],[NaN,1,1,1]])assert.deepEqual(ajustarCaixa(...x),{k:0,w:0,h:0});
});
test('mapaPecas: numeração corrida entre as peças do orçamento, igual à da ficha',()=>{
  const m=mapaPecas([[{l:'A'},{l:'B'}],[],[{l:'C'}]]);
  assert.deepEqual(m,[{n:1,pecaIndice:0},{n:2,pecaIndice:0},{n:3,pecaIndice:2}]);assert.deepEqual(mapaPecas(null),[]);
});
test('linhasOrdem: sem preço, com a peça de origem e as observações',()=>{
  const parts=[{w:157,h:60,l:'Tampo'},{w:60,h:157,l:'Lado',q:2},{w:500,h:10,l:'Roda'}];
  const pecas=listaPecas(parts,SL,SW),mapa=mapaPecas([[parts[0],parts[1]],[parts[2]]]),l=linhasOrdem(pecas,mapa,['Bancada','Saia']);
  assert.equal(l.length,3);assert.equal(l[0].projeto,'Bancada');assert.equal(l[2].projeto,'Saia');assert.equal(l[1].q,2);
  assert.equal(l[1].obs,'girada');assert.match(l[2].obs,/em 2 partes \(emenda\)/);assert.match(l[0].medida,/^157 × 60 cm$/);
  assert.ok(!JSON.stringify(l).includes('R$'),'nenhum valor em reais');assert.deepEqual(linhasOrdem(null,null,null),[]);
});
