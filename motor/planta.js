/* Projetta: planta baixa de formato livre ORTOGONAL (L, U, T e variações): paredes só na horizontal e na vertical.
   Funções puras, sem tela e sem localStorage; roda no navegador (funções globais) e no Node (tests/planta.test.js).
   TUDO EM CENTÍMETROS. Áreas em m², perímetro em m, volume em m³. Precisa de motor/ambiente.js carregado antes.

   Um ambiente de planta tem `pontos` [{x,y}] (cantos, em ordem em volta do ambiente), `altura`, `aberturas` e `revestimentos`.
   A parede i liga o ponto i ao ponto i+1 (o último volta ao primeiro). No 3D: x = x da planta, z = y da planta, y = altura.
   Abertura: `aresta` (índice da parede) e `x` = distância do início da parede (ponto i) até a abertura, na direção i → i+1.
   As paredes ficam FORA da planta (a planta é o vão interno), como no ambiente retangular. */

const _ambMotor=(typeof module!=='undefined'&&typeof require!=='undefined')?require('./ambiente.js'):null;
const plLim=_ambMotor?_ambMotor.AMB_LIM:AMB_LIM;
const plNum=_ambMotor?_ambMotor.ambNum:ambNum;
const plPerda=_ambMotor?_ambMotor.ambPerda:ambPerda;
const plSegmentos=_ambMotor?_ambMotor.ambSegmentos:ambSegmentos;

function criarPlanta(d){
  if(!d||typeof d!=='object')d={};
  const pts=Array.isArray(d.pontos)?d.pontos:[];
  return {
    id:d.id||'',nome:String(d.nome==null?'Ambiente':d.nome),altura:plNum(d.altura),
    pontos:pts.map(p=>({x:plNum(p&&p.x),y:plNum(p&&p.y)})),
    aberturas:(Array.isArray(d.aberturas)?d.aberturas:[]).map((a,i)=>({
      id:(a&&a.id)||'a'+(i+1),tipo:a&&a.tipo==='janela'?'janela':'porta',aresta:a&&a.aresta===''?NaN:plNum(a&&a.aresta),
      x:plNum(a&&a.x),largura:plNum(a&&a.largura),altura:plNum(a&&a.altura),peitoril:a&&a.peitoril==null||a&&a.peitoril===''?0:plNum(a&&a.peitoril)})),
    revestimentos:(Array.isArray(d.revestimentos)?d.revestimentos:[]).map((r,i)=>({id:(r&&r.id)||'r'+(i+1),aresta:r&&r.aresta===''?NaN:plNum(r&&r.aresta),altura:plNum(r&&r.altura)})),
    perdas:{piso:plPerda(d.perdas&&d.perdas.piso),revestimento:plPerda(d.perdas&&d.perdas.revestimento),rodape:plPerda(d.perdas&&d.perdas.rodape)}
  };
}

/* Pontos de formatos prontos. Origem no canto de trás à esquerda; x para a direita, y para a frente.
   A,B = largura e comprimento totais; a,b = tamanho do recorte (L: canto; U: no meio do lado de trás; T: largura do braço e profundidade da barra). */
function plantaFormato(tipo,A,B,a,b){
  const P=(x,y)=>({x,y});
  if(tipo==='L')return [P(0,0),P(A-a,0),P(A-a,b),P(A,b),P(A,B),P(0,B)];
  if(tipo==='U'){const x0=(A-a)/2;return [P(0,0),P(x0,0),P(x0,b),P(x0+a,b),P(x0+a,0),P(A,0),P(A,B),P(0,B)]}
  if(tipo==='T'){const x0=(A-a)/2;return [P(0,0),P(A,0),P(A,b),P(x0+a,b),P(x0+a,B),P(x0,B),P(x0,b),P(0,b)]}
  return [P(0,0),P(A,0),P(A,B),P(0,B)];
}

