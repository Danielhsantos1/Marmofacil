# Marmofácil

Protótipo de app para marmorarias: medir, desenhar a bancada, calcular chapas e custo, e gerar orçamento em PDF com envio por WhatsApp. Funciona como PWA (instalável no celular e utilizável offline).

## Estado atual
- App de arquivo único (`index.html`), sem build.
- Dados salvos só no navegador do aparelho (localStorage). Backup manual em Ajustes.
- Não há login, nuvem nem permissões nesta versão.
- A leitura de fotos por IA só existe dentro do Claude; fora dele o botão avisa que está indisponível.

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
Ao mudar arquivos, aumente o número de `V` em `sw.js` (ex.: `marmofacil-v5`) para o celular baixar a nova versão.
