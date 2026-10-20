/* Testes do cálculo (calc.js). Rodar na raiz do projeto: node --test
   Sem dependências. Os valores de tests/golden.json foram gerados com o código original,
   antes de mover as funções para calc.js, para provar que nada mudou nos preços. */
const test=require('node:test');
const assert=require('node:assert/strict');
const {defMl,shape,partsArea,nestParts,calcQuote}=require('../calc.js');
const golden=require('./golden.json');

const near=(a,b,msg,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const pc=(type,d,x={})=>({id:'p',type,name:type,d,saiaH:0,rodaH:0,...x});
const par=(x={})=>({margin:35,tax:6,moM2:180,instalM2:90,instalFixo:0,frete:150,charge:'chapa',lossPct:12,...x});
const MAT={id:'m',slabL:310,slabW:180,priceSlab:2900,priceM2:640};
const quote=(pieces,params={},lines=[])=>({materialId:'m',pieces,lines,params:par(params)});
const calc=(q)=>calcQuote(q,[MAT],[]);
const areaOf=(p)=>partsArea(shape(p).parts);

/* ---------- 1. Regressão: mesmos números do app antes da refatoração ---------- */
test('regressão: todos os casos de tests/golden.json batem com o original',()=>{
  for(const c of golden.cases){
    const r=calcQuote(c.quote,golden.materials,golden.services),e=c.esperado;
    near(r.area,e.area,c.nome+' área');
    assert.equal(r.nSlabs,e.nSlabs,c.nome+' chapas');
    assert.equal(r.nest.emendas,e.emendas,c.nome+' emendas');
    for(const k of ['util','mat','labor','svc','fab','inst','frete','cost','price','taxV','profit','perM2'])near(r[k],e[k],`${c.nome} ${k}`);
  }
});

test('regressão: os 3 orçamentos de exemplo do protótipo',()=>{
  const preco=Object.fromEntries(golden.cases.slice(0,3).map(c=>[c.nome,c.esperado.price]));
  assert.deepEqual(Object.values(preco),[13836.02,2777.08,7331.19]);
});

/* ---------- 2. Geometria: áreas conferidas à mão (m²) ---------- */
test('área por formato de peça',()=>{
  near(areaOf(pc('reta',{A:280,P:60})),1.68,'reta');
  near(areaOf(pc('L',{A:310,B:210,P:62})),(310*62+62*(210-62))/1e4,'L');                 // 2,8396
  near(areaOf(pc('U',{A:320,B:220,C:220,P:60})),3.84,'U');
  near(areaOf(pc('ilha',{A:240,B:100})),2.4,'ilha');
  near(areaOf(pc('escada',{A:100,N:5,PI:30,ES:17})),2.35,'escada');                       // 5 × (100×30 + 100×17)
  near(areaOf(pc('nicho',{A:80,H:60,P:25})),1.18,'nicho');                                // fundo + topo + base + 2 laterais
  near(areaOf(pc('lavatorio',{A:120,P:55})),0.66,'lavatório');
  near(areaOf(pc('livre',{rects:[{w:120,h:50,q:1},{w:60,h:40,q:2},{w:200,h:30,q:1}]})),1.68,'livre');
});

test('saia e rodabanca: metros automáticos por formato',()=>{
  near(defMl(pc('reta',{A:280,P:60}),'roda'),2.8,'reta');
  near(defMl(pc('L',{A:310,B:210,P:62}),'roda'),4.58,'L');
  near(defMl(pc('U',{A:320,B:220,C:220,P:60}),'roda'),(320+220+220-120)/100,'U');
  near(defMl(pc('ilha',{A:240,B:100}),'saia'),6.8,'ilha saia');
  assert.equal(defMl(pc('ilha',{A:240,B:100}),'roda'),0,'ilha não tem rodabanca');
  assert.equal(defMl(pc('nicho',{A:80,H:60,P:25}),'saia'),0,'nicho');
});

test('saia/rodabanca entram na área; metros informados à mão têm prioridade',()=>{
  const base=areaOf(pc('reta',{A:300,P:60}));
  near(areaOf(pc('reta',{A:300,P:60},{rodaH:7})),base+3*0.07,'rodabanca automática');
  near(areaOf(pc('reta',{A:300,P:60},{rodaH:7,rodaMl:3.5})),base+3.5*0.07,'rodabanca manual');
});

test('medidas inválidas não geram NaN nem área negativa',()=>{
  for(const d of [{A:0,P:60},{A:-10,P:60},{A:280,P:0}]){
    const a=areaOf(pc('reta',d));
    assert.ok(Number.isFinite(a)&&a===0,`reta ${JSON.stringify(d)} → ${a}`);
  }
  const L=areaOf(pc('L',{A:300,B:30,P:60}));      // lado B menor que a profundidade
  assert.ok(Number.isFinite(L)&&L>=0);
});

/* ---------- 3. Plano de corte ---------- */
test('peça maior que a chapa é dividida em emendas',()=>{
  const r=calc(quote([pc('reta',{A:400,P:65})]));
  assert.equal(r.nest.emendas,1);
  const r2=calc(quote([pc('reta',{A:280,P:60})]));
  assert.equal(r2.nest.emendas,0);
});

test('plano de corte conserva a área e mantém todas as peças dentro da chapa',()=>{
  for(const c of golden.cases){
    const r=calcQuote(c.quote,golden.materials,golden.services);
    near(r.nest.used,r.area,c.nome+' área cortada = área das peças',1e-9);
    for(const s of r.nest.slabs)for(const it of s.items){
      assert.ok(it.x>=-1e-9&&it.y>=-1e-9,`${c.nome}: peça fora (início)`);
      assert.ok(it.x+it.w<=r.SL+1e-6&&it.y+it.h<=r.SW+1e-6,`${c.nome}: peça passa da chapa ${r.SL}×${r.SW}`);
    }
  }
});

test('plano de corte: duas peças pequenas cabem na mesma chapa, a terceira abre outra',()=>{
  const n=(parts)=>nestParts(parts,310,180).slabs.length;
  assert.equal(n([{w:300,h:62,q:2}]),1);
  assert.equal(n([{w:300,h:100,q:1},{w:300,h:100,q:1}]),2);
});

/* ---------- 4. Preço ---------- */
test('margem real = margem configurada (margem e impostos sobre o preço de venda)',()=>{
  for(const [margin,tax] of [[35,6],[20,0],[0,0],[50,10],[10,15]]){
    const r=calc(quote([pc('reta',{A:280,P:60})],{margin,tax}));
    near(r.profit/r.price,margin/100,`margem ${margin}/${tax}`,1e-4);
    near(r.taxV/r.price,tax/100,`imposto ${margin}/${tax}`,1e-4);
    assert.equal(r.erro,'');
  }
});

test('custo = material + fabricação + instalação + frete',()=>{
  const r=calc(quote([pc('reta',{A:280,P:60})],{instalFixo:200}));
  near(r.mat,2900,'1 chapa inteira');
  near(r.labor,1.68*180,'mão de obra');
  near(r.inst,1.68*90+200,'instalação');
  near(r.cost,r.mat+r.fab+r.inst+r.frete,'soma');
});

test('material por m² usa a perda informada',()=>{
  const r=calc(quote([pc('reta',{A:280,P:60})],{charge:'m2',lossPct:12}));
  near(r.mat,1.68*1.12*640,'m² com 12% de perda');
});

test('serviços entram na fabricação; serviço apagado é ignorado',()=>{
  const q=quote([pc('reta',{A:280,P:60})],{},[{svcId:'s1',qty:2},{svcId:'sumiu',qty:5}]);
  const r=calcQuote(q,[MAT],[{id:'s1',price:140}]);
  near(r.svc,280,'serviços');
});

test('preço final é arredondado em centavos',()=>{
  const r=calc(quote([pc('L',{A:313.7,B:207.3,P:61.9})],{margin:33.3,tax:5.7}));
  near(Math.round(r.price*100),r.price*100,'centavos',1e-6);
});

/* ---------- 5. Margem + imposto inválidos (correção A1 do diagnóstico) ---------- */
test('margem + imposto acima de 95% gera erro em vez de preço silenciosamente absurdo',()=>{
  const r=calc(quote([pc('reta',{A:280,P:60})],{margin:70,tax:30}));
  assert.match(r.erro,/95%/);
  const r2=calc(quote([pc('reta',{A:280,P:60})],{margin:96,tax:0}));
  assert.match(r2.erro,/95%/);
  assert.equal(calc(quote([pc('reta',{A:280,P:60})],{margin:90,tax:5})).erro,'','90+5 = 95 ainda é aceito');
});

/* ---------- 6. Robustez ---------- */
test('sem material cadastrado não quebra e não cobra material',()=>{
  const r=calcQuote({materialId:'x',pieces:[pc('reta',{A:280,P:60})],lines:[],params:par()},[],[]);
  assert.equal(r.m,undefined);
  assert.equal(r.mat,0);
  assert.ok(r.price>0);
});

test('o cálculo não altera os dados recebidos',()=>{
  const q=quote([pc('U',{A:320,B:220,C:220,P:60},{saiaH:5,rodaH:7})],{},[{svcId:'s1',qty:1}]);
  const mats=[{...MAT}],svcs=[{id:'s1',price:100}];
  const antes=JSON.stringify([q,mats,svcs]);
  calcQuote(q,mats,svcs);
  assert.equal(JSON.stringify([q,mats,svcs]),antes);
});
