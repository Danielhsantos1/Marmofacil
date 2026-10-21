# Diagnóstico técnico e de produto: Marmofácil

> **Atualização (2026-10-21).** Este diagnóstico é de 2026-10-20 e descreve o estado de então. Desde aquele dia: o cálculo foi separado em `calc.js` com testes (A4); a margem + impostos acima de 95% é bloqueada (A1); orçamento fechado congela os valores (A2); o app tem aviso de nova versão e rede de segurança de abertura (M1); e há um visualizador 3D técnico com cotas, emendas e recortes (ver `README.md`). Continuam em aberto: C1 a C3 (login, nuvem, validação do plano de corte com projetos reais), A3 (fotos no `localStorage`), A5, M3 a M7. O 3D ainda **não** foi medido em um Android de entrada real.

Data: 2026-10-20. Base: leitura completa de `index.html` (853 linhas), `sw.js`, `manifest.webmanifest`, `CLAUDE.md`, `ROADMAP.md`, mais um teste rápido da lógica de cálculo em Node.
Repositório: https://github.com/Danielhsantos1/Marmofacil (público). Site: https://danielhsantos1.github.io/Marmofacil/ (GitHub Pages ligado em 2026-10-20; o deploy atual ainda é a versão com nome antigo até o PR #1 ser aprovado).

## 1. Resumo em 5 linhas
- É um protótipo **bom para demonstração**: faz o fluxo completo (medir → desenhar → plano de corte → preço → PDF → WhatsApp) em um arquivo, offline, sem servidor.
- A **fórmula de preço está correta** (testei: a margem real bate com a margem configurada).
- **Não é vendável ainda**: sem login, sem nuvem, dados só no aparelho (perder o celular = perder a empresa), sem isolamento entre marmorarias.
- O maior risco de **negócio** não é código: é o plano de corte (estimativa) ainda não validado com projetos reais.
- Próximo passo certo: seguir o `ROADMAP.md` na ordem (publicar → organizar/testar → banco e login). Não adicionar funcionalidades antes disso.

## 2. Quem usa e o que o produto promete
- Usuário final: vendedor de marmoraria, só com celular Android de entrada, na casa do cliente.
- Cliente pagante (alvo): dono da marmoraria. Quer: orçar rápido, não errar preço, saber se tem lucro, fechar mais.
- Promessa: "mede, calcula chapas, precifica e manda o orçamento no WhatsApp em minutos".

## 3. O que existe hoje (inventário)
| Área | Estado |
|---|---|
| Peças | reta, L, U, ilha, escada, nicho, lavatório, livre. Medidas em cm, área em m² |
| Saia e rodabanca | metros automáticos por formato ou informados à mão |
| Plano de corte | divide peças maiores que a chapa (emendas) e encaixa em faixas, perda de serra 0,4 cm; desenha cada chapa |
| Preço | `custo = material + fabricação + instalação + frete`; `preço = custo / (1 − margem − impostos)` |
| Material | cobrança por chapa inteira ou por m² com % de perda |
| Funil | Rascunho, Enviado, Negociação, Fechado, Perdido; lista e quadro (pipeline) |
| Painel | faturamento e lucro dos fechados, conversão, em aberto, faturamento dos últimos 4 meses |
| Cadastros | materiais (tamanho da chapa, foto), serviços (un/ml/m²), clientes |
| Saída | PDF (jsPDF) + link `wa.me` com texto pronto |
| Fotos | até 3 por orçamento, comprimidas (1000 px, JPEG 72%) |
| IA de fotos | só funciona dentro do Claude; fora dele o botão avisa que está indisponível |
| PWA | instalável, offline, tema claro/escuro, alvos de toque de 44 px |
| Backup | exportar/restaurar JSON manual |

## 4. Testes que rodei (lógica de cálculo)
Material de exemplo: chapa 310×180, R$ 2.900. Margem 35%, imposto 6%, mão de obra R$ 180/m², instalação R$ 90/m², frete R$ 150.

