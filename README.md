# Marmofácil

Protótipo de app para marmorarias: medir, desenhar a bancada, calcular chapas e custo, e gerar orçamento em PDF com envio por WhatsApp. Funciona como PWA (instalável no celular e utilizável offline).

## Estado atual
- App de arquivo único (`index.html`), sem build.
- Dados salvos só no navegador do aparelho (localStorage). Backup manual em Ajustes.
- Não há login, nuvem nem permissões nesta versão.
- A leitura de fotos por IA só existe dentro do Claude; fora dele o botão avisa que está indisponível.

## Orçamento fechado
Ao mudar a etapa para **Fechado**, o app guarda os valores do orçamento (`q.snap`). Depois disso, mudar o preço de um material ou serviço no cadastro **não altera** o orçamento fechado nem o faturamento e o lucro do painel. O orçamento fica só para ver (o PDF e o 3D continuam); para editar, toque em **Reabrir para editar**, que descongela e volta a usar os preços atuais do cadastro. Não deixa fechar com margem + impostos acima de 95%. Orçamentos que já estavam fechados ganham o snapshot, com os valores de hoje, na primeira abertura.

## Nova versão do app
Quando uma versão nova é baixada, aparece a barra **Nova versão disponível · Atualizar**. Em **Ajustes** aparece a versão instalada.

## Visualizador 3D técnico (Medir → Ver em 3D)
Mostra a peça em 3D para **conferir** as medidas antes do orçamento. Não é desenho de fabricação e não muda nenhum cálculo: usa os mesmos dados da peça que alimentam o plano de corte e o preço.

- **Cotas em cm** (comprimento, profundidade, lados A/B/C do L e do U, degrau, nicho, espessura, altura da saia e da rodabanca), com linhas de extensão e texto sem sobreposição. Cada cota liga dois pontos reais da peça e o valor vem dos dados; nada é fixo ou estimado. Botão **Cotas** liga e desliga.
- **Espessura** vem do cadastro do material; sem espessura cadastrada usa 2 cm e a cota avisa "(padrão)".
- **Emendas** (linha laranja): onde o plano de corte divide uma peça maior que a chapa, na mesma conta do cálculo. Detalhe e limites em *Divergências conhecidas*.
- **Recortes** (cuba, cooktop...): em **Medir → Recortes** (reta, lavatório, ilha, L e U; nos demais formatos a posição depende do layout e não da planta, então não é oferecido). Cada recorte tem tipo, distância da esquerda e do fundo, largura, profundidade (cm) e **origem da medida** (`medido` ou `estimado`). Um recorte novo nasce **vazio**: o app não preenche medida nenhuma. Só é desenhado (tracejado no 2D, abertura real no 3D) se couber inteiro num tampo; o que for inválido é recusado com o motivo na tela. Contrato dos dados: `p.recortes = [{id, tipo:'cuba'|'cooktop'|'outro', x, z, w, d, origem:'medido'|'estimado'}]`, em cm, no plano da peça (no L e no U, a partir do canto de trás e da esquerda da peça inteira). Campo opcional: dados antigos sem ele continuam válidos. **Recortes não mudam área, preço nem plano de corte** (o cálculo atual cobra cuba e cooktop como serviço em Serviços); a tela lembra de conferir lá. O valor `estimado` existe para a futura medição por foto: uma medida vinda de foto entra sempre como `estimado`, para confirmação do usuário.
- **Cuba, torneira e cooktop (ilustrativos):** onde há um recorte **válido** de cuba ou cooktop, o 3D desenha uma cuba de inox com ralo, uma torneira (atrás da cuba, centralizada) e um cooktop com 4 queimadores. É **só ilustração**: a forma, a profundidade da cuba e a posição da torneira não vêm de medida nenhuma (só o recorte tem medida), não têm cota e não entram em área, preço, plano de corte nem emendas. Sem recorte válido, nada aparece. O botão "Cuba, torneira e cooktop" liga e desliga (só aparece se a peça tem recortes). As medidas dos recortes aparecem na vista de cima e no 2D; nas vistas inclinadas esses textos ficam escondidos para não amontoar.
- **Câmera:** Perspectiva, De cima e De frente (exatas), Enquadrar, giro por toque ou mouse (no celular, 1 dedo gira na horizontal e a página continua rolando na vertical; 2 dedos aproximam e inclinam; com o mouse gira nos dois eixos), zoom por pinça ou roda com limites (o zoom escolhido é mantido ao editar), reenquadra ao redimensionar a tela. Se o aparelho perder o contexto WebGL, tenta recuperar por 4 s antes de voltar ao 2D.
- **Aparência (só visual):** lisa, do material, granito, mármore ou quartzo. Texturas procedurais pequenas, ilustrativas, que **não** mostram o veio da chapa e não afetam preço, área nem chapas.
- Saia e rodabanca em escada, nicho e peça livre aparecem **soltas** ao lado da peça: os dados não dizem onde elas ficam.

