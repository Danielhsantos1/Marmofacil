/* Marmofácil: dados da ficha do projeto e da ordem de produção (funções puras, sem tela e sem localStorage).
   Tudo em cm; áreas em m². Roda no navegador (funções globais) e no Node (tests/producao.test.js).
   Usa o resultado do plano de corte (calc.js). O plano continua sendo ESTIMATIVA: nada aqui promete o melhor encaixe possível. */

const prodNum=n=>(+n||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1});
const PROD_SOBRA_MIN=15;                                   // sobras só contam a partir de 15 cm nos dois lados (o app não assume outro valor; pode virar ajuste depois)

/* Rótulo de uma peça posta na chapa: "4" ou, quando a peça foi dividida em partes com emenda, "3-2". */
function rotuloPeca(ref){
  if(!ref||!ref.n)return '';
  return ref.sub>0?ref.n+'-'+ref.sub:String(ref.n);
}

/* Lista numerada das peças do orçamento (uma linha por peça cadastrada, com as cópias em q).
   girada = a peça é mais alta que larga, então vai deitada na chapa; partes = em quantas partes é dividida por ser maior que a chapa. */
function listaPecas(parts,SL,SW){
  return (parts||[]).map((a,i)=>{
    const L=Math.max(a.w,a.h),W=Math.min(a.w,a.h),k=Math.max(1,Math.ceil(L/SL)),m=Math.max(1,Math.ceil(W/SW));
    return {n:i+1,nome:a.l||'Peça',w:a.w,h:a.h,q:a.q||1,girada:a.h>a.w+1e-9,partes:k*m,emendas:k*m-1};
  });
}

/* Quantidade mínima de chapas só pela área (ignora serra, formato e encaixe). Serve de piso, não de promessa. */
function minimoChapas(areaPecas,areaChapa){
  if(!(areaChapa>0)||!(areaPecas>0))return 0;
  return Math.max(1,Math.ceil(areaPecas/areaChapa-1e-9));
}

/* Sobras aproveitáveis de cada chapa, lidas das prateleiras do plano: o espaço à direita de cada prateleira, o vão em cima de peças mais baixas
   (juntando os vizinhos de mesma altura) e a faixa de baixo. Retângulos que não se sobrepõem entre si nem às peças; só entram os com os dois
   lados a partir de `minimo` cm. É conservador: o que fica entre sobras pequenas não conta. */
function sobrasUteis(nest,SL,SW,minimo=PROD_SOBRA_MIN,kerf=0.4){
  const ok=(w,h)=>w>=minimo-1e-9&&h>=minimo-1e-9;
  const porChapa=(nest&&nest.slabs||[]).map(sl=>{
    const out=[],add=(x,y,w,h)=>{if(ok(w,h))out.push({x,y,w,h,area:w*h/1e4})};
    (sl.shelves||[]).forEach(sh=>{
      const its=sl.items.filter(it=>Math.abs(it.y-sh.y)<1e-6).sort((a,b)=>a.x-b.x);
      add(sh.x,sh.y,SL-sh.x,sh.h);                                                  // direita da prateleira
      let run=null;                                                                  // vão em cima das peças mais baixas, juntando as de mesma altura que se tocam
      const fecha=()=>{if(run)add(run.x,run.y,run.w,run.h);run=null};
      its.forEach(it=>{
        const gap=sh.h-it.h-kerf;
        if(gap<=0){fecha();return}
        if(run&&Math.abs(run.h-gap)<1e-6&&Math.abs(run.x+run.w+kerf-it.x)<1e-6)run.w+=kerf+it.w;
        else{fecha();run={x:it.x,y:it.y+it.h+kerf,w:it.w,h:gap}}
      });
      fecha();
    });
    const usado=(sl.shelves||[]).reduce((t,sh)=>t+sh.h+kerf,0);
    add(0,usado,SL,SW-usado);                                                        // faixa de baixo
    return out;
  });
  const total=porChapa.reduce((t,l)=>t+l.reduce((u,r)=>u+r.area,0),0);
  const todas=porChapa.flatMap((l,i)=>l.map(r=>({...r,chapa:i+1}))).sort((a,b)=>b.area-a.area);
  return {porChapa,total,todas};
}

