# Pedra Fácil

Protótipo de app para marmorarias: medir, desenhar a bancada, calcular chapas e custo, e gerar orçamento em PDF com envio por WhatsApp. Funciona como PWA (instalável no celular e utilizável offline).

## Estado atual
- App de arquivo único (`index.html`), sem build.
- Dados salvos só no navegador do aparelho (localStorage). Backup manual em Ajustes.
- Não há login, nuvem nem permissões nesta versão.
- A leitura de fotos por IA só existe dentro do Claude; fora dele o botão avisa que está indisponível.

## Publicar no GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `(root)`.

## Atualizar o app instalado
Ao mudar arquivos, aumente o número de `V` em `sw.js` (ex.: `pedra-facil-v2`) para o celular baixar a nova versão.
