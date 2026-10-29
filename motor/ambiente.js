/* Marmofácil: motor de Ambiente (paredes, piso, teto, portas e janelas).
   Funções puras, sem tela e sem localStorage; roda no navegador (funções globais) e no Node (tests/motor-ambiente.test.js).
   TUDO EM CENTÍMETROS. Áreas saem em m², perímetro em m e volume em m³.

   Convenção dos eixos (a mesma do model3d.js): x = largura (esquerda → direita), y = altura (para cima), z = comprimento (do fundo para a frente).
   Paredes: 'N' = fundo (z = 0), 'S' = frente (z = comprimento), 'O' = esquerda (x = 0), 'L' = direita (x = largura).
   Uma abertura (porta ou janela) tem `x` = distância do canto esquerdo da parede, OLHANDO A PAREDE DE DENTRO DO AMBIENTE. */

const AMB_LIM={min:30,max:5000,altMin:150,altMax:1000,esp:10,pisoEsp:5};     // limites de entrada (cm) e espessuras desenhadas (cm)
const AMB_PAREDES=['N','S','O','L'];
const AMB_NOME_PAREDE={N:'Fundo',S:'Frente',O:'Esquerda',L:'Direita'};

const ambNum=v=>{const n=typeof v==='string'?parseFloat(v.replace(',','.')):v;return typeof n==='number'&&isFinite(n)?n:NaN};

/* Ambiente normalizado: números de verdade, aberturas com id. NÃO altera o que veio de fora. */
function criarAmbiente(d){
  if(!d||typeof d!=='object')d={};                                          // null, texto e números viram ambiente vazio (inválido), nunca erro
  const ab=Array.isArray(d.aberturas)?d.aberturas:[];
  return {
    id:d.id||'',nome:String(d.nome==null?'Ambiente':d.nome),
    largura:ambNum(d.largura),comprimento:ambNum(d.comprimento),altura:ambNum(d.altura),
    aberturas:ab.map((a,i)=>({
      id:(a&&a.id)||'a'+(i+1),tipo:a&&a.tipo==='janela'?'janela':'porta',parede:a&&a.parede,
      x:ambNum(a&&a.x),largura:ambNum(a&&a.largura),altura:ambNum(a&&a.altura),peitoril:a&&a.peitoril==null||a&&a.peitoril===''?0:ambNum(a&&a.peitoril)
    })),
    revestimentos:(Array.isArray(d.revestimentos)?d.revestimentos:[]).map((r,i)=>({id:(r&&r.id)||'r'+(i+1),parede:r&&r.parede,altura:ambNum(r&&r.altura)})),
    perdas:{piso:ambPerda(d.perdas&&d.perdas.piso),revestimento:ambPerda(d.perdas&&d.perdas.revestimento),rodape:ambPerda(d.perdas&&d.perdas.rodape)}
  };
}
/* perda em %: vazio = 0 (o app não inventa percentual); texto inválido vira NaN e a validação recusa */
const ambPerda=v=>v==null||v===''?0:ambNum(v);

const ambCompParede=(a,p)=>p==='N'||p==='S'?a.largura:a.comprimento;

