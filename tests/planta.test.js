/* Testes da planta baixa ortogonal (motor/planta.js).
   Referências manuais: L 500 × 400 com recorte 200 × 150 => piso 17 m², perímetro 18 m. Retângulo 400 × 500 × 270 => 20 m², 18 m, paredes 48,6 m². Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {AMB_LIM,medidasAmbiente}=require('../motor/ambiente.js');
const {criarPlanta,plantaFormato,validarPlanta,medidasPlanta,quantitativoPlanta,modeloPlanta,plantaMoverParede,plRetangulos,plArea2}=require('../motor/planta.js');

const near=(a,b,msg,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: esperado ${b}, veio ${a}`);
const planta=(tipo='L',A=500,B=400,a=200,b=150,o={})=>({nome:'Sala',altura:270,pontos:plantaFormato(tipo,A,B,a,b),aberturas:[],...o});
const porta=(o={})=>({id:'p1',tipo:'porta',aresta:0,x:50,largura:80,altura:210,peitoril:0,...o});
const janela=(o={})=>({id:'j1',tipo:'janela',aresta:0,x:150,largura:120,altura:100,peitoril:110,...o});
const sobrepoe=(a,b)=>{const o=(p,q,r,s)=>Math.max(0,Math.min(p+q,r+s)-Math.max(p,r));return o(a.x,a.sx,b.x,b.sx)*o(a.y,a.sy,b.y,b.sy)*o(a.z,a.sz,b.z,b.sz)>1e-6};
const vol=s=>s.sx*s.sy*s.sz;
const maior=pts=>{let k=0,m=-1;pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length],L=Math.abs(q.x-p.x)+Math.abs(q.y-p.y);if(L>m){m=L;k=i}});return k};   // parede mais comprida (para caber porta e janela)

test('L 500×400 com recorte 200×150: piso 17 m², perímetro 18 m, 6 paredes',()=>{
  const m=medidasPlanta(planta());assert.equal(m.ok,true);
  near(m.areaPiso,17,'piso');near(m.areaTeto,17,'teto');near(m.perimetro,18,'perímetro');near(m.volume,17*2.7,'volume');
  assert.equal(m.paredes.length,6);near(m.areaParedesBruta,18*2.7,'paredes brutas');
});
test('U e T: áreas pela fórmula',()=>{
  near(medidasPlanta(planta('U',600,400,200,150)).areaPiso,(600*400-200*150)/1e4,'U');
  near(medidasPlanta(planta('T',600,400,200,150)).areaPiso,(600*150+200*250)/1e4,'T');
  near(medidasPlanta(planta('retangulo',400,500)).areaPiso,20,'retângulo');
});
test('retângulo da planta = ambiente retangular (mesmas áreas e perímetro, com porta e janela)',()=>{
  const r=medidasAmbiente({nome:'x',largura:400,comprimento:500,altura:270,aberturas:[{tipo:'porta',parede:'S',x:100,largura:80,altura:210,peitoril:0},{tipo:'janela',parede:'L',x:150,largura:120,altura:100,peitoril:110}]});
  const p=medidasPlanta(planta('retangulo',400,500,0,0,{aberturas:[porta({aresta:2}),janela({aresta:1})]}));
  near(p.areaPiso,r.areaPiso,'piso');near(p.perimetro,r.perimetro,'perímetro');near(p.areaParedesLiquida,r.areaParedesLiquida,'paredes líquidas');near(p.volume,r.volume,'volume');
});
test('sentido horário e anti-horário dão o mesmo resultado',()=>{
  const a=planta(),b={...a,pontos:a.pontos.slice().reverse()};
  assert.equal(validarPlanta(b).ok,true);near(medidasPlanta(b).areaPiso,17,'piso');
  assert.equal(modeloPlanta(a).solids.length,modeloPlanta(b).solids.length);
  assert.ok(plArea2(a.pontos)*plArea2(b.pontos)<0);
});
test('validação: poucos cantos, parede torta, curta, canto não reto, cruzamento, altura, limites',()=>{
  const ok=planta();
  assert.equal(validarPlanta({...ok,pontos:ok.pontos.slice(0,3)}).ok,false,'3 cantos');
  assert.equal(validarPlanta({...ok,pontos:[{x:0,y:0},{x:400,y:10},{x:400,y:400},{x:0,y:400}]}).ok,false,'diagonal');
  assert.equal(validarPlanta({...ok,pontos:plantaFormato('L',500,400,480,150)}).ok,false,'parede de 20 cm');
  assert.equal(validarPlanta({...ok,pontos:[{x:0,y:0},{x:200,y:0},{x:400,y:0},{x:400,y:400},{x:0,y:400},{x:0,y:200}]}).ok,false,'cantos de 180 graus');
  assert.equal(validarPlanta({...ok,pontos:[{x:0,y:0},{x:400,y:0},{x:400,y:400},{x:200,y:400},{x:200,y:100},{x:300,y:100},{x:300,y:300},{x:0,y:300}]}).ok,false,'cruzamento');
  assert.equal(validarPlanta({...ok,altura:50}).ok,false);assert.equal(validarPlanta({...ok,altura:''}).ok,false);
  assert.equal(validarPlanta({...ok,pontos:plantaFormato('retangulo',6000,400)}).ok,false,'maior que o limite');
  assert.equal(validarPlanta(null).ok,false);assert.equal(validarPlanta({}).ok,false);
});
test('validação das aberturas: parede, cabe, sobreposição, peitoril da porta, altura',()=>{
  const v=ab=>validarPlanta(planta('L',500,400,200,150,{aberturas:ab}));
  assert.equal(v([porta()]).ok,true);
  assert.equal(v([porta({aresta:''})]).ok,false,'sem parede');assert.equal(v([porta({aresta:9})]).ok,false,'parede inexistente');
  assert.equal(v([porta({x:250})]).ok,false,'passa do fim da parede (parede 1 tem 300 cm)');
  assert.equal(v([porta(),porta({id:'p2',x:100})]).ok,false,'sobrepõe');assert.equal(v([porta(),porta({id:'p2',x:130})]).ok,true,'encostadas');
  assert.equal(v([porta({peitoril:10})]).ok,false);assert.equal(v([janela({peitoril:200})]).ok,false,'passa do pé-direito');
});
test('modelo: sólidos sem sobreposição e dentro do bbox (L, U, T, com aberturas)',()=>{
  for(const t of ['retangulo','L','U','T']){
    const pp=plantaFormato(t,600,500,200,150),k=maior(pp);
    const m=modeloPlanta(planta(t,600,500,200,150,{aberturas:[porta({aresta:k,x:20,largura:80}),janela({aresta:k,x:200})]}));
    assert.equal(m.vazio,false,t);
    for(let i=0;i<m.solids.length;i++){
      const s=m.solids[i];
      assert.ok(s.x>=m.bbox.min[0]-1e-9&&s.x+s.sx<=m.bbox.max[0]+1e-9&&s.z>=m.bbox.min[2]-1e-9&&s.z+s.sz<=m.bbox.max[2]+1e-9,t+' bbox '+s.label);
      for(let j=i+1;j<m.solids.length;j++)if(s.kind!=='vidro'&&m.solids[j].kind!=='vidro')assert.ok(!sobrepoe(s,m.solids[j]),`${t}: ${s.label}/${s.kind} × ${m.solids[j].label}/${m.solids[j].kind}`);
    }
  }
});
test('volume das paredes sem aberturas = espessura × altura × (perímetro + 4 × espessura); com abertura, desconta largura × altura × espessura',()=>{
  const t=AMB_LIM.esp;
  for(const tp of ['retangulo','L','U','T']){
    const e=planta(tp,600,500,200,150),m=modeloPlanta(e),per=medidasPlanta(e).perimetro*100;
    near(m.solids.filter(s=>s.kind==='parede').reduce((a,s)=>a+vol(s),0),t*270*(per+4*t),tp+' sem aberturas',1e-6);
    const k=maior(e.pontos),c=modeloPlanta({...e,aberturas:[porta({aresta:k,x:50,largura:80,altura:210}),janela({aresta:k,x:200})]});
    near(c.solids.filter(s=>s.kind==='parede').reduce((a,s)=>a+vol(s),0),t*270*(per+4*t)-t*(80*210+120*100),tp+' com aberturas',1e-6);
  }
});
test('piso e teto: volume = área × espessura',()=>{
  const m=modeloPlanta(planta());near(m.solids.filter(s=>s.kind==='piso').reduce((a,s)=>a+vol(s),0),170000*AMB_LIM.pisoEsp,'piso');
  const sem=modeloPlanta(planta(),{teto:false});assert.equal(sem.solids.filter(s=>s.kind==='teto').length,0);
});
test('plRetangulos cobre exatamente a área',()=>{
  for(const t of ['retangulo','L','U','T']){const e=planta(t,600,500,200,150);near(plRetangulos(e.pontos).reduce((a,r)=>a+(r[2]-r[0])*(r[3]-r[1]),0),Math.abs(plArea2(e.pontos))/2,t)}
});
test('cotas: uma por parede com o comprimento certo; distância entre os pontos = valor',()=>{
  const m=modeloPlanta(planta()),pl=m.cotas.filter(c=>c.categoria==='plano');assert.equal(pl.length,6);
  const med=medidasPlanta(planta()).paredes.map(p=>p.comprimento).sort((a,b)=>a-b);
  assert.deepEqual(pl.map(c=>c.valor).sort((a,b)=>a-b),med);
  m.cotas.filter(c=>c.tipo==='cota').forEach(c=>near(Math.hypot(c.p2[0]-c.p1[0],c.p2[1]-c.p1[1],c.p2[2]-c.p1[2]),c.valor,c.id,1e-9));
  assert.equal(m.cotas.filter(c=>c.tipo==='rotulo').length,0);
  assert.equal(modeloPlanta(planta('L',500,400,200,150,{aberturas:[porta()]})).cotas.filter(c=>c.tipo==='rotulo').length,1);
});
test('modelo inválido: vazio com os avisos',()=>{const m=modeloPlanta({altura:270,pontos:[]});assert.equal(m.vazio,true);assert.ok(m.avisos.length)});
test('quantitativo: piso, pintura, rodapé e revestimento por parede',()=>{
  const e=planta('L',500,400,200,150,{aberturas:[porta({aresta:0,x:20,largura:80,altura:210})],revestimentos:[{id:'r1',aresta:0,altura:120},{id:'r2',aresta:0,altura:270}]});
  const q=quantitativoPlanta(e),it=c=>q.itens.find(i=>i.codigo===c);assert.equal(q.ok,true);
  near(it('AMB-PISO').quantidade,17,'piso');near(it('AMB-PINT-PAREDE').quantidade,18*2.7-0.8*2.1,'pintura');near(it('AMB-RODAPE').quantidade,18-0.8,'rodapé');
  near(it('AMB-REV-P1').quantidade,(300*120-80*120)/1e4,'rev baixo (parede 1 tem 300 cm)');near(it('AMB-REV-P1-2').quantidade,(300*270-80*210)/1e4,'rev inteiro, código repetido');
});
test('quantitativo: perdas só quando informadas e inválido devolve erros',()=>{
  const q=quantitativoPlanta({...planta(),perdas:{piso:10}});near(q.itens[0].quantidadeComPerda,17*1.1,'piso 10%');
  assert.equal(quantitativoPlanta({...planta(),perdas:{piso:200}}).ok,false);assert.equal(quantitativoPlanta({...planta(),revestimentos:[{aresta:'',altura:100}]}).ok,false);
  const r=quantitativoPlanta({altura:270,pontos:[]});assert.equal(r.ok,false);assert.equal(r.itens.length,0);
});
test('mesmo conjunto de itens e códigos do ambiente retangular',()=>{
  const {quantitativoAmbiente}=require('../motor/ambiente.js');
  const a=quantitativoAmbiente({nome:'x',largura:400,comprimento:500,altura:270,aberturas:[]}).itens.map(i=>i.codigo);
  assert.deepEqual(quantitativoPlanta(planta('retangulo',400,500)).itens.map(i=>i.codigo),a);
});
test('mover parede: muda a área; recusa o que invalida',()=>{
  const e=planta(),r=plantaMoverParede(e,0,50);assert.equal(r.ok,true);
  near(medidasPlanta({...e,pontos:r.pontos}).areaPiso,17-1.5,'a parede de cima desceu 50 cm');
  const x=plantaMoverParede(e,0,150);assert.equal(x.ok,false);assert.ok(x.erro);assert.deepEqual(x.pontos,e.pontos,'nada muda quando recusa');
  assert.equal(plantaMoverParede(e,99,10).ok,false);assert.equal(plantaMoverParede(e,0,NaN).ok,false);
  assert.equal(plantaMoverParede(planta('retangulo',400,500),1,-100).ok,true,'parede da direita do retângulo para dentro');
  assert.equal(plantaMoverParede(planta('retangulo',400,500),1,-380).ok,false,'sobra menos de 30 cm');
});
test('mover parede com abertura que deixa de caber é recusado',()=>{
  const e=planta('retangulo',400,500,0,0,{aberturas:[porta({aresta:0,x:300,largura:80})]});
  assert.equal(plantaMoverParede(e,1,-100).ok,false,'parede 1 encolheu de 400 para 300: a porta não cabe mais');
});
test('propriedade: 600 plantas aleatórias válidas, sem sobreposição e com a fórmula do volume',()=>{
  let s=12345;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  for(let k=0;k<600;k++){
    const tp=['retangulo','L','U','T'][int(0,3)],A=int(200,1500),B=int(200,1500),a=int(60,Math.max(61,A-80)),b=int(60,Math.max(61,B-80));
    const e=planta(tp,A,B,a,b);if(!validarPlanta(e).ok)continue;
    const m=modeloPlanta(e),md=medidasPlanta(e);assert.ok(md.areaPiso>0);
    near(plRetangulos(e.pontos).reduce((x,r)=>x+(r[2]-r[0])*(r[3]-r[1]),0)/1e4,md.areaPiso,'área '+tp+A+'x'+B);
    const ps=m.solids.filter(x=>x.kind==='parede');
    near(ps.reduce((x,y)=>x+vol(y),0),AMB_LIM.esp*270*(md.perimetro*100+4*AMB_LIM.esp),'volume '+tp,1e-4);
    for(let i=0;i<m.solids.length;i++)for(let j=i+1;j<m.solids.length;j++)assert.ok(!sobrepoe(m.solids[i],m.solids[j]),'sobrepõe em '+tp+A+'x'+B+'/'+a+'x'+b);
  }
});

/* ===== Desenhar ponto a ponto ===== */
const {plantaProximaDirecao,plantaAdicionarParede,plantaDoToque,plantaFechar}=require('../motor/planta.js');
const desenhar=lista=>{let pts=[{x:0,y:0}];for(const [s,l] of lista){const r=plantaAdicionarParede(pts,s,l);assert.equal(r.ok,true,r.erro);pts=r.pontos}return pts};

