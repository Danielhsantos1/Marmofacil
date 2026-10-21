/* Testes do modelo 3D (model3d.js). Rodar na raiz: node --test
   Garantia principal: o 3D usa os MESMOS dados do cálculo, então a área das faces dos sólidos
   tem que ser igual à área que entra no corte e no preço (partsArea). */
const test=require('node:test');
const assert=require('node:assert/strict');
const {shape,partsArea,calcQuote,divisoes}=require('../calc.js');
const {buildModel,cotas,ESP_PADRAO}=require('../model3d.js');
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
    // faixas de saia/rodabanca são aparadas nos cantos (junta de topo): o volume segue a face geométrica; `face` é a do corte
    for(const s of m.solids)near(s.sx*s.sy*s.sz,(s.faceGeom??s.face)*esp,`${type} ${s.label} esp ${esp}`,1e-6);
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

/* ================= Etapa técnica: geometria limpa, cotas, emendas e recortes ================= */
const par=(x={})=>({margin:35,tax:6,moM2:180,instalM2:90,instalFixo:0,frete:150,charge:'chapa',lossPct:12,...x});
const vol=(a,b)=>{const o=(p,q,r,t)=>Math.max(0,Math.min(p+q,r+t)-Math.max(p,r));return o(a.x,a.sx,b.x,b.sx)*o(a.y,a.sy,b.y,b.sy)*o(a.z,a.sz,b.z,b.sz)};

test('nenhum sólido se sobrepõe a outro (sem superfícies duplicadas), em todos os formatos e acabamentos',()=>{
  const extra=[...ACABAMENTOS,{saiaH:6,rodaH:4},{rodaH:7,rodaMl:30},{saiaH:6,saiaMl:20}];
  for(const [type,d] of FORMATOS)for(const ac of extra)for(const esp of [1,2,3]){
    const s=buildModel(pc(type,d,ac),esp).solids;
    for(let i=0;i<s.length;i++)for(let j=i+1;j<s.length;j++)
      assert.ok(vol(s[i],s[j])<1e-6,`${type} ${JSON.stringify(ac)} esp ${esp}: ${s[i].id} × ${s[j].id} se sobrepõem (${vol(s[i],s[j])} cm³)`);
  }
});

test('faixas aparadas nos cantos: a face do corte e a área continuam as nominais',()=>{
  const p=pc('ilha',{A:240,B:100},{saiaH:6});
  const m=buildModel(p,2),faixas=m.solids.filter(s=>s.kind==='saia');
  assert.equal(faixas.length,4);
  near(faixas.reduce((t,s)=>t+s.face,0),2*(240+100)*6,'soma das faces nominais = perímetro × altura');
  assert.ok(faixas.some(s=>s.faceGeom<s.face),'alguma faixa foi aparada no canto');
  near(m.area,areaCorte(p),'área igual ao corte');
});

/* ---------- cotas ---------- */
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const LADOS=[{x:'esq',z:'frente'},{x:'dir',z:'frente'},{x:'esq',z:'fundo'},{x:'dir',z:'fundo'}];

test('cota: a distância entre os dois pontos é exatamente o valor mostrado, em qualquer lado',()=>{
  for(const [type,d] of FORMATOS)for(const ac of ACABAMENTOS){
    const m=buildModel(pc(type,d,ac),2);
    for(const lado of LADOS)for(const c of cotas(m,lado).filter(c=>c.tipo==='cota')){
      near(dist(c.p1,c.p2),c.valor,`${type} ${c.texto}`,1e-9);
      near(Math.hypot(...c.dir),1,`${type} ${c.texto}: direção unitária`,1e-9);
      assert.ok(c.off>0&&Number.isFinite(c.off));
    }
  }
});