/* {ok, erros[]}: nada é "corrigido" em silêncio; o motor só calcula com ambiente válido. */
function validarAmbiente(entrada){
  const a=criarAmbiente(entrada),erros=[];
  const faixa=(v,mn,mx,nome)=>{if(!(v>=mn&&v<=mx))erros.push(nome+' precisa estar entre '+mn+' e '+mx+' cm.')};
  faixa(a.largura,AMB_LIM.min,AMB_LIM.max,'A largura');faixa(a.comprimento,AMB_LIM.min,AMB_LIM.max,'O comprimento');faixa(a.altura,AMB_LIM.altMin,AMB_LIM.altMax,'A altura');
  if(erros.length)return {ok:false,erros};                                    // sem as dimensões do ambiente não dá para conferir as aberturas
  const porParede={};
  a.aberturas.forEach((o,i)=>{
    const nome=(o.tipo==='janela'?'Janela ':'Porta ')+(i+1);
    if(!AMB_PAREDES.includes(o.parede)){erros.push(nome+': escolha a parede.');return}
    if(!(o.largura>0)||!(o.altura>0)||!(o.x>=0)||!(o.peitoril>=0)){erros.push(nome+': posição, largura e altura precisam ser números válidos (largura e altura maiores que zero).');return}
    if(o.tipo==='porta'&&o.peitoril!==0){erros.push(nome+': porta começa no piso (peitoril 0).');return}
    const comp=ambCompParede(a,o.parede);
    if(o.x+o.largura>comp+1e-9)erros.push(nome+': não cabe na parede '+AMB_NOME_PAREDE[o.parede]+' ('+comp+' cm).');
    if(o.peitoril+o.altura>a.altura+1e-9)erros.push(nome+': passa da altura do ambiente ('+a.altura+' cm).');
    (porParede[o.parede]=porParede[o.parede]||[]).push({o,nome});
  });
  a.revestimentos.forEach((r,i)=>{
    const nome='Revestimento '+(i+1);
    if(!AMB_PAREDES.includes(r.parede)){erros.push(nome+': escolha a parede.');return}
    if(!(r.altura>0&&r.altura<=a.altura+1e-9))erros.push(nome+': a altura precisa ser maior que zero e no máximo '+a.altura+' cm.');
  });
  Object.entries(a.perdas).forEach(([k,v])=>{if(!(v>=0&&v<=100))erros.push('A perda de '+k+' precisa estar entre 0 e 100%.')});
  Object.values(porParede).forEach(l=>{
    const ord=l.slice().sort((p,q)=>p.o.x-q.o.x);
    for(let i=1;i<ord.length;i++)if(ord[i].o.x<ord[i-1].o.x+ord[i-1].o.largura-1e-9)erros.push(ord[i-1].nome+' e '+ord[i].nome+' se sobrepõem na mesma parede.');
  });
  return {ok:erros.length===0,erros};
}

/* Quantitativos do ambiente (precisa de ambiente válido). Paredes: área bruta (comprimento × altura), aberturas e líquida. */
function medidasAmbiente(entrada){
  const v=validarAmbiente(entrada);if(!v.ok)return {ok:false,erros:v.erros};
  const a=criarAmbiente(entrada),M=1e4;
  const paredes=AMB_PAREDES.map(p=>{
    const comp=ambCompParede(a,p),ab=a.aberturas.filter(o=>o.parede===p),areaAb=ab.reduce((s,o)=>s+o.largura*o.altura,0);
    return {id:p,nome:AMB_NOME_PAREDE[p],comprimento:comp,areaBruta:comp*a.altura/M,areaAberturas:areaAb/M,areaLiquida:(comp*a.altura-areaAb)/M,aberturas:ab.length};
  });
  const soma=k=>paredes.reduce((s,p)=>s+p[k],0);
  return {ok:true,erros:[],
    areaPiso:a.largura*a.comprimento/M,areaTeto:a.largura*a.comprimento/M,
    perimetro:2*(a.largura+a.comprimento)/100,volume:a.largura*a.comprimento*a.altura/1e6,
    paredes,areaParedesBruta:soma('areaBruta'),areaAberturas:soma('areaAberturas'),areaParedesLiquida:soma('areaLiquida'),
    portas:a.aberturas.filter(o=>o.tipo==='porta').length,janelas:a.aberturas.filter(o=>o.tipo==='janela').length};
}

/* Quantitativo do ambiente: lista de itens {codigo, descricao, unidade, quantidade, perdaPct, quantidadeComPerda}.
   Só geometria medida: piso, teto, pintura (paredes líquidas e teto), rodapé (perímetro menos portas) e revestimentos escolhidos.
   Perda só entra se a pessoa informar (nunca inventada). Preço fica para o orçamento. */
