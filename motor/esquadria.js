/* Projetta: motor de Esquadrias (portas, janelas, portões e fachadas).
   Funções puras, sem tela e sem localStorage; roda no navegador (funções globais) e no Node (tests/esquadria.test.js).
   Largura e altura em CENTÍMETROS, espessura do vidro em MILÍMETROS; áreas em m², comprimentos em m, peso em kg.

   O app NÃO traz fórmula de perfil de nenhuma linha de alumínio: cada fabricante tem a sua. Quem usa cadastra MODELOS com componentes
   (perfis, ferragens, acessórios) e escolhe, para cada componente, uma regra simples de quantidade:
     fixo       = fator por esquadria (ex.: 2 roldanas)
     perimetro  = fator × perímetro, em m   (ex.: 1 m de perfil por metro de perímetro)
     largura    = fator × largura, em m
     altura     = fator × altura, em m
     area       = fator × área do vão, em m²
   O fator é digitado pela pessoa; nada de valor técnico é assumido. */

const ESQ_TIPOS={porta:'Porta',janela:'Janela',portao:'Portão',fachada:'Fachada',outro:'Outro'};
const ESQ_REGRAS={fixo:'Quantidade fixa por esquadria',perimetro:'Por metro de perímetro',largura:'Por metro de largura',altura:'Por metro de altura',area:'Por m² do vão'};
/* limites de ENTRADA (erro de digitação), não regras de fabricação */
const ESQ_LIM={min:5,max:1000,espMin:2,espMax:30,qtdMax:500,kgM2PorMm:2.5};

const esqNum=v=>{const n=typeof v==='string'?parseFloat(v.replace(',','.')):v;return typeof n==='number'&&isFinite(n)?n:NaN};
const esqVazio=v=>v==null||v==='';

function criarModelo(d){
  if(!d||typeof d!=='object')d={};
  return {id:d.id||'',nome:String(d.nome==null?'':d.nome).trim(),
    comps:(Array.isArray(d.comps)?d.comps:[]).map((c,i)=>({id:(c&&c.id)||'c'+(i+1),nome:String((c&&c.nome)||'').trim(),unidade:String((c&&c.unidade)||'').trim(),regra:c&&ESQ_REGRAS[c.regra]?c.regra:(c&&c.regra)||'',fator:esqNum(c&&c.fator)}))};
}
function validarModelo(entrada){
  const m=criarModelo(entrada),erros=[];
  if(!m.nome)erros.push('Dê um nome ao modelo.');
  if(!m.comps.length)erros.push('O modelo precisa de ao menos um componente.');
  m.comps.forEach((c,i)=>{
    const n='Componente '+(i+1);
    if(!c.nome)erros.push(n+': dê um nome.');
    if(!c.unidade)erros.push(n+': informe a unidade (m, un, barra, kg...).');
    if(!ESQ_REGRAS[c.regra])erros.push(n+': escolha a regra de quantidade.');
    if(!(c.fator>=0))erros.push(n+': o fator precisa ser um número igual ou maior que zero.');
  });
  return {ok:erros.length===0,erros};
}

/* projeto: {nome, itens:[{id, modeloId, tipo, largura, altura, qtd, vidro (espessura mm, vazio = sem vidro), obs}]}; modelos = lista de modelos cadastrados */
function criarEsquadrias(d){
  if(!d||typeof d!=='object')d={};
  return {id:d.id||'',nome:String(d.nome==null?'Esquadrias':d.nome),
    itens:(Array.isArray(d.itens)?d.itens:[]).map((it,i)=>({id:(it&&it.id)||'e'+(i+1),modeloId:(it&&it.modeloId)||'',tipo:it&&ESQ_TIPOS[it.tipo]?it.tipo:(it&&it.tipo)||'',
      largura:esqNum(it&&it.largura),altura:esqNum(it&&it.altura),qtd:esqVazio(it&&it.qtd)?1:esqNum(it&&it.qtd),vidro:esqVazio(it&&it.vidro)?null:esqNum(it&&it.vidro),obs:String((it&&it.obs)||'')}))};
}
function validarEsquadrias(entrada,modelos){
  const a=criarEsquadrias(entrada),mods=Array.isArray(modelos)?modelos:[],erros=[];
  a.itens.forEach((it,i)=>{
    const n='Esquadria '+(i+1);
    if(!ESQ_TIPOS[it.tipo]){erros.push(n+': escolha o tipo.');return}
    const mod=mods.find(m=>m.id===it.modeloId);
    if(!mod)erros.push(n+': escolha o modelo.');
    else if(!validarModelo(mod).ok)erros.push(n+': o modelo "'+mod.nome+'" tem pendências (abra Modelos para corrigir).');
    if(!(it.largura>=ESQ_LIM.min&&it.largura<=ESQ_LIM.max))erros.push(n+': a largura precisa estar entre '+ESQ_LIM.min+' e '+ESQ_LIM.max+' cm.');
    if(!(it.altura>=ESQ_LIM.min&&it.altura<=ESQ_LIM.max))erros.push(n+': a altura precisa estar entre '+ESQ_LIM.min+' e '+ESQ_LIM.max+' cm.');
    if(!(Number.isInteger(it.qtd)&&it.qtd>=1&&it.qtd<=ESQ_LIM.qtdMax))erros.push(n+': a quantidade precisa ser um número inteiro de 1 a '+ESQ_LIM.qtdMax+'.');
    if(it.vidro!==null&&!(it.vidro>=ESQ_LIM.espMin&&it.vidro<=ESQ_LIM.espMax))erros.push(n+': a espessura do vidro precisa estar entre '+ESQ_LIM.espMin+' e '+ESQ_LIM.espMax+' mm (ou ficar em branco, se não tem vidro).');
  });
  return {ok:erros.length===0,erros};
}