test('desenho: as direções alternam (H, V, H, V...) e a primeira parede é horizontal',()=>{
  assert.deepEqual([1,2,3,4,5].map(n=>plantaProximaDirecao(Array(n).fill({x:0,y:0}))),['H','V','H','V','H']);
  const p=desenhar([[1,400],[1,300]]);assert.deepEqual(p,[{x:0,y:0},{x:400,y:0},{x:400,y:300}]);
});
test('desenho: sentido negativo vai para a esquerda e para cima',()=>{
  const p=desenhar([[-1,200],[-1,100]]);assert.deepEqual(p[2],{x:-200,y:-100});
});
test('desenho + fechar: retângulo em 3 paredes (última vertical)',()=>{
  const f=plantaFechar(desenhar([[1,400],[1,300],[-1,400]]),270);
  assert.equal(f.ok,true,f.erro);near(medidasPlanta({altura:270,pontos:f.pontos}).areaPiso,12,'12 m²');assert.equal(f.pontos.length,4);
});
test('desenho + fechar: L em 4 paredes (última horizontal: o último canto é alinhado)',()=>{
  const f=plantaFechar(desenhar([[1,500],[1,300],[-1,200],[1,150]]),270);
  assert.equal(f.ok,true,f.erro);near(medidasPlanta({altura:270,pontos:f.pontos}).areaPiso,19.5,'19,5 m²');assert.equal(f.pontos.length,6);
});
test('desenho + fechar: formato em escada com 5 degraus',()=>{
  const f=plantaFechar(desenhar([[1,100],[1,100],[1,100],[1,100],[1,100],[1,100],[1,100],[1,100]]),270);
  assert.equal(f.ok,true,f.erro);
  /* 4 degraus de 100×100: área = 100·100 · (1+2+3+4) = 10 m² ... confere pela fórmula do polígono */
  near(medidasPlanta({altura:270,pontos:f.pontos}).areaPiso,Math.abs(plArea2(f.pontos))/2/1e4,'área');
});
test('desenho: recusa parede curta, enorme, sentido inválido, sem ponto inicial; nada muda',()=>{
  const base=[{x:0,y:0}];
  for(const [s,l] of [[1,10],[1,'abc'],[1,99999],[0,100],['x',100]]){const r=plantaAdicionarParede(base,s,l);assert.equal(r.ok,false,`${s},${l}`);assert.deepEqual(r.pontos,base)}
  assert.equal(plantaAdicionarParede([],1,100).ok,false);
});
test('desenho: recusa parede que cruza ou encosta numa já desenhada',()=>{
  const p=desenhar([[1,400],[1,300],[-1,300]]);                              // (0,0) (400,0) (400,300) (100,300)
  assert.equal(plantaAdicionarParede(p,-1,400).ok,false,'subir 400 cruza a parede de cima');
  assert.equal(plantaAdicionarParede(p,-1,300).ok,false,'subir 300 chega em (100,0): encosta na parede de cima');
  assert.equal(plantaAdicionarParede(p,-1,100).ok,true,'subir 100 é livre');
});
test('fechar: recusa com poucas paredes e planta inválida (mantém os pontos)',()=>{
  const dois=desenhar([[1,400]]);const r=plantaFechar(dois,270);assert.equal(r.ok,false);assert.ok(r.erro);assert.deepEqual(r.pontos,dois);
  const apertado=desenhar([[1,400],[1,300],[-1,300],[-1,280]]);             // (0,0) (400,0) (400,300) (100,300) (100,20): fechar deixaria uma parede de 20 cm
  const f=plantaFechar(apertado,270);assert.equal(f.ok,false);assert.ok(/pelo menos/.test(f.erro),f.erro);assert.deepEqual(f.pontos,apertado);
  const alinhar=plantaFechar(desenhar([[1,400],[1,300],[-1,380]]),270);assert.equal(alinhar.ok,true,'última horizontal: alinha o canto e fecha');near(medidasPlanta({altura:270,pontos:alinhar.pontos}).areaPiso,12,'retângulo 400×300');
});
test('toque: vira sentido e comprimento em múltiplos de 5 cm, na direção certa',()=>{
  const p=[{x:0,y:0}];
  assert.deepEqual(plantaDoToque(p,303,40),{sinal:1,comprimento:305},'primeira parede é horizontal: só o x conta');
  assert.deepEqual(plantaDoToque(p,-198,999),{sinal:-1,comprimento:200});
  const q=desenhar([[1,400]]);assert.deepEqual(plantaDoToque(q,9999,152),{sinal:1,comprimento:150},'segunda parede é vertical: só o y conta');
  assert.equal(plantaDoToque([],1,1),null);assert.equal(plantaDoToque(p,NaN,1),null);
});
test('propriedade: 500 desenhos aleatórios; o que fecha é uma planta válida com área = fórmula do polígono',()=>{
  let s=987;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,int=(a,b)=>Math.round(a+rnd()*(b-a));
  let fechou=0;
  for(let k=0;k<500;k++){
    let pts=[{x:0,y:0}];const n=int(2,9);
    for(let i=0;i<n;i++){const r=plantaAdicionarParede(pts,rnd()<.5?-1:1,int(30,600));if(r.ok)pts=r.pontos}
    const f=plantaFechar(pts,270);
    if(!f.ok){assert.deepEqual(f.pontos,pts);continue}
    fechou++;assert.equal(validarPlanta({altura:270,pontos:f.pontos}).ok,true);
    near(medidasPlanta({altura:270,pontos:f.pontos}).areaPiso,Math.abs(plArea2(f.pontos))/2/1e4,'área '+k);
    assert.equal(modeloPlanta({altura:270,pontos:f.pontos}).vazio,false);
  }
  assert.ok(fechou>20,'esperava vários desenhos fechando, vieram '+fechou);
});
