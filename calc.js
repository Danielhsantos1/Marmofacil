/* Marmofácil: cálculo puro (geometria, plano de corte e preço).
   Sem acesso a tela, localStorage ou variáveis globais do app. Medidas em cm; área em m².
   Roda no navegador (funções globais) e no Node (module.exports) para os testes em tests/. */

/* Formata número como o app (pt-BR); só usado no rótulo das peças de saia e rodabanca. */
function fmtRotulo(n,d){return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})}


/* Metragem linear padrão para saia e rodabanca (m) */
function defMl(p,kind){
  const d=p.d;
  if(p.type==='reta')return d.A/100;
  if(p.type==='L')return (d.A+d.B-d.P)/100;
  if(p.type==='U')return (d.A+d.B+d.C-2*d.P)/100;
  if(p.type==='ilha')return kind==='saia'?2*(d.A+d.B)/100:0;
  if(p.type==='lavatorio')return d.A/100;
  return 0;
}

/* Gera retângulos de desenho e peças de corte. Tudo em cm. */
function shape(p){
  const d=p.d,r=[],parts=[],g=6;
  const add=(x,y,w,h,l,q=1,kind='main')=>{if(w>0&&h>0){r.push({x,y,w,h,l,kind});parts.push({w,h,l,q})}};
  if(p.type==='reta')add(0,0,d.A,d.P,'Tampo');
  else if(p.type==='L'){add(0,0,d.A,d.P,'Trecho A');add(0,d.P,d.P,Math.max(0,d.B-d.P),'Trecho B')}
  else if(p.type==='U'){add(0,0,d.A,d.P,'Fundo');add(0,d.P,d.P,Math.max(0,d.B-d.P),'Esq.');add(d.A-d.P,d.P,d.P,Math.max(0,d.C-d.P),'Dir.')}
  else if(p.type==='ilha')add(0,0,d.A,d.B,'Tampo');
  else if(p.type==='lavatorio')add(0,0,d.A,d.P,'Tampo');
  else if(p.type==='escada'){let y=0;for(let i=1;i<=Math.max(1,Math.round(d.N));i++){
    r.push({x:0,y,w:d.A,h:d.PI,l:'Piso '+i,kind:'main'});y+=d.PI;
    r.push({x:0,y,w:d.A,h:d.ES,l:'Esp. '+i,kind:'riser'});y+=d.ES}
    const n=Math.max(1,Math.round(d.N));parts.push({w:d.A,h:d.PI,l:'Piso',q:n},{w:d.A,h:d.ES,l:'Espelho',q:n})}
  else if(p.type==='nicho'){add(0,0,d.A,d.H,'Fundo');add(0,d.H+g,d.A,d.P,'Topo');add(0,d.H+d.P+2*g,d.A,d.P,'Base');
    r.push({x:d.A+g,y:0,w:d.P,h:d.H,l:'Lat.',kind:'main'},{x:d.A+2*g+d.P,y:0,w:d.P,h:d.H,l:'Lat.',kind:'main'});
    parts.push({w:d.P,h:d.H,l:'Lateral',q:2})}
  else if(p.type==='livre'){let x=0,y=0,rowH=0;const W=320;
    (d.rects||[]).forEach(q=>{const w=q.w,h=q.h;if(!(w>0&&h>0))return;
      if(x>0&&x+w>W){x=0;y+=rowH+g;rowH=0}
      r.push({x,y,w,h,l:q.l||'Peça',kind:'main'});parts.push({w,h,l:q.l||'Peça',q:q.q||1});x+=w+g;rowH=Math.max(rowH,h)})}
  const mainBottom=r.reduce((m,a)=>Math.max(m,a.y+a.h),0);
  let ey=mainBottom+g*2;
  [['saia',p.saiaH,'Saia'],['roda',p.rodaH,'Rodabanca']].forEach(([k,h,l])=>{
    if(h>0){const ml=(k==='saia'?p.saiaMl:p.rodaMl)||defMl(p,k==='saia'?'saia':'roda');const w=ml*100;
      if(w>0){r.push({x:0,y:ey,w,h,l:l+' '+fmtRotulo(ml,2)+' m',kind:'extra'});parts.push({w,h,l,q:1});ey+=h+g}}});
  return {rects:r,parts};
}
const partsArea=parts=>parts.reduce((s,a)=>s+a.w*a.h*(a.q||1),0)/1e4;

