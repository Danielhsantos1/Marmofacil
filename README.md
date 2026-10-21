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
- **Recortes** (cuba, cooktop...): só aparecem como abertura real se a peça tiver `recortes: [{tipo, x, z, w, d}]` (cm, no plano da peça) e couberem inteiros num tampo; o que for inválido é recusado com aviso na tela. A interface atual **ainda não cria** recortes, e o cálculo atual **não desconta** a área deles.
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
