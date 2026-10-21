/* Catálogo de pedras para escolher (catalogo.js). Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {CATALOGO,normalizarNome,buscarCatalogo,jaCadastrada,materialDoCatalogo,materialSemPreco}=require('../catalogo.js');

test('catálogo: nomes únicos (sem acento), categorias válidas e cor preenchida',()=>{
  const nomes=CATALOGO.map(p=>normalizarNome(p.nome));
  assert.equal(new Set(nomes).size,nomes.length,'nome repetido');
  for(const p of CATALOGO){
    assert.ok(['Granito','Mármore','Quartzo'].includes(p.cat),p.nome+': categoria');
    assert.ok(p.nome.trim()&&p.cor.trim(),p.nome+': nome e cor');
  }
  assert.ok(CATALOGO.length>=40);
});
test('catálogo: nada de preço, chapa ou foto vindo de terceiros',()=>{
  for(const p of CATALOGO)assert.deepEqual(Object.keys(p).filter(k=>!['nome','cat','cor','confere'].includes(k)),[],p.nome);
});
test('busca ignora acento e maiúscula, filtra categoria e também acha pela cor',()=>{
  assert.deepEqual(buscarCatalogo('SANTA cecilia').map(p=>p.nome),['Santa Cecília']);
  assert.ok(buscarCatalogo('preto').length>=4);
  assert.ok(buscarCatalogo('','Quartzo').every(p=>p.cat==='Quartzo'));
  assert.equal(buscarCatalogo('',' todas').length>=0,true);
  assert.equal(buscarCatalogo('','todas').length,CATALOGO.length);
  assert.deepEqual(buscarCatalogo('zzzz'),[]);
});
test('já cadastrada: compara sem acento nem maiúscula e aguenta lixo',()=>{
  assert.equal(jaCadastrada([{name:'  santa  CECILIA '}],'Santa Cecília'),true);
  assert.equal(jaCadastrada([{name:'Carrara'}],'Santa Cecília'),false);
  assert.equal(jaCadastrada(null,'x'),false);
  assert.equal(jaCadastrada([null,{}],'x'),false);
});
test('material do catálogo nasce com preço em branco e chapa padrão editável',()=>{
  const m=materialDoCatalogo(CATALOGO[0],'abc');
  assert.equal(m.id,'abc');assert.equal(m.name,'Ocre');assert.equal(m.priceSlab,0);assert.equal(m.priceM2,0);
  assert.equal(m.supplier,'');assert.equal(m.photo,'');assert.equal(m.stock,0);assert.equal(m.doCatalogo,true);
  assert.equal(materialSemPreco(m,'chapa'),true);assert.equal(materialSemPreco(m,'m2'),true);
  assert.equal(materialSemPreco({priceSlab:100,priceM2:0},'chapa'),false);
  assert.equal(materialSemPreco({priceSlab:100,priceM2:0},'m2'),true,'cobrança por m² olha o preço por m²');
  assert.equal(materialSemPreco(undefined,'chapa'),false);
});