/* ===== Plano de corte (prateleiras, estimativa) ===== */
function nestParts(parts,SL,SW){
  const kerf=0.4;let items=[],emendas=0;
  parts.forEach(a=>{for(let i=0;i<(a.q||1);i++){
    const L=Math.max(a.w,a.h),W=Math.min(a.w,a.h);
    const k=Math.max(1,Math.ceil(L/SL)),m=Math.max(1,Math.ceil(W/SW));
    emendas+=k*m-1;
    for(let a1=0;a1<k;a1++)for(let b1=0;b1<m;b1++)items.push({w:L/k,h:W/m,l:a.l})}});
  items.sort((x,y)=>y.h-x.h||y.w-x.w);
  const slabs=[];
  const place=it=>{
    for(const s of slabs){
      for(const sh of s.shelves){if(sh.h>=it.h-1e-6&&SL-sh.x>=it.w){s.items.push({x:sh.x,y:sh.y,w:it.w,h:it.h,l:it.l});sh.x+=it.w+kerf;return}}
      const used=s.shelves.reduce((t,sh)=>t+sh.h+kerf,0);
      if(SW-used>=it.h){const sh={y:used,h:it.h,x:0};s.shelves.push(sh);s.items.push({x:0,y:sh.y,w:it.w,h:it.h,l:it.l});sh.x=it.w+kerf;return}
    }
    const s={items:[],shelves:[]};slabs.push(s);
    const sh={y:0,h:it.h,x:it.w+kerf};s.shelves.push(sh);s.items.push({x:0,y:0,w:it.w,h:it.h,l:it.l});
  };
  items.forEach(place);
  const used=items.reduce((t,a)=>t+a.w*a.h,0)/1e4;
  return {slabs,emendas,used};
}

/* ===== Cálculo do orçamento =====
   q: orçamento ({materialId, pieces, lines, params}); materials e services: cadastros do app.
   Margem e impostos incidem sobre o preço de venda: preço = custo / (1 − margem − impostos).
   Se margem + impostos passar de 95%, a conta não faz sentido: `erro` vem preenchido e o
   preço usa o piso de 5% do divisor (como antes), só para a tela não quebrar. */
function calcQuote(q,materials,services){
  const m=materials.find(x=>x.id===q.materialId),SL=m?.slabL||300,SW=m?.slabW||160,P=q.params;
  const parts=[];q.pieces.forEach(p=>parts.push(...shape(p).parts));
  const area=partsArea(parts);
  const nest=nestParts(parts,SL,SW);
  const nSlabs=nest.slabs.length,slabArea=SL*SW/1e4;
  const util=nSlabs?nest.used/(nSlabs*slabArea):0;
  let mat=0;
  if(m){mat=P.charge==='m2'?area*(1+P.lossPct/100)*(m.priceM2||0):nSlabs*(m.priceSlab||0)}
  const labor=area*P.moM2;
  const svc=q.lines.reduce((t,l)=>{const s=services.find(x=>x.id===l.svcId);return t+(s?s.price*l.qty:0)},0);
  const fab=labor+svc;
  const inst=area*P.instalM2+P.instalFixo;
  const frete=P.frete;
  const cost=mat+fab+inst+frete;
  const den0=1-P.margin/100-P.tax/100;
  const erro=P.margin+P.tax>95+1e-9?'Margem + impostos passam de 95%. O preço não é confiável: reduza a margem ou os impostos.':'';
  const den=Math.max(0.05,den0);
  const price=Math.round(cost/den*100)/100;
  const taxV=price*P.tax/100;
  const profit=price-cost-taxV;
  return {m,area,nest,nSlabs,slabArea,util,loss:1-util,mat,labor,svc,fab,inst,frete,cost,price,taxV,profit,SL,SW,
    perM2:area?price/area:0,erro};
}

if(typeof module!=='undefined')module.exports={defMl,shape,partsArea,nestParts,calcQuote};