const plArestas=pts=>pts.map((p,i)=>{const q=pts[(i+1)%pts.length];const dx=q.x-p.x,dy=q.y-p.y;const L=Math.abs(dx)+Math.abs(dy);return {i,p,q,L,ux:L?dx/L:0,uy:L?dy/L:0}});
const plArea2=pts=>pts.reduce((t,p,i)=>{const q=pts[(i+1)%pts.length];return t+(p.x*q.y-q.x*p.y)},0);   // 2 × área com sinal
const plCompPlano=pts=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)}};

/* dois segmentos axis-aligned se cruzam ou se tocam? */
function plSegTocam(a,b){
  const lo=(u,v)=>Math.min(u,v),hi=(u,v)=>Math.max(u,v);
  return lo(a.p.x,a.q.x)<=hi(b.p.x,b.q.x)+1e-9&&hi(a.p.x,a.q.x)>=lo(b.p.x,b.q.x)-1e-9&&lo(a.p.y,a.q.y)<=hi(b.p.y,b.q.y)+1e-9&&hi(a.p.y,a.q.y)>=lo(b.p.y,b.q.y)-1e-9;
}

function validarPlanta(entrada){
  const a=criarPlanta(entrada),erros=[],pts=a.pontos;
  if(!(a.altura>=plLim.altMin&&a.altura<=plLim.altMax))erros.push('A altura precisa estar entre '+plLim.altMin+' e '+plLim.altMax+' cm.');
  if(pts.length<4||pts.length%2!==0){erros.push('A planta precisa ter ao menos 4 cantos (e um número par deles).');return {ok:false,erros}}
  if(pts.some(p=>!isFinite(p.x)||!isFinite(p.y))){erros.push('Todos os cantos precisam ter medidas válidas.');return {ok:false,erros}}
  const ar=plArestas(pts);
  ar.forEach(e=>{
    if(e.p.x!==e.q.x&&e.p.y!==e.q.y)erros.push('Parede '+(e.i+1)+': só paredes retas na horizontal ou na vertical.');
    else if(e.L<plLim.min)erros.push('Parede '+(e.i+1)+': precisa ter pelo menos '+plLim.min+' cm.');
  });
  if(erros.length)return {ok:false,erros};
  ar.forEach((e,i)=>{const f=ar[(i+1)%ar.length];if(e.ux*f.ux+e.uy*f.uy!==0)erros.push('Paredes '+(e.i+1)+' e '+(f.i+1)+': precisam formar um canto reto.')});
  const c=plCompPlano(pts);
  if(c.maxx-c.minx>plLim.max||c.maxy-c.miny>plLim.max)erros.push('A planta passa de '+plLim.max+' cm.');
  if(erros.length)return {ok:false,erros};
  for(let i=0;i<ar.length;i++)for(let j=i+1;j<ar.length;j++){
    if(j===i+1||(i===0&&j===ar.length-1))continue;                           // vizinhas só dividem o canto (já conferido)
    if(plSegTocam(ar[i],ar[j])){erros.push('As paredes '+(i+1)+' e '+(j+1)+' se cruzam ou se encostam.');return {ok:false,erros}}
  }
  const porAresta={};
  a.aberturas.forEach((o,k)=>{
    const nome=(o.tipo==='janela'?'Janela ':'Porta ')+(k+1);
    if(!(Number.isInteger(o.aresta)&&o.aresta>=0&&o.aresta<ar.length)){erros.push(nome+': escolha a parede.');return}
    if(!(o.largura>0)||!(o.altura>0)||!(o.x>=0)||!(o.peitoril>=0)){erros.push(nome+': posição, largura e altura precisam ser números válidos (largura e altura maiores que zero).');return}
    if(o.tipo==='porta'&&o.peitoril!==0){erros.push(nome+': porta começa no piso (peitoril 0).');return}
    if(o.x+o.largura>ar[o.aresta].L+1e-9)erros.push(nome+': não cabe na parede '+(o.aresta+1)+' ('+ar[o.aresta].L+' cm).');
    if(o.peitoril+o.altura>a.altura+1e-9)erros.push(nome+': passa da altura do ambiente ('+a.altura+' cm).');
    (porAresta[o.aresta]=porAresta[o.aresta]||[]).push({o,nome});
  });
  Object.values(porAresta).forEach(l=>{const ord=l.slice().sort((p,q)=>p.o.x-q.o.x);
    for(let i=1;i<ord.length;i++)if(ord[i].o.x<ord[i-1].o.x+ord[i-1].o.largura-1e-9)erros.push(ord[i-1].nome+' e '+ord[i].nome+' se sobrepõem na mesma parede.')});
  a.revestimentos.forEach((r,k)=>{const nome='Revestimento '+(k+1);
    if(!(Number.isInteger(r.aresta)&&r.aresta>=0&&r.aresta<ar.length)){erros.push(nome+': escolha a parede.');return}
    if(!(r.altura>0&&r.altura<=a.altura+1e-9))erros.push(nome+': a altura precisa ser maior que zero e no máximo '+a.altura+' cm.')});
  Object.entries(a.perdas).forEach(([k,v])=>{if(!(v>=0&&v<=100))erros.push('A perda de '+k+' precisa estar entre 0 e 100%.')});
  return {ok:erros.length===0,erros};
}

