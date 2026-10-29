/* Quantitativo do Ambiente (motor/ambiente.js). Referência manual: 400 × 500 × 270 cm.
   piso 20 m², paredes 48,6 m², perímetro 18 m. Rodapé = 18 − portas. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {quantitativoAmbiente,validarAmbiente,medidasAmbiente}=require('../motor/ambiente.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const base=(o={})=>({nome:'Cozinha',largura:400,comprimento:500,altura:270,aberturas:[],...o});
const porta=(o={})=>({id:'p1',tipo:'porta',parede:'S',x:100,largura:80,altura:210,peitoril:0,...o});
const janela=(o={})=>({id:'j1',tipo:'janela',parede:'L',x:150,largura:120,altura:100,peitoril:110,...o});
const item=(q,c)=>q.itens.find(i=>i.codigo===c);

test('ambiente simples: piso, teto, pintura e rodapé',()=>{
  const q=quantitativoAmbiente(base());assert.equal(q.ok,true);
  near(item(q,'AMB-PISO').quantidade,20,'piso');near(item(q,'AMB-TETO').quantidade,20,'teto');
  near(item(q,'AMB-PINT-PAREDE').quantidade,48.6,'pintura paredes');near(item(q,'AMB-PINT-TETO').quantidade,20,'pintura teto');
  near(item(q,'AMB-RODAPE').quantidade,18,'rodapé sem portas');
  assert.equal(item(q,'AMB-RODAPE').unidade,'m');
});
test('porta desconta do rodapé; janela não',()=>{
  const q=quantitativoAmbiente(base({aberturas:[porta(),janela()]}));
  near(item(q,'AMB-RODAPE').quantidade,18-0.8,'rodapé com porta de 80 cm');
  near(item(q,'AMB-PINT-PAREDE').quantidade,48.6-0.8*2.1-1.2*1.0,'pintura sem aberturas');
});
test('perda só entra quando informada; vazio é zero',()=>{
  let q=quantitativoAmbiente(base());
  assert.equal(item(q,'AMB-PISO').perdaPct,0);near(item(q,'AMB-PISO').quantidadeComPerda,20,'sem perda');
  q=quantitativoAmbiente(base({perdas:{piso:10,rodape:'5'}}));
  near(item(q,'AMB-PISO').quantidadeComPerda,22,'piso 10%');near(item(q,'AMB-RODAPE').quantidadeComPerda,18*1.05,'rodapé 5% (texto)');
  near(item(q,'AMB-PISO').quantidade,20,'a quantidade líquida não muda');
});
test('perda inválida é recusada',()=>{
  for(const p of [-1,101,'abc'])assert.equal(validarAmbiente(base({perdas:{piso:p}})).ok,false,String(p));
});
test('revestimento da parede inteira = área bruta menos aberturas',()=>{
  const q=quantitativoAmbiente(base({aberturas:[porta()],revestimentos:[{id:'r1',parede:'S',altura:270}]}));
  near(item(q,'AMB-REV-S').quantidade,(400*270-80*210)/1e4,'parede frente');
});
test('revestimento baixo (rodameio) só desconta a parte da abertura abaixo da altura',()=>{
  const q=quantitativoAmbiente(base({aberturas:[porta(),janela({parede:'S',x:200,peitoril:90,altura:100})],revestimentos:[{id:'r1',parede:'S',altura:120}]}));
  // porta: 80 × 120 abaixo de 120; janela: começa em 90, só 30 cm abaixo de 120 × 120 de largura
  near(item(q,'AMB-REV-S').quantidade,(400*120-80*120-120*30)/1e4,'frente até 1,20 m');
});
test('janela acima da altura revestida não desconta nada',()=>{
  const q=quantitativoAmbiente(base({aberturas:[janela({parede:'L',peitoril:110})],revestimentos:[{id:'r1',parede:'L',altura:100}]}));
  near(item(q,'AMB-REV-L').quantidade,500*100/1e4,'direita até 1,00 m');
});
test('revestimento com perda',()=>{
  const q=quantitativoAmbiente(base({revestimentos:[{id:'r1',parede:'N',altura:100}],perdas:{revestimento:10}}));
  near(item(q,'AMB-REV-N').quantidadeComPerda,400*100/1e4*1.1,'com 10%');
});
test('revestimento inválido: parede, altura zero e altura acima do pé-direito',()=>{
  assert.equal(validarAmbiente(base({revestimentos:[{parede:'X',altura:100}]})).ok,false);
  assert.equal(validarAmbiente(base({revestimentos:[{parede:'N',altura:0}]})).ok,false);
  assert.equal(validarAmbiente(base({revestimentos:[{parede:'N',altura:300}]})).ok,false);
  assert.equal(validarAmbiente(base({revestimentos:[{parede:'N',altura:270}]})).ok,true);
});
test('ambiente inválido: nenhum item e os erros voltam',()=>{
  const q=quantitativoAmbiente(base({largura:10}));assert.equal(q.ok,false);assert.equal(q.itens.length,0);assert.ok(q.erros.length);
});
test('consistência: pintura das paredes e piso batem com medidasAmbiente',()=>{
  const e=base({aberturas:[porta(),janela()]}),m=medidasAmbiente(e),q=quantitativoAmbiente(e);
  near(item(q,'AMB-PINT-PAREDE').quantidade,m.areaParedesLiquida,'paredes');near(item(q,'AMB-PISO').quantidade,m.areaPiso,'piso');
});
test('o ambiente que não tem os campos novos continua válido (projetos antigos)',()=>{
  assert.equal(validarAmbiente({nome:'Velho',largura:300,comprimento:300,altura:250,aberturas:[]}).ok,true);
});
