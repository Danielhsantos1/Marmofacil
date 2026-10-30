# Roadmap: Projetta (antes Marmofácil)

**Projete. Meça. Orce.** Plataforma de projetos, medições e orçamentos 3D. A marmoraria é o primeiro módulo; os outros seguem o mesmo fluxo:

Projeto → Modelagem → Medição → Quantitativo → Orçamento → PDF

Regras fixas: JS puro (sem React, Vite, TypeScript, Tailwind), Three.js, PWA offline, GitHub Pages, `calc.js` e `tests/golden.json` intactos sem decisão comercial, cada etapa termina com `npm test` verde e algo que se testa no celular. Arquitetura detalhada em `docs/ARQUITETURA.md`.

## Fase atual (decisão de 2026-10-30)
Pausa de funcionalidades novas por 3 a 4 semanas para descobrir a dor com 15 conversas com donos de marmoraria, depois tornar o produto cobrável (login, nuvem, isolamento por empresa) e vender aos primeiros pilotos. Detalhes e critérios em `docs/DECISOES.md`. Os ciclos abaixo continuam como lista de ideias; nada novo entra sem pedido de cliente pagante ou piloto.

## Já feito
- Marmoraria: peças, plano de corte, preço, snapshot, 3D profissional, PDF, catálogo de 46 pedras (v1 a v26).
- Ambientes: motor `motor/ambiente.js` + aba Ambientes com medidas e 3D (v27).
- Página de vendas Projetta em `/vendas/`, com selo "Em breve" no que não existe.

## Ciclos
1. Documentos: este roteiro e `docs/ARQUITETURA.md`. (feito)
2. Rebranding: nome Projetta visível (título, manifest, textos). (feito, v28, junto com o layout responsivo) Não renomear a chave `pedrafacil.v1` nem o prefixo de cache `marmofacil-`.
3. Tela "O que deseja projetar?" e registro de módulos (`nucleo/registro-modulos.js`). (feito, v29)
4. Marmoraria e Ambientes encaixados como módulos, sem mudar o comportamento.
5. Ambientes completo: quantitativos (piso, pintura, rodapé, revestimento) (feito, v30) e entrada em orçamento (feito, v31).
6. Núcleo de orçamento genérico (quantitativo → custo → margem/impostos → PDF), sem tocar no `calc.js`. (feito, v31: `nucleo/orcamento.js` + PDF do Ambiente; v32: cliente, status, funil, painel e WhatsApp)
7. Planta baixa 2D com paredes livres. (v33: formatos L, U e T com paredes movíveis; v35: desenho ponto a ponto com cantos retos; falta paredes inclinadas e curvas)
8. 3D gerado da planta e medições automáticas em tempo real.
9. Primeiro módulo novo: Vidraçaria (m², ferragens, instalação). Depois Marcenaria, Esquadrias, Área externa.
10. Contratos SaaS (login, equipes, nuvem, permissões): só interfaces até existir backend. Em paralelo.

## Primeiras 10 tarefas
1. Atualizar este roadmap. (feito)  2. Escrever `docs/ARQUITETURA.md`. (feito)
3. Rebranding visível.  4. `nucleo/registro-modulos.js` com testes.
5. Tela "O que deseja projetar?".  6. Marmoraria como módulo.
7. Ambientes como módulo.  8. Quantitativo de Ambientes com testes.
9. Orçamento genérico.  10. PDF para projetos que não são marmoraria.

## Riscos conhecidos
- `index.html` (~140 KB) cresce a cada módulo: telas novas em arquivos separados.
- Renomear a chave do localStorage ou o prefixo do cache apaga ou duplica dados dos usuários.
- Sem login e sem nuvem não é SaaS para várias empresas (isolamento por RLS quando houver banco).
- O plano de corte é estimado: validar com 3 a 5 projetos reais antes de vender.
- Cada empresa calcula preço de um jeito (por chapa, por m², com ou sem perda): manter configurável.
- Nada foi testado em Android de entrada real.
- O nome Projetta precisa de consulta de marca (INPI) e de domínio.
- Nunca inventar valores de negócio (desperdício, margem): campos nascem em branco.
