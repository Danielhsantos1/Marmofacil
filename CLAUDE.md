# Pedra Fácil

SaaS para marmorarias. O vendedor usa só o celular na visita ao cliente para medir, desenhar a bancada, calcular chapas e custo, precificar e gerar orçamento (PDF + WhatsApp). Alvo comercial: vender para várias marmorarias, cada uma com seus próprios dados.

## Quem é o usuário (Daniel)
- Iniciante em configuração técnica (GitHub, Supabase, Vercel). Guie **um passo por vez**, espere a confirmação antes do próximo e diga exatamente onde clicar.
- Prefere perguntas em opções de seleção, não perguntas abertas.
- Fale em português do Brasil. Seja direto. Aponte quando algo estiver ineficiente ou errado, mesmo sem ele perguntar.

## Estado atual
Protótipo funcional em **um único arquivo** (`index.html`, ~64 KB, JS puro, sem build). Já é PWA (`manifest.webmanifest`, `sw.js`, ícones, `vendor/jspdf.umd.min.js`).
- Dados só em `localStorage` (chave `pedrafacil.v1`). Sem login, nuvem ou permissões.
- Fora do Claude, a leitura de fotos por IA não existe (o botão avisa). O PDF baixa por link comum.
- GitHub Pages ainda **não está funcionando** neste repositório (deploy nunca rodou). Não era problema do código.

## O que o protótipo faz (comportamento a preservar)
- Peças: reta, L, U, ilha, escada, nicho, lavatório, medidas livres. Tudo em **cm**; área em m².
- Saia e rodabanca: metros automáticos por formato (`defMl`) ou informados à mão.
- Plano de corte: peças maiores que a chapa são divididas (emendas) e encaixadas em faixas ("shelf nesting") com perda de serra de 0,4 cm. É estimativa, não considera veio.
- Preço: `custo = material + fabricação (mão de obra/m² + serviços) + instalação + frete`; `preço = custo / (1 − margem − impostos)`. Margem e impostos incidem sobre o preço de venda. Material cobrado por chapa inteira ou por m² (com % de perda).
- Funil: Rascunho, Enviado, Negociação, Fechado, Perdido. Painel: faturamento e lucro dos fechados, conversão = fechados / (todos menos rascunhos).
- Cadastros: materiais (inclui tamanho da chapa e foto), serviços (un/ml/m²), clientes.

## Regras de código
- Dinheiro e área com cuidado de arredondamento; a lógica de cálculo deve ficar em funções puras e ter testes.
- Mobile first, Android de entrada. Alvos de toque de 44 px. Nada de dependência pesada.
- Nunca confie em dados do navegador para segurança: permissões e isolamento entre marmorarias vão no banco (RLS).

## Próximos passos
Ver `ROADMAP.md`.