function quantitativoAmbiente(entrada){
  const v=validarAmbiente(entrada);if(!v.ok)return {ok:false,erros:v.erros,itens:[]};
  const a=criarAmbiente(entrada),m=medidasAmbiente(a),itens=[];
  const add=(codigo,descricao,unidade,quantidade,perdaPct=0)=>itens.push({codigo,descricao,unidade,quantidade,perdaPct,quantidadeComPerda:quantidade*(1+perdaPct/100)});
  add('AMB-PISO','Piso','m²',m.areaPiso,a.perdas.piso);
  add('AMB-TETO','Teto / forro','m²',m.areaTeto);
  add('AMB-PINT-PAREDE','Pintura das paredes (líquida)','m²',m.areaParedesLiquida);
  add('AMB-PINT-TETO','Pintura do teto','m²',m.areaTeto);
  const portas=a.aberturas.filter(o=>o.tipo==='porta').reduce((t,o)=>t+o.largura,0);
  add('AMB-RODAPE','Rodapé (perímetro menos portas)','m',Math.max(0,m.perimetro-portas/100),a.perdas.rodape);
  const nRev={};
  a.revestimentos.forEach(r=>{
    const comp=ambCompParede(a,r.parede),n=nRev[r.parede]=(nRev[r.parede]||0)+1;      // dois revestimentos na mesma parede: AMB-REV-S e AMB-REV-S-2
    const abertas=a.aberturas.filter(o=>o.parede===r.parede).reduce((t,o)=>t+o.largura*Math.max(0,Math.min(r.altura,o.peitoril+o.altura)-o.peitoril),0);   // só a parte da abertura abaixo da altura revestida
    add('AMB-REV-'+r.parede+(n>1?'-'+n:''),'Revestimento parede '+AMB_NOME_PAREDE[r.parede]+' até '+r.altura+' cm','m²',(comp*r.altura-abertas)/1e4,a.perdas.revestimento);
  });
  return {ok:true,erros:[],itens};
}

/* Faixas [ini,fim] em que a parede é cheia, e as aberturas viram "vergas" (acima) e "peitoris" (abaixo). Coordenada ao longo da parede. */
function ambSegmentos(comp,altura,aberturas,extra){
  const [e0,e1]=Array.isArray(extra)?extra:[extra,extra];                    // [início, fim]: negativo = parede mais curta que o comprimento
  const seg=[];let cur=-e0;
  aberturas.slice().sort((p,q)=>p.x-q.x).forEach(o=>{
    if(o.x>cur)seg.push({a:cur,b:o.x,y0:0,y1:altura});
    if(o.peitoril>0)seg.push({a:o.x,b:o.x+o.largura,y0:0,y1:o.peitoril});
    if(o.peitoril+o.altura<altura)seg.push({a:o.x,b:o.x+o.largura,y0:o.peitoril+o.altura,y1:altura});
    cur=o.x+o.largura;
  });
  if(cur<comp+e1)seg.push({a:cur,b:comp+e1,y0:0,y1:altura});
  return seg;
}

/* Modelo 3D do ambiente no MESMO contrato do model3d.js (solids, bbox, cotas...), para o visualizador desenhar.
   Opções: {teto:true|false}. Paredes ficam FORA das medidas internas (o interior tem exatamente as medidas informadas). */