/* mesmo formato de medidasAmbiente (motor/ambiente.js), com paredes numeradas */
function medidasPlanta(entrada){
  const v=validarPlanta(entrada);if(!v.ok)return {ok:false,erros:v.erros};
  const a=criarPlanta(entrada),M=1e4,ar=plArestas(a.pontos),area=Math.abs(plArea2(a.pontos))/2;
  const paredes=ar.map(e=>{const ab=a.aberturas.filter(o=>o.aresta===e.i),aa=ab.reduce((s,o)=>s+o.largura*o.altura,0);
    return {id:'P'+(e.i+1),nome:'Parede '+(e.i+1),comprimento:e.L,areaBruta:e.L*a.altura/M,areaAberturas:aa/M,areaLiquida:(e.L*a.altura-aa)/M,aberturas:ab.length}});
  const soma=k=>paredes.reduce((s,p)=>s+p[k],0),per=ar.reduce((s,e)=>s+e.L,0)/100;
  return {ok:true,erros:[],areaPiso:area/M,areaTeto:area/M,perimetro:per,volume:area*a.altura/1e6,paredes,
    areaParedesBruta:soma('areaBruta'),areaAberturas:soma('areaAberturas'),areaParedesLiquida:soma('areaLiquida'),
    portas:a.aberturas.filter(o=>o.tipo==='porta').length,janelas:a.aberturas.filter(o=>o.tipo==='janela').length};
}

/* mesmos códigos e itens do quantitativoAmbiente; revestimento por parede: AMB-REV-P3 (repetida: AMB-REV-P3-2) */
function quantitativoPlanta(entrada){
  const v=validarPlanta(entrada);if(!v.ok)return {ok:false,erros:v.erros,itens:[]};
  const a=criarPlanta(entrada),m=medidasPlanta(a),ar=plArestas(a.pontos),itens=[];
  const add=(codigo,descricao,unidade,quantidade,perdaPct=0)=>itens.push({codigo,descricao,unidade,quantidade,perdaPct,quantidadeComPerda:quantidade*(1+perdaPct/100)});
  add('AMB-PISO','Piso','m²',m.areaPiso,a.perdas.piso);
  add('AMB-TETO','Teto / forro','m²',m.areaTeto);
  add('AMB-PINT-PAREDE','Pintura das paredes (líquida)','m²',m.areaParedesLiquida);
  add('AMB-PINT-TETO','Pintura do teto','m²',m.areaTeto);
  const portas=a.aberturas.filter(o=>o.tipo==='porta').reduce((t,o)=>t+o.largura,0);
  add('AMB-RODAPE','Rodapé (perímetro menos portas)','m',Math.max(0,m.perimetro-portas/100),a.perdas.rodape);
  const nRev={};
  a.revestimentos.forEach(r=>{
    const e=ar[r.aresta],n=nRev[r.aresta]=(nRev[r.aresta]||0)+1;
    const abertas=a.aberturas.filter(o=>o.aresta===r.aresta).reduce((t,o)=>t+o.largura*Math.max(0,Math.min(r.altura,o.peitoril+o.altura)-o.peitoril),0);
    add('AMB-REV-P'+(r.aresta+1)+(n>1?'-'+n:''),'Revestimento parede '+(r.aresta+1)+' até '+r.altura+' cm','m²',(e.L*r.altura-abertas)/1e4,a.perdas.revestimento);
  });
  return {ok:true,erros:[],itens};
}

