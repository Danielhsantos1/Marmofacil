/* Marmofácil: modelo 3D ilustrativo de uma peça (função pura, sem Three.js nem tela).
   Lê a MESMA peça `p` (type, d, saiaH, rodaH...) que alimenta o corte e o preço; não guarda dado próprio.
   Unidades: cm. Eixos: x = comprimento (direita), y = altura (cima), z = profundidade (para o vendedor).
   O tampo ocupa y de 0 a t (t = espessura da pedra); a saia fica abaixo (y < 0) e a rodabanca acima (y > t).
   Cada sólido traz `face` (cm²): a área da face que o cortador recorta. A soma das faces é igual a
   partsArea(shape(p).parts) × 10000 (testado em tests/model3d.test.js).
   É uma montagem ILUSTRATIVA: não mostra emendas, recortes, cubas nem veio da pedra. */
(function(root){
  const C=typeof module!=='undefined'?require('./calc.js'):root;
  const {defMl}=C;
  const ESP_PADRAO=2;

  function buildModel(p,espessura){
    const t=espessura>0?espessura:ESP_PADRAO,d=p.d||{};
    const sol=[];
    const plate=(x,z,w,dp,label,kind)=>{if(w>0&&dp>0)sol.push({kind:kind||'tampo',label,x,y:0,z,sx:w,sy:t,sz:dp,face:w*dp})};

    if(p.type==='reta'||p.type==='lavatorio')plate(0,0,d.A,d.P,'Tampo');
    else if(p.type==='L'){plate(0,0,d.A,d.P,'Trecho A');plate(0,d.P,d.P,Math.max(0,d.B-d.P),'Trecho B')}
    else if(p.type==='U'){plate(0,0,d.A,d.P,'Fundo');plate(0,d.P,d.P,Math.max(0,d.B-d.P),'Esq.');plate(d.A-d.P,d.P,d.P,Math.max(0,d.C-d.P),'Dir.')}
    else if(p.type==='ilha')plate(0,0,d.A,d.B,'Tampo');
    else if(p.type==='escada'){
      const n=Math.max(1,Math.round(d.N));
      for(let i=1;i<=n;i++){                       // sobe para trás: o degrau 1 fica na frente
        const zf=(n-i+1)*d.PI;
        if(d.A>0&&d.PI>0)sol.push({kind:'degrau',label:'Piso '+i,x:0,y:i*d.ES-t,z:zf-d.PI,sx:d.A,sy:t,sz:d.PI,face:d.A*d.PI});
        if(d.A>0&&d.ES>0)sol.push({kind:'espelho',label:'Esp. '+i,x:0,y:(i-1)*d.ES,z:zf-t,sx:d.A,sy:d.ES,sz:t,face:d.A*d.ES});
      }
    }
    else if(p.type==='nicho'){
      const A=d.A,H=d.H,P=d.P;                     // espelha shape(): as laterais entram mesmo com largura 0
      if(A>0&&H>0)sol.push({kind:'painel',label:'Fundo',x:0,y:0,z:0,sx:A,sy:H,sz:t,face:A*H});
      if(A>0&&P>0){
        sol.push({kind:'painel',label:'Topo',x:0,y:H-t,z:t,sx:A,sy:t,sz:P,face:A*P});
        sol.push({kind:'painel',label:'Base',x:0,y:0,z:t,sx:A,sy:t,sz:P,face:A*P});
      }
      if(P>0&&H>0){
        sol.push({kind:'painel',label:'Lateral',x:-t,y:0,z:t,sx:t,sy:H,sz:P,face:P*H});
        sol.push({kind:'painel',label:'Lateral',x:A,y:0,z:t,sx:t,sy:H,sz:P,face:P*H});
      }
    }
    else if(p.type==='livre'){                     // peças soltas, lado a lado, como no desenho 2D
      let x=0,z=0,rowH=0;const W=320,g=6;
      (d.rects||[]).forEach(r=>{
        const w=r.w,h=r.h;if(!(w>0&&h>0))return;
        const q=Math.max(1,Math.round(r.q||1));
        for(let i=0;i<q;i++){
          if(x>0&&x+w>W){x=0;z+=rowH+g;rowH=0}
          plate(x,z,w,h,r.l||'Peça');x+=w+g;rowH=Math.max(rowH,h)
        }
      });
    }

    const main=sol.slice();
    const W=main.reduce((m,s)=>Math.max(m,s.x+s.sx),0),Dz=main.reduce((m,s)=>Math.max(m,s.z+s.sz),0);
    const seg=(x0,z0,x1,z1,nx,nz)=>({x0,z0,x1,z1,nx,nz});
    const A=d.A,B=d.B,Cc=d.C,P=d.P;
    const rota=(tipo)=>{                           // percurso da saia (frente) e da rodabanca (fundo)
      const back=tipo==='roda';
      if(p.type==='reta'||p.type==='lavatorio')return back?[seg(0,0,A,0,0,-1)]:[seg(0,P,A,P,0,1)];
      if(p.type==='L')return back?[seg(A,0,0,0,0,-1),seg(0,0,0,B,-1,0)]:[seg(A,P,P,P,0,1),seg(P,P,P,B,1,0)];
      if(p.type==='U')return back?[seg(0,B,0,0,-1,0),seg(0,0,A,0,0,-1),seg(A,0,A,Cc,1,0)]
                                  :[seg(P,B,P,P,1,0),seg(P,P,A-P,P,0,1),seg(A-P,P,A-P,Cc,-1,0)];
      if(p.type==='ilha')return back?[seg(0,0,A,0,0,-1),seg(A,0,A,B,1,0),seg(A,B,0,B,0,1),seg(0,B,0,0,-1,0)]
                                    :[seg(0,B,A,B,0,1),seg(A,B,A,0,1,0),seg(A,0,0,0,0,-1),seg(0,0,0,B,-1,0)];
      return back?[seg(0,0,W,0,0,-1)]:[seg(0,Dz,W,Dz,0,1)];   // escada, nicho, livre: borda do conjunto
    };
    [['saia',p.saiaH,p.saiaMl,'Saia'],['roda',p.rodaH,p.rodaMl,'Rodabanca']].forEach(([tipo,h,mlManual,nome])=>{
      if(!(h>0))return;
      const ml=mlManual||defMl(p,tipo);let resta=ml*100;
      if(!(resta>0))return;
      const y=tipo==='saia'?-h:t,path=rota(tipo);
      path.forEach((s,i)=>{
        if(resta<=0)return;
        const dx=Math.sign(s.x1-s.x0),dz=Math.sign(s.z1-s.z0),comp=Math.abs(s.x1-s.x0)+Math.abs(s.z1-s.z0);
        const ultimo=i===path.length-1;
        const l=ultimo?resta:Math.min(resta,comp);          // se passar do percurso, segue reto (medida manual)
        if(!(l>0))return;
        const xa=Math.min(s.x0,s.x0+dx*l),za=Math.min(s.z0,s.z0+dz*l);
        const alongX=dx!==0;
        const sx=alongX?l:t,sz=alongX?t:l;
        let x=alongX?xa:(s.nx>0?s.x0-t:s.x0),z=alongX?(s.nz>0?s.z0-t:s.z0):za;
        sol.push({kind:tipo,label:nome,x,y,z,sx,sy:h,sz,face:l*h});
        resta-=l;
      });
    });

    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    sol.forEach(s=>{[[s.x,s.x+s.sx],[s.y,s.y+s.sy],[s.z,s.z+s.sz]].forEach(([a,b],i)=>{min[i]=Math.min(min[i],a);max[i]=Math.max(max[i],b)})});
    const vazio=!sol.length;
    return {solids:sol,espessura:t,vazio,
      bbox:vazio?{min:[0,0,0],max:[0,0,0]}:{min,max},
      area:sol.reduce((s,x)=>s+x.face,0)/1e4};
  }

  const api={buildModel,ESP_PADRAO};
  if(typeof module!=='undefined')module.exports=api;else root.Model3D=api;
})(typeof window!=='undefined'?window:globalThis);
