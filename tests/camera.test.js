/* Testes da matemática da câmera (viewer3d.js: funções puras baseCamera e distanciaIdeal), sem WebGL.
   Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');

const norma=v=>Math.hypot(...v),pesc=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const perto=(a,b,m,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${m}: esperado ${b}, veio ${a}`);
const carregar=()=>import('../viewer3d.js');

test('base da câmera: ortonormal e destra em qualquer ângulo, inclusive de cima (0) e de frente (π/2)',async()=>{
  const {baseCamera}=await carregar();
  for(const az of [-3,-1.2,-0.6,0,0.4,1.57,3.1])for(const pol of [0,1e-9,0.05,0.5,1,Math.PI/2-1e-9,Math.PI/2]){
    const b=baseCamera(az,pol);
    for(const v of [b.dir,b.r,b.u])perto(norma(v),1,`norma az ${az} pol ${pol}`);
    perto(pesc(b.dir,b.r),0,'dir ⟂ r');perto(pesc(b.dir,b.u),0,'dir ⟂ u');perto(pesc(b.r,b.u),0,'r ⟂ u');
    const rxu=[b.r[1]*b.u[2]-b.r[2]*b.u[1],b.r[2]*b.u[0]-b.r[0]*b.u[2],b.r[0]*b.u[1]-b.r[1]*b.u[0]];
    for(let i=0;i<3;i++)perto(rxu[i],b.dir[i],`destra az ${az} pol ${pol}`);          // r × u = dir (câmera olha por −dir)
  }
});

test('vista de cima: o cima da tela é −z (o fundo da peça fica em cima); vista de frente: o cima é +y',async()=>{
  const {baseCamera}=await carregar();
  const t=baseCamera(0,0);
  assert.deepEqual(t.r.map(v=>+v.toFixed(9)+0),[1,0,0]);
  assert.deepEqual(t.u.map(v=>+v.toFixed(9)+0),[0,0,-1]);
  assert.deepEqual(t.dir.map(v=>+v.toFixed(9)+0),[0,1,0]);
  const f=baseCamera(0,Math.PI/2);
  assert.deepEqual(f.r.map(v=>+v.toFixed(9)+0),[1,0,0]);
  assert.deepEqual(f.u.map(v=>+v.toFixed(9)+0),[0,1,0]);
  assert.deepEqual(f.dir.map(v=>+v.toFixed(9)+0),[0,0,1]);
});

const caixa=(x,y,z)=>{const p=[];for(const a of [0,x])for(const b of [0,y])for(const c of [0,z])p.push([a,b,c]);return p};
const dentro=(pontos,alvo,az,pol,d,fov,aspecto,{baseCamera})=>{
  const b=baseCamera(az,pol);let pior=0;
  for(const p of pontos){
    const v=[p[0]-alvo[0],p[1]-alvo[1],p[2]-alvo[2]],xr=pesc(v,b.r),yu=pesc(v,b.u),prof=d-pesc(v,b.dir);
    const tv=Math.tan(fov*Math.PI/360);
    pior=Math.max(pior,Math.abs(yu)/(prof*tv),Math.abs(xr)/(prof*tv*aspecto));
  }
  return pior;   // ≤ 1 = dentro da tela
};

test('enquadramento: todos os pontos cabem na tela e a distância é a menor possível',async()=>{
  const mod=await carregar(),{distanciaIdeal}=mod;
  const pontos=caixa(2.8,0.09,0.6),alvo=[1.4,0.045,0.3];
  for(const aspecto of [0.6,1,1.4,2.2])for(const [az,pol] of [[0,0],[0,Math.PI/2],[-0.6,1],[1.2,0.7]]){
    const d=distanciaIdeal({pontos,alvo,az,pol,fov:35,aspecto,min:0.2});
    const pior=dentro(pontos,alvo,az,pol,d,35,aspecto,mod);
    assert.ok(pior<=1,`cabe (aspecto ${aspecto}, az ${az}, pol ${pol}): ${pior}`);
    if(d>0.2+1e-6){const d2=d*0.99;assert.ok(dentro(pontos,alvo,az,pol,d2,35,aspecto,mod)>pior,'mais perto que o ideal ocupa mais da tela')}
  }
});

test('enquadramento: tela mais estreita pede câmera mais longe; respeita o mínimo',async()=>{
  const {distanciaIdeal}=await carregar();
  const pontos=caixa(3,0.1,0.6),alvo=[1.5,0.05,0.3],base={pontos,alvo,az:0,pol:0,fov:35,min:0.25};
  const larga=distanciaIdeal({...base,aspecto:2}),estreita=distanciaIdeal({...base,aspecto:0.7});
  assert.ok(estreita>larga);
  assert.equal(distanciaIdeal({pontos:[alvo],alvo,az:0,pol:0,fov:35,aspecto:1,min:0.25}),0.25);
  assert.equal(distanciaIdeal({pontos:[],alvo,az:0,pol:0,fov:35,aspecto:1,min:0.3}),0.3);
});
