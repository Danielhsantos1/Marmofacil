/* Projetta: motor de Vidraçaria (box, espelho, divisória, guarda-corpo, porta de vidro, janela/fachada, vitrine, cobertura).
   Funções puras, sem tela e sem localStorage; roda no navegador (funções globais) e no Node (tests/vidro.test.js).
   Largura e altura em CENTÍMETROS, espessura em MILÍMETROS; áreas em m², comprimentos em m, peso em kg.
   Nada de preço, folga técnica ou perda é inventado: mínimo de cobrança e perda só entram se a pessoa informar. */

const VID_TIPOS={box:'Box',espelho:'Espelho',divisoria:'Divisória',guardacorpo:'Guarda-corpo',porta:'Porta de vidro',janela:'Janela ou fachada',vitrine:'Vitrine',cobertura:'Cobertura',outro:'Outro'};
const VID_COBRANCAS={m2:'por m²',ml:'por metro linear'};
/* limites de ENTRADA (para pegar erro de digitação), não regras do vidro: cm, mm, unidades; e a densidade do vidro (físico) em kg por m² por mm de espessura */
const VID_LIM={min:5,max:1000,espMin:2,espMax:30,qtdMax:500,kgM2PorMm:2.5};

const vidNum=v=>{const n=typeof v==='string'?parseFloat(v.replace(',','.')):v;return typeof n==='number'&&isFinite(n)?n:NaN};
const vidVazio=v=>v==null||v==='';

function criarVidro(d){
  if(!d||typeof d!=='object')d={};
  return {
    id:d.id||'',nome:String(d.nome==null?'Vidraçaria':d.nome),
    minimo:vidVazio(d.minimo)?0:vidNum(d.minimo),                              // cobrança mínima por peça, em m² (vazio = sem mínimo)
    perdas:{vidro:vidVazio(d.perdas&&d.perdas.vidro)?0:vidNum(d.perdas&&d.perdas.vidro)},
    itens:(Array.isArray(d.itens)?d.itens:[]).map((it,i)=>({
      id:(it&&it.id)||'v'+(i+1),tipo:it&&VID_TIPOS[it.tipo]?it.tipo:(it&&it.tipo)||'',
      largura:vidNum(it&&it.largura),altura:vidNum(it&&it.altura),espessura:vidNum(it&&it.espessura),
      qtd:vidVazio(it&&it.qtd)?1:vidNum(it&&it.qtd),cobranca:it&&it.cobranca==='ml'?'ml':'m2',pelicula:!!(it&&it.pelicula),obs:String((it&&it.obs)||'')})),
    ferragens:(Array.isArray(d.ferragens)?d.ferragens:[]).map((f,i)=>({id:(f&&f.id)||'f'+(i+1),nome:String((f&&f.nome)||'').trim(),unidade:String((f&&f.unidade)||'').trim(),qtd:vidNum(f&&f.qtd)}))
  };
}

function validarVidro(entrada){
  const a=criarVidro(entrada),erros=[];
  if(!(a.minimo>=0))erros.push('A cobrança mínima por peça precisa ser um número igual ou maior que zero (ou ficar em branco).');
  if(!(a.perdas.vidro>=0&&a.perdas.vidro<=100))erros.push('A perda do vidro precisa estar entre 0 e 100%.');
  a.itens.forEach((it,i)=>{
    const n='Peça '+(i+1);
    if(!VID_TIPOS[it.tipo]){erros.push(n+': escolha o tipo.');return}
    if(!(it.largura>=VID_LIM.min&&it.largura<=VID_LIM.max))erros.push(n+': a largura precisa estar entre '+VID_LIM.min+' e '+VID_LIM.max+' cm.');
    if(!(it.altura>=VID_LIM.min&&it.altura<=VID_LIM.max))erros.push(n+': a altura precisa estar entre '+VID_LIM.min+' e '+VID_LIM.max+' cm.');
    if(!(it.espessura>=VID_LIM.espMin&&it.espessura<=VID_LIM.espMax))erros.push(n+': a espessura precisa estar entre '+VID_LIM.espMin+' e '+VID_LIM.espMax+' mm.');
    if(!(Number.isInteger(it.qtd)&&it.qtd>=1&&it.qtd<=VID_LIM.qtdMax))erros.push(n+': a quantidade precisa ser um número inteiro de 1 a '+VID_LIM.qtdMax+'.');
  });
  a.ferragens.forEach((f,i)=>{
    const n='Ferragem '+(i+1);
    if(!f.nome)erros.push(n+': dê um nome.');
    if(!f.unidade)erros.push(n+': informe a unidade (un, kit, m...).');
    if(!(f.qtd>=0))erros.push(n+': a quantidade precisa ser um número igual ou maior que zero.');
  });
  return {ok:erros.length===0,erros};
}

