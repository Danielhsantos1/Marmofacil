/* Testes do motor de Esquadrias (motor/esquadria.js).
   Referência manual: janela 150 × 120 cm: vão 1,8 m², perímetro 5,4 m. Modelo de exemplo (valores de TESTE, não de fabricante):
   perfil = 1 × perímetro (m), roldana = 4 fixas, silicone = 0,1 × perímetro. Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {ESQ_TIPOS,ESQ_REGRAS,ESQ_LIM,criarModelo,validarModelo,validarEsquadrias,medidasEsquadrias,quantitativoEsquadrias}=require('../motor/esquadria.js');
const {orcarItens}=require('../nucleo/orcamento.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const modelo=(o={})=>({id:'m1',nome:'Janela de teste',comps:[
  {id:'p',nome:'Perfil',unidade:'m',regra:'perimetro',fator:1},{id:'r',nome:'Roldana',unidade:'un',regra:'fixo',fator:4},{id:'s',nome:'Silicone',unidade:'tubo',regra:'perimetro',fator:0.1}],...o});
const jan=(o={})=>({id:'e1',modeloId:'m1',tipo:'janela',largura:150,altura:120,qtd:1,vidro:'',...o});
const proj=(o={})=>({nome:'Obra',itens:[jan()],...o});

test('referência: janela 150 × 120, vão 1,8 m² e perímetro 5,4 m',()=>{
  const m=medidasEsquadrias(proj(),[modelo()]);assert.equal(m.ok,true);near(m.areaVao,1.8,'vão');near(m.perimetro,5.4,'perímetro');assert.equal(m.pecas,1);near(m.areaVidro,0,'sem vidro');
});
test('as cinco regras de quantidade',()=>{
  const mod=modelo({comps:['fixo','perimetro','largura','altura','area'].map((r,i)=>({id:'c'+i,nome:r,unidade:'u',regra:r,fator:2}))});
  const q=quantitativoEsquadrias(proj(),[mod]),c=i=>q.itens.find(x=>x.codigo==='ESQ-m1-c'+i).quantidade;
  near(c(0),2,'fixo');near(c(1),2*5.4,'perímetro');near(c(2),2*1.5,'largura');near(c(3),2*1.2,'altura');near(c(4),2*1.8,'área');
});
test('quantidade de esquadrias multiplica tudo, inclusive os componentes fixos',()=>{
  const q=quantitativoEsquadrias(proj({itens:[jan({qtd:3})]}),[modelo()]),c=k=>q.itens.find(x=>x.codigo==='ESQ-m1-'+k).quantidade;
  near(c('p'),16.2,'perfil');near(c('r'),12,'roldanas');near(c('s'),1.62,'silicone',1e-9);
});
test('várias esquadrias do mesmo modelo somam por componente',()=>{
  const q=quantitativoEsquadrias(proj({itens:[jan({id:'a'}),jan({id:'b',largura:100,altura:100,qtd:2})]}),[modelo()]);
  near(q.itens.find(x=>x.codigo==='ESQ-m1-p').quantidade,5.4+2*4,'perfil');near(q.itens.find(x=>x.codigo==='ESQ-m1-r').quantidade,12,'roldanas');
});
test('vidro: só onde a espessura foi informada, por espessura, e com peso',()=>{
  const e=proj({itens:[jan({id:'a',vidro:8}),jan({id:'b',vidro:8,qtd:2}),jan({id:'c',vidro:10}),jan({id:'d'})]});
  const q=quantitativoEsquadrias(e,[modelo()]),m=medidasEsquadrias(e,[modelo()]);
  near(q.itens.find(x=>x.codigo==='ESQ-VIDRO-8mm').quantidade,1.8*3,'vidro 8 mm');near(q.itens.find(x=>x.codigo==='ESQ-VIDRO-10mm').quantidade,1.8,'vidro 10 mm');
  near(m.areaVidro,1.8*4,'área de vidro');near(m.pesoVidro,1.8*8*2.5*3+1.8*10*2.5,'peso',1e-9);
});
test('espessura decimal não deixa ponto no código',()=>{
  const q=quantitativoEsquadrias(proj({itens:[jan({vidro:8.5})]}),[modelo()]);assert.ok(q.itens.some(x=>x.codigo==='ESQ-VIDRO-8p5mm'));assert.ok(q.itens.every(x=>!x.codigo.includes('.')));
});
test('modelos diferentes geram componentes separados',()=>{
  const m2=modelo({id:'m2',nome:'Porta de teste',comps:[{id:'p',nome:'Perfil',unidade:'m',regra:'altura',fator:2}]});
  const q=quantitativoEsquadrias(proj({itens:[jan(),jan({id:'x',modeloId:'m2',tipo:'porta',largura:90,altura:210})]}),[modelo(),m2]);
  near(q.itens.find(x=>x.codigo==='ESQ-m2-p').quantidade,4.2,'porta: 2 × 2,10 m');assert.match(q.itens.find(x=>x.codigo==='ESQ-m2-p').descricao,/^Porta de teste: Perfil/);
});
test('validação do modelo',()=>{
  const ruim=o=>validarModelo(modelo(o)).ok;
  assert.equal(ruim({}),true);assert.equal(ruim({nome:''}),false);assert.equal(ruim({comps:[]}),false);
  assert.equal(ruim({comps:[{nome:'',unidade:'m',regra:'fixo',fator:1}]}),false);assert.equal(ruim({comps:[{nome:'x',unidade:'',regra:'fixo',fator:1}]}),false);
  assert.equal(ruim({comps:[{nome:'x',unidade:'m',regra:'xyz',fator:1}]}),false);assert.equal(ruim({comps:[{nome:'x',unidade:'m',regra:'fixo',fator:-1}]}),false);
  assert.equal(ruim({comps:[{nome:'x',unidade:'m',regra:'fixo',fator:'abc'}]}),false);assert.equal(validarModelo(modelo({comps:[{nome:'x',unidade:'m',regra:'fixo',fator:'1,5'}]})).ok,true,'vírgula decimal');
});
test('validação do projeto: tipo, modelo, medidas, quantidade, vidro',()=>{
  const ok=(o,mods=[modelo()])=>validarEsquadrias(proj(o),mods).ok;
  assert.equal(ok({}),true);assert.equal(ok({itens:[jan({tipo:''})]}),false);assert.equal(ok({itens:[jan({modeloId:''})]}),false);assert.equal(ok({itens:[jan({modeloId:'zzz'})]}),false);
  assert.equal(ok({itens:[jan({largura:2})]}),false);assert.equal(ok({itens:[jan({altura:5000})]}),false);assert.equal(ok({itens:[jan({qtd:0})]}),false);assert.equal(ok({itens:[jan({qtd:2.5})]}),false);
  assert.equal(ok({itens:[jan({vidro:1})]}),false);assert.equal(ok({itens:[jan({vidro:50})]}),false);assert.equal(ok({itens:[jan({vidro:6})]}),true);
  assert.equal(ok({},[modelo({comps:[]})]),false,'modelo incompleto bloqueia');
});
test('entradas estranhas não derrubam o motor',()=>{
  for(const x of [null,undefined,'t',42,{},{itens:'x'},{itens:[null,1]}])for(const mods of [undefined,null,[],[null],[modelo()]])
    assert.doesNotThrow(()=>{validarEsquadrias(x,mods);medidasEsquadrias(x,mods);quantitativoEsquadrias(x,mods||[])});
  assert.doesNotThrow(()=>{criarModelo(null);validarModelo(undefined)});
});
test('projeto vazio é válido e nunca "completo" no orçamento',()=>{
  const q=quantitativoEsquadrias(proj({itens:[]}),[modelo()]);assert.equal(q.ok,true);assert.equal(q.itens.length,0);assert.equal(orcarItens(q.itens,{}).completo,false);
});
test('ponta a ponta com o orçamento genérico (preços de TESTE)',()=>{
  const q=quantitativoEsquadrias(proj({itens:[jan({vidro:8})]}),[modelo()]);
  const preco={'ESQ-VIDRO-8mm':300,'ESQ-m1-p':20,'ESQ-m1-r':5,'ESQ-m1-s':15};
  const o=orcarItens(q.itens.map(i=>({...i,precoUnit:preco[i.codigo]})),{margem:30,impostos:10});assert.equal(o.completo,true);
  const custo=1.8*300+5.4*20+4*5+0.54*15;near(o.custo,custo,'custo',0.01);near(o.preco,custo/0.6,'preço',0.01);
});
test('os tipos e regras pedidos existem',()=>{
  for(const t of ['porta','janela','portao','fachada'])assert.ok(ESQ_TIPOS[t],t);
  for(const r of ['fixo','perimetro','largura','altura','area'])assert.ok(ESQ_REGRAS[r],r);
});
test('propriedade: 600 projetos aleatórios',()=>{
  let s=777;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  const regras=Object.keys(ESQ_REGRAS);
  for(let k=0;k<600;k++){
    const mods=[0,1].map(j=>({id:'m'+j,nome:'M'+j,comps:Array.from({length:int(1,4)},(_,i)=>({id:'c'+i,nome:'c'+i,unidade:'u',regra:regras[int(0,4)],fator:int(0,300)/100}))}));
    const itens=Array.from({length:int(1,6)},(_,i)=>({id:'i'+i,modeloId:'m'+int(0,1),tipo:'janela',largura:int(ESQ_LIM.min,500),altura:int(ESQ_LIM.min,400),qtd:int(1,6),vidro:rnd()<.5?int(4,12):''}));
    const e={itens},m=medidasEsquadrias(e,mods),q=quantitativoEsquadrias(e,mods);assert.equal(m.ok,true);assert.equal(q.ok,true);
    near(m.areaVao,itens.reduce((t,x)=>t+x.largura*x.altura*x.qtd/1e4,0),'vão '+k,1e-9);
    near(m.perimetro,itens.reduce((t,x)=>t+2*(x.largura+x.altura)*x.qtd/100,0),'perímetro '+k,1e-9);
    assert.equal(new Set(q.itens.map(i=>i.codigo)).size,q.itens.length,'códigos únicos');
    mods.forEach(mod=>mod.comps.forEach(c=>{
      const esperado=itens.filter(x=>x.modeloId===mod.id).reduce((t,x)=>{const a=x.largura*x.altura/1e4,p=2*(x.largura+x.altura)/100;return t+c.fator*(c.regra==='fixo'?1:c.regra==='perimetro'?p:c.regra==='largura'?x.largura/100:c.regra==='altura'?x.altura/100:a)*x.qtd},0);
      const it=q.itens.find(i=>i.codigo==='ESQ-'+mod.id+'-'+c.id);
      if(itens.some(x=>x.modeloId===mod.id))near(it.quantidade,esperado,'comp '+k,1e-9);else assert.equal(it,undefined,'modelo não usado não aparece');
    }));
  }
});