/* retângulos [x0,y0,x1,y1] que cobrem exatamente o interior (faixas horizontais entre as alturas dos cantos) */
function plRetangulos(pts){
  const ys=[...new Set(pts.map(p=>p.y))].sort((p,q)=>p-q),ar=plArestas(pts),out=[];
  for(let k=0;k+1<ys.length;k++){
    const y0=ys[k],y1=ys[k+1],meio=(y0+y1)/2;
    const xs=ar.filter(e=>e.p.x===e.q.x&&Math.min(e.p.y,e.q.y)<meio&&Math.max(e.p.y,e.q.y)>meio).map(e=>e.p.x).sort((p,q)=>p-q);
    for(let j=0;j+1<xs.length;j+=2)out.push([xs[j],y0,xs[j+1],y1]);
  }
  return out;
}

/* Modelo 3D no mesmo contrato do model3d.js e do modeloAmbiente (solids, bbox, cotas...). op.teto:false tira o forro. */
function modeloPlanta(entrada,op={}){
  const vazio={solids:[],espessura:plLim.pisoEsp,espessuraOrigem:'ambiente',vazio:true,bbox:{min:[0,0,0],max:[0,0,0]},bboxPeca:{min:[0,0,0],max:[0,0,0]},
    area:0,emendas:[],emendasPlano:0,recortes:[],statusRecortes:[],equipamentos:[],avisos:[],cotas:[],peca:{type:'ambiente',d:{},saiaH:0,rodaH:0},cotasDe:()=>[]};
  const v=validarPlanta(entrada);if(!v.ok){vazio.avisos=v.erros;return vazio}
  const a=criarPlanta(entrada),H=a.altura,t=plLim.esp,pe=plLim.pisoEsp,pts=a.pontos,ar=plArestas(pts),sinal=plArea2(pts)>0?1:-1,solids=[];
  const add=s=>{if(s.sx>1e-9&&s.sy>1e-9&&s.sz>1e-9){s.id=s.id||'s'+solids.length;solids.push(s)}};
  plRetangulos(pts).forEach(r=>{
    add({kind:'piso',label:'Piso',x:r[0],y:-pe,z:r[1],sx:r[2]-r[0],sy:pe,sz:r[3]-r[1]});
    if(op.teto!==false)add({kind:'teto',label:'Teto',x:r[0],y:H,z:r[1],sx:r[2]-r[0],sy:pe,sz:r[3]-r[1]});
  });
  /* normal para fora: o interior fica do lado "esquerdo" se a planta gira no sentido positivo */
  const fora=e=>({x:sinal>0?e.uy:-e.uy,y:sinal>0?-e.ux:e.ux});
  const convexo=i=>{const e=ar[(i+ar.length-1)%ar.length],f=ar[i];return (e.ux*f.uy-e.uy*f.ux)*sinal>0};   // canto no ponto i (entre a parede anterior e a parede i)
  ar.forEach(e=>{
    const o=fora(e),a0=convexo(e.i)?0:t,a1=convexo((e.i+1)%ar.length)?e.L+t:e.L;                // canto de fora: a parede anterior cresce; canto de dentro: esta encurta
    const ab=a.aberturas.filter(x=>x.aresta===e.i);
    const rect=(s0,s1)=>{                                                                      // trecho [s0,s1] ao longo da parede, espessura para fora
      const xs=[e.p.x+e.ux*s0,e.p.x+e.ux*s1,e.p.x+e.ux*s0+o.x*t,e.p.x+e.ux*s1+o.x*t],zs=[e.p.y+e.uy*s0,e.p.y+e.uy*s1,e.p.y+e.uy*s0+o.y*t,e.p.y+e.uy*s1+o.y*t];
      return {x:Math.min(...xs),z:Math.min(...zs),sx:Math.max(...xs)-Math.min(...xs),sz:Math.max(...zs)-Math.min(...zs)};
    };
    plSegmentos(e.L,H,ab,[-a0,a1-e.L]).forEach(s=>{const r=rect(s.a,s.b);add({kind:'parede',label:'Parede '+(e.i+1),x:r.x,y:s.y0,z:r.z,sx:r.sx,sy:s.y1-s.y0,sz:r.sz})});
    ab.filter(x=>x.tipo==='janela').forEach(x=>{                                              // vidro fino no meio da espessura
      const r=rect(x.x,x.x+x.largura),horiz=e.uy===0;
      add({kind:'vidro',label:'Janela',x:horiz?r.x:r.x+t/2-0.5,y:x.peitoril,z:horiz?r.z+t/2-0.5:r.z,sx:horiz?r.sx:1,sy:x.altura,sz:horiz?1:r.sz});
    });
  });
  const c=plCompPlano(pts),min=[c.minx-t,-pe,c.miny-t],max=[c.maxx+t,op.teto===false?H:H+pe,c.maxy+t];
  const cotas=[],cota=(cat,valor,p1,p2,dir,prio,rot)=>cotas.push({id:cat+'-'+cotas.length,categoria:cat,tipo:'cota',valor,p1,p2,dir,off:Math.min(40,Math.max(15,Math.max(c.maxx-c.minx,c.maxy-c.miny)*0.06)),prio,texto:(rot?rot+' ':'')+valor+' cm'});
  ar.forEach(e=>{const o=fora(e);cota('plano',e.L,[e.p.x+o.x*t,0,e.p.y+o.y*t],[e.q.x+o.x*t,0,e.q.y+o.y*t],[o.x,0,o.y],0,'parede '+(e.i+1))});
  cota('altura',H,[c.minx-t,0,c.maxy+t],[c.minx-t,H,c.maxy+t],[-1,0,0],1,'altura');
  a.aberturas.forEach((x,k)=>{const e=ar[x.aresta],s=x.x+x.largura/2;
    cotas.push({id:'rot-ab'+k,categoria:'rotulo',tipo:'rotulo',texto:(x.tipo==='janela'?'janela ':'porta ')+x.largura+'×'+x.altura,pos:[e.p.x+e.ux*s+fora(e).x*t/2,x.peitoril+x.altura/2,e.p.y+e.uy*s+fora(e).y*t/2],prio:2})});
  return {...vazio,solids,vazio:false,bbox:{min,max},bboxPeca:{min:[c.minx,0,c.miny],max:[c.maxx,H,c.maxy]},area:Math.abs(plArea2(pts))/2/1e4,cotas,cotasDe:()=>cotas,
    peca:{type:'ambiente',d:{A:c.maxx-c.minx,B:c.maxy-c.miny,H},saiaH:0,rodaH:0}};
}

/* Mover a parede i para o lado (positivo = para a direita da planta ou para a frente): os dois cantos dela andam juntos.
   Devolve {ok,pontos,erro}: nada é aplicado se o resultado não for uma planta válida. */
function plantaMoverParede(entrada,i,delta){
  const a=criarPlanta(entrada),pts=a.pontos.map(p=>({...p}));
  if(!Number.isInteger(i)||i<0||i>=pts.length||!isFinite(delta))return {ok:false,pontos:a.pontos,erro:'Parede ou deslocamento inválido.'};
  const p=pts[i],q=pts[(i+1)%pts.length],horiz=p.y===q.y;
  if(horiz){p.y+=delta;q.y+=delta}else{p.x+=delta;q.x+=delta}
  const v=validarPlanta({...entrada,pontos:pts,aberturas:entrada&&entrada.aberturas||[],revestimentos:entrada&&entrada.revestimentos||[]});
  return v.ok?{ok:true,pontos:pts,erro:''}:{ok:false,pontos:a.pontos,erro:v.erros[0]};
}

if(typeof module!=='undefined')module.exports={criarPlanta,plantaFormato,validarPlanta,medidasPlanta,quantitativoPlanta,modeloPlanta,plantaMoverParede,plRetangulos,plArea2};
