/* Marmofácil: ordem de produção em PDF, para a oficina (SEM preço). Script comum: usa as funções e o estado de index.html
   (S, calc, shape, TYPES, clientOf, descPiece, nf, dateBR, imagens3dPdf, urlParaDataUrl) e as funções puras de producao.js.
   Os desenhos são vetoriais (nítidos na impressão) e a numeração das peças é a mesma da ficha do projeto. */

async function buildOrdemProducao(q){
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),s=S.settings,W=210,H=297,M=14,CW=W-2*M,ACC=[14,106,91],INK=[17,24,39];
  const c=calc(q),cl=clientOf(q)||{},m=c.m,partes=q.pieces.map(p=>shape(p).parts),flat=partes.flat();
  const res=resumoProducao(c,flat),mapa=mapaPecas(partes),nomes=q.pieces.map(p=>p.name||TYPES[p.type].nome),linhas=linhasOrdem(res.pecas,mapa,nomes);
  const [img3d,logo]=await Promise.all([imagens3dPdf(q),urlParaDataUrl(s.logo)]);
  let y=0;
  const fmt=v=>nf(v,v%1?1:0);
  const need=h=>{if(y+h>H-18){doc.addPage();y=16}};
  const titulo=t=>{need(12);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ACC);doc.text(t.toUpperCase(),M,y);doc.setTextColor(0);y+=5.5};
  const rodape=()=>{const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setDrawColor(200);doc.setLineWidth(0.2);doc.line(M,H-12,W-M,H-12);
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(120);
    doc.text('O plano de corte é uma estimativa por faixas e não considera o veio da pedra. Confira as medidas no local antes de cortar.',M,H-8.5,{maxWidth:CW});
    doc.text('Ordem de produção #'+q.num+' · '+i+' / '+n,W-M,H-4.5,{align:'right'})}doc.setTextColor(0)};

  /* ----- página 1: cabeçalho, dados e visão geral ----- */
  doc.setFillColor(...ACC);doc.rect(0,0,W,28,'F');let xt=M;
  if(logo){try{const p=doc.getImageProperties(logo),h=16,w=Math.min(42,h*p.width/p.height);doc.setFillColor(255,255,255);doc.roundedRect(M,6,w+4,h,2,2,'F');doc.addImage(logo,'JPEG',M+2,6,w,h);xt=M+w+9}catch(e){}}
  doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(s.empresa||'Marmoraria',xt,13.5,{maxWidth:100});
  doc.setFont('helvetica','normal');doc.setFontSize(9);if(s.telefone)doc.text(s.telefone,xt,20,{maxWidth:100});
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('ORDEM DE PRODUÇÃO #'+q.num,W-M,12,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text('Emitida em '+dateBR(Date.now()),W-M,18,{align:'right'});doc.text('Sem valores: uso da oficina',W-M,23,{align:'right'});
  doc.setTextColor(0);y=36;
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(cl.name||'Cliente não informado',M,y);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(90);const ct=[cl.phone,cl.address].filter(Boolean).join('   ·   ');if(ct)doc.text(ct,M,y+5,{maxWidth:CW});doc.setTextColor(0);y+=ct?12:7;
  /* material e chapa */
  const caixa=(x,w,rot,val,sub)=>{doc.setDrawColor(210);doc.setLineWidth(0.25);doc.roundedRect(x,y,w,17,1.5,1.5);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(120);doc.text(rot.toUpperCase(),x+3,y+5);
    doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(val,x+3,y+11.5,{maxWidth:w-6});if(sub){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(100);doc.text(sub,x+3,y+15.2,{maxWidth:w-6});doc.setTextColor(0)}};
  const w4=(CW-9)/4;
  caixa(M,w4*1.6,'Material',m?m.name:'A definir',m?[m.cat,m.color].filter(Boolean).join(' · '):'');
  caixa(M+w4*1.6+3,w4*0.8,'Espessura',m&&m.thick>0?fmt(m.thick)+' cm':'—','');
  caixa(M+w4*2.4+6,w4*1.6,'Chapa',fmt(c.SL)+' × '+fmt(c.SW)+' cm',nf(c.slabArea)+' m²');
  y+=20;
  caixa(M,w4,'Chapas',String(c.nSlabs),'');caixa(M+w4+3,w4,'Aproveitamento',nf(c.util*100,0)+'%','');caixa(M+2*(w4+3),w4,'Sobra útil',nf(res.sobraUtil)+' m²','');caixa(M+3*(w4+3),w4,'Pedra no projeto',nf(c.area)+' m²','');
  y+=23;
  /* peças do projeto */
  titulo('Peças do projeto');
  q.pieces.forEach((p,i)=>{
    const rec=(p.recortes||[]).filter(r=>r&&r.w>0&&r.d>0).map(r=>`${({cuba:'cuba',cooktop:'cooktop'})[r.tipo]||'recorte'} ${fmt(r.w)}×${fmt(r.d)} cm${r.origem==='estimado'?' (estimado)':''}`);
    const extra=[p.saiaH>0?`saia ${fmt(p.saiaH)} cm`:'',p.rodaH>0?`rodabanca ${fmt(p.rodaH)} cm`:'',...rec].filter(Boolean).join(' · ');
    const linhasTxt=doc.splitTextToSize(TYPES[p.type].nome+' · '+descPiece(p)+(extra?' · '+extra:''),CW-4);need(linhasTxt.length*4.2+10);
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(`${i+1}. ${nomes[i]}`,M,y);y+=4.6;
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(70);doc.text(linhasTxt,M+4,y);doc.setTextColor(0);y+=linhasTxt.length*4.2+2.5;
  });
  if(q.notes){y+=2;titulo('Observações do orçamento');doc.setFont('helvetica','normal');doc.setFontSize(9.5);const t=doc.splitTextToSize(q.notes,CW);need(t.length*4.6);doc.text(t,M,y);y+=t.length*4.6+3}
  /* visão 3D (se o aparelho conseguiu gerar) */
  const hero=img3d.geral||(img3d.pecas[0]&&img3d.pecas[0].img);
  if(hero){const hh=Math.min(CW*430/700,H-y-24);if(hh>45){need(hh+12);titulo('Visão geral em 3D');try{doc.addImage(hero,'JPEG',M,y,hh*700/430,hh);doc.setDrawColor(225);doc.rect(M,y,hh*700/430,hh);y+=hh+3;doc.setFontSize(7.5);doc.setTextColor(120);doc.text('Imagem ilustrativa. Vale o que está nas medidas e nos desenhos das páginas seguintes.',M,y+1);doc.setTextColor(0);y+=6}catch(e){}}}

  /* ----- desenho técnico de cada peça (vetorial) ----- */
  doc.addPage();y=16;
  q.pieces.forEach((p,i)=>{
    const sh=shape(p),rects=sh.rects;if(!rects.length)return;
    const Wd=Math.max(...rects.map(a=>a.x+a.w)),Hd=Math.max(...rects.map(a=>a.y+a.h)),box=ajustarCaixa(Wd,Hd,CW-26,78,3);
    const alturaTotal=box.h+22;need(alturaTotal+8);
    titulo(`Desenho e medidas: ${nomes[i]}`);
    const x0=M+16,y0=y+8,k=box.k,nums=mapa.filter(x=>x.pecaIndice===i).map(x=>x.n);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text(`${TYPES[p.type].nome} · peças do corte nº ${nums.length?nums[0]+(nums.length>1?' a '+nums[nums.length-1]:''):'—'}`,M,y-0.5+0.1);doc.setTextColor(0);
    rects.forEach(a=>{
      const rx=x0+a.x*k,ry=y0+a.y*k,rw=a.w*k,rh=a.h*k;
      doc.setLineWidth(0.4);doc.setDrawColor(...ACC);
      if(a.kind==='extra')doc.setFillColor(236,244,242);else if(a.kind==='riser')doc.setFillColor(238,238,238);else doc.setFillColor(214,236,230);
      doc.rect(rx,ry,rw,rh,'FD');
      if(rw>16&&rh>9){doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(30);doc.text(`${a.l}`,rx+rw/2,ry+rh/2-0.2,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(`${fmt(a.w)} × ${fmt(a.h)}`,rx+rw/2,ry+rh/2+3.2,{align:'center'});doc.setTextColor(0)}
      else if(rw>8){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(30);doc.text(`${a.l} · ${fmt(a.w)} × ${fmt(a.h)}`,rx,ry+rh+3.2);doc.setTextColor(0)}               // peça fina: rótulo logo abaixo
    });
    /* recortes, tracejados */
    Model3D.buildModel(p,2).recortes.forEach(r=>{
      doc.setLineDashPattern([1.5,1],0);doc.setDrawColor(190,110,20);doc.setLineWidth(0.4);doc.setFillColor(255,255,255);doc.rect(x0+r.x*k,y0+r.z*k,r.w*k,r.d*k,'FD');doc.setLineDashPattern([],0);
      if(r.w*k>14&&r.d*k>5){doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(150,80,10);doc.text(`${({cuba:'Cuba',cooktop:'Cooktop'})[r.tipo]||'Recorte'} ${fmt(r.w)}×${fmt(r.d)}`,x0+(r.x+r.w/2)*k,y0+(r.z+r.d/2)*k+1.5,{align:'center'});doc.setTextColor(0)}
    });
    /* cotas gerais */
    doc.setDrawColor(90);doc.setLineWidth(0.25);
    doc.line(x0,y0-4,x0+Wd*k,y0-4);doc.line(x0,y0-5.5,x0,y0-2.5);doc.line(x0+Wd*k,y0-5.5,x0+Wd*k,y0-2.5);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(40);doc.text(fmt(Wd)+' cm',x0+Wd*k/2,y0-5.2,{align:'center'});
    doc.line(x0-4,y0,x0-4,y0+Hd*k);doc.line(x0-5.5,y0,x0-2.5,y0);doc.line(x0-5.5,y0+Hd*k,x0-2.5,y0+Hd*k);
    doc.text(fmt(Hd)+' cm',x0-6,y0+Hd*k/2,{align:'center',angle:90});doc.setTextColor(0);
    y=y0+box.h+14;
  });

  /* ----- plano de corte ----- */
  doc.addPage();y=16;titulo('Plano de corte');
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const msg=doc.splitTextToSize(res.mensagem.texto,CW);doc.text(msg,M,y);y+=msg.length*4.4+2;
  res.avisos.forEach(a=>{const t=doc.splitTextToSize(a,CW);need(t.length*4.2+2);doc.setTextColor(176,40,25);doc.text(t,M,y);doc.setTextColor(0);y+=t.length*4.2+1});y+=2;
  c.nest.slabs.forEach((sl,i)=>{
    const k=Math.min((CW-2)/c.SL,100/c.SW),sw=c.SL*k,sh=c.SW*k;need(sh+14);
    const usada=sl.items.reduce((t,a)=>t+a.w*a.h,0)/1e4;
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(`Chapa ${i+1} de ${c.nSlabs}`,M,y);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(90);doc.text(`${fmt(c.SL)} × ${fmt(c.SW)} cm · ${nf(usada/c.slabArea*100,0)}% usada`,W-M,y,{align:'right'});doc.setTextColor(0);y+=3;
    doc.setDrawColor(130);doc.setLineWidth(0.4);doc.setFillColor(232,235,234);doc.rect(M,y,sw,sh,'FD');
    sl.items.forEach(a=>{
      const rx=M+a.x*k,ry=y+a.y*k,rw=a.w*k,rh=a.h*k,rot=rotuloPeca(a.ref);
      doc.setDrawColor(...ACC);doc.setLineWidth(0.35);doc.setFillColor(214,236,230);doc.rect(rx,ry,rw,rh,'FD');
      doc.setTextColor(30);
      if(rw>14&&rh>8){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(rot,rx+rw/2,ry+rh/2,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.text(`${fmt(a.w)} × ${fmt(a.h)}`,rx+rw/2,ry+rh/2+3.4,{align:'center'})}
      else if(rw>6&&rh>3){doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text(rot,rx+rw/2,ry+rh/2+1.1,{align:'center'})}
      doc.setTextColor(0);
    });
    (res.sobras.porChapa[i]||[]).forEach(r=>{
      doc.setLineDashPattern([1.2,1],0);doc.setDrawColor(30,130,80);doc.setLineWidth(0.3);doc.rect(M+r.x*k,y+r.y*k,r.w*k,r.h*k,'S');doc.setLineDashPattern([],0);
      if(r.w*k>26&&r.h*k>5){doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(30,130,80);doc.text(`sobra ${fmt(r.w)} × ${fmt(r.h)}`,M+(r.x+r.w/2)*k,y+(r.y+r.h/2)*k+1.2,{align:'center'});doc.setTextColor(0)}
    });
    y+=sh+9;
  });

  /* ----- tabela de peças ----- */
  need(30);titulo('Peças do corte');
  const col=[M,M+11,M+50,M+86,M+120,M+132,W-M-11];
  const cab=()=>{doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(110);['Nº','PEÇA DO PROJETO','PEÇA','MEDIDA','QTD','OBSERVAÇÃO'].forEach((t,i)=>doc.text(t,col[i],y));doc.text('CORTADA',W-M,y,{align:'right'});doc.setTextColor(0);y+=1.8;doc.setDrawColor(40);doc.setLineWidth(0.4);doc.line(M,y,W-M,y);y+=4.6};
  cab();
  linhas.forEach(l=>{
    if(y>H-22){doc.addPage();y=16;cab()}
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(String(l.n),col[0],y);doc.setFont('helvetica','normal');
    doc.text(doc.splitTextToSize(l.projeto,34)[0]||'',col[1],y);doc.text(doc.splitTextToSize(l.nome,34)[0]||'',col[2],y);doc.text(l.medida,col[3],y);doc.text(String(l.q),col[4],y);
    doc.setFontSize(8);doc.text(doc.splitTextToSize(l.obs||'—',W-M-14-col[5])[0],col[5],y);
    doc.setDrawColor(80);doc.setLineWidth(0.3);doc.rect(W-M-5,y-3.4,4.6,4.6);
    y+=1.8;doc.setDrawColor(225);doc.setLineWidth(0.2);doc.line(M,y,W-M,y);y+=4.8;
  });
  /* sobras */
  y+=4;need(24);titulo(`Sobras aproveitáveis (a partir de ${nf(PROD_SOBRA_MIN,0)} cm)`);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  if(!res.sobras.todas.length){doc.text('Nenhuma sobra com tamanho aproveitável.',M,y);y+=6}
  else{const meio=CW/2;for(let i=0;i<res.sobras.todas.length;i+=2){need(6);
    [0,1].forEach(j=>{const r=res.sobras.todas[i+j];if(r)doc.text(`Chapa ${r.chapa}: ${fmt(r.w)} × ${fmt(r.h)} cm (${nf(r.area)} m²)`,M+j*meio,y)});y+=5}}
  /* conferência */
  y+=6;need(26);titulo('Conferência');
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setDrawColor(60);doc.setLineWidth(0.3);
  doc.line(M,y+8,M+78,y+8);doc.line(M+96,y+8,M+CW-0,y+8);doc.text('Cortado e conferido por',M,y+12.5);doc.text('Data',M+96,y+12.5);
  rodape();
  return doc.output('blob');
}
const nomePdfOrdem=q=>'Ordem-de-producao-'+q.num+'-'+String((clientOf(q)||{}).name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')+'.pdf';
