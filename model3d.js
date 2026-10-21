/* Marmofácil: modelo 3D de uma peça (função pura, sem Three.js nem tela).
   Lê a MESMA peça `p` (type, d, saiaH, rodaH, recortes...) que alimenta o corte e o preço; não guarda dado próprio.
   Unidades: cm. Eixos: x = comprimento (direita), y = altura (cima), z = profundidade (para o vendedor).
   O tampo ocupa y de 0 a t (t = espessura da pedra); a saia fica abaixo (y < 0) e a rodabanca acima (y > t).

   Cada sólido traz `face` (cm²): a área da face que o cortador recorta (eixos em `fa`; o terceiro é a espessura).
   A soma das faces é igual a partsArea(shape(p).parts) × 10000, e as emendas desenhadas são exatamente as que o
   plano de corte conta (calc.js: divisoes). Recortes e cotas só existem quando há dado na peça.
   É uma montagem para CONFERÊNCIA VISUAL: não é desenho de fabricação nem mostra o veio da pedra. */
(function(root){
  const C=typeof module!=='undefined'?require('./calc.js'):root;
  const {defMl,divisoes}=C;
  const ESP_PADRAO=2;
  const AX={x:0,y:1,z:2};
  const fmt=n=>Number.isInteger(n)?String(n):(+n).toLocaleString('pt-BR',{maximumFractionDigits:1});

  /* Aceita buildModel(p, espessura) (forma antiga) ou buildModel(p, {espessura, SL, SW}). */
  function opcoes(o){
    if(o==null||typeof o==='number')o={espessura:o};
    return {t:o.espessura>0?o.espessura:ESP_PADRAO,origem:o.espessura>0?'material':'padrao',
            SL:o.SL>0?o.SL:300,SW:o.SW>0?o.SW:160};          // 300×160 é o padrão do cálculo sem material
  }
  const sobrepoe=(a,b)=>Math.min(a.x+a.sx,b.x+b.sx)-Math.max(a.x,b.x)>1e-9&&Math.min(a.z+a.sz,b.z+b.sz)-Math.max(a.z,b.z)>1e-9;

  function buildModel(p,o){
    const {t,origem,SL,SW}=opcoes(o);
    const sol=[],avisos=[];
    /* medidas não finitas (NaN, Infinity) são tratadas como 0, com aviso: nunca viram coordenada */
    const d={};
    Object.keys(p.d||{}).forEach(k=>{
      const v=p.d[k];
      if(typeof v==='number'&&!isFinite(v)){d[k]=0;avisos.push('Medida "'+k+'" inválida: tratada como 0.')}
      else d[k]=v;
    });
    const fin=(v,nome)=>{if(typeof v==='number'&&!isFinite(v)){avisos.push(nome+' inválido: tratado como 0.');return 0}return v};
    const saiaH=fin(p.saiaH,'Altura da saia'),rodaH=fin(p.rodaH,'Altura da rodabanca'),saiaMl=fin(p.saiaMl,'Metragem da saia'),rodaMl=fin(p.rodaMl,'Metragem da rodabanca');
    const pp=Object.assign({},p,{d,saiaH,rodaH,saiaMl,rodaMl});                  // peça saneada (usada também por defMl)
    function add(s){
      const dim={x:s.sx,y:s.sy,z:s.sz};
      s.face=dim[s.fa[0]]*dim[s.fa[1]];
      s.espAx=['x','y','z'].find(a=>!s.fa.includes(a));
      s.id=s.kind+'-'+sol.length;
      sol.push(s);return s;
    }
    const plate=(x,z,w,dp,label)=>{if(w>0&&dp>0)add({kind:'tampo',label,x,y:0,z,sx:w,sy:t,sz:dp,fa:['x','z']})};

    if(pp.type==='reta'||pp.type==='lavatorio')plate(0,0,d.A,d.P,'Tampo');
    else if(p.type==='L'){plate(0,0,d.A,d.P,'Trecho A');plate(0,d.P,d.P,Math.max(0,d.B-d.P),'Trecho B')}
    else if(p.type==='U'){plate(0,0,d.A,d.P,'Fundo');plate(0,d.P,d.P,Math.max(0,d.B-d.P),'Esq.');plate(d.A-d.P,d.P,d.P,Math.max(0,d.C-d.P),'Dir.')}
    else if(p.type==='ilha')plate(0,0,d.A,d.B,'Tampo');
    else if(p.type==='escada'){
      const n=Math.max(1,Math.round(d.N));
      for(let i=1;i<=n;i++){                         // sobe para trás: o degrau 1 fica na frente
        const zf=(n-i+1)*d.PI;
        // o espelho fica logo abaixo do piso (sem invadir o piso): mesma face A×ES do corte
        if(d.A>0&&d.PI>0)add({kind:'degrau',label:'Piso '+i,x:0,y:i*d.ES-t,z:zf-d.PI,sx:d.A,sy:t,sz:d.PI,fa:['x','z']});
        if(d.A>0&&d.ES>0)add({kind:'espelho',label:'Esp. '+i,x:0,y:(i-1)*d.ES-t,z:zf-t,sx:d.A,sy:d.ES,sz:t,fa:['x','y']});
      }
    }
    else if(p.type==='nicho'){
      const A=d.A,H=d.H,P=d.P;                       // espelha shape(): as laterais entram mesmo com largura 0
      if(A>0&&H>0)add({kind:'painel',label:'Fundo',x:0,y:0,z:0,sx:A,sy:H,sz:t,fa:['x','y']});
      if(A>0&&P>0){
        add({kind:'painel',label:'Topo',x:0,y:H-t,z:t,sx:A,sy:t,sz:P,fa:['x','z']});
        add({kind:'painel',label:'Base',x:0,y:0,z:t,sx:A,sy:t,sz:P,fa:['x','z']});
      }
      if(P>0&&H>0){
        add({kind:'painel',label:'Lateral',x:-t,y:0,z:t,sx:t,sy:H,sz:P,fa:['z','y']});
        add({kind:'painel',label:'Lateral',x:A,y:0,z:t,sx:t,sy:H,sz:P,fa:['z','y']});
      }
    }
    else if(p.type==='livre'){                       // peças soltas, lado a lado, como no desenho 2D
      let x=0,z=0,rowH=0;const W=320,g=6;
      (Array.isArray(d.rects)?d.rects:[]).forEach(r=>{
        if(!r)return;
        const w=r.w,h=r.h;if(!(w>0&&h>0))return;
        const q=Math.max(1,Math.round(r.q||1));
        if(r.q!=null&&(!Number.isInteger(r.q)||r.q<1))avisos.push('Peça livre com quantidade "'+r.q+'": o cálculo usa '+r.q+'× a área, o 3D desenha '+q+' peça(s). Use quantidade inteira.');
        for(let i=0;i<q;i++){
          if(x>0&&x+w>W){x=0;z+=rowH+g;rowH=0}
          plate(x,z,w,h,r.l||'Peça');x+=w+g;rowH=Math.max(rowH,h)
        }
      });
    }

    /* caixa só das peças principais (sem saia/rodabanca): referência para cotas e percursos */
    const principais=sol.slice();
    const bp=caixa(principais);
    const Dz=principais.length?bp.max[2]:0;

    /* ---- saia e rodabanca: percurso nas bordas, faixas sem sobrepor nos cantos ---- */
    const partes=[];                                                       // faixas: o plano de corte as trata como UMA peça de comprimento total × altura
    const seg=(x0,z0,x1,z1,nx,nz)=>({x0,z0,x1,z1,nx,nz});
    const A=d.A,B=d.B,Cc=d.C,P=d.P;
    const rota=(tipo)=>{
      const back=tipo==='roda';
      if(p.type==='reta'||p.type==='lavatorio')return back?[seg(0,0,A,0,0,-1)]:[seg(0,P,A,P,0,1)];
      if(p.type==='L')return back?[seg(A,0,0,0,0,-1),seg(0,0,0,B,-1,0)]:[seg(A,P,P,P,0,1),seg(P,P,P,B,1,0)];
      if(p.type==='U')return back?[seg(0,B,0,0,-1,0),seg(0,0,A,0,0,-1),seg(A,0,A,Cc,1,0)]
                                  :[seg(P,B,P,P,1,0),seg(P,P,A-P,P,0,1),seg(A-P,P,A-P,Cc,-1,0)];
      if(p.type==='ilha')return back?[seg(0,0,A,0,0,-1),seg(A,0,A,B,1,0),seg(A,B,0,B,0,1),seg(0,B,0,0,-1,0)]
                                    :[seg(0,B,A,B,0,1),seg(A,B,A,0,1,0),seg(A,0,0,0,0,-1),seg(0,0,0,B,-1,0)];
      return null;                                          // escada, nicho, livre: os dados não dizem onde a faixa fica
    };
    [['saia',saiaH,saiaMl,'Saia'],['roda',rodaH,rodaMl,'Rodabanca']].forEach(([tipo,h,mlManual,nome])=>{
      if(!(h>0))return;
      const ml=mlManual||defMl(pp,tipo);let resta=ml*100;
      if(!(resta>0))return;
      const path=rota(tipo);
      const solta=(comp,rot)=>{                               // faixa SEM posição nos dados: deitada ao lado da peça, como no desenho 2D
        const g=6;let zs=Dz+15;
        sol.filter(x=>x.solta).forEach(x=>{zs=Math.max(zs,x.z+x.sz+g)});
        const st=add({kind:tipo,label:nome+rot,solta:true,x:0,y:0,z:zs,sx:comp,sy:t,sz:h,fa:['x','z']});
        st.nom=comp;return st;
      };
      if(!path){solta(resta,' (solta)');return}
      const y=tipo==='saia'?-h:t,feitas=[],parte={tipo,h,total:ml*100,segs:[]};let acc=0,semLugar=0;partes.push(parte);
      path.forEach(s=>{
        if(resta<=1e-9)return;
        const dx=Math.sign(s.x1-s.x0),dz=Math.sign(s.z1-s.z0),comp=Math.abs(s.x1-s.x0)+Math.abs(s.z1-s.z0);
        const l=Math.min(resta,comp);                         // nunca passa do percurso real da pedra
        if(!(l>0))return;
        const alongX=dx!==0;
        const c={kind:tipo,label:nome,y,sy:h,sx:alongX?l:t,sz:alongX?t:l,fa:[alongX?'x':'z','y']};
        c.x=alongX?Math.min(s.x0,s.x0+dx*l):(s.nx>0?s.x0-t:s.x0);
        c.z=alongX?(s.nz>0?s.z0-t:s.z0):Math.min(s.z0,s.z0+dz*l);
        /* junta de topo nos cantos: a faixa que encosta é encurtada (só no desenho). O comprimento nominal `nom`
           e a `face` seguem os do corte, para a área e o plano de corte não mudarem. */
        feitas.forEach(f=>{
          const ox=[Math.max(c.x,f.x),Math.min(c.x+c.sx,f.x+f.sx)],oz=[Math.max(c.z,f.z),Math.min(c.z+c.sz,f.z+f.sz)];
          if(!(ox[1]-ox[0]>1e-9&&oz[1]-oz[0]>1e-9))return;
          if(alongX){if(ox[0]<=c.x+1e-9){c.sx-=ox[1]-c.x;c.x=ox[1]}else c.sx=ox[0]-c.x}
          else{if(oz[0]<=c.z+1e-9){c.sz-=oz[1]-c.z;c.z=oz[1]}else c.sz=oz[0]-c.z}
        });
        if(!(c.sx>1e-9&&c.sz>1e-9)){semLugar+=l;resta-=l;acc+=l;return}     // menor que a espessura: vai para a faixa solta
        const st=add(c);st.nom=l;st.faceGeom=st.face;st.face=l*h;
        Object.assign(st,{nomIni:acc,eixoP:alongX?'x':'z',sinal:alongX?dx:dz,inicio:alongX?s.x0:s.z0,parte:true});
        parte.segs.push(st);feitas.push(st);resta-=l;acc+=l;
      });
      const sobra=resta+semLugar;                             // metragem que não cabe no percurso (ou em cantos menores que a espessura)
      if(sobra>1e-9){
        const st=solta(sobra,' (sem posição)');
        Object.assign(st,{nomIni:acc-semLugar,eixoP:'x',sinal:1,inicio:st.x,parte:true});parte.segs.push(st);
        if(sobra>t*2)avisos.push(nome+': '+fmt(Math.round(sobra*10)/10)+' cm de faixa não têm posição definida nos dados (a metragem passa do contorno da peça); aparecem soltas ao lado.');
      }
    });

    /* ---- recortes: só os que vierem na peça (p.recortes) e couberem inteiros num tampo ---- */
    const recortes=[];
    (Array.isArray(p.recortes)?p.recortes:[]).forEach((r,i)=>{
      const nome=(r&&r.tipo)||'recorte';
      const num=[r&&r.x,r&&r.z,r&&r.w,r&&r.d].every(v=>typeof v==='number'&&isFinite(v));
      if(!num||!(r.w>0)||!(r.d>0)){avisos.push('Recorte "'+nome+'" sem medidas válidas: não desenhado.');return}
      const dentro=s=>r.x>s.x&&r.z>s.z&&r.x+r.w<s.x+s.sx&&r.z+r.d<s.z+s.sz;
      const hospedeira=sol.find(s=>s.kind==='tampo'&&dentro(s));
      if(!hospedeira){
        avisos.push(sol.some(s=>s.kind!=='tampo'&&s.kind!=='saia'&&s.kind!=='roda'&&dentro(s))
          ?'Recorte "'+nome+'" em piso ou painel não é desenhado nesta versão.'
          :'Recorte "'+nome+'" fora da pedra (ou encostado na borda): não desenhado.');
        return;
      }
      const ocupa=(hospedeira.furos||[]).some(f=>Math.min(f.x+f.w,r.x+r.w)>Math.max(f.x,r.x)&&Math.min(f.z+f.d,r.z+r.d)>Math.max(f.z,r.z));
      if(ocupa){avisos.push('Recorte "'+nome+'" sobrepõe outro: não desenhado.');return}
      const f={tipo:nome,x:r.x,z:r.z,w:r.w,d:r.d,solidId:hospedeira.id};
      (hospedeira.furos=hospedeira.furos||[]).push(f);recortes.push(f);
    });

    /* ---- emendas: cortes que o plano de corte faz em cada peça maior que a chapa ---- */
    const emendas=[];let emendasPlano=0;               // emendas = planos de corte desenhados; emendasPlano = o que o cálculo conta (peças − 1)
    const volta=(s,eixo,pos)=>{                                            // contorno do corte: seção do sólido no plano eixo=pos
      const o0=[s.x,s.y,s.z],tam=[s.sx,s.sy,s.sz],i0=AX[eixo],outros=[0,1,2].filter(k=>k!==i0);
      const pts=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const q=[0,0,0];q[i0]=pos;q[outros[0]]=o0[outros[0]]+u*tam[outros[0]];q[outros[1]]=o0[outros[1]]+v*tam[outros[1]];return q});
      emendas.push({solidId:s.id,eixo,pos,pts});
    };
    sol.filter(s=>!s.parte).forEach(s=>{
      const dim={x:s.sx,y:s.sy,z:s.sz},[a,b]=s.fa;
      const dv=divisoes(s.nom!=null?s.nom:dim[a],dim[b],SL,SW);          // faixas: comprimento nominal do corte
      emendasPlano+=dv.emendas;
      const longo=(s.nom!=null?s.nom:dim[a])>=dim[b]?a:b,curto=longo===a?b:a;
      const cortes=[];
      for(let i=1;i<Math.min(dv.k,200);i++)cortes.push([longo,dim[longo]*i/dv.k]);       // no máximo 200 linhas por peça
      for(let j=1;j<Math.min(dv.m,200);j++)cortes.push([curto,dim[curto]*j/dv.m]);
      cortes.forEach(([eixo,pos])=>volta(s,eixo,[s.x,s.y,s.z][AX[eixo]]+pos));
    });
    partes.forEach(pt=>{
      if(!pt.segs.length&&!(pt.total>0))return;
      const dv=divisoes(pt.total,pt.h,SL,SW);emendasPlano+=dv.emendas;
      for(let i=1;i<Math.min(dv.k,200);i++){                               // cortes nos múltiplos de total/k, ao longo do percurso
        const c=pt.total*i/dv.k,sg=pt.segs.filter(s=>s.nomIni<=c+1e-9&&c<=s.nomIni+s.nom+1e-9).pop()||pt.segs[pt.segs.length-1];
        if(!sg)continue;
        const ini=[s=>s.x,s=>s.z][sg.eixoP==='x'?0:1](sg),fim=ini+(sg.eixoP==='x'?sg.sx:sg.sz);
        const bruto=sg.inicio+sg.sinal*(c-sg.nomIni);
        volta(sg,sg.eixoP,Math.min(Math.max(bruto,ini),fim));
      }
    });

    recortes.forEach(r=>{                                                  // recorte em cima de uma emenda: continua desenhado, mas avisa
      if(emendas.some(e=>e.solidId===r.solidId&&((e.eixo==='x'&&e.pos>r.x&&e.pos<r.x+r.w)||(e.eixo==='z'&&e.pos>r.z&&e.pos<r.z+r.d))))
        avisos.push('Recorte "'+r.tipo+'" cruza uma emenda do plano de corte.');
    });

    /* rede de segurança: partes que se sobrepõem indicam medidas inconsistentes (ex.: U com A < 2P) */
    let sobrepostas=false;
    for(let i=0;i<sol.length&&!sobrepostas;i++)for(let j=i+1;j<sol.length;j++){
      const a=sol[i],b=sol[j],o=(p0,q0,r0,s0)=>Math.max(0,Math.min(p0+q0,r0+s0)-Math.max(p0,r0));
      if(o(a.x,a.sx,b.x,b.sx)*o(a.y,a.sy,b.y,b.sy)*o(a.z,a.sz,b.z,b.sz)>1e-6){sobrepostas=true;break}
    }
    if(sobrepostas)avisos.push(pp.type==='U'&&d.A>0&&d.A<2*d.P
      ?'No U, a largura A precisa ser pelo menos 2 vezes a profundidade P: as pernas se sobrepõem e o cálculo conta pedra que não existe.'
      :'Medidas inconsistentes: partes da peça se sobrepõem. Confira as medidas.');

    const bb=caixa(sol);
    const modelo={solids:sol,espessura:t,espessuraOrigem:origem,vazio:!sol.length,
      bbox:sol.length?bb:{min:[0,0,0],max:[0,0,0]},bboxPeca:principais.length?bp:{min:[0,0,0],max:[0,0,0]},
      area:sol.reduce((s,x)=>s+x.face,0)/1e4,emendas,emendasPlano,recortes,avisos,
      peca:{type:p.type,d:JSON.parse(JSON.stringify(d)),saiaH,rodaH}};
    modelo.cotas=cotas(modelo);
    return modelo;
  }

  function caixa(lista){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    lista.forEach(s=>{[[s.x,s.x+s.sx],[s.y,s.y+s.sy],[s.z,s.z+s.sz]].forEach(([a,b],i)=>{min[i]=Math.min(min[i],a);max[i]=Math.max(max[i],b)})});
    return {min,max};
  }

  /* ===== Cotas =====
     Cada cota liga dois pontos REAIS da peça (p1, p2, em cm) e o comprimento entre eles é o valor
     vindo dos dados (|p2 − p1| = valor; testado). `dir` é para onde a linha de cota é deslocada (`off` cm).
     lado = {x:'esq'|'dir', z:'frente'|'fundo'}: lado preferido nas peças retangulares; L e U têm posição fixa
     para nunca cruzar a pedra. Só mostra dimensões que existem no desenho; nada é estimado. */
  function cotas(m,lado){
    lado=Object.assign({x:'esq',z:'frente'},lado||{});
    const out=[];if(m.vazio)return out;
    const {type,d}=m.peca,t=m.espessura,bp=m.bboxPeca;
    const grande=Math.max(bp.max[0]-bp.min[0],bp.max[2]-bp.min[2]);
    const off=Math.min(24,Math.max(7,grande*0.06));
    const add=(cat,rot,valor,p1,p2,dir,prio)=>{
      if(!(valor>0)||!isFinite(valor))return;
      out.push({id:cat+'-'+out.length,categoria:cat,tipo:'cota',valor,p1,p2,dir,off,prio:prio||0,
        texto:(rot?rot+' ':'')+fmt(valor)+' cm'});
    };
    const rotulo=(texto,pos,prio)=>out.push({id:'rot-'+out.length,categoria:'rotulo',tipo:'rotulo',texto,pos,prio:prio||3});
    const espTxt='e';                                        // espessura
    const espOrig=m.espessuraOrigem==='padrao'?' (padrão)':'';
    const addEsp=(p1,p2,dir)=>{add('espessura',espTxt,t,p1,p2,dir,2);const c=out[out.length-1];if(c&&espOrig)c.texto+=espOrig};
    const zEd=lado.z==='fundo'?bp.min[2]:bp.max[2],dz=lado.z==='fundo'?-1:1;
    const xEd=lado.x==='dir'?bp.max[0]:bp.min[0],dx=lado.x==='dir'?1:-1;
    const xOp=lado.x==='dir'?bp.min[0]:bp.max[0],dxOp=-dx;  // lado oposto (espessura)

    if(type==='reta'||type==='lavatorio'||type==='ilha'){
      const compr=d.A,prof=type==='ilha'?d.B:d.P;
      add('plano','',compr,[bp.min[0],t,zEd],[bp.min[0]+compr,t,zEd],[0,0,dz]);
      add('plano','',prof,[xEd,t,bp.min[2]],[xEd,t,bp.min[2]+prof],[dx,0,0]);
      addEsp([xOp,0,zEd],[xOp,t,zEd],[dxOp,0,0]);
    }else if(type==='L'){
      add('plano','A',d.A,[0,t,0],[d.A,t,0],[0,0,-1]);                        // trecho A, borda de trás
      if(d.B>d.P){
        add('plano','B',d.B,[0,t,0],[0,t,d.B],[-1,0,0]);                       // trecho B, borda da esquerda
        add('plano','prof.',d.P,[0,t,d.B],[d.P,t,d.B],[0,0,1]);                // largura da ponta do trecho B
        addEsp([d.P,0,d.B],[d.P,t,d.B],[1,0,0]);
      }else{
        add('plano','prof.',d.P,[d.A,t,0],[d.A,t,d.P],[1,0,0]);
        addEsp([d.A,0,d.P],[d.A,t,d.P],[1,0,0]);
      }
    }else if(type==='U'){
      add('plano','A',d.A,[0,t,0],[d.A,t,0],[0,0,-1]);
      if(d.B>d.P)add('plano','B',d.B,[0,t,0],[0,t,d.B],[-1,0,0]);              // lateral esquerda
      if(d.C>d.P)add('plano','C',d.C,[d.A,t,0],[d.A,t,d.C],[1,0,0]);           // lateral direita
      if(d.B>d.P){
        add('plano','prof.',d.P,[0,t,d.B],[d.P,t,d.B],[0,0,1]);
        addEsp([d.P,0,d.B],[d.P,t,d.B],[1,0,0]);
      }else{
        add('plano','prof.',d.P,[d.A,t,0],[d.A,t,d.P],[1,0,0]);
        addEsp([d.A,0,d.P],[d.A,t,d.P],[1,0,0]);
      }
    }else if(type==='escada'){
      const n=Math.max(1,Math.round(d.N)),zf=n*d.PI;
      add('plano','',d.A,[0,d.ES,zf],[d.A,d.ES,zf],[0,0,1]);                    // largura
      add('plano','piso',d.PI,[d.A,d.ES,zf-d.PI],[d.A,d.ES,zf],[1,0,0]);        // profundidade do piso
      add('altura','esp.',d.ES,[d.A,-t,zf],[d.A,d.ES-t,zf],[1,0,0],1);          // altura do espelho
      addEsp([0,d.ES-t,zf],[0,d.ES,zf],[-1,0,0]);
      rotulo(n+(n===1?' degrau':' degraus'),[d.A/2,n*d.ES,zf/2]);
    }else if(type==='nicho'){
      const z1=t+d.P;
      add('plano','',d.A,[0,d.H,z1],[d.A,d.H,z1],[0,0,1]);                      // largura
      add('altura','',d.H,[-t,0,z1],[-t,d.H,z1],[-1,0,0],1);                    // altura
      add('plano','prof.',d.P,[d.A+t,d.H,t],[d.A+t,d.H,z1],[1,0,0]);            // profundidade
      addEsp([-t,d.H,z1],[0,d.H,z1],[0,0,1]);
    }else if(type==='livre'){
      m.solids.filter(s=>s.kind==='tampo').slice(0,12).forEach(s=>rotulo(fmt(s.sx)+' × '+fmt(s.sz)+' cm',[s.x+s.sx/2,t,s.z+s.sz/2],2));
    }

    /* altura da saia e da rodabanca (só se existirem): vertical na face de fora da primeira faixa */
    const cx=(bp.min[0]+bp.max[0])/2,cz=(bp.min[2]+bp.max[2])/2;
    const longe=(a,b,c)=>Math.abs(a-c)>=Math.abs(b-c)?a:b;
    ['saia','roda'].forEach(k=>{
      const s=m.solids.find(x=>x.kind===k);if(!s)return;
      const alongX=s.fa[0]==='x',h=k==='saia'?m.peca.saiaH:m.peca.rodaH;
      if(s.solta){add('altura',k==='saia'?'saia':'roda',h,[s.x,t,s.z],[s.x,t,s.z+s.sz],[-1,0,0],1);return}   // deitada: altura no eixo z
      /* faixa ao longo de x: a altura vai para o lado oposto ao da profundidade (reta, lavatório, ilha) ou para a
         direita no L; assim as cotas não se amontoam. Nos demais formatos, para a esquerda. */
      const dirX=alongX?(['reta','lavatorio','ilha'].includes(type)?-dx:(type==='L'?1:-1)):(s.x+s.sx/2>=cx?1:-1);
      const x=alongX?(dirX>0?s.x+s.sx:s.x):longe(s.x,s.x+s.sx,cx),z=alongX?longe(s.z,s.z+s.sz,cz):s.z;
      add('altura',k==='saia'?'saia':'roda',h,[x,s.y,z],[x,s.y+s.sy,z],[dirX,0,0],1);
    });

    /* recortes: rótulo no centro da abertura, com as medidas dadas */
    m.recortes.forEach(r=>rotulo(r.tipo+' '+fmt(r.w)+'×'+fmt(r.d)+' cm',[r.x+r.w/2,t,r.z+r.d/2],2));
    return out;
  }

  const api={buildModel,cotas,ESP_PADRAO,fmt};
  if(typeof module!=='undefined')module.exports=api;else root.Model3D=api;
})(typeof window!=='undefined'?window:globalThis);