/* Resumo da ficha: números de topo, mensagem honesta sobre o encaixe e avisos de peças maiores que a chapa. */
function resumoProducao(c,parts,minimo=PROD_SOBRA_MIN){
  const so=sobrasUteis(c.nest,c.SL,c.SW,minimo);
  const pecas=listaPecas(parts,c.SL,c.SW),min=minimoChapas(c.area,c.slabArea);
  let mensagem;
  if(!c.nSlabs)mensagem={tipo:'neutro',texto:'Adicione peças para ver o plano de corte.'};
  else if(c.nSlabs<=min)mensagem={tipo:'bom',texto:'É o menor número de chapas possível pela área das peças.'};
  else mensagem={tipo:'aviso',texto:`Este plano usa ${c.nSlabs} chapas; só pela área caberia em ${min}. Pode haver encaixe melhor: o plano é uma estimativa e não considera o veio.`};
  const avisos=pecas.filter(p=>p.partes>1).map(p=>`${p.nome} (${prodNum(p.w)} × ${prodNum(p.h)} cm) é maior que a chapa: sai em ${p.partes} partes, com emenda.`);
  return {chapas:c.nSlabs,aproveitamento:c.util,sobraUtil:so.total,minimoChapas:min,mensagem,avisos,pecas,sobras:so};
}

/* ===== Estoque de sobras (retalhos) =====
   Um retalho: {id, materialId, w, h (w >= h, cm), origem:'ficha'|'manual', qid, num, chapa, usada, em, obs}. Tudo puro: devolve listas novas, não mexe no que recebe. */

/* Retalhos novos a guardar, a partir das sobras úteis de um orçamento (sobrasUteis(...).todas). */
function retalhosParaGuardar(todas,meta){
  return (todas||[]).map((r,i)=>({id:(meta.prefixoId||'r')+(meta.qid||'')+'-'+(i+1),materialId:meta.materialId||'',w:Math.max(r.w,r.h),h:Math.min(r.w,r.h),
    origem:'ficha',qid:meta.qid||'',num:meta.num||null,chapa:r.chapa||1,usada:false,em:meta.em||0,obs:''}));
}
/* Guardar de novo as sobras do mesmo orçamento substitui as que ainda não foram usadas; as já usadas e as de outros orçamentos ficam. */
function mesclarEstoque(estoque,novas,qid){
  const fica=(estoque||[]).filter(r=>!(r.origem==='ficha'&&r.qid===qid&&!r.usada));
  const usadas=new Set(fica.map(r=>r.id));
  return fica.concat((novas||[]).filter(r=>!usadas.has(r.id)));
}
const cabeNoRetalho=(peca,r)=>Math.max(peca.w,peca.h)<=Math.max(r.w,r.h)+1e-9&&Math.min(peca.w,peca.h)<=Math.min(r.w,r.h)+1e-9;

/* Sugestão (só informativa): quais peças do orçamento caberiam em retalhos do estoque do mesmo material. Cada retalho serve a uma peça só,
   e a peça vai no menor retalho em que cabe. Peças maiores que a chapa (com emenda) não entram. Não muda plano, chapas nem preço. */
function sugerirRetalhos(parts,estoque,materialId,SL,SW){
  const livres=(estoque||[]).filter(r=>!r.usada&&r.materialId===materialId&&materialId).slice().sort((a,b)=>a.w*a.h-b.w*b.h);
  const pecas=[];
  (parts||[]).forEach((a,i)=>{
    const L=Math.max(a.w,a.h),W=Math.min(a.w,a.h);
    if(L>SL+1e-9||W>SW+1e-9)return;
    for(let c=0;c<(a.q||1);c++)pecas.push({n:i+1,nome:a.l||'Peça',w:a.w,h:a.h});
  });
  pecas.sort((a,b)=>b.w*b.h-a.w*a.h);
  const usados=new Set(),sugestoes=[],semRetalho=[];
  pecas.forEach(p=>{
    const r=livres.find(x=>!usados.has(x.id)&&cabeNoRetalho(p,x));
    if(r){usados.add(r.id);sugestoes.push({n:p.n,nome:p.nome,w:p.w,h:p.h,retalhoId:r.id,retalho:{w:r.w,h:r.h}})}
    else semRetalho.push(p);
  });
  return {sugestoes,semRetalho,retalhosLivres:livres.length};
}

if(typeof module!=='undefined')module.exports={retalhosParaGuardar,mesclarEstoque,cabeNoRetalho,sugerirRetalhos,PROD_SOBRA_MIN,rotuloPeca,listaPecas,minimoChapas,sobrasUteis,resumoProducao};
