/* Marmofácil: visualizador 3D técnico (Three.js). Carregado só quando o usuário abre o 3D.
   Só desenha; não calcula nada: recebe o modelo de model3d.js (cm) e mostra em metros.
   - Um único canvas/contexto WebGL é reaproveitado: o app refaz o HTML da tela a cada mudança,
     então canvas e camadas de texto são re-anexados ao novo container em vez de recriados.
   - Desenha só quando algo muda (sem animação contínua) e libera geometrias e materiais antigos.
   - Cotas: linhas no 3D + textos em HTML por cima (nítidos em qualquer zoom, sem sobrepor). */
import * as THREE from './vendor/three.module.min.js';

const CM=0.01;
const TILE=0.5;
const TILE_FOTO=[1.2,0.7];                       // foto de pedra: metros por repetição (largura, altura); a escala real da chapa não é conhecida                                   // metros por repetição da textura
/* cor do material liso e tinta (multiplica a textura) por tipo de sólido */
const LISO={tampo:0xd8dfdc,degrau:0xd8dfdc,saia:0xa3b3ae,roda:0xc3cfcb,espelho:0xb6c3bf,painel:0xcbd5d1,parede:0xe6e2da,piso:0xc9c2b4,teto:0xf2f2f2,vidro:0x8fc4e6};   // parede, piso, teto e vidro: ambientes (motor/ambiente.js)
const TINTA={tampo:0xffffff,degrau:0xffffff,saia:0xb4bdba,roda:0xdde3e0,espelho:0xc9d0cd,painel:0xeef1ef,parede:0xffffff,piso:0xffffff,teto:0xffffff,vidro:0xffffff};

/* 'gpu' (aceleração de hardware), 'software' (funciona, mas pode ficar lento) ou null (sem WebGL) */
export function webglModo(){
  const tenta=opts=>{
    try{
      const c=document.createElement('canvas'),gl=c.getContext('webgl2',opts)||c.getContext('webgl',opts);
      if(!gl)return false;
      const e=gl.getExtension('WEBGL_lose_context');e&&e.loseContext();            // não deixa o contexto de teste ocupando um lugar
      return true;
    }catch(e){return false}
  };
  if(tenta({failIfMajorPerformanceCaveat:true}))return 'gpu';
  return tenta({})?'software':null;
}
export const webglDisponivel=()=>webglModo()!==null;

/* ---- matemática da câmera: função pura (arrays), testada em Node sem WebGL ----
   az = giro em volta do eixo y; pol = 0 (de cima) até π/2 (de frente). `dir` aponta do alvo para a câmera,
   `r` é a direita da tela e `u` o cima da tela. Só dependem de az, então não há degeneração em pol = 0 nem π/2. */
const cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const pesc=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function baseCamera(az,pol){
  const dir=[Math.sin(pol)*Math.sin(az),Math.cos(pol),Math.sin(pol)*Math.cos(az)],r=[Math.cos(az),0,-Math.sin(az)];
  return {dir,r,u:cruz(dir,r)};
}
/* menor distância da câmera ao alvo em que todos os pontos cabem na tela (com folga para textos e bordas) */
export function distanciaIdeal({pontos,alvo,az,pol,fov,aspecto,min=0,folga=0.86}){
  const b=baseCamera(az,pol),tv=Math.tan(fov*Math.PI/360)*folga,th=tv*aspecto;let d=0;
  pontos.forEach(p=>{
    const v=[p[0]-alvo[0],p[1]-alvo[1],p[2]-alvo[2]],xr=pesc(v,b.r),yu=pesc(v,b.u),zf=-pesc(v,b.dir);
    d=Math.max(d,Math.abs(xr)/th-zf,Math.abs(yu)/tv-zf);
  });
  return Math.max(d,min);
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
function escalarUV(geo,sx,sy,sz,tu=TILE,tv=TILE){
  const uv=geo.attributes.uv,tam=[[sz,sy],[sz,sy],[sx,sz],[sx,sz],[sx,sy],[sx,sy]];   // +x −x +y −y +z −z
  for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*tam[f][0]*CM/tu,uv.getY(i)*tam[f][1]*CM/tv)}
  uv.needsUpdate=true;
}

