/* Testes do modelo 3D (model3d.js). Rodar na raiz: node --test
   Garantia principal: o 3D usa os MESMOS dados do cálculo, então a área das faces dos sólidos
   tem que ser igual à área que entra no corte e no preço (partsArea). */
const test=require('node:test');
const assert=require('node:assert/strict');
const {shape,partsArea}=require('../calc.js');
const {buildModel,ESP_PADRAO}=require('../model3d.js');
const golden=require('./golden.json');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const pc=(type,d,x={})=>({id:'p',type,name:type,d,saiaH:0,rodaH:0,...x});
const areaCorte=(p)=>partsArea(shape(p).parts);

const FORMATOS=[
  ['reta',{A:280,P:60}],
  ['L',{A:310,B:210,P:62}],
  ['U',{A:320,B:220,C:200,P:60}],
  ['ilha',{A:240,B:100}],
  ['escada',{A:100,N:5,PI:30,ES:17}],
  ['nicho',{A:80,H:60,P:25}],
  ['lavatorio',{A:120,P:55}],
  ['livre',{rects:[{w:120,h:50,q:1},{w:60,h:40,q:2},{w:200,h:30,q:1},{w:250,h:90,q:1}]}]
];
const ACABAMENTOS=[{},{saiaH:5},{rodaH:7},{saiaH:5,rodaH:7},{saiaH:5,saiaMl:2,rodaH:7,rodaMl:3.5},{rodaH:7,rodaMl:30}];

test('a área das faces do 3D é igual à área de corte de cada formato (com e sem saia/rodabanca)',()=>{
  for(const [type,d] of FORMATOS)for(const ac of ACABAMENTOS){
    const p=pc(type,d,ac),m=buildModel(p,2);
    near(m.area,areaCorte(p),`${type} ${JSON.stringify(ac)}`);
  }
});

test('volume de cada sólido = face × espessura (peça maciça de pedra)',()=>{
  for(const [type,d] of FORMATOS)for(const esp of [1,2,3]){
    const m=buildModel(pc(type,d,{saiaH:5,rodaH:7}),esp);
    for(const s of m.solids)near(s.sx*s.sy*s.sz,s.face*esp,`${type} ${s.label} esp ${esp}`,1e-6);
  }
});

test('espessura vem do parâmetro; sem valor usa 2 cm',()=>{
  const p=pc('reta',{A:280,P:60});
  assert.equal(buildModel(p,3).solids[0].sy,3);
  assert.equal(buildModel(p).espessura,ESP_PADRAO);
  assert.equal(buildModel(p,0).espessura,ESP_PADRAO);
  assert.equal(buildModel(p,-5).espessura,ESP_PADRAO);
});

test('caixa envolvente e posições batem com as medidas',()=>{
  const r=buildModel(pc('reta',{A:280,P:60}),2);
  assert.deepEqual(r.bbox,{min:[0,0,0],max:[280,2,60]});
  const L=buildModel(pc('L',{A:310,B:210,P:62}),2);
  assert.deepEqual([L.bbox.max[0],L.bbox.max[2]],[310,210]);   // lado A no comprimento, lado B na profundidade
  const U=buildModel(pc('U',{A:320,B:220,C:200,P:60}),2);
  assert.deepEqual([U.bbox.max[0],U.bbox.max[2]],[320,220]);
  const e=buildModel(pc('escada',{A:100,N:5,PI:30,ES:17}),2);
  assert.deepEqual([e.bbox.max[0],e.bbox.max[1],e.bbox.max[2]],[100,85,150]);   // 5 degraus: 5×17 de altura, 5×30 de piso
});

test('rodabanca sobe acima do tampo e a saia desce abaixo dele',()=>{
  const m=buildModel(pc('reta',{A:280,P:60},{saiaH:5,rodaH:7}),2);
  const saia=m.solids.filter(s=>s.kind==='saia'),roda=m.solids.filter(s=>s.kind==='roda');
  assert.equal(saia.length,1);assert.equal(roda.length,1);
  assert.equal(saia[0].y,-5);assert.equal(saia[0].sy,5);
  assert.equal(roda[0].y,2);assert.equal(roda[0].sy,7);
  assert.equal(roda[0].z,0);                       // rodabanca no fundo
  assert.equal(saia[0].z+saia[0].sz,60);           // saia na frente
});

test('saia e rodabanca de L e U seguem as bordas em mais de um trecho',()=>{
  const L=buildModel(pc('L',{A:310,B:210,P:62},{rodaH:7}),2);
  assert.equal(L.solids.filter(s=>s.kind==='roda').length,2);      // fundo + lateral
  const U=buildModel(pc('U',{A:320,B:220,C:200,P:60},{rodaH:7}),2);
  assert.equal(U.solids.filter(s=>s.kind==='roda').length,3);
});

test('peça livre repete a quantidade informada',()=>{
  const m=buildModel(pc('livre',{rects:[{w:60,h:40,q:3}]}),2);
  assert.equal(m.solids.length,3);
  near(m.area,3*60*40/1e4,'área');
});

test('medidas inválidas não geram NaN, sólidos vazios nem erro',()=>{
  const ruins=[['reta',{A:0,P:60}],['reta',{A:-10,P:60}],['L',{A:300,B:30,P:60}],['U',{A:100,B:10,C:10,P:60}],
    ['escada',{A:100,N:0,PI:30,ES:17}],['nicho',{A:0,H:60,P:25}],['livre',{rects:[]}],['livre',{}]];
  for(const [type,d] of ruins){
    const m=buildModel(pc(type,d,{saiaH:5,rodaH:7}),2);
    assert.ok(Number.isFinite(m.area),`${type} área`);
    for(const s of m.solids)for(const k of ['x','y','z','sx','sy','sz','face'])assert.ok(Number.isFinite(s[k]),`${type} ${s.label} ${k}`);
    for(const s of m.solids)assert.ok(s.sx>0&&s.sy>0&&s.sz>0,`${type} ${s.label} sem volume`);
    near(m.area,areaCorte(pc(type,d,{saiaH:5,rodaH:7})),`${type} inválido`);
  }
  assert.equal(buildModel(pc('reta',{A:0,P:60}),2).vazio,true);
});

test('todas as peças dos 20 casos de regressão: 3D e corte têm a mesma área',()=>{
  for(const c of golden.cases)for(const p of c.quote.pieces)near(buildModel(p,2).area,areaCorte(p),`${c.nome} / ${p.name}`);
});

test('o modelo não altera a peça recebida',()=>{
  const p=pc('U',{A:320,B:220,C:200,P:60},{saiaH:5,rodaH:7});
  const antes=JSON.stringify(p);
  buildModel(p,2);
  assert.equal(JSON.stringify(p),antes);
});
