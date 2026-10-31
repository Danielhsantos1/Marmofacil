# Projetta (antes Marmofácil)

SaaS para marmorarias. O vendedor usa só o celular na visita ao cliente para medir, desenhar a bancada, calcular chapas e custo, precificar e gerar orçamento (PDF + WhatsApp). Alvo comercial: vender para várias marmorarias, cada uma com seus próprios dados.

## Quem é o usuário (Daniel)
- Iniciante em configuração técnica (GitHub, Supabase, Vercel). Guie **um passo por vez**, espere a confirmação antes do próximo e diga exatamente onde clicar.
- Prefere perguntas em opções de seleção, não perguntas abertas.
- Fale em português do Brasil. Seja direto. Aponte quando algo estiver ineficiente ou errado, mesmo sem ele perguntar.

## Estado atual
Protótipo funcional, JS puro, **sem build**, instalável como PWA (`manifest.webmanifest`, `sw.js`, ícones). Arquivos:
- `index.html` (~80 KB): telas, estado e integração.
- `calc.js`: geometria, plano de corte, preço e snapshot de orçamento fechado (funções puras).
- `catalogo.js`: catálogo de pedras para escolher (nome, tipo, cor; funções puras) e foto/cor aproximada da pedra; fotos em `pedras/` (origem: ver README).
- `model3d.js`: modelo 3D da peça, emendas, recortes e cotas (funções puras, mesma peça do cálculo).
- `viewer3d.js`: visualizador Three.js (carregado só ao abrir o 3D; Three.js local em `vendor/`, MIT, 692 KB).
- `motor/ambiente.js`: Ambiente (paredes, piso, teto, portas e janelas): medidas e modelo 3D, funções puras, tudo em cm. Aba "Ambientes" no app; dados em `S.ambientes` (opcional, projetos antigos abrem iguais). Inclui `quantitativoAmbiente` (piso, teto, pintura, rodapé e revestimentos; perda só se informada). Não mexe em preço nem em `calc.js`.
- `motor/planta.js`: planta baixa de formato livre ORTOGONAL (L, U, T e variações; paredes só horizontais/verticais): `plantaFormato`, `validarPlanta`, `medidasPlanta`, `quantitativoPlanta`, `modeloPlanta` (3D), `plantaMoverParede`. Mesmo formato de saída do motor retangular, então orçamento, PDF, funil e 3D do Ambiente funcionam igual (`a.formato==='planta'`, `a.pontos`, `a.forma`, `a.editada`). Desenho ponto a ponto (`plantaAdicionarParede`, `plantaFechar`, `plantaDoToque`): direções alternam, cantos sempre retos. Paredes inclinadas e curvas ainda não existem (o 3D só desenha paredes em caixas alinhadas aos eixos).
- `nucleo/registro-modulos.js`: registro dos módulos (Ambientes, Marmoraria, Vidraçaria, Esquadrias, Marcenaria, Área externa, Projeto personalizado) com estado `disponivel`/`embreve`; alimenta a seção "O que deseja projetar?" no Início. Funções puras, testadas.
- `nucleo/orcamento.js`: orçamento genérico (qualquer módulo): itens do quantitativo + preços informados → custo, preço = custo/(1−margem−impostos), lucro; preço em branco = item "sem preço" (nunca zero em silêncio). Usado pelo Ambiente (aba Ambientes: preços, margem, impostos, PDF, cliente, status e WhatsApp). Ambientes entram na lista de Orçamentos, no pipeline e no painel junto com os de marmoraria (`todosOrcamentos()`); Fechado congela o preço em `a.snap` e trava os campos. Não usa nem altera `calc.js`.
- `motor/vidro.js` e `telas/vidracaria.js`: módulo de Vidraçaria (v37): peças de vidro (box, espelho, divisória, guarda-corpo, porta, janela, vitrine, cobertura) com área, metro linear, peso aproximado (2,5 kg por m² por mm), película e ferragens lançadas à mão; mínimo de cobrança e perda só se informados; orçamento pelo `nucleo/orcamento.js`, PDF, WhatsApp, funil e painel. Dados em `S.vidracaria` (opcional). A tela fica em `telas/` (primeiro passo para quebrar o `index.html`); as ações com prefixo `vid-` são entregues a `acaoVid`.
- `motor/esquadria.js` e `telas/esquadrias.js`: módulo de Esquadrias (v38: portas, janelas, portões, fachadas). O app NÃO traz fórmula de perfil de nenhuma linha de alumínio: a pessoa cadastra MODELOS (`S.modelosEsq`) com componentes e uma regra de quantidade (fixo, por perímetro, largura, altura ou m² do vão) e um fator digitado por ela; vidro opcional por espessura; orçamento pelo `nucleo/orcamento.js`, PDF, WhatsApp, funil e painel. Dados em `S.esquadrias`. Ações com prefixo `esq-` entregues a `acaoEsq`.
- `vendor/jspdf.umd.min.js`: PDF.
- `tests/`: `npm test` (Node 18+, sem dependências). Regressão do cálculo com `tests/golden.json`, gerado pelo código original: **não mudar os valores esperados sem decisão comercial**.
- Layout responsivo (v28): mobile <768 e tablet 768–1023 usam a barra inferior; a partir de 1024 px ela vira sidebar (84 px; 232 px a partir de 1440) e o painel inicial ganha largura (até 1400–1640 px). `body[data-layout]` informa a faixa (mobile/tablet/notebook/desktop/ultrawide). Editor de Ambiente em 3 painéis (v34, a partir de 1024 px: dados | planta + 3D sempre abertos | medidas, quantitativo e preço; no celular continua uma coluna). Editor de orçamento de marmoraria também em 3 painéis (v36: etapas | 3D sempre aberto | preço e aproveitamento ao vivo; `desk3()`). Faltam as tabelas (fase B do `ROADMAP.md`).
- Versão: `V` em `sw.js`, `APP_V` e os `?v=` em `index.html` têm o mesmo número (`tests/versao.test.js` confere). Subir os três a cada mudança de arquivo.
- Dados só em `localStorage` (chave `pedrafacil.v1`, nome antigo mantido de propósito para não perder dados já salvos). Sem login, nuvem ou permissões.
- Orçamento **Fechado** congela os valores (`q.snap`, inclusive chapa e espessura para o 3D) e fica só para ver até ser reaberto.
- Fora do Claude, a leitura de fotos por IA não existe (o botão avisa). O PDF baixa por link comum.
- GitHub Pages: https://danielhsantos1.github.io/Marmofacil/ (o endereço github.io é compartilhado com outros projetos do mesmo usuário: o service worker só apaga caches do Marmofácil).
- Visualizador 3D: ver `README.md`. É conferência visual, não desenho de fabricação; recortes (`p.recortes`, com `origem` medido/estimado) são digitados em Medir, nascem vazios e não mudam preço nem área.

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
