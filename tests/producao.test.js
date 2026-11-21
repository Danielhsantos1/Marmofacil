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