test('cota: os valores vêm dos dados da peça (nada fixo ou estimado)',()=>{
  const valores=(type,d,ac)=>cotas(buildModel(pc(type,d,ac),2)).filter(c=>c.tipo==='cota'&&c.categoria!=='espessura').map(c=>c.valor).sort((a,b)=>a-b);
  assert.deepEqual(valores('reta',{A:280,P:60}),[60,280]);
  assert.deepEqual(valores('reta',{A:123.5,P:47}),[47,123.5],'muda junto com a medida');
  assert.deepEqual(valores('lavatorio',{A:120,P:55}),[55,120]);
  assert.deepEqual(valores('ilha',{A:240,B:100}),[100,240]);
  assert.deepEqual(valores('L',{A:310,B:210,P:62}),[62,210,310]);
  assert.deepEqual(valores('U',{A:320,B:220,C:200,P:60}),[60,200,220,320]);
  assert.deepEqual(valores('escada',{A:100,N:5,PI:30,ES:17}),[17,30,100]);
  assert.deepEqual(valores('nicho',{A:80,H:60,P:25}),[25,60,80]);
  assert.deepEqual(valores('reta',{A:280,P:60},{saiaH:5,rodaH:7}),[5,7,60,280],'altura da saia e da rodabanca');
});

test('cota: espessura vem do material; sem material avisa que é o padrão',()=>{
  const e=m=>cotas(m).find(c=>c.categoria==='espessura');
  const comMat=buildModel(pc('reta',{A:280,P:60}),3);
  assert.equal(e(comMat).valor,3);assert.doesNotMatch(e(comMat).texto,/padrão/);
  const semMat=buildModel(pc('reta',{A:280,P:60}));
  assert.equal(semMat.espessuraOrigem,'padrao');assert.match(e(semMat).texto,/padrão/);
  assert.equal(buildModel(pc('reta',{A:280,P:60}),{espessura:1}).espessuraOrigem,'material');
});

test('cota: L e U mostram dimensões diferentes em lugares diferentes (sem repetir o total para trechos distintos)',()=>{
  const L=cotas(buildModel(pc('L',{A:200,B:200,P:60}),2)).filter(c=>c.tipo==='cota'&&c.categoria==='plano');
  const a=L.find(c=>c.texto.startsWith('A ')),b=L.find(c=>c.texto.startsWith('B '));
  assert.ok(a&&b,'A e B existem mesmo com valores iguais');
  assert.notDeepEqual([a.p1,a.p2],[b.p1,b.p2],'posições diferentes');
  assert.ok(a.p1[0]!==a.p2[0]&&a.p1[2]===a.p2[2],'A corre no eixo x');
  assert.ok(b.p1[2]!==b.p2[2]&&b.p1[0]===b.p2[0],'B corre no eixo z');
  const U=cotas(buildModel(pc('U',{A:320,B:220,C:220,P:60}),2)).filter(c=>c.tipo==='cota'&&c.categoria==='plano');
  const ids=U.map(c=>c.texto);
  assert.ok(ids.includes('B 220 cm')&&ids.includes('C 220 cm'),'as duas laterais têm cota própria');
  const b2=U.find(c=>c.texto.startsWith('B ')),c2=U.find(c=>c.texto.startsWith('C '));
  assert.ok(b2.p1[0]===0&&c2.p1[0]===320,'esquerda em x=0, direita em x=A');
});

test('cota: lado esquerdo/direito e frente/fundo trocam a posição, nunca o valor',()=>{
  const m=buildModel(pc('reta',{A:280,P:60}),2);
  const ref=cotas(m,LADOS[0]).filter(c=>c.tipo==='cota').map(c=>c.texto).sort();
  for(const l of LADOS)assert.deepEqual(cotas(m,l).filter(c=>c.tipo==='cota').map(c=>c.texto).sort(),ref);
  const f=cotas(m,{x:'esq',z:'frente'}).find(c=>c.valor===280),g=cotas(m,{x:'esq',z:'fundo'}).find(c=>c.valor===280);
  assert.equal(f.dir[2],1);assert.equal(g.dir[2],-1);
});

