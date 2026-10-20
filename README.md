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

## Visualizador 3D (Medir → Ver em 3D)
Mostra a peça em 3D com a espessura do material, saia e rodabanca. Gira com um dedo e aproxima com dois. É **ilustrativo**: não mostra emendas, recortes, cubas nem veio da pedra, e não muda nenhum cálculo (usa os mesmos dados do corte e do preço).
- `model3d.js`: monta as peças em 3D a partir dos dados da peça (função pura, testada).
- `viewer3d.js`: desenha com Three.js (`vendor/three.module.min.js`, MIT). Só é carregado quando o usuário toca em "Ver em 3D".
- Se o aparelho não tiver WebGL, aparece um aviso e o desenho 2D continua funcionando.

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
