/* Projetta: tela do módulo de Esquadrias (lista, modelos, editor, orçamento, PDF e WhatsApp). Script comum: usa as funções e o estado de index.html.
   O cálculo está em motor/esquadria.js e nucleo/orcamento.js (funções puras, com testes). Dados: S.esquadrias (orçamentos) e S.modelosEsq (modelos
   cadastrados pela pessoa; o app não traz fórmula de perfil nenhuma).  Ações com prefixo "esq-" chegam em acaoEsq. */

const esqs=()=>S.esquadrias||(S.esquadrias=[]);
const modelosEsq=()=>S.modelosEsq||(S.modelosEsq=[]);
const fechadoEsq=a=>!!a&&a.status==='Fechado'&&!!a.snap;
const ESQ_TIPO_OPC=Object.entries(ESQ_TIPOS),ESQ_REGRA_OPC=Object.entries(ESQ_REGRAS);

function garantirEsq(){
  let mudou=false;
  (S.esquadrias||[]).forEach(a=>{if(a.num==null){a.num=S.settings.nextNum++;a.status=a.status||'Rascunho';a.createdAt=a.createdAt||Date.now();a.clientId=a.clientId||'';mudou=true}});
  if(mudou)save();
}
function esqNovo(){
  const a={id:uid(),nome:'Esquadrias '+(esqs().length+1),num:S.settings.nextNum++,status:'Rascunho',clientId:'',createdAt:Date.now(),closedAt:null,itens:[],orc:{precos:{}}};
  esqs().push(a);save();nav.esq=a.id;nav.esqModelos=false;render();scrollTo(0,0);
}
function esqOrc(a){
  const o=a.orc||{},q=quantitativoEsquadrias(a,modelosEsq());if(!q.ok)return null;
  const itens=q.itens.map(i=>({...i,precoUnit:(o.precos&&o.precos[i.codigo]||{}).preco,maoObraUnit:(o.precos&&o.precos[i.codigo]||{}).mo}));
  const cfg={margem:o.margem===''||o.margem==null?S.settings.margin:o.margem,impostos:o.impostos===''||o.impostos==null?S.settings.tax:o.impostos,frete:o.frete,instalacao:o.instalacao};
  if(fechadoEsq(a)){cfg.margem=a.snap.cfg.margem;cfg.impostos=a.snap.cfg.impostos}
  return {q,res:orcarItens(itens,cfg),cfg};
}
function setStatusEsq(a,st){
  if(st==='Fechado'){
    if(a.status!=='Fechado'||!a.snap){
      const r=esqOrc(a);
      if(!r||!r.res.ok){toast('Corrija as medidas e os valores antes de fechar.');return false}
      if(!r.res.completo){toast('Preencha todos os preços antes de fechar o orçamento.');return false}
      a.snap={preco:r.res.preco,lucro:r.res.lucro,custo:r.res.custo,cfg:{margem:r.cfg.margem,impostos:r.cfg.impostos},em:Date.now()};
    }
    if(a.status!=='Fechado')a.closedAt=Date.now();
  }else{delete a.snap;a.closedAt=null}
  a.status=st;save();return true;
}
const nomePdfEsq=a=>'Orcamento-'+(a.num||'')+'-Esquadrias-'+String(a.nome||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')+'.pdf';
function waTextoEsq(a,r){
  const cl=S.clients.find(c=>c.id===a.clientId)||{},s=S.settings,m=medidasEsquadrias(a,modelosEsq());
  return `Olá${cl.name?', '+cl.name.split(' ')[0]:''}! Segue o orçamento #${a.num} da ${s.empresa}.\n\n${a.nome}: ${m.pecas} esquadria${m.pecas===1?'':'s'}, ${nf(m.areaVao)} m² de vão\nTotal: ${brl(r.res.preco)}\nValidade: ${s.validade||15} dias.`;
}

function esqMedHtml(a){
  const m=medidasEsquadrias(a,modelosEsq());
  if(!m.ok)return `<div class="card" role="alert" style="color:var(--bad)"><b>Confira os dados</b><ul style="margin:6px 0 0;padding-left:18px">${m.erros.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
  const c=(t,v)=>`<div class="card" style="padding:10px"><div class="small muted">${t}</div><b class="num">${v}</b></div>`;
  return `<div class="grid2">${c('Esquadrias',m.pecas)}${c('Área dos vãos',nf(m.areaVao)+' m²')}${c('Perímetro',nf(m.perimetro)+' m')}${c('Área de vidro',nf(m.areaVidro)+' m²')}${c('Peso do vidro aprox.',nf(m.pesoVidro,1)+' kg')}</div>
   <p class="small muted">Peso do vidro com densidade de 2,5 kg por m² para cada mm de espessura. Os componentes seguem as regras que você cadastrou nos modelos.</p>`;
}
function esqQtdHtml(a){
  const q=quantitativoEsquadrias(a,modelosEsq());if(!q.ok||!q.itens.length)return '<p class="small muted">Sem itens ainda.</p>';
  return `<div class="sheet">${q.itens.map(i=>`<div class="li" style="display:flex;justify-content:space-between;gap:8px;padding:10px 12px;border-top:1px solid var(--line)"><span>${esc(i.descricao)}</span><span class="num"><b>${nf(i.quantidade)} ${esc(i.unidade)}</b></span></div>`).join('')}</div>`;
}
function esqOrcHtml(a){
  const r=esqOrc(a);if(!r)return '<p class="small muted">Corrija os dados para orçar.</p>';
  const {res}=r;
  if(!res.ok)return `<div role="alert" style="color:var(--bad)"><b>Confira os valores</b><ul style="margin:6px 0 0;padding-left:18px">${res.erros.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
  return `<div class="card" style="background:var(--fg);color:var(--bg);padding:14px"><div class="small" style="opacity:.8">PREÇO FINAL${res.completo?'':' (incompleto)'}</div><b class="num" style="font-size:26px">${brl(res.preco)}</b>
   <div class="small" style="opacity:.8;margin-top:4px">Custo ${brl(res.custo)} · lucro ${brl(res.lucro)} · impostos ${brl(res.impostosValor)}</div></div>
   ${res.pendentes.length?`<p class="small" style="color:var(--warn)">Faltam preços em: ${res.pendentes.map(c=>esc((r.q.itens.find(i=>i.codigo===c)||{}).descricao||c)).join(', ')}. Eles entram como R$ 0,00 até você preencher.</p>`:''}`;
}
function esqPrecosHtml(a){
  const P='esquadrias.'+a.id,qq=quantitativoEsquadrias(a,modelosEsq());a.orc=a.orc||{};a.orc.precos=a.orc.precos||{};
  qq.itens.forEach(i=>{a.orc.precos[i.codigo]=a.orc.precos[i.codigo]||{preco:'',mo:''}});
  return qq.itens.map(i=>{const R=P+'.orc.precos.'+i.codigo;
    return `<div class="stack" style="gap:6px;padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><b>${esc(i.descricao)}</b><span class="num small">${nf(i.quantidadeComPerda)} ${esc(i.unidade)}</span></div>
     <div class="grid2">${fld('Preço por '+i.unidade,R+'.preco','n',{unit:'R$'})}${fld('Mão de obra por '+i.unidade,R+'.mo','n',{unit:'R$'})}</div></div>`}).join('');
}
const esqAssinatura=a=>quantitativoEsquadrias(a,modelosEsq()).itens.map(i=>i.codigo).join('|');

/* ----- telas ----- */
function viewEsq(){
  if(nav.esqModelos)return viewEsqModelos();
  const L=esqs();
  if(nav.esq){const a=L.find(x=>x.id===nav.esq);if(a)return viewEsqEdit(a);nav.esq=null}
  const lista=L.map(a=>{const m=medidasEsquadrias(a,modelosEsq()),r=esqOrc(a),sn=fechadoEsq(a)?a.snap:null;
    return `<div class="li card tap" style="border-radius:0;border-width:1px 0 0" tabindex="0" data-act="esq-abrir" data-v="${a.id}"><div class="grow"><b>${esc(a.nome)}</b>
     <div class="small muted">${m.ok?`${m.pecas} esquadria${m.pecas===1?'':'s'} · ${nf(m.areaVao)} m²`:'dados incompletos'}</div></div>
     <div class="num"><b>${brl(sn?sn.preco:(r&&r.res.ok?r.res.preco:0))}</b><div><span class="chip c-${a.status}">${a.status}</span></div></div></div>`}).join('');
  return `<header class="top"><button class="ghost" data-act="tab" data-v="home" aria-label="Voltar ao início">${IC.back}</button><h1>Esquadrias</h1><button class="pri" data-act="esq-novo">Novo</button></header>
   <div class="stack"><button data-act="esq-modelos">Meus modelos (${modelosEsq().length})</button>
   ${lista?`<div class="sheet">${lista}</div>`:'<div class="card muted" style="text-align:center">Nenhum orçamento de esquadrias ainda. Primeiro cadastre seus modelos (o app não traz fórmula de perfil nenhuma), depois toque em Novo para lançar portas, janelas, portões e fachadas.</div>'}</div>`;
}
function viewEsqModelos(){
  const cards=modelosEsq().map(mod=>{const M='modelosEsq.'+mod.id,v=validarModelo(mod);
    const comps=(mod.comps||[]).map(c=>{const C=M+'.comps.'+c.id;
      return `<div class="card stack" style="padding:10px"><div class="row between"><b>${esc(c.nome||'Componente')}</b><button class="ghost danger sm" data-act="esq-del-comp" data-v="${mod.id}|${c.id}">Remover</button></div>
       <div class="grid2">${fld('Nome',C+'.nome')}${fld('Unidade',C+'.unidade','t',{ph:'m, un, barra...'})}${sel('Regra',C+'.regra',ESQ_REGRA_OPC,{blank:'Escolha…'})}${fld('Fator',C+'.fator','n')}</div></div>`}).join('');
    return `<div class="card stack" style="padding:12px"><div class="row between"><h3>${esc(mod.nome||'Novo modelo')}</h3><button class="ghost danger sm" data-act="esq-del-modelo" data-v="${mod.id}">Excluir modelo</button></div>
     ${fld('Nome do modelo',M+'.nome','t',{ph:'Ex.: Janela de correr 2 folhas'})}${comps}
     <button data-act="esq-add-comp" data-v="${mod.id}">+ Componente</button>
     ${v.ok?'':`<ul class="small" style="color:var(--warn);margin:0;padding-left:18px">${v.erros.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`}</div>`}).join('');
  return `<header class="top"><button class="ghost" data-act="esq-voltar-modelos" aria-label="Voltar">${IC.back}</button><h1>Meus modelos</h1><button class="pri" data-act="esq-novo-modelo">Novo</button></header>
   <div class="stack"><div class="note">Um modelo é a lista de componentes de um tipo de esquadria (perfis, ferragens, acessórios). Para cada componente, diga a regra da quantidade e o fator. Exemplos de regra: 4 roldanas por esquadria (fixo, fator 4); 1 m de perfil por metro de perímetro (perímetro, fator 1). Os valores são seus: o app não assume nenhum.</div>
   ${cards||'<div class="card muted" style="text-align:center">Nenhum modelo ainda. Toque em Novo.</div>'}</div>`;
}
function viewEsqEdit(a){
  const P='esquadrias.'+a.id;a.itens=a.itens||[];a.orc=a.orc||{};a.orc.precos=a.orc.precos||{};
  const mods=modelosEsq();
  const pecas=a.itens.map(it=>{const Q=P+'.itens.'+it.id;
    return `<div class="card stack" style="padding:12px"><div class="row between"><b>${esc(ESQ_TIPOS[it.tipo]||'Esquadria')}</b><button class="ghost danger sm" data-act="esq-del-peca" data-v="${it.id}">Remover</button></div>
     <div class="grid2">${sel('Tipo',Q+'.tipo',ESQ_TIPO_OPC,{blank:'Escolha…'})}${sel('Modelo',Q+'.modeloId',mods.map(m=>[m.id,m.nome||'(sem nome)']),{blank:'Escolha…'})}
     ${fld('Largura',Q+'.largura','n',{unit:'cm'})}${fld('Altura',Q+'.altura','n',{unit:'cm'})}${fld('Quantidade',Q+'.qtd','n',{unit:'un'})}${fld('Vidro (espessura)',Q+'.vidro','n',{unit:'mm (vazio = sem vidro)'})}</div>
     ${fld('Observação (cor, acabamento...)',Q+'.obs')}</div>`}).join('');
  return `<header class="top"><button class="ghost" data-act="esq-voltar" aria-label="Voltar">${IC.back}</button><h1>${esc(a.nome||'Esquadrias')}</h1><span class="small muted">#${a.num||''}</span></header>
   <div class="stack ed3p"><div class="edcol ed-l"><div class="card stack o1" style="padding-top:14px">
    <div class="grid2">${sel('Cliente',P+'.clientId',S.clients.map(c=>[c.id,c.name]),{blank:'Sem cliente'})}${sel('Status',P+'.status',STATUS.map(x=>[x,x]))}</div>
    ${fechadoEsq(a)?'<div class="note">Orçamento fechado: os valores estão congelados. Mude o status para reabrir e editar.</div>':''}${fld('Nome',P+'.nome')}
    <button data-act="esq-modelos">Meus modelos (${mods.length})</button></div>
    <div class="stack o8"><h3>Esquadrias</h3>${pecas}<button data-act="esq-add-peca">+ Esquadria</button></div>
    <button class="danger o10" data-act="esq-del">Excluir orçamento</button></div>
   <div class="edcol ed-c"></div>
   <div class="edcol ed-r"><div id="esqmed" class="stack o3">${esqMedHtml(a)}</div>
    <div class="card stack o4"><div class="row between"><h3>Quantitativo</h3><span class="small muted">sem preço: vem no orçamento</span></div><div id="esqqtd">${esqQtdHtml(a)}</div></div>
    <div class="card stack o5"><h3>Orçamento</h3><p class="small muted">Informe o preço por unidade de cada item e, se quiser, a mão de obra. O app não sugere preços.</p>
     <div id="esqprecos" data-sig="${esc(esqAssinatura(a))}">${esqPrecosHtml(a)}</div>
     <div class="grid2">${fld('Margem',P+'.orc.margem','n',{unit:'% (vazio = Ajustes: '+nf(S.settings.margin,0)+'%)'})}${fld('Impostos',P+'.orc.impostos','n',{unit:'% (vazio = Ajustes: '+nf(S.settings.tax,0)+'%)'})}
     ${fld('Instalação',P+'.orc.instalacao','n',{unit:'R$'})}${fld('Frete',P+'.orc.frete','n',{unit:'R$'})}</div>
     <div id="esqpreco">${esqOrcHtml(a)}</div>
     <div class="row"><button class="pri grow" data-act="esq-pdf">Gerar PDF</button><button class="grow" data-act="esq-wa">Enviar por WhatsApp</button></div></div></div></div>`;
}
function aplicarTravaEsq(){
  const a=esqs().find(x=>x.id===nav.esq);if(!fechadoEsq(a)||nav.esqModelos)return;
  $$('#app input,#app select,#app textarea,#app button').forEach(el=>{
    if(!el.matches('[data-act="esq-voltar"],[data-act="esq-pdf"],[data-act="esq-wa"],select[data-b$=".status"]'))el.disabled=true;
  });
}
function liveEsq(){
  if(nav.esqModelos)return;
  const a=esqs().find(x=>x.id===nav.esq);if(!a)return;
  const set=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
  const pr=$('#esqprecos'),sig=esqAssinatura(a);
  if(pr&&pr.dataset.sig!==sig&&!pr.contains(document.activeElement)){pr.dataset.sig=sig;pr.innerHTML=esqPrecosHtml(a)}
  else if(pr&&pr.dataset.sig===sig){const q=quantitativoEsquadrias(a,modelosEsq());const spans=pr.querySelectorAll('.row.between .num');q.itens.forEach((i,k)=>{if(spans[k])spans[k].textContent=nf(i.quantidadeComPerda)+' '+i.unidade})}
  set('#esqmed',esqMedHtml(a));set('#esqqtd',esqQtdHtml(a));set('#esqpreco',esqOrcHtml(a));
  const t=$('.top h1');if(t)t.textContent=a.nome||'Esquadrias';
}

async function buildPdfEsq(a){
  const r=esqOrc(a);if(!r||!r.res.ok)throw new Error('orcamento-invalido');
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),s=S.settings,W=210,M=14,CW=W-2*M,ACC=[14,106,91],INK=[17,24,39];
  const logo=await urlParaDataUrl(s.logo),m=medidasEsquadrias(a,modelosEsq()),cli=S.clients.find(c=>c.id===a.clientId),mods=modelosEsq();let y=0;
  const rodape=()=>{const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setDrawColor(200);doc.setLineWidth(0.2);doc.line(M,286,W-M,286);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(120);
    doc.text('Valores sujeitos a conferência das medidas no local.',M,290.5,{maxWidth:CW-18});doc.text(i+' / '+n,W-M,290.5,{align:'right'})}doc.setTextColor(0)};
  const need=h=>{if(y+h>282){doc.addPage();y=16}};
  const titulo=t=>{need(12);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ACC);doc.text(t.toUpperCase(),M,y);doc.setTextColor(0);y+=5.5};
  doc.setFillColor(...ACC);doc.rect(0,0,W,30,'F');let xt=M;
  if(logo){try{const p=doc.getImageProperties(logo),h=18,w=Math.min(46,h*p.width/p.height);doc.setFillColor(255,255,255);doc.roundedRect(M,6,w+4,h,2,2,'F');doc.addImage(logo,'JPEG',M+2,6,w,h);xt=M+w+9}catch(e){}}
  doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(s.empresa||'Empresa',xt,14.5,{maxWidth:100});
  doc.setFont('helvetica','normal');doc.setFontSize(9);const l2=[s.cnpj?'CNPJ '+s.cnpj:'',s.telefone].filter(Boolean).join('   ·   ');if(l2)doc.text(l2,xt,21.5,{maxWidth:105});
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('ORÇAMENTO #'+(a.num||''),W-M,13,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(dateBR(Date.now()),W-M,19,{align:'right'});doc.text('Validade: '+(s.validade||15)+' dias',W-M,24,{align:'right'});
  doc.setTextColor(0);y=38;
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(a.nome||'Esquadrias',M,y);y+=6;
  if(cli){doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Cliente: '+cli.name,M,y);doc.setFont('helvetica','normal');doc.setTextColor(90);const ct=[cli.phone,cli.email,cli.address].filter(Boolean).join('   ·   ');if(ct)doc.text(ct,M,y+5,{maxWidth:CW});doc.setTextColor(0);y+=ct?11:6}
  y+=2;titulo('Esquadrias');
  const col=[M,M+34,M+84,M+118,M+136];
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(120);['TIPO','MODELO','MEDIDAS (cm)','QTD','VIDRO'].forEach((t,i)=>doc.text(t,col[i],y));doc.text('ÁREA (m²)',W-M,y,{align:'right'});doc.setTextColor(0);y+=2;doc.setDrawColor(40);doc.setLineWidth(0.4);doc.line(M,y,W-M,y);y+=4.5;
  a.itens.forEach((it,i)=>{need(14);const mi=m.itens[i],mod=mods.find(x=>x.id===it.modeloId);
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(ESQ_TIPOS[it.tipo]||'',col[0],y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(mod?mod.nome:'',46)[0]||'',col[1],y);
    doc.text(nf(it.largura,0)+' × '+nf(it.altura,0),col[2],y);doc.text(String(it.qtd),col[3],y);doc.text(it.vidro?nf(it.vidro,0)+' mm':'sem vidro',col[4],y);doc.text(nf(mi.area*it.qtd),W-M,y,{align:'right'});
    if(it.obs){y+=4.2;doc.setFontSize(8);doc.setTextColor(100);doc.text(it.obs,col[0],y,{maxWidth:CW});doc.setTextColor(0)}
    y+=1.6;doc.setDrawColor(225);doc.setLineWidth(0.2);doc.line(M,y,W-M,y);y+=4.6});
  need(10);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(`Total: ${m.pecas} esquadria${m.pecas===1?'':'s'} · ${nf(m.areaVao)} m² de vão`,M,y);y+=9;
  need(36);doc.setFillColor(...INK);doc.roundedRect(M,y,CW,30,2.5,2.5,'F');
  doc.setTextColor(190,200,210);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('VALOR TOTAL',M+7,y+9);
  doc.setTextColor(255);doc.setFontSize(32);doc.text(brl(r.res.preco),M+7,y+23.5);
  const pa=+s.parcelas||0,pd=+s.pixDesc||0;doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(210,218,226);
  if(pa>1)doc.text('Em até '+pa+'x',W-M-7,y+11,{align:'right'});
  if(pd>0){doc.text('PIX com '+nf(pd,pd%1?1:0)+'% de desconto:',W-M-7,y+16.2,{align:'right'});doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(255);doc.text(brl(Math.round(r.res.preco*(1-pd/100)*100)/100),W-M-7,y+24,{align:'right'})}
  doc.setTextColor(0);y+=38;
  const cond=[['Pagamento',s.pagamento],['Prazo de entrega',s.prazo],['Garantia',s.garantia]].filter(([,v])=>v&&String(v).trim());
  if(cond.length){titulo('Condições');cond.forEach(([k,v])=>{const t=doc.splitTextToSize(String(v),CW-40);need(t.length*4.6+2);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(k,M+2,y);doc.setFont('helvetica','normal');doc.text(t,M+40,y);y+=t.length*4.6+1.5})}
  rodape();return doc.output('blob');
}

async function acaoEsq(act,b,v,e){
  const a=esqs().find(x=>x.id===nav.esq);
  switch(act){
    case 'esq-novo':esqNovo();break;
    case 'esq-abrir':nav.tab='esq';nav.esq=v;nav.esqModelos=false;nav.qid=null;render();scrollTo(0,0);break;
    case 'esq-voltar':nav.esq=null;render();break;
    case 'esq-modelos':nav.esqModelos=true;render();scrollTo(0,0);break;
    case 'esq-voltar-modelos':nav.esqModelos=false;render();break;
    case 'esq-novo-modelo':modelosEsq().push({id:uid(),nome:'',comps:[]});save();render();break;
    case 'esq-del-modelo':confirmTap(b,()=>{const usado=esqs().some(x=>(x.itens||[]).some(i=>i.modeloId===v));
      if(usado){toast('Este modelo está em uso em algum orçamento. Remova-o de lá antes de excluir.');return}S.modelosEsq=modelosEsq().filter(m=>m.id!==v);save();render()});break;
    case 'esq-add-comp':{const m=modelosEsq().find(x=>x.id===v);if(m){m.comps.push({id:uid(),nome:'',unidade:'',regra:'',fator:''});save();render()}break}
    case 'esq-del-comp':{const [mid,cid]=v.split('|'),m=modelosEsq().find(x=>x.id===mid);if(m){m.comps=m.comps.filter(c=>c.id!==cid);save();render()}break}
    case 'esq-add-peca':if(a){a.itens.push({id:uid(),modeloId:'',tipo:'',largura:'',altura:'',qtd:1,vidro:'',obs:''});save();render()}break;
    case 'esq-del-peca':if(a){a.itens=a.itens.filter(x=>x.id!==v);save();render()}break;
    case 'esq-del':confirmTap(b,()=>{S.esquadrias=esqs().filter(x=>x.id!==nav.esq);nav.esq=null;save();render()});break;
    case 'esq-pdf':{if(!a)break;const r=esqOrc(a);if(!r||!r.res.ok){toast('Corrija os dados e os valores antes de gerar o PDF.');break}
      if(!r.res.completo&&!confirm('Há itens sem preço. Eles entram como R$ 0,00. Gerar o PDF mesmo assim?'))break;
      b.disabled=true;toast('Gerando o PDF…');
      try{await saveFile(nomePdfEsq(a),await buildPdfEsq(a))}catch(err){toast('Não foi possível gerar o PDF.')}
      b.disabled=false;break}
    case 'esq-wa':{if(!a)break;const r=esqOrc(a);if(!r||!r.res.ok){toast('Corrija os dados e os valores antes de enviar.');break}
      b.disabled=true;toast('Gerando o PDF…');
      try{const bl=await buildPdfEsq(a),nome=nomePdfEsq(a),arq=new File([bl],nome,{type:'application/pdf'}),texto=waTextoEsq(a,r);
        if(navigator.canShare&&navigator.canShare({files:[arq]})){try{await navigator.share({files:[arq],text:texto,title:'Orçamento #'+a.num});b.disabled=false;break}catch(err){if(err&&err.name==='AbortError'){b.disabled=false;break}}}
        await saveFile(nome,bl);let d=((S.clients.find(c=>c.id===a.clientId)||{}).phone||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;
        window.open(`https://wa.me/${d}?text=${encodeURIComponent(texto)}`,'_blank','noopener');toast('PDF baixado. Anexe na conversa do WhatsApp.');
      }catch(err){toast('Não foi possível gerar o PDF.')}
      b.disabled=false;break}
  }
}