test('cota: a linha de cota fica fora da pedra (nunca cruza o modelo)',()=>{
  for(const [type,d] of FORMATOS.filter(f=>['reta','L','U','ilha','lavatorio'].includes(f[0]))){
    const m=buildModel(pc(type,d),2);
    for(const lado of LADOS)for(const c of cotas(m,lado).filter(c=>c.tipo==='cota'&&c.categoria==='plano')){
      const q=[0,1,2].map(i=>(c.p1[i]+c.p2[i])/2+c.dir[i]*c.off);
      const dentro=m.solids.some(s=>q[0]>s.x&&q[0]<s.x+s.sx&&q[2]>s.z&&q[2]<s.z+s.sz);
      assert.ok(!dentro,`${type} ${c.texto}: a linha de cota está sobre a pedra`);
    }
  }
});

test('cota: medidas inválidas ou ausentes não geram cota',()=>{
  assert.equal(cotas(buildModel(pc('reta',{A:0,P:60}),2)).length,0);
  const t=cotas(buildModel(pc('reta',{A:280,P:0}),2)).filter(c=>c.tipo==='cota');
  assert.ok(t.every(c=>Number.isFinite(c.valor)&&c.valor>0));
  const L=cotas(buildModel(pc('L',{A:300,B:30,P:60}),2)).filter(c=>c.tipo==='cota');   // lado B menor que a profundidade
  assert.ok(!L.some(c=>c.texto.startsWith('B ')),'não inventa cota de um trecho que não existe');
  assert.equal(cotas(buildModel(pc('reta',{A:280,P:60}),2)).filter(c=>c.categoria==='altura').length,0,'sem saia/rodabanca não há cota de altura');
});

test('peça livre: rótulos com as medidas reais de cada peça, sem inventar linhas de cota',()=>{
  const r=cotas(buildModel(pc('livre',{rects:[{w:120,h:50,q:1},{w:60,h:40,q:2}]}),2));
  assert.deepEqual(r.map(c=>c.texto),['120 × 50 cm','60 × 40 cm','60 × 40 cm']);
  assert.ok(r.every(c=>c.tipo==='rotulo'));
});

/* ---------- emendas: as do plano de corte ---------- */
test('emendas: peça maior que a chapa mostra o corte no ponto exato; peça menor não mostra nada',()=>{
  const m=buildModel(pc('reta',{A:400,P:65}),{espessura:2,SL:310,SW:180});
  assert.equal(m.emendas.length,1);assert.equal(m.emendasPlano,1);
  const e=m.emendas[0];
  assert.equal(e.eixo,'x');near(e.pos,200,'no meio do comprimento');
  assert.ok(e.pts.every(p=>p[0]===200),'o contorno do corte está no plano x=200');
  assert.deepEqual(buildModel(pc('reta',{A:280,P:60}),{espessura:2,SL:310,SW:180}).emendas,[]);
});

test('emendas: a soma por peça é igual às emendas que o cálculo (plano de corte) conta, nos 20 casos de regressão',()=>{
  for(const c of golden.cases){
    const calc=calcQuote(c.quote,golden.materials,golden.services);
    const soma=c.quote.pieces.reduce((t,p)=>t+buildModel(p,{espessura:2,SL:calc.SL,SW:calc.SW}).emendasPlano,0);
    assert.equal(soma,calc.nest.emendas,c.nome);
  }
});

test('emendas: peça maior que a chapa nos dois lados — o cálculo conta peças−1, o desenho mostra as linhas de corte (divergência documentada)',()=>{
  const dv=divisoes(700,200,310,180);                                  // 3 × 2 pedaços
  assert.equal(dv.emendas,5);
  const m=buildModel(pc('reta',{A:700,P:200}),{espessura:2,SL:310,SW:180});
  assert.equal(m.emendasPlano,5);
  assert.equal(m.emendas.length,3,'2 cortes no comprimento + 1 na profundidade');
});