Arquivos: `model3d.js` (modelo, emendas, recortes e cotas: funções puras, testadas), `viewer3d.js` (Three.js local em `vendor/`, carregado só ao abrir o 3D). Se o aparelho não tiver WebGL, aparece um aviso e o desenho 2D continua.

### Divergências conhecidas (documentadas, não alteradas)
- O plano de corte **não conta como emenda** a junção entre os trechos de um L ou U (cada trecho é uma peça separada).
- A saia e a rodabanca são **uma peça só** no plano de corte (comprimento total × altura). O 3D as monta por trechos, mas marca as emendas ao longo do percurso inteiro, onde o plano as divide.
- Quando uma peça é maior que a chapa nos **dois** lados, o cálculo conta *peças − 1* emendas e o desenho mostra as linhas de corte (menos linhas). A nota do 3D mostra os dois números.
- Nos cantos, a faixa de saia/rodabanca que encosta na outra é encurtada no desenho (junta de topo); o comprimento do corte e a área não mudam.
- Um nicho com largura 0 ainda conta as 2 laterais na área (comportamento anterior, mantido).
- Peça livre com **quantidade fracionária ou menor que 1**: o preço soma `q × área`, o plano de corte monta peças inteiras e o 3D desenha `max(1, arredondado)`. O 3D avisa; o cálculo não foi alterado (decisão comercial).
- **U com largura A menor que 2× a profundidade P**: as pernas se sobrepõem e o cálculo conta pedra que não existe. O 3D avisa; o cálculo não foi alterado.
- A saia/rodabanca **automática** tem metragem `defMl` maior que o contorno real em L e U; o que passa do contorno aparece como faixa solta "(sem posição)", com aviso.
- Medidas absurdamente grandes (como `1e300`) podem travar o cálculo do plano de corte (`nestParts`), fora do 3D, que limita as linhas de corte. Falta um limite nos campos de medida.


## Testes do cálculo
A geometria, o plano de corte e o preço ficam em `calc.js` (funções puras, sem tela). Os testes ficam em `tests/` e precisam só do Node 18 ou mais novo, sem instalar nada:

```
node --test
```

(ou `npm test`). Qualquer mudança em `calc.js` deve manter os testes verdes; `tests/golden.json` guarda os preços do app antes da refatoração para provar que nada mudou.

## Publicar no GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `(root)`.

## Atualizar o app instalado
Ao mudar **qualquer** arquivo do app, suba o número da versão nos 3 lugares (o teste `tests/versao.test.js` falha se algum ficar diferente):
1. `const V='marmofacil-vN'` e a lista `CORE` em `sw.js` (os `?v=N`);
2. `const APP_V=N` em `index.html`;
3. os `?v=N` dos scripts em `index.html` (`calc.js`, `model3d.js` e o `import` do `viewer3d.js`).

Os scripts levam a versão no endereço (`calc.js?v=6`) para o celular nunca misturar arquivos de versões diferentes. O app abre sempre pela rede quando há sinal (versão nova na hora) e usa a cópia guardada sem sinal ou com sinal lento (mais de 3 s).

**Rede de segurança:** se o app não conseguir abrir, ele limpa só o cache do app e tenta de novo uma vez; se ainda falhar, mostra a tela "O app não conseguiu abrir" com **Tentar de novo** e **Baixar cópia dos meus dados**. Nada disso apaga os dados salvos.

## Editor 3D em tela cheia (versão 11)
Em Medir, "Abrir editor 3D (tela cheia)". Celular: 3D em cima e menu embaixo (toque no menu ativo para recolher). Computador e celular deitado: menu lateral. Menus: Peças (trocar, adicionar formato, duplicar, remover), Medidas, Acabamento (saia e rodabanca), Recortes e Material (material, aparência, cuba ilustrativa). Usa os mesmos campos, o mesmo cálculo e a mesma peça de Medir: o preço atualiza ao digitar. Orçamento fechado abre só para ver. O botão voltar do aparelho e a tecla Esc fecham o editor. Ainda não é possível arrastar peças com o dedo (próximas etapas).

