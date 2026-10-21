/* Marmofácil: catálogo de pedras para ESCOLHER (só nomes, tipo e cor em palavras; sem foto, preço ou tamanho de chapa).
   Quem escolhe adiciona ao próprio cadastro de materiais com preço e chapa em branco, para a marmoraria preencher.
   Funções puras; roda no navegador (funções globais) e no Node (tests/catalogo.test.js).
   `confere:true` = a categoria foi deduzida da ordem do catálogo de origem e deve ser conferida pela marmoraria. */

const CATALOGO=[
  /* granitos */
  {nome:'Ocre',cat:'Granito',cor:'Cinza com marrom'},
  {nome:'Andorinha',cat:'Granito',cor:'Cinza'},
  {nome:'Corumbazinho',cat:'Granito',cor:'Cinza claro'},
  {nome:'Branco Dallas',cat:'Granito',cor:'Branco'},
  {nome:'Verde',cat:'Granito',cor:'Verde escuro',confere:true},
  {nome:'Ornamental',cat:'Granito',cor:'Bege dourado'},
  {nome:'Santa Cecília',cat:'Granito',cor:'Bege'},
  {nome:'Ouro do Deserto',cat:'Granito',cor:'Bege rosado'},
  {nome:'Maracujá',cat:'Granito',cor:'Rosado'},
  {nome:'Florença',cat:'Granito',cor:'Laranja'},
  {nome:'Icaraí',cat:'Granito',cor:'Bege claro'},
  {nome:'Humaitá',cat:'Granito',cor:'Dourado'},
  {nome:'Vermelho Brasília',cat:'Granito',cor:'Vermelho'},
  {nome:'Preto São Gabriel',cat:'Granito',cor:'Preto'},
  {nome:'Verde Savana',cat:'Granito',cor:'Verde'},
  {nome:'Marrom Absoluto',cat:'Granito',cor:'Marrom'},
  {nome:'Rosa Raíssa',cat:'Granito',cor:'Rosa e cinza'},
  {nome:'Branco Siena',cat:'Granito',cor:'Branco'},
  {nome:'Preto Via Láctea',cat:'Granito',cor:'Preto veiado'},
  {nome:'Café Imperial',cat:'Granito',cor:'Marrom escuro'},
  {nome:'Branco Ceará',cat:'Granito',cor:'Branco'},
  {nome:'Preto Absoluto',cat:'Granito',cor:'Preto'},
  {nome:'Branco Alpha',cat:'Granito',cor:'Branco acinzentado'},
  {nome:'Azul da Vinci',cat:'Granito',cor:'Azul'},
  {nome:'Bordô da Vinci',cat:'Granito',cor:'Bordô'},
  {nome:'Cinza Absoluto',cat:'Granito',cor:'Cinza'},
  /* mármores */
  {nome:'Mármore Branco',cat:'Mármore',cor:'Branco com veios verdes'},
  {nome:'Travertino',cat:'Mármore',cor:'Bege',confere:true},
  {nome:'Marrom Imperador',cat:'Mármore',cor:'Marrom'},
  {nome:'Crema Marfil',cat:'Mármore',cor:'Creme'},
  {nome:'Mármore Carrara Gioia',cat:'Mármore',cor:'Branco veiado'},
  {nome:'Mármore Branco Paraná',cat:'Mármore',cor:'Branco'},
  /* quartzos */
  {nome:'Calacata Prime',cat:'Quartzo',cor:'Branco veiado',confere:true},
  {nome:'Branco Prime',cat:'Quartzo',cor:'Branco',confere:true},
  {nome:'Marengo',cat:'Quartzo',cor:'Cinza escuro'},
  {nome:'Desert',cat:'Quartzo',cor:'Bege'},
  {nome:'Unsui',cat:'Quartzo',cor:'Marrom rosado'},
  {nome:'Kensho',cat:'Quartzo',cor:'Cinza'},
  {nome:'Sky White',cat:'Quartzo',cor:'Branco acinzentado'},
  {nome:'Bianco Sereno',cat:'Quartzo',cor:'Branco'},
  {nome:'Branco Stellar',cat:'Quartzo',cor:'Branco'},
  {nome:'Vermelho Stellar',cat:'Quartzo',cor:'Vermelho'},
  {nome:'Cinza Stellar',cat:'Quartzo',cor:'Cinza'},
  {nome:'Preto Stellar',cat:'Quartzo',cor:'Preto'},
  {nome:'Branco Zeus',cat:'Quartzo',cor:'Branco'},
  {nome:'Super Nano',cat:'Quartzo',cor:'Branco'}
];

/* sem acento, minúsculo, espaços simples: "Santa Cecília" = "santa cecilia" */
const normalizarNome=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

/* busca por parte do nome ou da cor, filtrando a categoria ('todas' = sem filtro); mantém a ordem do catálogo */
function buscarCatalogo(texto,cat){
  const t=normalizarNome(texto);
  return CATALOGO.filter(p=>(!cat||cat==='todas'||p.cat===cat)&&(!t||normalizarNome(p.nome).includes(t)||normalizarNome(p.cor).includes(t)));
}

/* o material já está no cadastro? (compara o nome sem acento nem maiúscula) */
const jaCadastrada=(materiais,nome)=>(materiais||[]).some(m=>normalizarNome(m&&m.name)===normalizarNome(nome));

/* material novo a partir de uma pedra do catálogo: preço e tamanho da chapa NÃO vêm do catálogo
   (preço 0 = "preencher"); espessura e chapa seguem o padrão de "Nova pedra" e são editáveis. */
function materialDoCatalogo(p,id){
  return {id,name:p.nome,cat:p.cat,color:p.cor,thick:2,priceSlab:0,priceM2:0,slabL:300,slabW:160,supplier:'',stock:0,photo:'',doCatalogo:true};
}

/* o preço que o orçamento vai usar está em branco? (cobrança por chapa usa priceSlab; por m², priceM2) */
const materialSemPreco=(m,cobranca)=>!!m&&!((cobranca==='m2'?m.priceM2:m.priceSlab)>0);

if(typeof module!=='undefined')module.exports={CATALOGO,normalizarNome,buscarCatalogo,jaCadastrada,materialDoCatalogo,materialSemPreco};