| Caso | Área | Chapas | Emendas | Aproveitamento | Preço | Margem real |
|---|---|---|---|---|---|---|
| Reta 280×60 | 1,68 m² | 1 | 0 | 30,1% | R$ 5.938,31 | 35,00% |
| L 310×210×62 + rodabanca 7 cm | 3,16 m² | 1 | 1 | 56,6% | R$ 6.615,68 | 35,00% |
| Reta 400×65 (maior que a chapa) | 2,60 m² | 1 | 1 | 46,6% | R$ 6.359,32 | 35,00% |
| Cobrança por m² (+12% perda) | 1,68 m² | 1 | 0 | 30,1% | R$ 3.064,11 | 35,00% |
| **Margem 70% + imposto 30%** | 1,68 m² | 1 | 0 | 30,1% | **R$ 70.072,00** | **65%** (errado) |

Leitura: a conta fecha. O último caso é bug real (item A1 abaixo).

## 5. Problemas encontrados, por gravidade

### Críticos (impedem vender para terceiros)
- **C1. Sem login, sem nuvem, sem permissões.** Tudo em `localStorage` (chave `pedrafacil.v1`). Perder, trocar ou limpar o celular apaga a empresa. Sem multiempresa, sem papéis (dono vê lucro, vendedor não).
- **C2. Segurança no navegador não existe.** Qualquer pessoa com o aparelho vê preços, margem e lucro. Isolamento entre marmorarias tem que ir para o banco (RLS), como já está no `CLAUDE.md`.
- **C3. Plano de corte não validado.** Heurística de "prateleiras", sem veio, sem sobras aproveitáveis, sem rotação inteligente. Se subestimar chapas, a marmoraria tem prejuízo; se superestimar, perde venda por preço alto. Antes de vender: comparar com 3 a 5 projetos reais do que o cortador usaria.

### Altos
- **A1. Margem + imposto perto de 100% gera preço absurdo sem aviso.** `den = Math.max(0.05, 1 − margem − imposto)`; com 70% + 30% o preço vai a R$ 70 mil e o "lucro" mostra margem de 65%, inconsistente. Falta validar a entrada e mostrar erro.
- **A2. Orçamento fechado muda sozinho.** `calc(q)` recalcula ao vivo a partir do cadastro atual. Se o preço de um material ou serviço mudar, o faturamento e o lucro de orçamentos já fechados mudam retroativamente; se o material for apagado, o custo dele vira R$ 0. Falta **congelar um "snapshot" do preço** ao enviar/fechar. O painel hoje não é confiável como histórico.
- **A3. Fotos em `localStorage` (limite ~5 MB).** Cada foto vira base64 (~100 a 150 KB). Algumas dezenas de fotos (orçamentos + materiais) enchem a memória; o app avisa, mas o usuário perde a capacidade de salvar. Precisa de IndexedDB agora e de Storage na nuvem depois.
- **A4. Sem testes automatizados e sem CI.** A lógica de dinheiro e área está misturada com a tela em um único arquivo. O `CLAUDE.md` exige funções puras com testes; ainda não existe nada.
- **A5. Restaurar backup substitui tudo sem validar.** Só checa `quotes` e `materials` como listas; aceita qualquer estrutura e sobrescreve o estado atual sem confirmação nem cópia de segurança.

### Médios
- **M1. Cache do PWA depende de lembrar de subir a versão (`V` em `sw.js`).** Se esquecer, o cliente continua com a versão velha instalada. Hoje é cache-first.
- **M2. Fonte do Google (Archivo e IBM Plex Mono) carrega da internet.** Offline na primeira abertura cai em fonte do sistema; o layout muda um pouco. Considerar hospedar as fontes.
- **M3. O PDF é simples demais para fechar venda:** sem logo, sem cores da empresa, sem condições de pagamento, sem prazo de entrega, sem CNPJ, sem assinatura/aceite. Mostra só total (decisão boa para não expor custo), mas falta o resto.
- **M4. Preço com uma única margem global.** Sem desconto, sem comissão de vendedor, sem margem por material ou por serviço, sem custo de sobra/retalho.
- **M5. Número do orçamento (`nextNum`) é local.** Com mais de um aparelho vai gerar números repetidos. Resolver junto com a nuvem.
- **M6. Arredondamento só no preço final** (`Math.round(cost/den*100)/100`). Dinheiro e área usam ponto flutuante; funciona, mas o `CLAUDE.md` pede cuidado: usar centavos inteiros ao migrar.
- **M7. Dados de exemplo misturam com os reais** até clicar em "Remover dados de exemplo". Risco de o vendedor mandar um orçamento fictício.