function modeloAmbiente(entrada,op={}){
  const vazio={solids:[],espessura:AMB_LIM.pisoEsp,espessuraOrigem:'ambiente',vazio:true,bbox:{min:[0,0,0],max:[0,0,0]},bboxPeca:{min:[0,0,0],max:[0,0,0]},
    area:0,emendas:[],emendasPlano:0,recortes:[],statusRecortes:[],equipamentos:[],avisos:[],cotas:[],peca:{type:'ambiente',d:{},saiaH:0,rodaH:0},cotasDe:()=>[]};
  const v=validarAmbiente(entrada);if(!v.ok){vazio.avisos=v.erros;return vazio}
  const a=criarAmbiente(entrada),L=a.largura,C=a.comprimento,H=a.altura,t=AMB_LIM.esp,pe=AMB_LIM.pisoEsp,solids=[];
  const add=s=>{if(s.sx>1e-9&&s.sy>1e-9&&s.sz>1e-9){s.id=s.id||'s'+solids.length;solids.push(s)}};
  add({kind:'piso',label:'Piso',x:0,y:-pe,z:0,sx:L,sy:pe,sz:C});
  if(op.teto!==false)add({kind:'teto',label:'Teto',x:0,y:H,z:0,sx:L,sy:pe,sz:C});
  AMB_PAREDES.forEach(p=>{
    const ab=a.aberturas.filter(o=>o.parede===p),comp=ambCompParede(a,p),nsLado=p==='N'||p==='S';
    /* coordenada ao longo da parede, vista de dentro: N e L seguem o eixo para frente; S e O correm ao contrário */
    const dentro=o=>{const x=nsLado?(p==='N'?o.x:L-o.x-o.largura):(p==='O'?C-o.x-o.largura:o.x);return {x,largura:o.largura,altura:o.altura,peitoril:o.peitoril,tipo:o.tipo}};
    const abx=ab.map(dentro),seg=ambSegmentos(comp,H,abx,nsLado?t:0);
    seg.forEach(s=>{
      if(nsLado)add({kind:'parede',label:'Parede '+AMB_NOME_PAREDE[p],x:s.a,y:s.y0,z:p==='N'?-t:C,sx:s.b-s.a,sy:s.y1-s.y0,sz:t});
      else add({kind:'parede',label:'Parede '+AMB_NOME_PAREDE[p],x:p==='O'?-t:L,y:s.y0,z:s.a,sx:t,sy:s.y1-s.y0,sz:s.b-s.a});
    });
    abx.filter(o=>o.tipo==='janela').forEach(o=>{                              // vidro fino no meio da espessura da parede
      if(nsLado)add({kind:'vidro',label:'Janela',x:o.x,y:o.peitoril,z:(p==='N'?-t:C)+t/2-0.5,sx:o.largura,sy:o.altura,sz:1});
      else add({kind:'vidro',label:'Janela',x:(p==='O'?-t:L)+t/2-0.5,y:o.peitoril,z:o.x,sx:1,sy:o.altura,sz:o.largura});
    });
  });
  const min=[-t,-pe,-t],max=[L+t,op.teto===false?H:H+pe,C+t];
  /* cotas automáticas: largura, comprimento e altura do ambiente (formato do model3d.cotas) + um rótulo por abertura */
  const cotas=[],cota=(cat,rot,valor,p1,p2,dir,prio)=>cotas.push({id:cat+'-'+cotas.length,categoria:cat,tipo:'cota',valor,p1,p2,dir,off:Math.min(40,Math.max(15,Math.max(L,C)*0.06)),prio,texto:(rot?rot+' ':'')+valor+' cm'});
  cota('plano','largura',L,[0,0,C+t],[L,0,C+t],[0,0,1],0);
  cota('plano','comprimento',C,[L+t,0,0],[L+t,0,C],[1,0,0],0);
  cota('altura','altura',H,[-t,0,C+t],[-t,H,C+t],[-1,0,0],1);
  a.aberturas.forEach((o,i)=>{
    const nsLado=o.parede==='N'||o.parede==='S',cx=nsLado?(o.parede==='N'?o.x:L-o.x-o.largura)+o.largura/2:(o.parede==='O'?-t/2:L+t/2),
      cz=nsLado?(o.parede==='N'?-t/2:C+t/2):(o.parede==='O'?C-o.x-o.largura:o.x)+o.largura/2;
    cotas.push({id:'rot-ab'+i,categoria:'rotulo',tipo:'rotulo',texto:(o.tipo==='janela'?'janela ':'porta ')+o.largura+'×'+o.altura,pos:[cx,o.peitoril+o.altura/2,cz],prio:2});
  });
  return {...vazio,solids,vazio:false,bbox:{min,max},bboxPeca:{min:[0,0,0],max:[L,H,C]},area:L*C/1e4,cotas,cotasDe:()=>cotas,
    peca:{type:'ambiente',d:{A:L,B:C,H},saiaH:0,rodaH:0}};
}

if(typeof module!=='undefined')module.exports={AMB_LIM,AMB_PAREDES,AMB_NOME_PAREDE,criarAmbiente,validarAmbiente,medidasAmbiente,modeloAmbiente,ambSegmentos,quantitativoAmbiente,ambNum,ambPerda};