/* área em m² de UMA peça; cobrada = o maior entre a área e o mínimo informado */
const vidAreaPeca=it=>it.largura*it.altura/1e4;

function medidasVidro(entrada){
  const v=validarVidro(entrada);if(!v.ok)return {ok:false,erros:v.erros};
  const a=criarVidro(entrada),itens=a.itens.map(it=>{
    const area=vidAreaPeca(it),cobrada=Math.max(area,a.minimo);
    return {id:it.id,area,areaCobrada:cobrada,comprimento:it.largura/100,peso:area*it.espessura*VID_LIM.kgM2PorMm,perimetro:2*(it.largura+it.altura)/100,qtd:it.qtd};
  });
  const soma=f=>itens.reduce((t,x)=>t+f(x),0);
  return {ok:true,erros:[],itens,pecas:soma(x=>x.qtd),
    areaTotal:soma(x=>x.area*x.qtd),areaCobrada:soma(x=>x.areaCobrada*x.qtd),
    metrosLineares:a.itens.reduce((t,it)=>t+it.largura/100*it.qtd,0),
    peso:soma(x=>x.peso*x.qtd),perimetro:soma(x=>x.perimetro*x.qtd),
    peliculaArea:a.itens.reduce((t,it,i)=>t+(it.pelicula?itens[i].area*it.qtd:0),0)};
}

/* Itens do quantitativo: vidro agrupado por tipo, espessura e forma de cobrança (um preço por grupo), película e ferragens (uma linha cada).
   Cada item: {codigo, descricao, unidade, quantidade, perdaPct, quantidadeComPerda}, o mesmo formato do quantitativoAmbiente. */
function quantitativoVidro(entrada){
  const v=validarVidro(entrada);if(!v.ok)return {ok:false,erros:v.erros,itens:[]};
  const a=criarVidro(entrada),m=medidasVidro(a),itens=[],grupos=new Map();
  const add=(codigo,descricao,unidade,quantidade,perdaPct=0)=>itens.push({codigo,descricao,unidade,quantidade,perdaPct,quantidadeComPerda:quantidade*(1+perdaPct/100)});
  a.itens.forEach((it,i)=>{
    const chave=it.tipo+'-'+String(it.espessura).replace('.','p')+'mm-'+it.cobranca,q=it.cobranca==='ml'?it.largura/100*it.qtd:m.itens[i].areaCobrada*it.qtd;
    const g=grupos.get(chave)||{tipo:it.tipo,esp:it.espessura,cob:it.cobranca,q:0,pecas:0};g.q+=q;g.pecas+=it.qtd;grupos.set(chave,g);
  });
  grupos.forEach((g,chave)=>add('VID-'+chave,`${VID_TIPOS[g.tipo]} ${g.esp} mm (${g.pecas} peça${g.pecas===1?'':'s'})`,g.cob==='ml'?'m':'m²',g.q,a.perdas.vidro));
  if(m.peliculaArea>0)add('VID-PELICULA','Película','m²',m.peliculaArea);
  a.ferragens.forEach(f=>add('VID-FERR-'+f.id,f.nome,f.unidade,f.qtd));
  return {ok:true,erros:[],itens};
}

if(typeof module!=='undefined')module.exports={VID_TIPOS,VID_COBRANCAS,VID_LIM,criarVidro,validarVidro,medidasVidro,quantitativoVidro};
