/* Orçamento genérico (nucleo/orcamento.js). Referência manual:
   100 m² a R$ 50 + 20 m² a R$ 100 de mão de obra = 7.000; + instalação 500 + frete 500 = custo 8.000.
   margem 30% + impostos 10%: preço = 8.000 / 0,60 = 13.333,33. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {orcarItens,orcNum,orcR2}=require('../nucleo/orcamento.js');

const near=(a,b,msg,eps=0.005)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const it=(o={})=>({codigo:'A',descricao:'Piso',unidade:'m²',quantidade:100,precoUnit:50,maoObraUnit:null,...o});

test('exemplo de referência: custo 8.000 e preço 13.333,33',()=>{
  const o=orcarItens([it({maoObraUnit:null}),it({codigo:'B',descricao:'Pintura',quantidade:20,precoUnit:null,maoObraUnit:100})],{margem:30,impostos:10,frete:500,instalacao:500});
  assert.equal(o.ok,true);near(o.material,5000,'material');near(o.maoObra,2000,'mão de obra');near(o.custo,8000,'custo');near(o.preco,13333.33,'preço');
  near(o.lucro,4000,'lucro 30% do preço');near(o.impostosValor,1333.33,'impostos 10% do preço');
  assert.equal(o.completo,true);
});
test('o preço fecha a conta: preço − impostos − lucro = custo (±1 centavo)',()=>{
  for(const [m,i] of [[0,0],[35,6],[20,15],[50,40]]){
    const o=orcarItens([it()],{margem:m,impostos:i,frete:123.45});near(o.preco-o.impostosValor-o.lucro,o.custo,`m=${m} i=${i}`,0.011);
  }
});
test('sem margem e sem impostos: preço = custo',()=>{
  const o=orcarItens([it()],{});near(o.preco,5000,'preço');near(o.custo,5000,'custo');
});
test('a quantidade com perda é a que vale',()=>{
  const o=orcarItens([it({quantidade:100,quantidadeComPerda:110})],{});near(o.material,5500,'material com perda');
});
test('preço em branco: item "sem preço", não vira zero em silêncio',()=>{
  const o=orcarItens([it(),it({codigo:'B',precoUnit:'',maoObraUnit:''}),it({codigo:'C',precoUnit:0})],{});
  assert.deepEqual(o.pendentes,['B']);assert.equal(o.completo,false);
  assert.equal(o.linhas[2].semPreco,false,'zero informado é preço, não falta de preço');
});
test('item com quantidade zero e sem preço não conta como pendente',()=>{
  const o=orcarItens([it(),it({codigo:'Z',quantidade:0,precoUnit:null})],{});assert.deepEqual(o.pendentes,[]);assert.equal(o.completo,true);
});
test('lista vazia: nunca completo',()=>{const o=orcarItens([],{});assert.equal(o.ok,true);assert.equal(o.completo,false);near(o.preco,0,'preço');});
test('aceita vírgula decimal e texto numérico',()=>{
  const o=orcarItens([it({quantidade:'2,5',precoUnit:'10,50'})],{margem:'10',frete:'1,5'});near(o.material,26.25,'material');near(o.custo,27.75,'custo');
});
test('margem + impostos de 95% ou mais é bloqueado',()=>{
  assert.equal(orcarItens([it()],{margem:60,impostos:35}).ok,false);assert.equal(orcarItens([it()],{margem:94,impostos:0}).ok,true);
});
test('valores inválidos são recusados com mensagem',()=>{
  for(const c of [{margem:-1},{margem:101},{impostos:'abc'},{frete:-5},{instalacao:'x'}]){const o=orcarItens([it()],c);assert.equal(o.ok,false,JSON.stringify(c));assert.ok(o.erros.length);}
  assert.equal(orcarItens([it({precoUnit:-1})],{}).ok,false);assert.equal(orcarItens([it({quantidade:-1})],{}).ok,false);assert.equal(orcarItens([it({maoObraUnit:'x'})],{}).ok,false);
});
test('arredondamento por linha: 3 × R$ 0,335 = 1,01 por linha somada (sem erro de ponto flutuante)',()=>{
  const o=orcarItens([it({quantidade:3,precoUnit:0.335}),it({codigo:'B',quantidade:3,precoUnit:0.335})],{});near(o.material,2.02,'duas linhas de 1,01',1e-9);
});
test('orcNum e orcR2',()=>{assert.equal(orcNum(''),null);assert.equal(orcNum(null),null);assert.equal(orcNum('1,5'),1.5);assert.ok(Number.isNaN(orcNum('x')));assert.equal(orcR2(1.005),1.01);});
test('propriedade: preço nunca é menor que o custo e cresce com a margem',()=>{
  let ant=-1;for(let m=0;m<=80;m+=5){const o=orcarItens([it()],{margem:m,impostos:10,frete:100});assert.ok(o.preco>=o.custo);assert.ok(o.preco>=ant);ant=o.preco}
});