/* deps.cotas = Model3D.cotas (injetada pelo app: o visualizador não depende de variável global) */
export function criarVisualizador(deps={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  const canvas=renderer.domElement;
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';     // pan-y: arrastar na vertical com 1 dedo rola a página
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Modelo 3D da peça com cotas em centímetros. Arraste para girar e use dois dedos para aproximar.');
  const camada=document.createElement('div');                   // textos das cotas e avisos, por cima do canvas
  camada.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;font:600 12px/1.1 var(--mono,monospace)';
  const aviso=document.createElement('div');
  aviso.style.cssText='position:absolute;left:8px;right:8px;top:8px;padding:8px 10px;border-radius:8px;background:var(--fg);color:var(--bg);font:600 13px/1.3 var(--font,sans-serif);text-align:center;display:none';
  aviso.setAttribute('role','status');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,0.05,80);
  const hemi=new THREE.HemisphereLight(0xffffff,0x8d9996,1.0),amb=new THREE.AmbientLight(0xffffff,0.35);scene.add(hemi,amb);
  const sol=new THREE.DirectionalLight(0xffffff,1.25);sol.position.set(-2,4,3);scene.add(sol);scene.add(sol.target);
  sol.shadow.mapSize.set(1024,1024);sol.shadow.bias=-0.0006;sol.shadow.normalBias=0.004;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;                 // sombra suave, recalculada só quando a cena muda
  let ambiente=null,pmrem=null,chao=null;
  const grupo=new THREE.Group(),grupoCotas=new THREE.Group();scene.add(grupo,grupoCotas);
  let grade=null;

  const alvo=new THREE.Vector3(),est={az:-0.6,pol:1.0,dist:3};
  const opt={cotas:true,textura:'liso',equip:true,cor:null,foto:null,brilho:deps.brilho!==false};   // brilho: pedra polida (material PBR, reflexo e sombra suave); o app desliga em aparelho sem aceleração      // cor: tom da pedra (0xRRGGBB) vindo do cadastro; null = padrão
  let modelo=null,quadro=[],raioQ=1,dMin=0.3,dMax=20,zoomManual=false,pedido=0,perdido=false,aoPerder=null,aoFalhar=null,aoRecuperar=null,tRecup=0;
  let ladoCotas={x:'esq',z:'frente'},rotulos=[],listaCotas=[];
  const texturas={};
  const mq=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;
  const aoMudarTema=()=>{if(modelo){construir();pedir()}};            // cores de contorno, cotas e emendas seguem o tema
  if(mq&&mq.addEventListener)mq.addEventListener('change',aoMudarTema);
  let dprAtual=0,dprForca=0;                                      // dprForca: densidade de pixels pedida só para uma captura
  let extPerdaCache=null;                                        // só para testes: depois de perdido, getExtension devolve nulo
  const extPerda=()=>extPerdaCache||(extPerdaCache=renderer.getContext().getExtension('WEBGL_lose_context'));

  /* ---------- desenho sob demanda ---------- */
  /* se o aparelho derrubar o contexto no meio de um quadro, o Three.js lança erro de shader antes de o evento de perda chegar: isso não é falha do app (a recuperação é tratada no evento) */
  const desenhar=()=>{try{renderer.render(scene,camera);return true}catch(e){if(renderer.getContext().isContextLost())return false;throw e}};
  const render=()=>{pedido=0;if(perdido)return;if(!desenhar())return;posicionarRotulos();posicionarAlcas()};
  const pedir=()=>{if(!pedido)pedido=requestAnimationFrame(render)};

  /* ---------- câmera: ângulos, base própria (vista de cima e de frente exatas) e enquadramento ---------- */
  function base(az,pol){
    const b=baseCamera(az,pol);
    return {dir:new THREE.Vector3(...b.dir),r:new THREE.Vector3(...b.r),u:new THREE.Vector3(...b.u)};
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
  function distIdeal(az,pol){
    if(!quadro.length)return est.dist;
    return distanciaIdeal({pontos:quadro.map(p=>[p.x,p.y,p.z]),alvo:[alvo.x,alvo.y,alvo.z],az,pol,fov:camera.fov,aspecto:camera.aspect,min:dMin,folga:edicao.ativo?0.8:0.86});   // no editor (0,8) sobra espaço para a coluna de ferramentas e o cartão de resumo
  }
  function enquadrar(){paraInercia();zoomManual=false;est.dist=distIdeal(est.az,est.pol);posicionar()}
  function vista(nome){
    paraInercia();
    if(nome==='topo'){est.az=0;est.pol=0}
    else if(nome==='frente'){est.az=0;est.pol=Math.PI/2}
    else if(nome==='iso'){est.az=-Math.PI/4;est.pol=0.96}          // isométrica: 45° de lado e ~55° de altura, a vista "de catálogo"
    else{est.az=-0.6;est.pol=1.0}
    enquadrar();
  }
  /* depois de mudar o tamanho do container ou do modelo: sem zoom manual, reenquadra a peça inteira;
     com zoom manual, respeita o que o usuário escolheu (só aplica os limites). O botão Enquadrar sempre volta ao quadro. */
  function garantirVisivel(){
    if(arrastando){posicionar();return}                            // durante o arrasto o quadro não muda (o dedo e a escala ficam estáveis)
    if(!zoomManual)est.dist=distIdeal(est.az,est.pol);
    posicionar();
  }

  /* toque e mouse: 1 ponteiro gira, 2 ponteiros aproximam, roda do mouse aproxima */
  const ptr=new Map();let d0=0;
  /* inércia (damping): ao soltar o dedo depois de um arrasto rápido, o giro continua e para suave */
  const vel={az:0,pol:0};let tMov=0,rafIn=0;
  const paraInercia=()=>{if(rafIn)cancelAnimationFrame(rafIn);rafIn=0;tIn=0;vel.az=vel.pol=0};
  let tIn=0;                                                       // por tempo, não por quadro: aparelho lento freia igual ao rápido
  function inercia(t){rafIn=0;const k=tIn?Math.min(6,(t-tIn)/16.7):1;tIn=t;est.az+=vel.az*k;est.pol+=vel.pol*k;const f=Math.pow(0.9,k);vel.az*=f;vel.pol*=f;posicionar();if(Math.abs(vel.az)+Math.abs(vel.pol)>0.0004)rafIn=requestAnimationFrame(inercia);else tIn=0}
  canvas.addEventListener('pointerdown',e=>{paraInercia();canvas.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptr.size===2){const [a,b]=[...ptr.values()];d0=Math.hypot(a.x-b.x,a.y-b.y)}canvas.style.cursor='grabbing'});
  const solta=e=>{const era=ptr.size;if(!era)return;ptr.delete(e.pointerId);d0=0;if(!ptr.size){canvas.style.cursor='grab';
    if(era===1&&e.type==='pointerup'&&performance.now()-tMov<90&&Math.abs(vel.az)+Math.abs(vel.pol)>0.002){vel.az*=0.5;vel.pol*=0.5;rafIn=requestAnimationFrame(inercia)}else vel.az=vel.pol=0}};
  canvas.addEventListener('pointerup',solta);canvas.addEventListener('pointercancel',solta);canvas.addEventListener('lostpointercapture',solta);
  canvas.addEventListener('pointermove',e=>{
    const p=ptr.get(e.pointerId);if(!p)return;
    if(ptr.size===1){
      const dAz=-(e.clientX-p.x)*0.008,dPol=e.pointerType==='mouse'?-(e.clientY-p.y)*0.008:0;
      est.az+=dAz;est.pol+=dPol;vel.az=dAz;vel.pol=dPol;tMov=performance.now();    // com o mouse gira nos dois eixos; no toque a vertical é da página
      p.x=e.clientX;p.y=e.clientY;
    }else if(ptr.size===2){                                         // dois dedos: aproxima/afasta e inclina juntos
      const antes=[...ptr.values()],my0=(antes[0].y+antes[1].y)/2;
      p.x=e.clientX;p.y=e.clientY;
      const [a,b]=[...ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y),my1=(a.y+b.y)/2;
      if(d0>0&&d>0){est.dist*=d0/d;zoomManual=true}d0=d;
      est.pol-=(my1-my0)*0.008;
    }
    posicionar();
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();paraInercia();est.dist*=Math.exp(e.deltaY*0.0012);zoomManual=true;posicionar()},{passive:false});

  /* ---------- contexto WebGL: tenta recuperar antes de desistir ---------- */
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();perdido=true;camada.style.visibility='hidden';mostrarAviso('O aparelho pausou o 3D. Tentando recuperar…');
    aoPerder&&aoPerder();
    clearTimeout(tRecup);tRecup=setTimeout(()=>{if(perdido){mostrarAviso('');aoFalhar&&aoFalhar(canvas.isConnected)}},4000);   // true = o 3D estava na tela
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    perdido=false;clearTimeout(tRecup);camada.style.visibility='visible';mostrarAviso('');
    Object.values(texturas).forEach(t=>{if(t)t.needsUpdate=true});
    ambiente=null;pmrem=null;if(modelo)construir();                       // o ambiente de reflexo (alvo de renderização) se perde junto com o contexto: refaz
    aoRecuperar&&aoRecuperar();pedir();
  });
  function mostrarAviso(t){aviso.textContent=t;aviso.style.display=t?'block':'none'}


  /* ---------- alças de edição: arrastar a ponta de uma cota muda a medida; recorte: mover (✥) e redimensionar (canto).
     O visualizador só mede o gesto e pede a mudança ao app (edicao.fn); o app valida e devolve o modelo novo. ---------- */
  const camadaEdit=document.createElement('div');
  camadaEdit.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none';
  let edicao={ativo:false,fn:null},arrastando=null,pend=0,pendAcao=null;
  const alcas=new Map();
  const tela=p=>{const v=p.clone().project(camera);return [(v.x*0.5+0.5)*canvas.clientWidth,(-v.y*0.5+0.5)*canvas.clientHeight,v.z]};
  function criarAlca(a){
    const el=document.createElement('div'),mover=a.tipo==='mover'||a.tipo==='peca',cota=a.tipo==='cota';
    if(a.tipo==='chip'){                                              // nome da peça na cena: tocar seleciona
      el.style.cssText='position:absolute;left:0;top:0;display:none;pointer-events:auto;cursor:pointer;z-index:4;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;padding:6px 10px;border-radius:99px;border:1px solid var(--line,#ccd);font:700 12px/1.1 var(--font,sans-serif);box-shadow:0 1px 4px rgba(0,0,0,.2)';
      el.setAttribute('role','button');
      el.addEventListener('click',()=>{const h=alcas.get(a.chave);if(h&&!h.a.sel&&edicao.fn)edicao.fn({tipo:'selecionar',indice:h.a.indice})});
      camadaEdit.appendChild(el);return {a,el};
    }
    el.style.cssText='position:absolute;left:0;top:0;width:44px;height:44px;display:none;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;cursor:grab;z-index:4';
    const d=document.createElement('span'),bg=cota?'var(--accent,#0e6a5b)':a.tipo==='peca'?'var(--fg,#15191a)':'var(--warn,#a8620b)';
    d.style.cssText='display:flex;align-items:center;justify-content:center;color:#fff;font:700 15px/1 sans-serif;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);background:'+bg+';'+
      (cota?'width:22px;height:22px;border-radius:50%':mover?'width:30px;height:30px;border-radius:50%':'width:22px;height:22px;border-radius:5px');
    d.className='alca-dot';if(mover)d.textContent='✥';
    el.appendChild(d);el.setAttribute('role','button');
    el.setAttribute('aria-label',cota?'Arrastar para mudar '+a.rot:a.tipo==='peca'?'Arrastar para mover a peça':mover?'Arrastar para mover o recorte':'Arrastar para mudar o tamanho do recorte');
    el.addEventListener('pointerdown',e=>iniciarArrasto(alcas.get(a.chave),e));
    el.addEventListener('pointermove',moverArrasto);
    el.addEventListener('pointerup',fimArrasto);el.addEventListener('pointercancel',fimArrasto);
    camadaEdit.appendChild(el);
    return {a,el};
  }
  function montarAlcas(){
    const vivas=new Set();
    const def=a=>{vivas.add(a.chave);let h=alcas.get(a.chave);if(!h){h=criarAlca(a);alcas.set(a.chave,h)}h.a=a};
    if(edicao.ativo&&modelo&&!modelo.vazio){
      listaCotas.forEach(c=>{
        if(c.tipo!=='cota'||!c.campo)return;
        const u=new THREE.Vector3(c.p2[0]-c.p1[0],c.p2[1]-c.p1[1],c.p2[2]-c.p1[2]).normalize();
        def({chave:'c:'+c.campo,tipo:'cota',campo:c.campo,valor:c.valor,rot:c.texto,u,
          pos:new THREE.Vector3((c.p2[0]+c.dir[0]*c.off)*CM,(c.p2[1]+c.dir[1]*c.off)*CM,(c.p2[2]+c.dir[2]*c.off)*CM)});
      });
      const t=modelo.espessura;
      if(modelo.alcaPeca){const r=modelo.alcaPeca;def({chave:'p',tipo:'peca',r:{x:r.x,z:r.z,w:r.w,d:r.d},pos:new THREE.Vector3(r.x*CM,t*CM,r.z*CM)})}      // canto de trás à esquerda (afastado na tela): longe das pontas das cotas e dos recortes
      const ps=(modelo.pecas||[]).filter(p=>!p.vazio);
      if(ps.length>1)ps.forEach(p=>def({chave:'n:'+p.indice,tipo:'chip',indice:p.indice,sel:p.sel,nome:p.nome,pos:new THREE.Vector3(p.pos[0]*CM,p.pos[1]*CM,p.pos[2]*CM)}));
      (modelo.recortes||[]).forEach(r=>{
        const base={indice:r.indice,r:{x:r.x,z:r.z,w:r.w,d:r.d}};
        def({...base,chave:'m:'+r.indice,tipo:'mover',pos:new THREE.Vector3((r.x+r.w/2)*CM,t*CM,(r.z+r.d/2)*CM)});
        def({...base,chave:'s:'+r.indice,tipo:'tamanho',pos:new THREE.Vector3((r.x+r.w)*CM,t*CM,(r.z+r.d)*CM)});
      });
    }
    alcas.forEach((h,k)=>{if(!vivas.has(k)&&!(arrastando&&arrastando.chave===k)){h.el.remove();alcas.delete(k)}});
  }
  function posicionarAlcas(){
    if(!alcas.size)return;
    const W=canvas.clientWidth,H=canvas.clientHeight,pos={};
    alcas.forEach(h=>{
      const a=h.a,[x,y,z]=tela(a.pos);let ok=z<=1&&z>=-1&&x>-10&&x<W+10&&y>-10&&y<H+10;
      if(ok&&a.tipo==='cota'){const q=tela(a.pos.clone().addScaledVector(a.u,10*CM));ok=Math.hypot(q[0]-x,q[1]-y)/10>=0.15}      // eixo apontando para o olho: sem como arrastar
      if(ok&&a.tipo!=='cota'&&a.tipo!=='chip')ok=est.pol<=1.2;                                                                                   // recorte: precisa ver a bancada de cima
      h.x=x-(a.tipo==='peca'?26:0);h.y=y-(a.tipo==='peca'?26:0);h.ok=ok;pos[a.chave]=h;
    });
    alcas.forEach(h=>{                                                // 
      if(h.a.tipo==='tamanho'&&h.ok){                                  // canto colado no ✥ (recorte pequeno na tela): o canto se afasta na diagonal para os dois ficarem tocáveis
        const m=pos['m:'+h.a.indice];
        if(m&&m.ok){let vx=h.x-m.x,vy=h.y-m.y;const n=Math.hypot(vx,vy);if(n<42){if(n<1){vx=1;vy=1}else{vx/=n;vy/=n}h.x=m.x+vx*42;h.y=m.y+vy*42}}
      }
      const vis=h.ok||(arrastando&&arrastando.chave===h.a.chave);
      h.el.style.display=vis?(h.a.tipo==='chip'?'block':'flex'):'none';
      if(vis&&h.a.tipo==='chip'){
        if(h.el.textContent!==h.a.nome)h.el.textContent=h.a.nome;
        h.el.style.background=h.a.sel?'var(--accent,#0e6a5b)':'var(--surface,#fff)';h.el.style.color=h.a.sel?'var(--accent-fg,#fff)':'var(--fg,#111)';
        h.el.style.transform='translate('+(h.x-h.el.offsetWidth/2).toFixed(1)+'px,'+(h.y-h.el.offsetHeight-6).toFixed(1)+'px)';
      }else if(vis)h.el.style.transform='translate('+(h.x-22).toFixed(1)+'px,'+(h.y-22).toFixed(1)+'px)';
    });
  }
  /* digitar a medida: clicar no valor da cota abre um campo; Enter grava (pelo mesmo caminho das alças: peça, preço e plano de corte recalculam), Esc cancela */
  let campoCota=null;
  function editarCota(r){
    if(!edicao.ativo||!r.campo||!edicao.fn||campoCota||arrastando)return;
    const b=r.el.getBoundingClientRect(),c=canvas.parentElement.getBoundingClientRect(),inp=document.createElement('input');
    inp.type='number';inp.inputMode='decimal';inp.step='1';inp.value=String(r.valor);inp.setAttribute('aria-label','Nova medida em centímetros');
    inp.style.cssText='position:absolute;left:'+Math.round(b.left-c.left+b.width/2-46)+'px;top:'+Math.round(b.top-c.top+b.height/2-20)+'px;width:92px;height:40px;z-index:7;pointer-events:auto;text-align:center;font:700 15px var(--mono,monospace);border:2px solid #60a5fa;border-radius:10px;background:#fff;color:#111;box-shadow:0 4px 14px rgba(0,0,0,.28)';
    camadaEdit.appendChild(inp);campoCota=inp;inp.focus();inp.select();
    let feito=false;
    const fechar=aplicar=>{
      if(feito)return;feito=true;
      const v=parseFloat(String(inp.value).replace(',','.'));inp.remove();campoCota=null;
      if(aplicar&&isFinite(v)&&Math.round(v)!==Math.round(r.valor)&&edicao.fn){
        const min=/^(saia|roda)H$|^ES$/.test(r.campo)?1:5;
        edicao.fn({tipo:'campo',campo:r.campo,valor:Math.min(1000,Math.max(min,Math.round(v)))});edicao.fn({tipo:'fim'});
      }
    };
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fechar(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fechar(false)}});
    inp.addEventListener('blur',()=>fechar(true));
  }
  function iniciarArrasto(h,e){
    if(!h||!edicao.ativo||arrastando)return;
    e.preventDefault();e.stopPropagation();
    try{h.el.setPointerCapture(e.pointerId)}catch(x){}
    const a=h.a,o=tela(a.pos),px=(v3)=>{const q=tela(a.pos.clone().addScaledVector(v3,10*CM));return [(q[0]-o[0])/10,(q[1]-o[1])/10]};
    const base=a.tipo==='cota'?{ex:px(a.u),v0:a.valor}:{ex:px(new THREE.Vector3(1,0,0)),ez:px(new THREE.Vector3(0,0,1)),r:{...a.r}};
    arrastando={chave:a.chave,tipo:a.tipo,campo:a.campo,indice:a.indice,x0:e.clientX,y0:e.clientY,base,pid:e.pointerId,ult:''};
    h.el.style.cursor='grabbing';
  }
  function acaoDoGesto(e){
    const g=arrastando,b=g.base,dx=e.clientX-g.x0,dy=e.clientY-g.y0,lim=(v,mn)=>Math.min(1000,Math.max(mn,Math.round(v)));
    if(g.tipo==='cota'){
      const n=b.ex[0]*b.ex[0]+b.ex[1]*b.ex[1];if(n<0.0225)return null;
      return {tipo:'campo',campo:g.campo,valor:lim(b.v0+(dx*b.ex[0]+dy*b.ex[1])/n,/^(saia|roda)H$|^ES$/.test(g.campo)?1:5)};
    }
    const det=b.ex[0]*b.ez[1]-b.ex[1]*b.ez[0];
    if(Math.abs(det)<0.2*Math.hypot(b.ex[0],b.ex[1])*Math.hypot(b.ez[0],b.ez[1])||Math.abs(det)<1e-4)return null;   // eixos quase paralelos na tela (vista rasante): sem como resolver
    const mx=(dx*b.ez[1]-dy*b.ez[0])/det,mz=(b.ex[0]*dy-b.ex[1]*dx)/det,r=b.r;       // gesto na tela -> deslocamento em cm no plano da bancada
    if(g.tipo==='peca')return {tipo:'peca',x:Math.round(b.r.x+mx),z:Math.round(b.r.z+mz)};
    return g.tipo==='mover'?{tipo:'recorte',indice:g.indice,x:Math.round(r.x+mx),z:Math.round(r.z+mz),w:r.w,d:r.d}
      :{tipo:'recorte',indice:g.indice,x:r.x,z:r.z,w:lim(r.w+mx,5),d:lim(r.d+mz,5)};
  }
  function aplicarPendente(){
    pend=0;const a=pendAcao;pendAcao=null;
    if(a&&edicao.fn){const k=JSON.stringify(a);if(k!==arrastando?.ult){if(arrastando)arrastando.ult=k;edicao.fn(a)}}
  }
  function moverArrasto(e){
    if(!arrastando||e.pointerId!==arrastando.pid)return;
    const a=acaoDoGesto(e);if(!a)return;
    pendAcao=a;if(!pend)pend=requestAnimationFrame(aplicarPendente);        // no máximo uma reconstrução por quadro
  }
  function fimArrasto(e){
    if(!arrastando||e.pointerId!==arrastando.pid)return;
    if(pend){cancelAnimationFrame(pend);aplicarPendente()}
    const h=alcas.get(arrastando.chave);if(h)h.el.style.cursor='grab';
    arrastando=null;
    if(edicao.fn)edicao.fn({tipo:'fim'});
    montarAlcas();if(modelo)garantirVisivel();pedir();
  }

  /* ---------- tamanho do container ---------- */
  function ajustarTamanho(){
    const c=canvas.parentElement;if(!c)return;
    const w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight);
    const dpr=dprForca||Math.min(window.devicePixelRatio||1,1.5);
    if(dpr!==dprAtual){renderer.setPixelRatio(dpr);dprAtual=dpr}
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
  /* material da pedra: PBR (rugosidade 0,3 e metal 0,05: pedra polida) quando o brilho está ligado; senão Lambert, mais leve */
  function mat(par){return opt.brilho?new THREE.MeshStandardMaterial({...par,roughness:0.3,metalness:0.05,envMapIntensity:0.3}):new THREE.MeshLambertMaterial(par)}
  /* reflexo suave: ambiente de estúdio feito na hora (sem arquivo): sala clara com duas luminárias grandes */
  function criarAmbiente(){
    if(ambiente)return ambiente;
    const es=new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(14,8,14),new THREE.MeshBasicMaterial({color:0x6b7572,side:THREE.BackSide})));
    const luz=(w,h,x,y,z,rx,ry,k)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(k,k,k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);es.add(m)};
    luz(3,2,0,3.9,0,Math.PI/2,0,1.6);luz(2.5,4,-6.9,2,1,0,Math.PI/2,2.2);luz(2,3,6.9,2,-2,0,-Math.PI/2,1.0);
    pmrem=pmrem||new THREE.PMREMGenerator(renderer);
    ambiente=pmrem.fromScene(es,0.04).texture;
    es.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});
    return ambiente;
  }
  /* teto e vidro são translúcidos (não escondem o interior do ambiente nem a janela) */
  function material(kind){
    const m=material0(kind);
    if(kind==='teto'||kind==='vidro'){m.transparent=true;m.opacity=kind==='teto'?0.14:0.38;m.depthWrite=false}
    return m;
  }
  function material0(kind){
    const nome=opt.textura;
    if(opt.foto){                                                                           // foto da pedra (catálogo ou da marmoraria); enquanto carrega, vale o tom
      const tf=texFoto(opt.foto),k=({tampo:1,degrau:1,saia:0.85,roda:0.95,espelho:0.9,painel:1})[kind]||1;
      if(tf)return mat({color:new THREE.Color(0xffffff).multiplyScalar(k),map:tf});
    }
    const fator={tampo:1,degrau:1,saia:0.85,roda:0.95,espelho:0.9,painel:1}[kind]||1;     // saia e peças de apoio um pouco mais escuras que o tampo
    if(nome==='liso')return mat({color:opt.cor!=null?new THREE.Color(opt.cor).multiplyScalar(fator):(LISO[kind]||LISO.tampo)});
    const tx=texturas[nome]||(texturas[nome]=textura(nome));
    return mat({color:opt.cor!=null?new THREE.Color(opt.cor).multiplyScalar(fator):(TINTA[kind]||0xffffff),map:tx});
  }

  /* foto da pedra como textura: carrega uma vez (cache em `texturas`); quando chega, refaz a cena. Falha = fica o tom. */
  const fotosFalhas=new Set();let fotosPend=0;
  function texFoto(url){
    const k='foto:'+url,tx=texturas[k];
    if(tx&&tx.image)return tx;
    if(tx===undefined&&!fotosFalhas.has(url)){
      texturas[k]=null;fotosPend++;
      new THREE.TextureLoader().load(url,t=>{fotosPend--;
        t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;texturas[k]=t;
        if(opt.foto===url&&modelo){construir();pedir()}
      },undefined,()=>{fotosPend--;delete texturas[k];fotosFalhas.add(url)});
    }
    return null;
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
      if(opt.textura!=='liso'||opt.foto){const uv=g.attributes.uv,[tu,tv]=opt.foto?TILE_FOTO:[TILE,TILE];for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/tu,uv.getY(i)/tv);uv.needsUpdate=true}
      return {g,extrudado:true};
    }
    if(s.kind==='tampo'&&unicoTampo(s)){                       // peça de um tampo só: borda com chanfro sutil (nas peças de vários tampos o chanfro viraria um falso rasgo na junta)
      const b=Math.min(0.2,s.sy/4,s.sx/10,s.sz/10)*CM,sx=s.sx*CM,sz=s.sz*CM,sh=new THREE.Shape();
      sh.moveTo(b,-b);sh.lineTo(sx-b,-b);sh.lineTo(sx-b,-(sz-b));sh.lineTo(b,-(sz-b));sh.closePath();
      const g=new THREE.ExtrudeGeometry(sh,{depth:s.sy*CM-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelOffset:0,bevelSegments:1});
      g.rotateX(-Math.PI/2);g.translate(s.x*CM,s.y*CM+b,s.z*CM);                // as medidas finais continuam as do sólido: o chanfro fica dentro delas
      if(opt.textura!=='liso'||opt.foto){const uv=g.attributes.uv,[tu,tv]=opt.foto?TILE_FOTO:[TILE,TILE];for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/tu,uv.getY(i)/tv);uv.needsUpdate=true}
      return {g,extrudado:true};
    }
    const g=new THREE.BoxGeometry(s.sx*CM,s.sy*CM,s.sz*CM);
    if(opt.textura!=='liso'||opt.foto)escalarUV(g,s.sx,s.sy,s.sz,...(opt.foto?TILE_FOTO:[TILE,TILE]));
    return {g,extrudado:false};
  }
  let contaTampos={};
  const unicoTampo=s=>contaTampos[s.peca==null?-1:s.peca]===1;
  function construir(){
    if(perdido)return;                                          // sem contexto WebGL não dá para criar nada; ao restaurar o contexto a cena é refeita
    liberar(grupo);liberar(grupoCotas);rotulos.forEach(r=>r.el.remove());rotulos=[];
    if(grade){scene.remove(grade);grade.geometry.dispose();grade.material.dispose();grade=null}
    if(!modelo||modelo.vazio){quadro=[];listaCotas=[];gradeCm=0;montarAlcas();pedir();return}
    contaTampos={};modelo.solids.forEach(x=>{if(x.kind==='tampo'){const k=x.peca==null?-1:x.peca;contaTampos[k]=(contaTampos[k]||0)+1}});
    renderer.shadowMap.enabled=!!opt.brilho;sol.castShadow=!!opt.brilho;
    renderer.toneMapping=opt.brilho?THREE.NeutralToneMapping:THREE.NoToneMapping;renderer.toneMappingExposure=0.95;      // tom neutro: não estoura pedra clara e mantém as cores
    hemi.intensity=opt.brilho?0.5:1.0;amb.intensity=opt.brilho?0.05:0.35;sol.intensity=opt.brilho?1.0:1.25;      // com o ambiente de estúdio (reflexo) a luz direta precisa ser menor, senão a pedra clara estoura
    scene.environment=opt.brilho?criarAmbiente():null;
    const borda=cssVar('--fg','#15191A');
    const emenda=cssVar('--emenda','#d9480f'),dimCor=new THREE.Color(0x60a5fa);
    modelo.solids.forEach(s=>{
      const {g,extrudado}=geometria(s);
      const m=new THREE.Mesh(g,material(s.kind));m.castShadow=m.receiveShadow=!!opt.brilho&&s.kind!=='teto'&&s.kind!=='vidro';
      if(!extrudado)m.position.set((s.x+s.sx/2)*CM,(s.y+s.sy/2)*CM,(s.z+s.sz/2)*CM);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:borda,transparent:true,opacity:0.62})));
      grupo.add(m);
    });
    /* emendas do plano de corte: contorno do corte em laranja, um pouco para fora para não brigar com a face */
    modelo.emendas.forEach(e=>{
      const c=e.pts.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4,a[2]+p[2]/4],[0,0,0]),pts=[];
      e.pts.forEach(p=>{const q=p.map((v,i)=>v+Math.sign(v-c[i])*0.03);pts.push(new THREE.Vector3(q[0]*CM,q[1]*CM,q[2]*CM))});
      grupo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:emenda})));
    });
    desenharEquipamentos();
    const [a,b]=[modelo.bbox.min,modelo.bbox.max];
    alvo.set((a[0]+b[0])/2*CM,(a[1]+b[1])/2*CM,(a[2]+b[2])/2*CM);
    montarGrade(a,b);
    montarCotas(dimCor);
    montarQuadro(a,b);
    ajustarSombra(a,b);
    montarAlcas();
    pedir();
  }

  /* sombra suave: chão que só recebe sombra e luz direcional enquadrada na cena */
  function ajustarSombra(a,b){
    if(chao){scene.remove(chao);chao.geometry.dispose();chao.material.dispose();chao=null}
    if(!opt.brilho)return;
    const r=Math.max(0.5,raioQ)*1.7,d=Math.max(4,raioQ*3);
    sol.position.copy(alvo).add(new THREE.Vector3(-2,4,3).normalize().multiplyScalar(d));sol.target.position.copy(alvo);
    const c=sol.shadow.camera;c.left=-r;c.right=r;c.top=r;c.bottom=-r;c.near=0.1;c.far=d*2.5;c.updateProjectionMatrix();
    chao=new THREE.Mesh(new THREE.PlaneGeometry(r*2.4,r*2.4),new THREE.ShadowMaterial({opacity:0.2}));
    chao.rotation.x=-Math.PI/2;chao.position.set(alvo.x,a[1]*CM-0.0007,alvo.z);chao.receiveShadow=true;scene.add(chao);
    renderer.shadowMap.needsUpdate=true;
  }

  /* cuba, torneira e cooktop ILUSTRATIVOS (vindos só dos recortes válidos); formas simples, sem textura */
  function desenharEquipamentos(){
    if(!opt.equip||!modelo.equipamentos)return;
    const lamb=c=>new THREE.MeshLambertMaterial({color:c});
    const caixa=(w,h,d,x,y,z,mat)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w*CM,h*CM,d*CM),mat);o.position.set(x*CM,y*CM,z*CM);grupo.add(o)};
    const cil=(r1,r2,h,x,y,z,mat,rotX)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1*CM,r2*CM,h*CM,18),mat);o.position.set(x*CM,y*CM,z*CM);if(rotX)o.rotation.x=Math.PI/2;grupo.add(o)};
    const t=modelo.espessura,met=(c,m)=>opt.brilho?new THREE.MeshStandardMaterial({color:c,roughness:0.3,metalness:m}):lamb(c),inox=met(0xaeb4ba,0.85),fundo=lamb(0x7f868c),cromo=met(0x8d949a,0.9),vidro=met(0x1b1e22,0.1),anel=lamb(0x5a6068);
    modelo.equipamentos.forEach(e=>{
      if(e.tipo==='cuba'){
        const topo=t,base=t-e.prof,meio=(topo+base)/2,esp=0.5,cx=e.x+e.w/2,cz=e.z+e.d/2;
        caixa(e.w,e.prof,esp,cx,meio,e.z+esp/2,inox);caixa(e.w,e.prof,esp,cx,meio,e.z+e.d-esp/2,inox);
        caixa(esp,e.prof,e.d-2*esp,e.x+esp/2,meio,cz,inox);caixa(esp,e.prof,e.d-2*esp,e.x+e.w-esp/2,meio,cz,inox);
        caixa(e.w-2*esp,esp,e.d-2*esp,cx,base+esp/2,cz,fundo);
        cil(2.4,2.4,0.3,cx,base+esp+0.15,cz,lamb(0x30353a));                       // ralo
      }else if(e.tipo==='torneira'){
        cil(2.6,2.2,3,e.x,t+1.5,e.z,cromo);                                         // base
        cil(1.1,1.1,e.altura-6,e.x,t+3+(e.altura-6)/2,e.z,cromo);                   // haste
        cil(1,1,e.alcance,e.x,t+e.altura-3,e.z+e.alcance/2,cromo,true);             // bico, em direção ao usuário
        cil(1,1,5,e.x,t+e.altura-5.5,e.z+e.alcance,cromo);                          // ponta voltada para baixo
      }else if(e.tipo==='cooktop'){
        caixa(e.w,0.5,e.d,e.x+e.w/2,t+0.25,e.z+e.d/2,vidro);
        e.queimadores.forEach(q=>{const g=new THREE.TorusGeometry(q.r*CM,0.25*CM,8,28);g.rotateX(Math.PI/2);const o=new THREE.Mesh(g,anel);o.position.set(q.x*CM,(t+0.6)*CM,q.z*CM);grupo.add(o)});
      }
    });
  }

  /* grade proporcional: espaçamento "redondo" (10/20/50/100/200 cm) com no máximo ~12 divisões na maior dimensão */
  function montarGrade(a,b){
    const maior=Math.max(b[0]-a[0],b[2]-a[2]),esp=[10,20,50,100,200,500].find(e=>maior/e<=12)||500;
    const tam=Math.ceil(maior*1.5/esp)*esp,n=Math.max(2,Math.round(tam/esp));
    const escuro=document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&mq&&mq.matches);
    const fina=cssVar('--line','#cdd3d1'),eixo=fina.clone().offsetHSL(0,0,escuro?0.06:-0.07);     // linhas finas, de baixo contraste, na cor do tema; as do centro um pouco mais firmes
    grade=new THREE.GridHelper(tam*CM,n,eixo,fina);
    grade.material.transparent=true;grade.material.opacity=0.8;grade.material.depthWrite=false;
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
        rotulos.push({txt:c.texto,pos:new THREE.Vector3(...V(add(q1,[q2[0]-q1[0],q2[1]-q1[1],q2[2]-q1[2]],0.5))),prio:c.prio,cat:c.categoria,campo:c.campo,valor:c.valor,
          a:new THREE.Vector3(...V(q1)),b:new THREE.Vector3(...V(q2))});
      }else rotulos.push({txt:c.texto,pos:new THREE.Vector3(...V(c.pos)),prio:c.prio,cat:c.categoria==='recorte'?'recorte':'rotulo'});
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    grupoCotas.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:cor,depthTest:false,transparent:true,opacity:0.95})));
    grupoCotas.renderOrder=10;grupoCotas.visible=opt.cotas;
    rotulos.forEach(r=>{
      const el=document.createElement('span');el.textContent=r.txt;
      const fino=typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches;            // mouse: texto um pouco menor; toque: maior e mais fácil de acertar
      el.style.cssText='position:absolute;left:0;top:0;white-space:nowrap;padding:'+(fino?'2px 7px':'4px 10px')+';border-radius:99px;border:1.5px solid #60a5fa;color:#fff;background:rgba(8,12,20,0.88);font-size:'+(fino?'11px':'12.5px')+';pointer-events:none';   // pílula escura com borda azul: boa leitura no sol e em qualquer fundo
      if(r.cat==='rotulo'||r.cat==='recorte')el.style.borderStyle='dashed';
      if(r.campo){el.addEventListener('click',()=>editarCota(r));el.title='Clique para digitar a medida';if(edicao.ativo){el.style.pointerEvents='auto';el.style.cursor='text'}}
      camada.appendChild(el);r.el=el;r.w=0;r.h=0;
    });
    camada.style.display=opt.cotas?'block':'none';
    rotulos.forEach(r=>{r.w=r.el.offsetWidth;r.h=r.el.offsetHeight});
  }
  /* Model3D.cotas é global (model3d.js); o visualizador recalcula quando o lado preferido muda */
  const Model3D_cotas=(m,l)=>deps.cotas?deps.cotas(m,l):(m.cotas||[]);

  /* pontos que precisam caber na tela: caixa da peça + extremos das cotas */
  function montarQuadro(a,b){
    quadro=[];
    [a[0],b[0]].forEach(x=>[a[1],b[1]].forEach(y=>[a[2],b[2]].forEach(z=>quadro.push(new THREE.Vector3(x*CM,y*CM,z*CM)))));
    if(opt.cotas)listaCotas.forEach(c=>{
      if(c.tipo!=='cota')return;
      [c.p1,c.p2].forEach(p=>quadro.push(new THREE.Vector3((p[0]+c.dir[0]*c.off*1.4)*CM,(p[1]+c.dir[1]*c.off*1.4)*CM,(p[2]+c.dir[2]*c.off*1.4)*CM)));
    });
    if(opt.equip)(modelo.equipamentos||[]).forEach(e=>{const c=e.caixa;
      [c.min[0],c.max[0]].forEach(x=>[c.min[1],c.max[1]].forEach(y=>[c.min[2],c.max[2]].forEach(z=>quadro.push(new THREE.Vector3(x*CM,y*CM,z*CM)))))});
    raioQ=Math.max(0.25,...quadro.map(p=>p.distanceTo(alvo)));
    dMin=Math.max(0.25,raioQ*0.45);dMax=raioQ*7;
  }

  /* lado preferido das cotas (só reta, lavatório e ilha usam; nos demais as cotas têm posição fixa).
     Histerese: só troca quando a câmera passa claramente para o outro lado, sem reconstruir a cada pixel do gesto. */
  function atualizarLado(){
    if(!modelo||modelo.vazio||!opt.cotas||!['reta','lavatorio','ilha'].includes(modelo.peca.type))return;
    if(est.pol<0.2)return;                                          // de cima: a câmera está em cima da peça, não troca de lado
    const dx=camera.position.x-alvo.x,dz=camera.position.z-alvo.z,m=0.06*est.dist,n={x:ladoCotas.x,z:ladoCotas.z};
    if(dx<-m)n.x='esq';else if(dx>m)n.x='dir';
    if(dz>m)n.z='frente';else if(dz<-m)n.z='fundo';
    if(n.x!==ladoCotas.x||n.z!==ladoCotas.z){ladoCotas=n;reconstruirCotas()}
  }
  let nReconst=0;                                                   // só para testes: quantas vezes as cotas foram reconstruídas
  function reconstruirCotas(){
    nReconst++;
    liberar(grupoCotas);rotulos.forEach(r=>r.el.remove());
    montarCotas(new THREE.Color(0x60a5fa));
    const [a,b]=[modelo.bbox.min,modelo.bbox.max];montarQuadro(a,b);montarAlcas();pedir();
  }

  /* textos das cotas em tela: projeção, sem sobrepor e dentro do canvas.
     - cota cuja linha vira quase um ponto na tela (vista "de lado") não tem o que ler: o texto some;
     - sem espaço livre, some o texto de menor prioridade (comprimento > altura > espessura > recortes). */
  function posicionarRotulos(){
    if(!opt.cotas||!rotulos.length)return;
    const W=canvas.clientWidth,H=canvas.clientHeight,usados=[],v=new THREE.Vector3(),pa=new THREE.Vector3(),pb=new THREE.Vector3();
    [...rotulos].sort((p,q)=>p.prio-q.prio).forEach(r=>{
      v.copy(r.pos).project(camera);
      let esconder=v.z>1||v.z<-1||(r.cat==='recorte'&&est.pol>0.8);       // medida do recorte: lê-se na vista de cima e no 2D; nas inclinadas só amontoa
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
      ptr.clear();d0=0;                                       // gesto interrompido por uma troca de tela não deixa ponteiro preso
      if(canvas.parentElement!==container)container.appendChild(canvas);
      if(camada.parentElement!==container)container.appendChild(camada);
      if(aviso.parentElement!==container)container.appendChild(aviso);
      if(camadaEdit.parentElement!==container)container.appendChild(camadaEdit);
      if(ro){ro.disconnect();ro.observe(container)}
      ajustarTamanho();
    },
    soltar(){paraInercia();clearTimeout(tRecup);if(ro)ro.disconnect();canvas.remove();camada.remove();aviso.remove();camadaEdit.remove()},
    /* descarta o visualizador de vez (contexto perdido sem volta): o app cria outro na próxima abertura */
    destruir(){
      clearTimeout(tRecup);if(pedido)cancelAnimationFrame(pedido);pedido=0;
      if(mq&&mq.removeEventListener)mq.removeEventListener('change',aoMudarTema);
      if(ro)ro.disconnect();canvas.remove();camada.remove();aviso.remove();camadaEdit.remove();
      liberar(grupo);liberar(grupoCotas);if(grade){grade.geometry.dispose();grade.material.dispose();grade=null}
      paraInercia();if(chao){chao.geometry.dispose();chao.material.dispose();chao=null}if(ambiente){ambiente.dispose();ambiente=null}if(pmrem){pmrem.dispose();pmrem=null}
      Object.values(texturas).forEach(t=>{if(t)t.dispose()});
      renderer.dispose();setTimeout(()=>{try{renderer.forceContextLoss()}catch(e){}},500);          // adiado: o Three ainda termina verificações dos programas de shader e quebraria com o contexto já perdido
      modelo=null;
    },
    /* liga/desliga as alças; fn(acao) recebe {tipo:'campo',campo,valor} | {tipo:'recorte',indice,x,z,w,d} | {tipo:'fim'} */
    editar(ativo,fn){const m=!!ativo!==edicao.ativo;edicao={ativo:!!ativo,fn:fn||null};if(m){montarAlcas();rotulos.forEach(r=>{if(r.el&&r.campo){r.el.style.pointerEvents=edicao.ativo?'auto':'none';r.el.style.cursor=edicao.ativo?'text':''}});pedir()}},
    /* imagem JPEG (dataURL) da cena como está, com as cotas desenhadas por cima: usada pelo PDF do orçamento.
       Espera as fotos de textura chegarem (até `espera` ms). O container precisa ter tamanho (o app usa um div fora da tela). */
    async capturar({espera=3000,qualidade=0.9,semGrade=false,escala=0}={}){
      for(let t=0;fotosPend>0&&t<espera;t+=50)await new Promise(r=>setTimeout(r,50));
      const grade0=grade?grade.visible:true;
      if(grade&&semGrade)grade.visible=false;                                 // "foto": sem a grade de apoio
      dprForca=escala>0?escala:0;                                             // mais pixels só para esta imagem; volta ao normal no fim
      try{ajustarTamanho();render();                                          // render síncrono: o buffer do WebGL ainda vale para a leitura
      const cont=canvas.parentElement,cr=cont.getBoundingClientRect(),k=canvas.width/Math.max(1,cont.clientWidth);
      const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;
      const g=out.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,out.width,out.height);g.drawImage(canvas,0,0);
      if(opt.cotas)rotulos.forEach(r=>{
        if(!r.el||r.el.style.display==='none')return;
        const b=r.el.getBoundingClientRect(),cs=getComputedStyle(r.el),x=(b.left-cr.left)*k,y=(b.top-cr.top)*k,w=b.width*k,h=b.height*k,rad=6*k;
        g.beginPath();g.moveTo(x+rad,y);g.arcTo(x+w,y,x+w,y+h,rad);g.arcTo(x+w,y+h,x,y+h,rad);g.arcTo(x,y+h,x,y,rad);g.arcTo(x,y,x+w,y,rad);g.closePath();
        g.fillStyle=cs.backgroundColor;g.fill();g.strokeStyle=cs.borderTopColor;g.lineWidth=Math.max(1.5,1.5*k);
        if(r.cat==='rotulo'||r.cat==='recorte')g.setLineDash([3*k,2*k]);else g.setLineDash([]);
        g.stroke();g.setLineDash([]);g.fillStyle=cs.color;g.font='600 '+(12*k)+'px ui-monospace,Menlo,monospace';g.textBaseline='middle';g.textAlign='center';
        g.fillText(r.txt,x+w/2,y+h/2+k*0.5);
      });
      return out.toDataURL('image/jpeg',qualidade);
      }finally{if(grade)grade.visible=grade0;dprForca=0;if(escala>0)ajustarTamanho()}
    },
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
    /* atualiza modelo e opções numa construção só: o = {cotas, textura} */
    atualizar(m,mantem,o){
      if(o){if('cor' in o)opt.cor=o.cor==null?null:o.cor;if('foto' in o)opt.foto=o.foto||null;if('brilho' in o)opt.brilho=!!o.brilho;if(o.cotas!=null)opt.cotas=!!o.cotas;if(o.textura!=null)opt.textura=o.textura;if(o.equip!=null)opt.equip=!!o.equip}
      const novo=!mantem||!modelo;
      modelo=m;construir();
      if(novo){zoomManual=false;est.dist=distIdeal(est.az,est.pol);posicionar()}else garantirVisivel();
    },
    /* opções visuais: {cotas:boolean, textura:'liso'|'granito'|'marmore'|'quartzo'} */
    opcoes(o){
      const mudouCor='cor' in o&&(o.cor==null?null:o.cor)!==opt.cor;
      if('cor' in o)opt.cor=o.cor==null?null:o.cor;
      const mudouFoto='foto' in o&&(o.foto||null)!==opt.foto;if('foto' in o)opt.foto=o.foto||null;
      const mudouBrilho='brilho' in o&&!!o.brilho!==opt.brilho;if('brilho' in o)opt.brilho=!!o.brilho;
      const mudouTx=mudouCor||mudouFoto||mudouBrilho||o.textura!=null&&o.textura!==opt.textura,mudouCotas=o.cotas!=null&&o.cotas!==opt.cotas,mudouEq=o.equip!=null&&!!o.equip!==opt.equip;
      if(o.cotas!=null)opt.cotas=!!o.cotas;
      if(o.equip!=null)opt.equip=!!o.equip;
      if(o.textura!=null)opt.textura=o.textura;
      if(mudouTx||mudouCotas||mudouEq){construir();garantirVisivel()}
    },
    enquadrar,vista,
    gradeCm:()=>gradeCm,
    /* só para testes e diagnóstico */
    estado(){
      let fora=0;const v=new THREE.Vector3();
      (modelo?quadro:[]).forEach(p=>{v.copy(p).project(camera);if(Math.abs(v.x)>1.001||Math.abs(v.y)>1.001||v.z>1)fora++});
      return {objetos:grupo.children.length,az:est.az,pol:est.pol,dist:est.dist,dMin,dMax,perdido,zoomManual,ladoCotas:{...ladoCotas},
        rotulos:rotulos.map(r=>({txt:r.txt,visivel:r.el.style.display!=='none'&&opt.cotas})),cotasVisiveis:opt.cotas&&grupoCotas.visible,
        foraDoQuadro:fora,grade:gradeCm,textura:opt.textura,equip:opt.equip,memoria:{...renderer.info.memory},
        canvas:{w:canvas.clientWidth,h:canvas.clientHeight},reconstrucoesCotas:nReconst};
    },
    perderContextoParaTeste(){const e=extPerda();e&&e.loseContext();return !!e},
    restaurarContextoParaTeste(){const e=extPerda();e&&e.restoreContext();return !!e}
  };
}