function medidasEsquadrias(entrada,modelos){
  const v=validarEsquadrias(entrada,modelos);if(!v.ok)return {ok:false,erros:v.erros};
  const a=criarEsquadrias(entrada),itens=a.itens.map(it=>{
    const area=it.largura*it.altura/1e4,perimetro=2*(it.largura+it.altura)/100;
    return {id:it.id,area,perimetro,pesoVidro:it.vidro===null?0:area*it.vidro*ESQ_LIM.kgM2PorMm,qtd:it.qtd};
  });
  const soma=f=>itens.reduce((t,x)=>t+f(x),0);
  return {ok:true,erros:[],itens,pecas:soma(x=>x.qtd),areaVao:soma(x=>x.area*x.qtd),perimetro:soma(x=>x.perimetro*x.qtd),
    areaVidro:a.itens.reduce((t,it,i)=>t+(it.vidro===null?0:itens[i].area*it.qtd),0),pesoVidro:soma(x=>x.pesoVidro*x.qtd)};
}

function qtdComponente(c,it){
  const area=it.largura*it.altura/1e4,per=2*(it.largura+it.altura)/100;
  return c.fator*(c.regra==='fixo'?1:c.regra==='perimetro'?per:c.regra==='largura'?it.largura/100:c.regra==='altura'?it.altura/100:area)*it.qtd;
}

/* Itens do quantitativo, no formato do quantitativoAmbiente: vidro por espessura e um item por componente de cada modelo usado.
   Código do componente = ESQ-<modelo>-<componente> (ids estáveis, para o preço não trocar de linha ao apagar outra). */
function quantitativoEsquadrias(entrada,modelos){
  const v=validarEsquadrias(entrada,modelos);if(!v.ok)return {ok:false,erros:v.erros,itens:[]};
  const a=criarEsquadrias(entrada),mods=modelos.map(criarModelo),itens=[],comp=new Map(),vidros=new Map();
  const add=(codigo,descricao,unidade,quantidade)=>itens.push({codigo,descricao,unidade,quantidade,perdaPct:0,quantidadeComPerda:quantidade});
  a.itens.forEach(it=>{
    const mod=mods.find(m=>m.id===it.modeloId);
    mod.comps.forEach(c=>{const k='ESQ-'+mod.id+'-'+c.id,g=comp.get(k)||{mod,c,q:0};g.q+=qtdComponente(c,it);comp.set(k,g)});
    if(it.vidro!==null){const k='ESQ-VIDRO-'+String(it.vidro).replace('.','p')+'mm';vidros.set(k,{esp:it.vidro,q:(vidros.get(k)||{q:0}).q+it.largura*it.altura/1e4*it.qtd})}
  });
  vidros.forEach((g,k)=>add(k,`Vidro ${g.esp} mm`,'m²',g.q));
  comp.forEach((g,k)=>add(k,`${g.mod.nome}: ${g.c.nome}`,g.c.unidade,g.q));
  return {ok:true,erros:[],itens};
}

if(typeof module!=='undefined')module.exports={ESQ_TIPOS,ESQ_REGRAS,ESQ_LIM,criarModelo,validarModelo,criarEsquadrias,validarEsquadrias,medidasEsquadrias,quantitativoEsquadrias};
