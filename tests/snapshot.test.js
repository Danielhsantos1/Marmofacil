/* Testes do snapshot de preço (orçamento fechado). Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {calcQuote,snapshotOf,aplicarSnapshot,SNAP_CAMPOS}=require('../calc.js');

const par=(x={})=>({margin:35,tax:6,moM2:180,instalM2:90,instalFixo:0,frete:150,charge:'chapa',lossPct:12,...x});
const quote=(params={})=>({materialId:'m',lines:[{svcId:'s1',qty:2}],params:par(params),
  pieces:[{id:'p',type:'L',name:'L',d:{A:310,B:210,P:62},saiaH:0,rodaH:7}]});
const mats=(preco=2900)=>[{id:'m',slabL:310,slabW:180,priceSlab:preco,priceM2:640}];
const svcs=(preco=140)=>[{id:'s1',price:preco}];

test('depois do snapshot, mudar o preço do material ou do serviço não muda o orçamento',()=>{
  const q=quote(),antes=calcQuote(q,mats(),svcs());
  const snap=snapshotOf(antes,1000);
  const depois=calcQuote(q,mats(9999),svcs(500));
  assert.notEqual(depois.price,antes.price,'sem snapshot o preço mudaria');
  const congelado=aplicarSnapshot(depois,snap);
  for(const k of SNAP_CAMPOS)assert.equal(congelado[k],antes[k],k);
  assert.equal(congelado.congelado,true);
  assert.equal(congelado.snapEm,1000);
});

test('sem snapshot, o cálculo volta igual (mesmo objeto)',()=>{
  const c=calcQuote(quote(),mats(),svcs());
  assert.equal(aplicarSnapshot(c,undefined),c);
  assert.equal(aplicarSnapshot(c,null),c);
  assert.equal(c.congelado,undefined);
});

test('o snapshot é pequeno, só números, e sobrevive a JSON (localStorage e backup)',()=>{
  const snap=snapshotOf(calcQuote(quote(),mats(),svcs()),1234);
  const volta=JSON.parse(JSON.stringify(snap));
  assert.deepEqual(volta,snap);
  assert.ok(JSON.stringify(snap).length<400);
  for(const k of SNAP_CAMPOS)assert.ok(Number.isFinite(snap[k]),k);
  assert.equal(snap.versao,1);
});

test('snapshot de backup antigo ou adulterado: campo inválido é ignorado, o resto vale',()=>{
  const c=calcQuote(quote(),mats(),svcs());
  const r=aplicarSnapshot(c,{versao:1,em:1,price:'abc',cost:NaN,profit:100});
  assert.equal(r.price,c.price);
  assert.equal(r.cost,c.cost);
  assert.equal(r.profit,100);
});

test('o aviso de margem inválida não vale para orçamento já fechado',()=>{
  const c=calcQuote(quote({margin:70,tax:30}),mats(),svcs());
  assert.match(c.erro,/95%/);
  assert.equal(aplicarSnapshot(c,snapshotOf(calcQuote(quote(),mats(),svcs()),1)).erro,'');
});

test('faturamento e lucro dos fechados ficam estáveis quando o cadastro muda',()=>{
  const qs=[quote(),quote({margin:20})];
  const snaps=qs.map(q=>snapshotOf(calcQuote(q,mats(),svcs()),1));
  const soma=(m,s)=>qs.reduce((t,q,i)=>{const c=aplicarSnapshot(calcQuote(q,m,s),snaps[i]);return[t[0]+c.price,t[1]+c.profit]},[0,0]);
  assert.deepEqual(soma(mats(),svcs()),soma(mats(12345),svcs(1)));
});

test('o cálculo do snapshot não altera o cálculo original',()=>{
  const c=calcQuote(quote(),mats(),svcs()),antes=c.price;
  aplicarSnapshot(c,{price:1,em:1});
  assert.equal(c.price,antes);
});
