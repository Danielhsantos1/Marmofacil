/* Projetta: registro de módulos (o que o usuário pode projetar). Funções puras, sem tela e sem localStorage;
   roda no navegador (funções globais) e no Node (tests/registro-modulos.test.js).
   Um módulo "disponivel" tem `destino` (o que a tela faz ao tocar). Um "embreve" aparece com selo e não abre nada.
   Contrato completo dos módulos: docs/ARQUITETURA.md. */

const MOD_ESTADOS=['disponivel','embreve'];
const MOD_DESTINOS=['aba-ambientes','novo-orcamento'];          // ações que a tela sabe executar

const MODULOS=[
  {id:'ambientes',nome:'Ambientes',icone:'casa',estado:'disponivel',destino:'aba-ambientes',descricao:'Sala, cozinha, quarto, banheiro: piso, paredes, perímetro, volume e aberturas.'},
  {id:'marmoraria',nome:'Marmoraria',icone:'pedra',estado:'disponivel',destino:'novo-orcamento',descricao:'Bancadas, ilhas, nichos e escadas com plano de corte, chapas e preço.'},
  {id:'marcenaria',nome:'Marcenaria',icone:'madeira',estado:'embreve',descricao:'Armários, cozinhas planejadas e closets com chapas de MDF e ferragens.'},
  {id:'vidracaria',nome:'Vidraçaria',icone:'vidro',estado:'embreve',descricao:'Box, espelhos, divisórias e guarda-corpos com m², ferragens e instalação.'},
  {id:'esquadrias',nome:'Esquadrias',icone:'porta',estado:'embreve',descricao:'Portas, janelas e portões com perfis, vidros e acessórios.'},
  {id:'externa',nome:'Área externa',icone:'ext',estado:'embreve',descricao:'Piscina, deck, pergolado, muro e calçadas com cálculo de materiais.'},
  {id:'personalizado',nome:'Projeto personalizado',icone:'livre',estado:'embreve',descricao:'Desenhe qualquer objeto informando largura, altura, profundidade e espessura.'}
];

const listarModulos=()=>MODULOS.slice();
const moduloPorId=id=>MODULOS.find(m=>m.id===id)||null;
const modulosDisponiveis=()=>MODULOS.filter(m=>m.estado==='disponivel');
const modulosEmBreve=()=>MODULOS.filter(m=>m.estado==='embreve');

/* {ok, erros[]}: confere um registro (o do app ou um de teste). */
function validarRegistro(lista){
  const erros=[],vistos=new Set();
  if(!Array.isArray(lista)||!lista.length)return {ok:false,erros:['O registro precisa ter ao menos um módulo.']};
  lista.forEach((m,i)=>{
    const n='Módulo '+(m&&m.id||i+1);
    if(!m||typeof m!=='object'){erros.push(n+': inválido.');return}
    if(!m.id||!/^[a-z][a-z0-9-]*$/.test(m.id))erros.push(n+': id precisa ser texto minúsculo sem espaço.');
    else if(vistos.has(m.id))erros.push(n+': id repetido.');
    vistos.add(m.id);
    if(!m.nome)erros.push(n+': falta o nome.');
    if(!MOD_ESTADOS.includes(m.estado))erros.push(n+': estado precisa ser disponivel ou embreve.');
    if(m.estado==='disponivel'&&!MOD_DESTINOS.includes(m.destino))erros.push(n+': módulo disponível precisa de um destino conhecido.');
    if(m.estado==='embreve'&&m.destino)erros.push(n+': módulo em breve não pode ter destino.');
  });
  return {ok:!erros.length,erros};
}

if(typeof module!=='undefined')module.exports={MOD_ESTADOS,MOD_DESTINOS,MODULOS,listarModulos,moduloPorId,modulosDisponiveis,modulosEmBreve,validarRegistro};
