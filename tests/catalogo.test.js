/* Catálogo de pedras para escolher (catalogo.js). Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {corDaPedra,CATALOGO,normalizarNome,buscarCatalogo,jaCadastrada,materialDoCatalogo,materialSemPreco}=require('../catalogo.js');

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

test('cor da pedra para o 3D: primeira cor citada, escuro/claro ajustam, desconhecida = null',()=>{
  const lum=h=>((h>>16&255)+(h>>8&255)+(h&255))/3;
  assert.ok(lum(corDaPedra('Preto veiado'))<60);
  assert.ok(lum(corDaPedra('Branco com veios verdes'))>220,'vale o Branco, que vem primeiro');
  assert.ok(lum(corDaPedra('Cinza escuro'))<lum(corDaPedra('Cinza')));
  assert.ok(lum(corDaPedra('Bege claro'))>lum(corDaPedra('Bege')));
  assert.ok(corDaPedra('Bordô')!==null,'acento ignorado');
  assert.equal(corDaPedra(''),null);assert.equal(corDaPedra('xyz'),null);assert.equal(corDaPedra(null),null);
  assert.equal(corDaPedra('Brancoso'),null,'só palavra inteira');
  for(const p of CATALOGO)assert.notEqual(corDaPedra(p.cor),null,p.nome+': a cor do catálogo é reconhecida');
});