### Alças no 3D (versão 12)
No editor 3D, as bolinhas verdes nas pontas das cotas mudam a medida ao arrastar (a peça, o preço e o plano de corte recalculam na hora; a gravação é feita ao soltar). Em recortes, ✥ move e o quadrado no canto muda largura e profundidade; um recorte arrastado para fora da bancada ou por cima de outro para no último lugar válido. Limites: 5 a 1000 cm (1 a 1000 cm em saia, rodabanca e espelho). O botão "Alças" liga e desliga; orçamento fechado não mostra alças. As alças somem quando o eixo aponta para o olho (ex.: comprimento na vista de cima de um L visto de frente).

### Várias peças na mesma cena (versão 13)
O 3D mostra todas as peças do orçamento juntas. Cada peça continua independente (medidas, recortes, preço e plano de corte). Peças novas entram à direita das outras (40 cm de vão). Com as Alças ligadas: o nome de cada peça aparece na cena (tocar seleciona), e o ✥ escuro, perto do canto de trás à esquerda da peça selecionada, move a peça. Uma peça não pode ser arrastada por cima de outra. A posição (`p.pos`, canto de trás à esquerda, em cm) é só de desenho: não entra em área, preço nem plano de corte, e é opcional (orçamentos antigos funcionam sem ela). Ainda não há rotação de peça nem união entre peças.

## Catálogo de pedras (versão 14)
Cadastros > Materiais > "Escolher pedras do catálogo": 46 pedras (granitos, mármores e quartzos) com busca e filtro. Cada pedra escolhida entra no cadastro com **preço e chapa em branco** (o catálogo só traz nome, tipo e cor em palavras; sem foto, preço ou medida de terceiros). Pedras já cadastradas aparecem desabilitadas. Material sem preço é avisado na lista de materiais e na barra de preço do orçamento ("o orçamento não cobra a pedra"). `catalogo.js` (funções puras, com testes). Categorias marcadas "confira a categoria" foram deduzidas da ordem do catálogo de origem.

### Aparência "Do material" (versão 15)
O 3D agora abre em "Do material": a textura vem da categoria (granito, mármore, quartzo) e o **tom vem do campo Cor do material** (ex.: "Preto" escurece, "Bege claro" clareia; ver `corDaPedra` em `catalogo.js`). Trocar o material do orçamento troca o tom na hora. É só aparência aproximada: sem foto da chapa e sem veio real. Cor não reconhecida usa o tom padrão.

### Fotos das pedras e escolha por quadradinhos (versão 16)
- `pedras/` tem a foto de cada pedra do catálogo (46 arquivos, ~660 KB, nome do arquivo = nome da pedra sem acento, com hífens). **Origem: catálogo "Marmofacil" (PDF) enviado pelo Daniel, que declarou ser o dono.** Para remover as fotos: apagar a pasta `pedras/` e as funções `fotoPedra`/`fotoDoMaterial` em `catalogo.js` (e o teste que confere a pasta).
- A lista "Escolher pedras do catálogo" mostra a foto de cada pedra. Os dois "Cinza Absoluto" do catálogo ficaram como "(claro)" e "(escuro)" para terem nomes diferentes; "Humatá" e "Blanco Serreno" seguem a grafia do catálogo.
- A foto do material que a marmoraria subiu em Cadastros tem prioridade sobre a do catálogo.
- No editor 3D, menu Material: quadradinhos com a foto de cada material (toque para escolher). Em "Aparência: Do material", o 3D usa a foto como textura (repete a cada 1,2 m × 0,7 m com espelhamento; a escala real da chapa não é conhecida e o veio não acompanha o corte). Sem foto, usa o tom da cor.
- As fotos carregam sob demanda e ficam guardadas para uso sem internet depois de vistas uma vez.

### Rótulo nas faixas soltas (versão 17)
Faixas de saia ou rodabanca desenhadas deitadas ao lado da peça agora dizem o que são: "sobra de saia/rodabanca N cm" (metragem que passa do contorno da peça ou cantos menores que a espessura) ou "saia/rodabanca solta N cm" (formatos sem contorno definido, como nicho e escada). A medida é a real; a área e o preço não mudam.