### Baixos
- Arquivo único de 65 KB já é difícil de manter; ok para protótipo.
- `S0svc` e `sv` são código morto em `seed()`.
- IA de fotos depende de `window.claude`; fora disso é botão decorativo (já avisa).
- Sem acessibilidade testada com leitor de tela, sem internacionalização (só pt-BR, que é o alvo).

## 6. O que está bom (preservar)
- Fórmula de preço correta e coerente com a prática (margem e imposto sobre o preço de venda).
- UX pensada para campo: uma coluna, abas fixas embaixo, resumo de preço sempre visível, toque de 44 px.
- Escapa texto antes de `innerHTML` (função `esc`); não achei XSS óbvio.
- Compressão de foto antes de salvar.
- PWA completo e funcionando offline.
- Documentação (`CLAUDE.md`, `ROADMAP.md`) clara e honesta sobre riscos.

## 7. Oportunidades de produto e venda
1. **Validação de campo antes de qualquer coisa:** levar o app a 2 ou 3 marmorarias reais, medir 5 projetos já fechados e comparar chapas e preço. É a prova de que o plano de corte e a margem servem.
2. **Orçamento que vende:** PDF com logo, condições de pagamento, prazo, validade, foto do material e aceite por link/WhatsApp. É o que o cliente final vê.
3. **Funil com lembrete:** avisar "orçamento enviado há 3 dias sem resposta". Aumenta conversão com pouco código.
4. **Modelo de cobrança sugerido:** assinatura mensal por marmoraria, com limite de vendedores. Teste de 14 dias grátis.
5. **IA de fotos como diferencial:** só depois de login e limite de uso por empresa (custo de API). Sempre como sugestão a confirmar.
6. **Catálogo de materiais compartilhado/importável** reduz o cadastro inicial, que é a maior barreira de entrada.

## 8. Ordem recomendada (alinhada ao `ROADMAP.md`)
0. Aprovar o PR #1 e publicar no Pages; instalar no Android e testar em modo avião.
1. Antes de migrar: corrigir A1 e A5 (pequenos) e escrever testes da lógica de cálculo.
2. Etapa 1 do roadmap: projeto Vite + TypeScript, separar `lib/calc`, testes com os 3 orçamentos de exemplo.
3. Resolver A2 (snapshot de preço) já no desenho do banco da Etapa 2.
4. Etapa 2: Supabase com `empresa_id` em tudo, RLS, login por e-mail, papéis dono e vendedor.
5. Em paralelo e sem código: validar C3 com marmorarias reais.
6. Etapas 3, 4 e 5 só depois.

## 9. Perguntas que a próxima IA deve fazer ao Daniel antes de agir
- Já existe alguma marmoraria disposta a testar? Quantos vendedores ela tem?
- Quanto tempo e quanto dinheiro por mês há para desenvolver e para hospedar?
- A meta é vender assinatura (SaaS) ou usar o app na própria marmoraria primeiro?
- O Daniel quer aprender a configurar ou só receber pronto? (Hoje é iniciante: guiar um passo por vez.)

## 10. Regras para qualquer agente que trabalhe neste projeto
- Falar em português do Brasil, direto, e apontar erros mesmo sem pergunta.
- Guiar o Daniel **um passo por vez**, dizendo exatamente onde clicar; perguntas em opções de seleção.
- Não mudar a chave `pedrafacil.v1` do `localStorage` sem migração de dados.
- Dinheiro e área em funções puras, com testes. Mobile first, nada de dependência pesada.
- Segurança e isolamento por empresa no banco (RLS), nunca no navegador.