test('emendas: saia/rodabanca compridas são cortadas pelo comprimento nominal',()=>{
  const m=buildModel(pc('L',{A:310,B:210,P:62},{rodaH:7}),{espessura:2,SL:310,SW:180});
  const calc=calcQuote({materialId:'t',pieces:[pc('L',{A:310,B:210,P:62},{rodaH:7})],lines:[],params:par()},[{id:'t',slabL:310,slabW:180,priceSlab:1,priceM2:1}],[]);
  assert.equal(m.emendasPlano,calc.nest.emendas);
});

/* ---------- recortes: só com dados ---------- */
test('recortes: sem dados na peça, nada é inventado',()=>{
  for(const [type,d] of FORMATOS){const m=buildModel(pc(type,d),2);assert.deepEqual(m.recortes,[]);assert.deepEqual(m.avisos,[]);assert.ok(m.solids.every(s=>!s.furos))}
});

test('recortes: abertura real no tampo, com as medidas dadas; a área do corte não muda',()=>{
  const sem=pc('reta',{A:280,P:60});
  const com=pc('reta',{A:280,P:60},{recortes:[{tipo:'cuba',x:100,z:10,w:80,d:45},{tipo:'cooktop',x:200,z:10,w:50,d:40}]});
  const m=buildModel(com,2);
  assert.equal(m.recortes.length,2);assert.deepEqual(m.avisos,[]);
  assert.equal(m.solids[0].furos.length,2);
  near(m.area,buildModel(sem,2).area,'o cálculo atual não desconta recortes: a área não muda');
  assert.deepEqual(cotas(m).filter(c=>c.tipo==='rotulo').map(c=>c.texto),['cuba 80×45 cm','cooktop 50×40 cm']);
});

test('recortes: dados inválidos são ignorados com aviso (nunca desenhados nem corrigidos)',()=>{
  const ruins=[{tipo:'cuba',x:100,z:10,w:0,d:45},{tipo:'cuba',x:100,z:10,w:-5,d:45},{tipo:'cuba',x:NaN,z:10,w:80,d:45},{tipo:'cuba',z:10,w:80,d:45},
    {tipo:'cuba',x:250,z:10,w:80,d:45},{tipo:'cuba',x:100,z:30,w:80,d:45},{tipo:'cuba',x:-5,z:10,w:80,d:45},{tipo:'cuba',x:0,z:10,w:80,d:45}];
  for(const r of ruins){
    const m=buildModel(pc('reta',{A:280,P:60},{recortes:[r]}),2);
    assert.equal(m.recortes.length,0,JSON.stringify(r));assert.equal(m.avisos.length,1,JSON.stringify(r));
  }
  const dup=buildModel(pc('reta',{A:280,P:60},{recortes:[{tipo:'cuba',x:100,z:10,w:80,d:45},{tipo:'cooktop',x:120,z:20,w:50,d:30}]}),2);
  assert.equal(dup.recortes.length,1);assert.match(dup.avisos[0],/sobrepõe/);
  assert.equal(buildModel(pc('reta',{A:280,P:60},{recortes:'x'}),2).recortes.length,0);
});

test('recortes: num L o recorte vai para o trecho que o contém; entre trechos não é desenhado',()=>{
  const p=pc('L',{A:310,B:210,P:62},{recortes:[{tipo:'cuba',x:100,z:10,w:80,d:40},{tipo:'cooktop',x:10,z:100,w:40,d:40},{tipo:'cuba',x:40,z:50,w:60,d:30}]});
  const m=buildModel(p,{espessura:2,SL:400,SW:200});
  assert.equal(m.recortes.length,2);
  assert.equal(m.recortes[0].solidId,'tampo-0');assert.equal(m.recortes[1].solidId,'tampo-1');
  assert.equal(m.avisos.length,1,'o que cruza a junção dos trechos é recusado, não inventado');
});

