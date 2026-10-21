/* Marmofácil: visualizador 3D técnico (Three.js). Carregado só quando o usuário abre o 3D.
   Só desenha; não calcula nada: recebe o modelo de model3d.js (cm) e mostra em metros.
   - Um único canvas/contexto WebGL é reaproveitado: o app refaz o HTML da tela a cada mudança,
     então canvas e camadas de texto são re-anexados ao novo container em vez de recriados.
   - Desenha só quando algo muda (sem animação contínua) e libera geometrias e materiais antigos.
   - Cotas: linhas no 3D + textos em HTML por cima (nítidos em qualquer zoom, sem sobrepor). */
import * as THREE from './vendor/three.module.min.js';

const CM=0.01;
const TILE=0.5;                                   // metros por repetição da textura
/* cor do material liso e tinta (multiplica a textura) por tipo de sólido */
const LISO={tampo:0xd8dfdc,degrau:0xd8dfdc,saia:0xa3b3ae,roda:0xc3cfcb,espelho:0xb6c3bf,painel:0xcbd5d1};
const TINTA={tampo:0xffffff,degrau:0xffffff,saia:0xb4bdba,roda:0xdde3e0,espelho:0xc9d0cd,painel:0xeef1ef};

export function webglDisponivel(){
  try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}
}

/* ---- texturas de pedra: puramente visuais, geradas no aparelho (128 px), sempre as mesmas ---- */
function prng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function textura(nome){
  const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),r=prng(nome.length*977+nome.charCodeAt(0));
  const rect=(x,y,w,h,cor)=>{g.fillStyle=cor;g.fillRect(x,y,w,h)};
  if(nome==='granito'){
    rect(0,0,N,N,'#b9bcbc');
    for(let i=0;i<1100;i++){const v=r(),x=r()*N,y=r()*N,s=r()<.15?2:1;
      rect(x,y,s,s,v<.4?'rgba(40,40,44,.65)':v<.7?'rgba(235,235,235,.75)':'rgba(150,120,115,.55)')}
  }else if(nome==='marmore'){
    rect(0,0,N,N,'#ecebe7');
    g.lineCap='round';
    for(let k=0;k<7;k++){
      g.beginPath();let x=r()*N,y=0;g.moveTo(x,y);
      while(y<N){x+=(r()-.5)*18;y+=6+r()*8;g.lineTo(x,y)}
      g.strokeStyle='rgba('+(70+r()*40|0)+','+(80+r()*40|0)+','+(95+r()*30|0)+','+(.18+r()*.35)+')';g.lineWidth=.6+r()*1.8;g.stroke();
    }
  }else{                                           // quartzo: fundo uniforme com brilho fino
    rect(0,0,N,N,'#e3e5e4');
    for(let i=0;i<1400;i++){const x=r()*N,y=r()*N;rect(x,y,1,1,r()<.5?'rgba(255,255,255,.7)':'rgba(120,128,126,.35)')}
  }
  const tx=new THREE.CanvasTexture(c);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=2;
  return tx;
}

/* UV proporcional ao tamanho real da face (a textura repete a cada 0,5 m, sem esticar) */
function escalarUV(geo,sx,sy,sz){
  const uv=geo.attributes.uv,tam=[[sz,sy],[sz,sy],[sx,sz],[sx,sz],[sx,sy],[sx,sy]];   // +x −x +y −y +z −z
  for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*tam[f][0]*CM/TILE,uv.getY(i)*tam[f][1]*CM/TILE)}
  uv.needsUpdate=true;
}

