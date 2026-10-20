/* Marmofácil: visualizador 3D (Three.js). Carregado só quando o usuário abre o 3D.
   Só desenha; não calcula nada. Recebe os sólidos de model3d.js (cm) e mostra em metros.
   Um único canvas/contexto WebGL é reaproveitado: o app refaz o HTML da tela a cada mudança,
   então o canvas é re-anexado ao novo container em vez de ser recriado. */
import * as THREE from './vendor/three.module.min.js';

const CM=0.01;
const COR={tampo:0xc9d3d0,saia:0xa4b3af,roda:0xb4c1bd,degrau:0xc9d3d0,espelho:0xb4c1bd,painel:0xc0cbc8};

export function webglDisponivel(){
  try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}
}

export function criarVisualizador(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  const canvas=renderer.domElement;
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Modelo 3D da peça. Arraste para girar e use dois dedos para aproximar.');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,0.05,60);
  scene.add(new THREE.AmbientLight(0xffffff,1.15));
  const sol=new THREE.DirectionalLight(0xffffff,1.6);sol.position.set(-2,4,3);scene.add(sol);
  const grupo=new THREE.Group();scene.add(grupo);
  const grade=new THREE.GridHelper(6,12,0x8c9794,0xb9c2bf);grade.material.transparent=true;grade.material.opacity=0.45;scene.add(grade);

  const alvo=new THREE.Vector3(),est={az:-0.6,pol:1.0,dist:3};
  let raio=1,box=null,pedido=0,perdido=false,aoPerder=null;

  const render=()=>{pedido=0;if(!perdido)renderer.render(scene,camera)};
  const pedir=()=>{if(!pedido)pedido=requestAnimationFrame(render)};
  function posicionar(){
    est.pol=Math.min(Math.max(est.pol,0.05),Math.PI/2-0.02);
    est.dist=Math.min(Math.max(est.dist,raio*0.6),raio*8);
    const s=Math.sin(est.pol);
    camera.position.set(alvo.x+est.dist*s*Math.sin(est.az),alvo.y+est.dist*Math.cos(est.pol),alvo.z+est.dist*s*Math.cos(est.az));
    camera.lookAt(alvo);pedir();
  }
  function enquadrar(){
    est.dist=raio/Math.tan(camera.fov*Math.PI/360)*1.15;posicionar();
  }
  function vista(nome){
    if(nome==='topo'){est.az=0;est.pol=0.05}
    else if(nome==='frente'){est.az=0;est.pol=Math.PI/2-0.02}
    else{est.az=-0.6;est.pol=1.0}
    enquadrar();
  }

  /* toque e mouse: 1 ponteiro gira, 2 ponteiros aproximam */
  const ptr=new Map();let d0=0;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptr.size===2){const [a,b]=[...ptr.values()];d0=Math.hypot(a.x-b.x,a.y-b.y)}canvas.style.cursor='grabbing'});
  const solta=e=>{ptr.delete(e.pointerId);if(!ptr.size)canvas.style.cursor='grab'};
  canvas.addEventListener('pointerup',solta);canvas.addEventListener('pointercancel',solta);
  canvas.addEventListener('pointermove',e=>{
    const p=ptr.get(e.pointerId);if(!p)return;
    if(ptr.size===1){est.az-=(e.clientX-p.x)*0.008;est.pol-=(e.clientY-p.y)*0.008;p.x=e.clientX;p.y=e.clientY}
    else if(ptr.size===2){
      p.x=e.clientX;p.y=e.clientY;const [a,b]=[...ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d0>0&&d>0)est.dist*=d0/d;d0=d;
    }
    posicionar();
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();est.dist*=Math.exp(e.deltaY*0.0012);posicionar()},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();perdido=true;aoPerder&&aoPerder()});
  canvas.addEventListener('webglcontextrestored',()=>{perdido=false;pedir()});

  function ajustarTamanho(){
    const c=canvas.parentElement;if(!c)return;
    const w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();pedir();
  }
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(ajustarTamanho):null;

  function limpar(){
    grupo.children.slice().forEach(o=>{grupo.remove(o);o.geometry&&o.geometry.dispose();if(o.material&&o.material.dispose)o.material.dispose()});
  }
  function corBorda(){
    const v=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    try{return new THREE.Color(v||'#0E6A5B')}catch(e){return new THREE.Color(0x0e6a5b)}
  }

  return {
    anexar(container){
      if(canvas.parentElement!==container)container.appendChild(canvas);
      if(ro){ro.disconnect();ro.observe(container)}
      ajustarTamanho();
    },
    soltar(){if(ro)ro.disconnect();canvas.remove()},
    aoPerderContexto(fn){aoPerder=fn},
    /* modelo: resultado de Model3D.buildModel (cm). mantem=true conserva o ângulo da câmera. */
    definirModelo(modelo,mantem){
      limpar();
      const borda=corBorda();
      modelo.solids.forEach(s=>{
        const g=new THREE.BoxGeometry(s.sx*CM,s.sy*CM,s.sz*CM);
        const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:COR[s.kind]||COR.tampo}));
        m.position.set((s.x+s.sx/2)*CM,(s.y+s.sy/2)*CM,(s.z+s.sz/2)*CM);
        const l=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:borda}));
        m.add(l);grupo.add(m);
      });
      const [a,b]=[modelo.bbox.min,modelo.bbox.max];
      alvo.set((a[0]+b[0])/2*CM,(a[1]+b[1])/2*CM,(a[2]+b[2])/2*CM);
      raio=Math.max(0.3,Math.hypot((b[0]-a[0])*CM,(b[1]-a[1])*CM,(b[2]-a[2])*CM)/2);
      grade.position.set(alvo.x,a[1]*CM-0.002,alvo.z);
      const tam=Math.max(2,Math.ceil(raio*4));grade.scale.setScalar(tam/6);
      if(mantem&&box)posicionar();else enquadrar();
      box=modelo;pedir();
    },
    vista,
    /* só para testes e diagnóstico */
    estado:()=>({objetos:grupo.children.length,az:est.az,pol:est.pol,dist:est.dist,perdido})
  };
}