test('o 3D não altera o resultado do orçamento (mesma peça, mesmo cálculo antes e depois)',()=>{
  for(const c of golden.cases){
    const antes=JSON.stringify(calcQuote(c.quote,golden.materials,golden.services).price);
    c.quote.pieces.forEach(p=>{buildModel(p,{espessura:2,SL:310,SW:180});cotas(buildModel(p,2))});
    assert.equal(JSON.stringify(calcQuote(c.quote,golden.materials,golden.services).price),antes,c.nome);
  }
});

/* ================= Achados da revisão independente (geometria) ================= */
const dentroDaPedra=(m)=>{                                           // todas as faixas colocadas ficam sobre a pedra (ou soltas e rotuladas)
  const plates=m.solids.filter(s=>['tampo','degrau','espelho','painel'].includes(s.kind));
  const bx=[Math.min(...plates.map(s=>s.x))-1e-6,Math.max(...plates.map(s=>s.x+s.sx))+1e-6],bz=[Math.min(...plates.map(s=>s.z))-1e-6,Math.max(...plates.map(s=>s.z+s.sz))+1e-6];
  return m.solids.filter(s=>(s.kind==='saia'||s.kind==='roda')&&!s.solta).every(s=>s.x>=bx[0]&&s.x+s.sx<=bx[1]&&s.z>=bz[0]&&s.z+s.sz<=bz[1]);
};

test('saia automática em L e U nunca passa do contorno da pedra; a sobra vira faixa solta rotulada, com área igual à do corte',()=>{
  for(const [type,d] of [['L',{A:300,B:200,P:60}],['U',{A:300,B:200,C:200,P:60}],['U',{A:294,B:232,C:45,P:81}]]){
    for(const ac of [{saiaH:5},{saiaH:12,rodaH:7},{rodaH:7}]){
      const p=pc(type,d,ac),m=buildModel(p,2);
      assert.ok(dentroDaPedra(m),`${type} ${JSON.stringify(d)} ${JSON.stringify(ac)}: faixa fora da pedra`);
      near(m.area,areaCorte(p),`${type} área`);
      for(const s of m.solids.filter(s=>s.solta))assert.match(s.label,/sem posição|solta/);
    }
  }
  const m=buildModel(pc('L',{A:300,B:200,P:60},{saiaH:5}),2);
  assert.ok(m.solids.some(s=>s.label==='Saia (sem posição)'),'a metragem que passa do contorno aparece solta');
  assert.ok(m.avisos.some(a=>/não têm posição/.test(a)),'e avisa');
});

test('metragem manual maior que o percurso: nada flutua fora da pedra e os cortes não se empilham',()=>{
  for(const [type,d,ac] of [['ilha',{A:210.8,B:199.8},{saiaH:5,saiaMl:18}],['reta',{A:280,P:60},{rodaH:7,rodaMl:8}],['lavatorio',{A:120,P:55},{saiaH:5,saiaMl:6}]]){
    const p=pc(type,d,ac),m=buildModel(p,{espessura:2,SL:310,SW:180});
    assert.ok(dentroDaPedra(m),`${type}: faixa fora da pedra`);
    near(m.area,areaCorte(p),`${type} área`);
    const chaves=m.emendas.map(e=>e.solidId+'|'+e.eixo+'|'+e.pos.toFixed(3));
    assert.equal(new Set(chaves).size,chaves.length,`${type}: cortes coincidentes (empilhados)`);
  }
});

test('faixa menor que a espessura num canto não faz a área do 3D ficar menor que a do corte',()=>{
  for(const [type,d,ac,esp] of [['ilha',{A:240,B:100},{rodaH:5,rodaMl:5.81},2],['ilha',{A:450,B:87},{rodaH:5,rodaMl:9.9},3],['L',{A:201.6,B:26,P:25},{saiaH:5,rodaH:7},1]]){
    const p=pc(type,d,ac);
    near(buildModel(p,esp).area,areaCorte(p),`${type} ${JSON.stringify(ac)}`);
  }
});