export function criarVisualizador(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  const canvas=renderer.domElement;
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Modelo 3D da peça com cotas em centímetros. Arraste para girar e use dois dedos para aproximar.');
  const camada=document.createElement('div');                   // textos das cotas e avisos, por cima do canvas
  camada.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;font:600 12px/1.1 var(--mono,monospace)';
  const aviso=document.createElement('div');
  aviso.style.cssText='position:absolute;left:8px;right:8px;top:8px;padding:8px 10px;border-radius:8px;background:var(--fg);color:var(--bg);font:600 13px/1.3 var(--font,sans-serif);text-align:center;display:none';
  aviso.setAttribute('role','status');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,0.05,80);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8d9996,1.0));
  scene.add(new THREE.AmbientLight(0xffffff,0.35));
  const sol=new THREE.DirectionalLight(0xffffff,1.25);sol.position.set(-2,4,3);scene.add(sol);
  const grupo=new THREE.Group(),grupoCotas=new THREE.Group();scene.add(grupo,grupoCotas);
  let grade=null;

  const alvo=new THREE.Vector3(),est={az:-0.6,pol:1.0,dist:3};
  const opt={cotas:true,textura:'liso'};
  let modelo=null,quadro=[],raioQ=1,dMin=0.3,dMax=20,zoomManual=false,pedido=0,perdido=false,aoPerder=null,aoFalhar=null,aoRecuperar=null,tRecup=0;
  let ladoCotas={x:'esq',z:'frente'},rotulos=[],listaCotas=[];
  const texturas={};
  let extPerdaCache=null;                                        // só para testes: depois de perdido, getExtension devolve nulo
  const extPerda=()=>extPerdaCache||(extPerdaCache=renderer.getContext().getExtension('WEBGL_lose_context'));

  /* ---------- desenho sob demanda ---------- */
  const render=()=>{pedido=0;if(perdido)return;renderer.render(scene,camera);posicionarRotulos()};
  const pedir=()=>{if(!pedido)pedido=requestAnimationFrame(render)};

  /* ---------- câmera: ângulos, base própria (vista de cima e de frente exatas) e enquadramento ---------- */
  function base(az,pol){
    const dir=new THREE.Vector3(Math.sin(pol)*Math.sin(az),Math.cos(pol),Math.sin(pol)*Math.cos(az));   // do alvo para a câmera
    const dir_r=new THREE.Vector3(Math.cos(az),0,-Math.sin(az));                                          // direita na tela (só depende de az)
    const cima=new THREE.Vector3().crossVectors(dir,dir_r);
    return {dir,r:dir_r,u:cima};
  }
  function posicionar(){
    est.pol=Math.min(Math.max(est.pol,0),Math.PI/2);            // de cima (0) até de frente (π/2); sem olhar por baixo
    est.dist=Math.min(Math.max(est.dist,dMin),dMax);
    const b=base(est.az,est.pol);
    camera.position.copy(alvo).addScaledVector(b.dir,est.dist);
    camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.r,b.u,b.dir));
    camera.updateMatrixWorld();
    atualizarLado();pedir();
  }
  /* menor distância em que todos os pontos do quadro (peça + cotas) cabem, com folga para os textos */
  function distIdeal(az,pol){
    if(!quadro.length)return est.dist;
    const b=base(az,pol),tv=Math.tan(camera.fov*Math.PI/360)*0.86,th=tv*camera.aspect;
    let d=0;
    const v=new THREE.Vector3();
    quadro.forEach(p=>{v.copy(p).sub(alvo);const xr=v.dot(b.r),yu=v.dot(b.u),zf=-v.dot(b.dir);
      d=Math.max(d,Math.abs(xr)/th-zf,Math.abs(yu)/tv-zf)});
    return Math.max(d,dMin);
  }
  function enquadrar(){zoomManual=false;est.dist=distIdeal(est.az,est.pol);posicionar()}
  function vista(nome){
    if(nome==='topo'){est.az=0;est.pol=0}
    else if(nome==='frente'){est.az=0;est.pol=Math.PI/2}
    else{est.az=-0.6;est.pol=1.0}
    enquadrar();
  }
  /* depois de mudar tamanho do container ou do modelo: nunca deixa a peça cortada */
  function garantirVisivel(){
    const ideal=distIdeal(est.az,est.pol);
    if(!zoomManual||est.dist<ideal)est.dist=ideal;
    posicionar();
  }

  /* toque e mouse: 1 ponteiro gira, 2 ponteiros aproximam, roda do mouse aproxima */
  const ptr=new Map();let d0=0;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptr.size===2){const [a,b]=[...ptr.values()];d0=Math.hypot(a.x-b.x,a.y-b.y)}canvas.style.cursor='grabbing'});
  const solta=e=>{ptr.delete(e.pointerId);d0=0;if(!ptr.size)canvas.style.cursor='grab'};
  canvas.addEventListener('pointerup',solta);canvas.addEventListener('pointercancel',solta);
  canvas.addEventListener('pointermove',e=>{
    const p=ptr.get(e.pointerId);if(!p)return;
    if(ptr.size===1){est.az-=(e.clientX-p.x)*0.008;est.pol-=(e.clientY-p.y)*0.008;p.x=e.clientX;p.y=e.clientY}
    else if(ptr.size===2){
      p.x=e.clientX;p.y=e.clientY;const [a,b]=[...ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d0>0&&d>0){est.dist*=d0/d;zoomManual=true}d0=d;
    }
    posicionar();
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();est.dist*=Math.exp(e.deltaY*0.0012);zoomManual=true;posicionar()},{passive:false});

  /* ---------- contexto WebGL: tenta recuperar antes de desistir ---------- */
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();perdido=true;mostrarAviso('O aparelho pausou o 3D. Tentando recuperar…');
    aoPerder&&aoPerder();
    clearTimeout(tRecup);tRecup=setTimeout(()=>{if(perdido){mostrarAviso('');aoFalhar&&aoFalhar()}},4000);
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    perdido=false;clearTimeout(tRecup);mostrarAviso('');
    Object.values(texturas).forEach(t=>{t.needsUpdate=true});
    aoRecuperar&&aoRecuperar();pedir();
  });
  function mostrarAviso(t){aviso.textContent=t;aviso.style.display=t?'block':'none'}

  /* ---------- tamanho do container ---------- */
  function ajustarTamanho(){
    const c=canvas.parentElement;if(!c)return;
    const w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    if(modelo)garantirVisivel();else pedir();
  }
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(ajustarTamanho):null;

  /* ---------- limpeza: libera geometria e material antigos (inclui os contornos filhos) ---------- */
  function liberar(g){
    g.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];
      ms.forEach(m=>m.dispose());
    });
    g.clear();
  }
  function cssVar(nome,fallback){
    const v=getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    try{return new THREE.Color(v||fallback)}catch(e){return new THREE.Color(fallback)}
  }
  function material(kind){
    const nome=opt.textura;
    if(nome==='liso')return new THREE.MeshLambertMaterial({color:LISO[kind]||LISO.tampo});
    const tx=texturas[nome]||(texturas[nome]=textura(nome));
    return new THREE.MeshLambertMaterial({color:TINTA[kind]||0xffffff,map:tx});
  }

  /* ---------- construção da cena a partir do modelo ---------- */
  function geometria(s){
    if(s.furos&&s.furos.length){                              // abertura real: sólido extrudado com furo
      const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(s.sx*CM,0);sh.lineTo(s.sx*CM,-s.sz*CM);sh.lineTo(0,-s.sz*CM);sh.closePath();
      s.furos.forEach(f=>{
        const x0=(f.x-s.x)*CM,x1=(f.x+f.w-s.x)*CM,z0=(f.z-s.z)*CM,z1=(f.z+f.d-s.z)*CM,h=new THREE.Path();
        h.moveTo(x0,-z0);h.lineTo(x0,-z1);h.lineTo(x1,-z1);h.lineTo(x1,-z0);h.closePath();sh.holes.push(h);
      });
      const g=new THREE.ExtrudeGeometry(sh,{depth:s.sy*CM,bevelEnabled:false});
      g.rotateX(-Math.PI/2);                                  // (x, -z, espessura) -> (x, espessura, z)
      g.translate((s.x)*CM,s.y*CM,s.z*CM);
      if(opt.textura!=='liso'){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/TILE,uv.getY(i)/TILE);uv.needsUpdate=true}
      return {g,extrudado:true};
    }
    const g=new THREE.BoxGeometry(s.sx*CM,s.sy*CM,s.sz*CM);
    if(opt.textura!=='liso')escalarUV(g,s.sx,s.sy,s.sz);
    return {g,extrudado:false};
  }
  function construir(){
    liberar(grupo);liberar(grupoCotas);rotulos.forEach(r=>r.el.remove());rotulos=[];
    if(grade){scene.remove(grade);grade.geometry.dispose();grade.material.dispose();grade=null}
    if(!modelo||modelo.vazio){quadro=[];pedir();return}
    const borda=cssVar('--fg','#15191A');
    const emenda=cssVar('--emenda','#d9480f'),dimCor=cssVar('--dim','#1d5fd1');
    modelo.solids.forEach(s=>{
      const {g,extrudado}=geometria(s);
      const m=new THREE.Mesh(g,material(s.kind));
      if(!extrudado)m.position.set((s.x+s.sx/2)*CM,(s.y+s.sy/2)*CM,(s.z+s.sz/2)*CM);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:borda,transparent:true,opacity:0.5})));
      grupo.add(m);
    });
    /* emendas do plano de corte: contorno do corte em laranja, um pouco para fora para não brigar com a face */
    modelo.emendas.forEach(e=>{
      const c=e.pts.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4,a[2]+p[2]/4],[0,0,0]),pts=[];
      e.pts.forEach(p=>{const q=p.map((v,i)=>v+Math.sign(v-c[i])*0.03);pts.push(new THREE.Vector3(q[0]*CM,q[1]*CM,q[2]*CM))});
      grupo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:emenda})));
    });
    const [a,b]=[modelo.bbox.min,modelo.bbox.max];
    alvo.set((a[0]+b[0])/2*CM,(a[1]+b[1])/2*CM,(a[2]+b[2])/2*CM);
    montarGrade(a,b);
    montarCotas(dimCor);
    montarQuadro(a,b);
    pedir();
  }

  /* grade proporcional: espaçamento "redondo" (10/20/50/100/200 cm) com no máximo ~12 divisões na maior dimensão */
  function montarGrade(a,b){
    const maior=Math.max(b[0]-a[0],b[2]-a[2]),esp=[10,20,50,100,200,500].find(e=>maior/e<=12)||500;
    const tam=Math.ceil(maior*1.5/esp)*esp,n=Math.max(2,Math.round(tam/esp));
    grade=new THREE.GridHelper(tam*CM,n,0x9aa5a2,0xbcc5c2);
    grade.material.transparent=true;grade.material.opacity=0.35;grade.material.depthWrite=false;
    grade.position.set(alvo.x,a[1]*CM-0.0004,alvo.z);scene.add(grade);
    gradeCm=esp;
  }
  let gradeCm=0;

  /* cotas: linha de cota deslocada, linhas de extensão com pequena folga e traço oblíquo nas pontas */
  function montarCotas(cor){
    const pos=[],V=(p,k=1)=>[p[0]*CM*k,p[1]*CM*k,p[2]*CM*k];
    const seg=(p,q)=>{pos.push(p[0]*CM,p[1]*CM,p[2]*CM,q[0]*CM,q[1]*CM,q[2]*CM)};
    const add=(p,q,k)=>[p[0]+q[0]*k,p[1]+q[1]*k,p[2]+q[2]*k];
    listaCotas=Model3D_cotas(modelo,ladoCotas);
    rotulos=[];
    listaCotas.forEach(c=>{
      if(c.tipo==='cota'){
        const u=[c.p2[0]-c.p1[0],c.p2[1]-c.p1[1],c.p2[2]-c.p1[2]],l=Math.hypot(...u);u[0]/=l;u[1]/=l;u[2]/=l;
        const q1=add(c.p1,c.dir,c.off),q2=add(c.p2,c.dir,c.off),folga=Math.min(1,c.off*0.15),alem=Math.min(2,c.off*0.3);
        seg(q1,q2);                                                       // linha de cota
        seg(add(c.p1,c.dir,folga),add(c.p1,c.dir,c.off+alem));            // extensões
        seg(add(c.p2,c.dir,folga),add(c.p2,c.dir,c.off+alem));
        const tk=Math.min(1.6,Math.max(0.6,c.off*0.2)),t=[u[0]+c.dir[0],u[1]+c.dir[1],u[2]+c.dir[2]],n=Math.hypot(...t)||1;
        [q1,q2].forEach(q=>seg(add(q,t,-tk/n),add(q,t,tk/n)));            // traços oblíquos
        rotulos.push({txt:c.texto,pos:new THREE.Vector3(...V(add(q1,[q2[0]-q1[0],q2[1]-q1[1],q2[2]-q1[2]],0.5))),prio:c.prio,cat:c.categoria,
          a:new THREE.Vector3(...V(q1)),b:new THREE.Vector3(...V(q2))});
      }else rotulos.push({txt:c.texto,pos:new THREE.Vector3(...V(c.pos)),prio:c.prio,cat:'rotulo'});
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    grupoCotas.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:cor,depthTest:false,transparent:true,opacity:0.95})));
    grupoCotas.renderOrder=10;grupoCotas.visible=opt.cotas;
    rotulos.forEach(r=>{
      const el=document.createElement('span');el.textContent=r.txt;
      el.style.cssText='position:absolute;left:0;top:0;white-space:nowrap;padding:2px 5px;border-radius:6px;border:1px solid var(--dim,#1d5fd1);color:var(--dim,#1d5fd1);background:color-mix(in srgb,var(--surface,#fff) 88%,transparent)';
      if(r.cat==='rotulo')el.style.borderStyle='dashed';
      camada.appendChild(el);r.el=el;r.w=0;r.h=0;
    });
    camada.style.display=opt.cotas?'block':'none';
    rotulos.forEach(r=>{r.w=r.el.offsetWidth;r.h=r.el.offsetHeight});
  }
  /* Model3D.cotas é global (model3d.js); o visualizador recalcula quando o lado preferido muda */
  const Model3D_cotas=(m,l)=>window.Model3D.cotas(m,l);

  /* pontos que precisam caber na tela: caixa da peça + extremos das cotas */
  function montarQuadro(a,b){
    quadro=[];
    [a[0],b[0]].forEach(x=>[a[1],b[1]].forEach(y=>[a[2],b[2]].forEach(z=>quadro.push(new THREE.Vector3(x*CM,y*CM,z*CM)))));
    if(opt.cotas)listaCotas.forEach(c=>{
      if(c.tipo!=='cota')return;
      [c.p1,c.p2].forEach(p=>quadro.push(new THREE.Vector3((p[0]+c.dir[0]*c.off*1.4)*CM,(p[1]+c.dir[1]*c.off*1.4)*CM,(p[2]+c.dir[2]*c.off*1.4)*CM)));
    });
    raioQ=Math.max(0.25,...quadro.map(p=>p.distanceTo(alvo)));
    dMin=Math.max(0.25,raioQ*0.45);dMax=raioQ*7;
  }

  /* lado preferido das cotas: o que está virado para a câmera (só muda quando a câmera troca de lado) */
  function atualizarLado(){
    if(!modelo||!opt.cotas)return;
    const n={x:camera.position.x<alvo.x?'esq':'dir',z:camera.position.z>alvo.z?'frente':'fundo'};
    if(est.pol<0.2){n.x=ladoCotas.x;n.z=ladoCotas.z}                // de cima: a câmera está em cima da peça, não troca de lado
    if(n.x!==ladoCotas.x||n.z!==ladoCotas.z){ladoCotas=n;reconstruirCotas()}
  }
  function reconstruirCotas(){
    liberar(grupoCotas);rotulos.forEach(r=>r.el.remove());
    montarCotas(cssVar('--dim','#1d5fd1'));
    const [a,b]=[modelo.bbox.min,modelo.bbox.max];montarQuadro(a,b);
  }

  /* textos das cotas em tela: projeção, sem sobrepor e dentro do canvas.
     - cota cuja linha vira quase um ponto na tela (vista "de lado") não tem o que ler: o texto some;
     - sem espaço livre, some o texto de menor prioridade (comprimento > altura > espessura > recortes). */
  function posicionarRotulos(){
    if(!opt.cotas||!rotulos.length)return;
    const W=canvas.clientWidth,H=canvas.clientHeight,usados=[],v=new THREE.Vector3(),pa=new THREE.Vector3(),pb=new THREE.Vector3();
    [...rotulos].sort((p,q)=>p.prio-q.prio).forEach(r=>{
      v.copy(r.pos).project(camera);
      let esconder=v.z>1||v.z<-1;
      if(!esconder&&r.a){
        pa.copy(r.a).project(camera);pb.copy(r.b).project(camera);
        const px=Math.hypot((pa.x-pb.x)*W/2,(pa.y-pb.y)*H/2);
        // some o que está de lado: linha quase um ponto na tela, ou quase paralela ao olhar (ex.: profundidade na vista de frente)
        const olhar=pa.copy(r.pos).sub(camera.position).normalize(),linha=pb.copy(r.b).sub(r.a).normalize();
        esconder=px<({espessura:1.5,altura:3}[r.cat]??10)||Math.abs(olhar.dot(linha))>0.9;
      }
      if(esconder){r.el.style.display='none';return}
      r.el.style.display='';
      if(!r.w){r.w=r.el.offsetWidth;r.h=r.el.offsetHeight}
      const x0=(v.x*0.5+0.5)*W,y0=(-v.y*0.5+0.5)*H,hh=r.h+3,ww=r.w*0.55;
      const tent=[[0,0],[0,hh],[0,-hh],[ww,0],[-ww,0],[ww,hh],[-ww,hh],[ww,-hh],[-ww,-hh],[0,2*hh],[0,-2*hh],[ww*2,0],[-ww*2,0],[0,3*hh],[0,-3*hh]];
      let achou=null;
      for(const [dx,dy] of tent){
        const cx=Math.min(Math.max(x0+dx,r.w/2+2),W-r.w/2-2),cy=Math.min(Math.max(y0+dy,r.h/2+2),H-r.h/2-2);
        if(!usados.some(u=>Math.abs(u.x-cx)<(u.w+r.w)/2&&Math.abs(u.y-cy)<(u.h+r.h)/2)){achou={x:cx,y:cy};break}
      }
      if(!achou){r.el.style.display='none';return}
      usados.push({x:achou.x,y:achou.y,w:r.w,h:r.h});
      r.el.style.transform='translate('+(achou.x-r.w/2).toFixed(1)+'px,'+(achou.y-r.h/2).toFixed(1)+'px)';
    });
  }

  return {
    anexar(container){
      if(canvas.parentElement!==container)container.appendChild(canvas);
      if(camada.parentElement!==container)container.appendChild(camada);
      if(aviso.parentElement!==container)container.appendChild(aviso);
      if(ro){ro.disconnect();ro.observe(container)}
      ajustarTamanho();
    },
    soltar(){if(ro)ro.disconnect();canvas.remove();camada.remove();aviso.remove()},
    aoPerderContexto(fn){aoPerder=fn},
    aoFalharContexto(fn){aoFalhar=fn},
    aoRecuperarContexto(fn){aoRecuperar=fn},
    /* modelo: resultado de Model3D.buildModel (cm). mantem=true conserva o ângulo (e o zoom manual) da câmera. */
    definirModelo(m,mantem){
      const novo=!mantem||!modelo;
      modelo=m;
      construir();
      if(novo){zoomManual=false;est.dist=distIdeal(est.az,est.pol);posicionar()}else garantirVisivel();
    },
    /* opções visuais: {cotas:boolean, textura:'liso'|'granito'|'marmore'|'quartzo'} */
    opcoes(o){
      const mudouTx=o.textura!=null&&o.textura!==opt.textura,mudouCotas=o.cotas!=null&&o.cotas!==opt.cotas;
      if(o.cotas!=null)opt.cotas=!!o.cotas;
      if(o.textura!=null)opt.textura=o.textura;
      if(mudouTx||mudouCotas){construir();garantirVisivel()}
    },
    enquadrar,vista,
    gradeCm:()=>gradeCm,
    /* só para testes e diagnóstico */
    estado(){
      let fora=0;const v=new THREE.Vector3();
      (modelo?quadro:[]).forEach(p=>{v.copy(p).project(camera);if(Math.abs(v.x)>1.001||Math.abs(v.y)>1.001||v.z>1)fora++});
      return {objetos:grupo.children.length,az:est.az,pol:est.pol,dist:est.dist,dMin,dMax,perdido,zoomManual,ladoCotas:{...ladoCotas},
        rotulos:rotulos.map(r=>({txt:r.txt,visivel:r.el.style.display!=='none'&&opt.cotas})),cotasVisiveis:opt.cotas&&grupoCotas.visible,
        foraDoQuadro:fora,grade:gradeCm,textura:opt.textura,memoria:{...renderer.info.memory},
        canvas:{w:canvas.clientWidth,h:canvas.clientHeight}};
    },
    perderContextoParaTeste(){const e=extPerda();e&&e.loseContext();return !!e},
    restaurarContextoParaTeste(){const e=extPerda();e&&e.restoreContext();return !!e}
  };
}
