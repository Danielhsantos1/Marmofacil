/* Testes do motor de Ambiente (motor/ambiente.js). Rodar na raiz: node --test
   Referência manual: ambiente 400 × 500 × 270 cm => piso 20 m², perímetro 18 m, paredes 48,6 m², volume 54 m³. */
const test=require('node:test');
const assert=require('node:assert/strict');
const {AMB_LIM,criarAmbiente,validarAmbiente,medidasAmbiente,modeloAmbiente,ambSegmentos}=require('../motor/ambiente.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const cozinha=(ab=[])=>({nome:'Cozinha',largura:400,comprimento:500,altura:270,aberturas:ab});
const porta=(o={})=>({id:'p1',tipo:'porta',parede:'S',x:100,largura:80,altura:210,peitoril:0,...o});
const janela=(o={})=>({id:'j1',tipo:'janela',parede:'L',x:150,largura:120,altura:100,peitoril:110,...o});
const vol=s=>s.sx*s.sy*s.sz;
const sobrepoe=(a,b)=>{const o=(p,q,r,s)=>Math.max(0,Math.min(p+q,r+s)-Math.max(p,r));return o(a.x,a.sx,b.x,b.sx)*o(a.y,a.sy,b.y,b.sy)*o(a.z,a.sz,b.z,b.sz)>1e-6};

test('medidas do exemplo: piso, teto, perímetro, paredes e volume',()=>{
  const m=medidasAmbiente(cozinha());
  assert.equal(m.ok,true);
  near(m.areaPiso,20,'piso');near(m.areaTeto,20,'teto');near(m.perimetro,18,'perímetro');
  near(m.areaParedesBruta,48.6,'paredes brutas');near(m.volume,54,'volume');near(m.areaParedesLiquida,48.6,'sem aberturas, líquida = bruta');
  assert.deepEqual(m.paredes.map(p=>p.id),['N','S','O','L']);
  near(m.paredes[0].comprimento,400,'fundo');near(m.paredes[2].comprimento,500,'lateral esquerda');
});
test('porta 80×210 e janela 120×100 descontam das paredes: 48,6 − 2,88 = 45,72 m²',()=>{
  const m=medidasAmbiente(cozinha([porta(),janela()]));
  near(m.areaAberturas,2.88,'aberturas');near(m.areaParedesLiquida,45.72,'líquida');
  assert.equal(m.portas,1);assert.equal(m.janelas,1);
  near(m.paredes.find(p=>p.id==='S').areaAberturas,1.68,'porta na frente');near(m.paredes.find(p=>p.id==='L').areaAberturas,1.2,'janela à direita');
});
test('aceita números digitados como texto ("400", "4,5") e não altera o objeto original',()=>{
  const ent={largura:'400',comprimento:'500',altura:'270',aberturas:[{tipo:'porta',parede:'S',x:'100',largura:'80',altura:'210'}]};
  const copia=JSON.stringify(ent);
  near(medidasAmbiente(ent).areaPiso,20,'piso');assert.equal(JSON.stringify(ent),copia,'entrada intacta');
  near(criarAmbiente({largura:'4,5'}).largura,4.5,'vírgula decimal');
});
test('validação: dimensões inválidas, fora dos limites, NaN, Infinity e lixo',()=>{
  for(const ruim of [{largura:0},{largura:-10},{largura:NaN},{largura:Infinity},{largura:'abc'},{largura:AMB_LIM.max+1},{largura:AMB_LIM.min-1},{largura:null},{largura:undefined}]){
    const v=validarAmbiente({...cozinha(),...ruim});assert.equal(v.ok,false,JSON.stringify(ruim));assert.ok(v.erros.length>0);
    assert.equal(medidasAmbiente({...cozinha(),...ruim}).ok,false);
  }
  assert.equal(validarAmbiente({...cozinha(),altura:100}).ok,false,'altura mínima');
  assert.equal(validarAmbiente({...cozinha(),altura:2000}).ok,false,'altura máxima');
  assert.equal(validarAmbiente(null).ok,false);assert.equal(validarAmbiente({}).ok,false);
});
test('validação das aberturas: fora da parede, sobrepostas, altas demais, sem parede, porta suspensa',()=>{
  assert.equal(validarAmbiente(cozinha([porta()])).ok,true);
  assert.equal(validarAmbiente(cozinha([porta({x:350})])).ok,false,'80 cm a partir de 350 passa de 400');
  assert.equal(validarAmbiente(cozinha([porta({x:320})])).ok,true,'encosta no canto, cabe');
  assert.equal(validarAmbiente(cozinha([janela({peitoril:200})])).ok,false,'100 de altura a 200 passa de 270');
  assert.equal(validarAmbiente(cozinha([porta({parede:'X'})])).ok,false);
  assert.equal(validarAmbiente(cozinha([porta({largura:0})])).ok,false);
  assert.equal(validarAmbiente(cozinha([porta({x:-5})])).ok,false);
  assert.equal(validarAmbiente(cozinha([porta({peitoril:30})])).ok,false,'porta começa no piso');
  assert.equal(validarAmbiente(cozinha([porta({id:'a',x:100}),porta({id:'b',x:150})])).ok,false,'sobrepostas');
  assert.equal(validarAmbiente(cozinha([porta({id:'a',x:100}),porta({id:'b',x:180})])).ok,true,'encostadas, sem sobrepor');
  assert.equal(validarAmbiente(cozinha([porta({id:'a',parede:'S'}),porta({id:'b',parede:'N',x:100})])).ok,true,'paredes diferentes não se sobrepõem');
  const lateral=validarAmbiente(cozinha([janela({parede:'O',x:450,largura:100})]));assert.equal(lateral.ok,false,'parede lateral mede 500, não 400');
});
test('modelo 3D: o interior tem exatamente as medidas informadas e as paredes ficam por fora',()=>{
  const m=modeloAmbiente(cozinha());
  assert.equal(m.vazio,false);
  const piso=m.solids.find(s=>s.kind==='piso');
  near(piso.sx,400,'piso largura');near(piso.sz,500,'piso comprimento');near(piso.x,0,'piso x');near(piso.z,0,'piso z');
  m.solids.filter(s=>s.kind==='parede').forEach(s=>{
    const dentro=s.x<400&&s.x+s.sx>0&&s.z<500&&s.z+s.sz>0&&s.y>=0;
    const colide=Math.max(0,Math.min(s.x+s.sx,400)-Math.max(s.x,0))*Math.max(0,Math.min(s.z+s.sz,500)-Math.max(s.z,0));
    assert.ok(colide<1e-9,'parede invade o interior: '+s.label);assert.ok(s.sy<=270+1e-9);void dentro;
  });
  near(m.bbox.min[0],-AMB_LIM.esp,'caixa começa na parede esquerda');near(m.bbox.max[2],500+AMB_LIM.esp,'caixa termina na parede da frente');
});
test('modelo 3D: volume das paredes = espessura × (área da parede − aberturas); nada se sobrepõe',()=>{
  const ab=[porta(),janela(),porta({id:'p2',parede:'N',x:50,largura:90,altura:200}),janela({id:'j2',parede:'O',x:40,largura:100,altura:120,peitoril:90})];
  const m=modeloAmbiente(cozinha(ab)),t=AMB_LIM.esp;
  const paredes=m.solids.filter(s=>s.kind==='parede');
  const brutoNS=2*t*((400+2*t)*270),brutoOL=2*t*(500*270),abertas=t*(80*210+120*100+90*200+100*120);
  near(paredes.reduce((s,x)=>s+vol(x),0),brutoNS+brutoOL-abertas,'volume das paredes',1e-6);
  for(let i=0;i<m.solids.length;i++)for(let j=i+1;j<m.solids.length;j++)assert.ok(!sobrepoe(m.solids[i],m.solids[j]),`sobreposição: ${m.solids[i].label} x ${m.solids[j].label}`);
  m.solids.forEach(s=>{assert.ok(s.sx>0&&s.sy>0&&s.sz>0,'tamanho positivo: '+s.label);assert.ok(isFinite(s.x+s.y+s.z))});
});
test('a posição da abertura é medida olhando a parede de dentro (N e L crescem; S e O invertem)',()=>{
  const x0=(parede,x)=>{const m=modeloAmbiente(cozinha([janela({id:'j',parede,x,largura:100,altura:100,peitoril:100})]));return m.solids.find(s=>s.kind==='vidro')};
  const n=x0('N',50);near(n.x,50,'N: a partir da esquerda (oeste)');
  const s=x0('S',50);near(s.x,400-50-100,'S: de dentro, a esquerda é o lado leste');
  const o=x0('O',50);near(o.z,500-50-100,'O: de dentro, a esquerda é o lado sul');
  const l=x0('L',50);near(l.z,50,'L: a partir do fundo');
});
test('janela gera vidro fino; porta deixa o vão aberto; sem teto quando pedido',()=>{
  const m=modeloAmbiente(cozinha([porta(),janela()]));
  assert.equal(m.solids.filter(s=>s.kind==='vidro').length,1);
  assert.ok(m.solids.some(s=>s.kind==='teto'));
  assert.ok(!modeloAmbiente(cozinha(),{teto:false}).solids.some(s=>s.kind==='teto'),'teto opcional');
  near(modeloAmbiente(cozinha(),{teto:false}).bbox.max[1],270,'sem teto a caixa para na altura');
});
test('cotas automáticas: largura, comprimento e altura, com |p2−p1| = valor; um rótulo por abertura',()=>{
  const m=modeloAmbiente(cozinha([porta(),janela()])),cotas=m.cotasDe();
  const c=cotas.filter(x=>x.tipo==='cota');
  assert.deepEqual(c.map(x=>x.valor).sort((a,b)=>a-b),[270,400,500]);
  c.forEach(x=>near(Math.hypot(x.p2[0]-x.p1[0],x.p2[1]-x.p1[1],x.p2[2]-x.p1[2]),x.valor,'distância = valor'));
  assert.deepEqual(cotas.filter(x=>x.tipo==='rotulo').map(x=>x.texto).sort(),['janela 120×100','porta 80×210']);
  assert.deepEqual(m.cotas,cotas);
});
test('ambiente inválido: modelo vazio com avisos, sem lançar erro',()=>{
  const m=modeloAmbiente({largura:0,comprimento:500,altura:270});
  assert.equal(m.vazio,true);assert.equal(m.solids.length,0);assert.ok(m.avisos.length>0);assert.deepEqual(m.cotasDe(),[]);
});
test('segmentos da parede cobrem exatamente o comprimento menos as aberturas (sem furo nem sobra)',()=>{
  const ab=[{x:50,largura:80,altura:210,peitoril:0},{x:200,largura:100,altura:100,peitoril:100}];
  const seg=ambSegmentos(400,270,ab,0),area=seg.reduce((s,q)=>s+(q.b-q.a)*(q.y1-q.y0),0);
  near(area,400*270-80*210-100*100,'área dos segmentos');
});
test('propriedade: 800 ambientes aleatórios válidos mantêm as invariantes de área e volume',()=>{
  let sem=12345;const r=()=>{sem=(sem*1103515245+12345)&0x7fffffff;return sem/0x7fffffff};
  for(let i=0;i<800;i++){
    const L=AMB_LIM.min+Math.floor(r()*600),C=AMB_LIM.min+Math.floor(r()*600),H=AMB_LIM.altMin+Math.floor(r()*250),ab=[];
    const n=Math.floor(r()*4);
    for(let k=0;k<n;k++){const parede='NSOL'[Math.floor(r()*4)],comp=parede==='N'||parede==='S'?L:C,w=20+Math.floor(r()*80),x=Math.floor(r()*Math.max(1,comp-w)),pe=r()<0.5?0:Math.floor(r()*40),h=10+Math.floor(r()*(H-pe-10));
      ab.push({id:'a'+k,tipo:pe?'janela':'porta',parede,x,largura:w,altura:h,peitoril:pe})}
    const ent={largura:L,comprimento:C,altura:H,aberturas:ab},v=validarAmbiente(ent);
    if(!v.ok)continue;
    const m=medidasAmbiente(ent);
    near(m.areaPiso,L*C/1e4,'piso');near(m.volume,L*C*H/1e6,'volume');near(m.perimetro,2*(L+C)/100,'perímetro');
    near(m.areaParedesBruta-m.areaAberturas,m.areaParedesLiquida,'bruta − aberturas = líquida',1e-9);
    assert.ok(m.areaParedesLiquida>0&&m.areaParedesLiquida<=m.areaParedesBruta+1e-12);
    const mod=modeloAmbiente(ent);assert.equal(mod.vazio,false);
    mod.solids.forEach(s=>assert.ok(s.sx>0&&s.sy>0&&s.sz>0&&isFinite(s.x+s.y+s.z)));
  }
});