test('U estreito (A < 2P), nicho baixo e outras medidas inconsistentes: avisa que as partes se sobrepõem',()=>{
  const u=buildModel(pc('U',{A:59,B:212,C:79,P:47}),2);
  assert.ok(u.avisos.some(a=>/No U, a largura A/.test(a)));
  near(u.area,areaCorte(pc('U',{A:59,B:212,C:79,P:47})),'a área segue a do cálculo (o aviso não corrige o cálculo)');
  const n=buildModel(pc('nicho',{A:80,H:3,P:25}),2);
  assert.ok(n.avisos.some(a=>/se sobrepõem/.test(a)));
  assert.deepEqual(buildModel(pc('U',{A:320,B:220,C:200,P:60}),2).avisos,[],'medidas boas: nenhum aviso');
});

test('recortes: mensagens certas (piso/painel, fora, borda) e aviso quando cruza uma emenda',()=>{
  const esc=buildModel(pc('escada',{A:100,N:3,PI:30,ES:17},{recortes:[{tipo:'cuba',x:10,z:5,w:20,d:10}]}),2);
  assert.equal(esc.recortes.length,0);assert.match(esc.avisos[0],/piso ou painel/);
  const borda=buildModel(pc('reta',{A:280,P:60},{recortes:[{tipo:'cuba',x:0,z:10,w:80,d:45}]}),2);
  assert.match(borda.avisos[0],/encostado na borda/);
  const cruza=buildModel(pc('reta',{A:400,P:60},{recortes:[{tipo:'cuba',x:190,z:10,w:20,d:30}]}),{espessura:2,SL:310,SW:180});
  assert.equal(cruza.recortes.length,1,'continua desenhado');assert.ok(cruza.avisos.some(a=>/cruza uma emenda/.test(a)));
});

test('valores não finitos, peça nula e retângulo nulo não geram NaN nem exceção',()=>{
  const m=buildModel(pc('lavatorio',{A:80,P:NaN},{saiaH:310}),2);
  for(const s of m.solids)for(const k of ['x','y','z','sx','sy','sz','face'])assert.ok(Number.isFinite(s[k]),k);
  assert.ok(Number.isFinite(m.area)&&m.avisos.some(a=>/inválid/.test(a)));
  const inf=buildModel(pc('reta',{A:Infinity,P:60},{rodaH:Infinity,saiaMl:NaN}),2);
  assert.ok(Number.isFinite(inf.area));
  assert.doesNotThrow(()=>buildModel(pc('livre',{rects:[null,{w:50,h:50}]}),2));
  assert.doesNotThrow(()=>buildModel(pc('reta',undefined),2));
  assert.doesNotThrow(()=>buildModel({type:'reta'},2));
});

test('medidas absurdas de grandes não travam o 3D (no máximo 200 linhas de corte por peça)',()=>{
  const t0=Date.now();
  const m=buildModel(pc('reta',{A:1e7,P:1e6}),{espessura:2,SL:310,SW:180});
  assert.ok(Date.now()-t0<2000,'terminou rápido');
  assert.ok(m.emendas.length<=400);
});

test('peça livre com quantidade fracionária ou menor que 1: avisa que o cálculo e o 3D divergem',()=>{
  const m=buildModel(pc('livre',{rects:[{w:100,h:50,q:2.5}]}),2);
  assert.ok(m.avisos.some(a=>/quantidade/i.test(a)));
  assert.equal(buildModel(pc('livre',{rects:[{w:100,h:50,q:2}]}),2).avisos.length,0);
});

