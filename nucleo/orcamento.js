/* Projetta: orçamento genérico (qualquer módulo). Funções puras, sem tela e sem localStorage;
   roda no navegador (funções globais) e no Node (tests/orcamento.test.js). Não usa nem altera o calc.js da marmoraria.
   Entrada: itens de um quantitativo ({codigo, descricao, unidade, quantidade, quantidadeComPerda?}) e os preços que a pessoa informou.
   Regra de preço, a mesma da marmoraria: custo = materiais + mão de obra + instalação + frete;  preço = custo / (1 − margem − impostos).
   Preço em branco NÃO vira zero em silêncio: o item fica "sem preço" e o orçamento sai marcado como incompleto.
   Dinheiro arredondado em centavos a cada linha. Percentuais em % (35 = 35%). */

const ORC_MAX_MARGEM_IMPOSTO=95;                     // margem + impostos precisam ficar abaixo disso (senão o preço explode)

const orcNum=v=>{if(v==null||v==='')return null;const n=typeof v==='string'?parseFloat(v.replace(',','.')):v;return typeof n==='number'&&isFinite(n)?n:NaN};
const orcR2=n=>Math.round((n+Number.EPSILON)*100)/100;

function orcarItens(itens,cfg){
  cfg=cfg||{};const erros=[];
  const pct=(v,nome)=>{const n=orcNum(v);if(n===null)return 0;if(!(n>=0&&n<=100)){erros.push(nome+' precisa estar entre 0 e 100%.');return 0}return n};
  const din=(v,nome)=>{const n=orcNum(v);if(n===null)return 0;if(!(n>=0)){erros.push(nome+' precisa ser um valor igual ou maior que zero.');return 0}return n};
  const margem=pct(cfg.margem,'A margem'),impostos=pct(cfg.impostos,'Os impostos');
  const frete=din(cfg.frete,'O frete'),instalacao=din(cfg.instalacao,'A instalação');
  if(margem+impostos>=ORC_MAX_MARGEM_IMPOSTO)erros.push('Margem + impostos precisa ficar abaixo de '+ORC_MAX_MARGEM_IMPOSTO+'%.');
  const linhas=(Array.isArray(itens)?itens:[]).map(it=>{
    const q=orcNum(it.quantidadeComPerda!=null?it.quantidadeComPerda:it.quantidade),pu=orcNum(it.precoUnit),mo=orcNum(it.maoObraUnit);
    if(!(q>=0))erros.push((it.descricao||it.codigo||'Item')+': quantidade inválida.');
    if(Number.isNaN(pu)||(pu!==null&&pu<0))erros.push((it.descricao||it.codigo||'Item')+': preço inválido.');
    if(Number.isNaN(mo)||(mo!==null&&mo<0))erros.push((it.descricao||it.codigo||'Item')+': mão de obra inválida.');
    const qq=q>=0?q:0,p=pu>=0?pu:0,m=mo>=0?mo:0;
    const material=orcR2(qq*p),maoObra=orcR2(qq*m);
    return {codigo:it.codigo,descricao:it.descricao,unidade:it.unidade,quantidade:qq,precoUnit:pu,maoObraUnit:mo,material,maoObra,custo:orcR2(material+maoObra),semPreco:pu===null&&mo===null};
  });
  if(erros.length)return {ok:false,erros,linhas,pendentes:[]};
  const material=orcR2(linhas.reduce((t,l)=>t+l.material,0)),maoObra=orcR2(linhas.reduce((t,l)=>t+l.maoObra,0));
  const custo=orcR2(material+maoObra+instalacao+frete);
  const fator=1-(margem+impostos)/100,preco=orcR2(custo/fator);
  const pendentes=linhas.filter(l=>l.semPreco&&l.quantidade>0).map(l=>l.codigo);
  return {ok:true,erros:[],linhas,pendentes,completo:pendentes.length===0&&linhas.length>0,
    material,maoObra,instalacao,frete,custo,margemPct:margem,impostosPct:impostos,preco,
    impostosValor:orcR2(preco*impostos/100),lucro:orcR2(preco*margem/100)};
}

if(typeof module!=='undefined')module.exports={ORC_MAX_MARGEM_IMPOSTO,orcNum,orcR2,orcarItens};