/* propriedades com medidas aleatórias (gerador fixo: sempre os mesmos casos) */
function gerador(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
test('propriedades (1500 peças aleatórias): área = corte, sem sobreposição, sem NaN, cotas exatas, faixas na pedra',()=>{
  const r=gerador(20261021),n=(a,b)=>Math.round((a+r()*(b-a))*10)/10;
  const tipos=['reta','L','U','ilha','escada','nicho','lavatorio','livre'];
  for(let i=0;i<1500;i++){
    const tipo=tipos[i%tipos.length],P=n(40,90),d={
      reta:{A:n(60,600),P},L:{A:n(P+10,500),B:n(P+10,400),P},U:{A:n(2*P+10,600),B:n(P+10,400),C:n(P+10,400),P},
      ilha:{A:n(60,500),B:n(40,200)},escada:{A:n(40,200),N:Math.round(n(1,10)),PI:n(20,40),ES:n(12,22)},
      nicho:{A:n(30,200),H:n(20,120),P:n(10,60)},lavatorio:{A:n(40,200),P:n(35,70)},
      livre:{rects:Array.from({length:Math.round(n(1,4))},()=>({w:n(10,400),h:n(10,150),q:Math.round(n(1,3))}))}
    }[tipo];
    const ac={};
    if(r()<.6)ac.saiaH=n(2,15);if(r()<.6)ac.rodaH=n(2,12);
    if(r()<.3&&ac.saiaH)ac.saiaMl=n(0.5,12);if(r()<.3&&ac.rodaH)ac.rodaMl=n(0.5,12);
    const p=pc(tipo,d,ac),esp=[1,2,3][i%3],SL=[150,300,310,400][i%4],SW=[100,160,180,200][(i>>2)%4];
    const m=buildModel(p,{espessura:esp,SL,SW}),ctx=`${tipo} ${JSON.stringify(d)} ${JSON.stringify(ac)} esp ${esp} chapa ${SL}x${SW}`;
    near(m.area,areaCorte(p),'área '+ctx,1e-9);
    for(const s of m.solids)for(const k of ['x','y','z','sx','sy','sz','face'])assert.ok(Number.isFinite(s[k]),k+' '+ctx);
    const s=m.solids;
    for(let a=0;a<s.length;a++)for(let b=a+1;b<s.length;b++)assert.ok(vol(s[a],s[b])<1e-6,`sobreposição ${s[a].id} × ${s[b].id} ${ctx}`);
    assert.ok(dentroDaPedra(m),'faixa fora da pedra '+ctx);
    for(const lado of LADOS)for(const c of cotas(m,lado).filter(c=>c.tipo==='cota'))near(dist(c.p1,c.p2),c.valor,`cota ${c.texto} ${ctx}`,1e-9);
    const nest=calcQuote({materialId:'t',pieces:[p],lines:[],params:par()},[{id:'t',slabL:SL,slabW:SW,priceSlab:1,priceM2:1}],[]);
    assert.equal(m.emendasPlano,nest.nest.emendas,'emendas = plano de corte '+ctx);
    assert.deepEqual(m.avisos.filter(a=>/NaN|inválid/.test(a)),[]);
  }
});

/* ================= Recortes editáveis: contrato de dados ================= */
test('recortes: origem "medido" (padrão) ou "estimado"; estimado aparece marcado na cota e no modelo',()=>{
  const p=pc('reta',{A:280,P:60},{recortes:[
    {tipo:'cuba',x:100,z:10,w:80,d:45},                           // sem origem (dado antigo ou digitado): medido
    {tipo:'cooktop',x:200,z:10,w:50,d:40,origem:'estimado'},
    {tipo:'outro',x:20,z:10,w:30,d:20,origem:'qualquer coisa'}      // valor desconhecido: tratado como medido
  ]});
  const m=buildModel(p,{espessura:2,SL:400,SW:200});
  assert.deepEqual(m.recortes.map(r=>r.origem),['medido','estimado','medido']);
  assert.deepEqual(cotas(m).filter(c=>c.tipo==='rotulo').map(c=>c.texto),['cuba 80×45 cm','cooktop 50×40 cm (estimado)','outro 30×20 cm']);
});

test('recortes: campos vazios de um recorte novo (sem medidas) não desenham nada e avisam',()=>{
  const m=buildModel(pc('reta',{A:280,P:60},{recortes:[{id:'x',tipo:'cuba',origem:'medido'}]}),2);
  assert.equal(m.recortes.length,0);assert.equal(m.avisos.length,1);assert.match(m.avisos[0],/sem medidas válidas/);
  assert.equal(m.area,areaCorte(pc('reta',{A:280,P:60})),'a área não muda');
});

test('recortes: o campo id e dados antigos sem "recortes" convivem; a peça recebida não é alterada',()=>{
  const p=pc('reta',{A:280,P:60},{recortes:[{id:'abc',tipo:'cuba',x:100,z:10,w:80,d:45,origem:'medido'}]});
  const antes=JSON.stringify(p);buildModel(p,2);assert.equal(JSON.stringify(p),antes);
  assert.deepEqual(buildModel(pc('reta',{A:280,P:60}),2).recortes,[]);
});

test('o preço e o plano de corte não dependem dos recortes (mesmo orçamento com e sem)',()=>{
  const base=pc('reta',{A:280,P:60}),com=pc('reta',{A:280,P:60},{recortes:[{tipo:'cuba',x:100,z:10,w:80,d:45},{tipo:'cooktop',x:200,z:10,w:50,d:40}]});
  const mats=[{id:'m',slabL:310,slabW:180,priceSlab:2900,priceM2:640}],q=p=>({materialId:'m',pieces:[p],lines:[],params:par()});
  const a=calcQuote(q(base),mats,[]),b=calcQuote(q(com),mats,[]);
  for(const k of ['area','price','cost','profit','nSlabs'])assert.equal(b[k],a[k],k);
  assert.equal(b.nest.emendas,a.nest.emendas);
});

/* ================= Status de cada recorte (aparece dentro do cartão dele) ================= */
test('statusRecortes: um status por recorte da lista, no mesmo índice, com o motivo quando não é desenhado',()=>{
  const p=pc('reta',{A:280,P:60},{recortes:[
    {tipo:'cuba',x:100,z:10,w:80,d:45},          // 0: ok
    {tipo:'cooktop'},                              // 1: vazio
    {tipo:'cuba',x:0,z:10,w:80,d:45},              // 2: encostado na borda
    {tipo:'cuba',x:250,z:10,w:80,d:45},            // 3: passa da pedra
    {tipo:'outro',x:120,z:20,w:30,d:20}            // 4: sobrepõe o 0
  ]});
  const s=buildModel(p,{espessura:2,SL:400,SW:200}).statusRecortes;
  assert.equal(s.length,5);
  assert.deepEqual(s[0],{ok:true,motivo:''});
  assert.equal(s[1].ok,false);assert.match(s[1].motivo,/Falta preencher/);
  assert.equal(s[2].ok,false);assert.match(s[2].motivo,/maiores que 0/);
  assert.equal(s[3].ok,false);assert.match(s[3].motivo,/Não cabe/);
  assert.equal(s[4].ok,false);assert.match(s[4].motivo,/Sobrepõe/);
});

test('statusRecortes: recorte desenhado que cruza uma emenda vem marcado com aviso, sem deixar de ser desenhado',()=>{
  const m=buildModel(pc('reta',{A:400,P:60},{recortes:[{tipo:'cuba',x:190,z:10,w:20,d:30}]}),{espessura:2,SL:310,SW:180});
  assert.equal(m.statusRecortes[0].ok,true);assert.match(m.statusRecortes[0].motivo,/cruza uma emenda/);
  assert.equal(m.recortes.length,1);
});

test('statusRecortes: sem recortes a lista é vazia',()=>{
  assert.deepEqual(buildModel(pc('reta',{A:280,P:60}),2).statusRecortes,[]);
});
