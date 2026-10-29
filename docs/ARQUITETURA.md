# Arquitetura do Projetta

## Princípio
Todo módulo (Marmoraria, Ambientes, Vidraçaria...) segue o mesmo fluxo: Projeto → Modelagem → Medição → Quantitativo → Orçamento → PDF. A tela, o 3D, o preço e o PDF são compartilhados; cada módulo só diz como medir e quantificar.

## Contrato de módulo (a implementar no ciclo 3)
```js
{ id, nome, icone, estado: 'disponivel' | 'embreve',
  criar(),                  // projeto novo do módulo
  modelo3d(p),              // mesmo contrato do model3d.js: solids, bbox, cotas
  medir(p),                 // áreas, perímetros, volumes (cm por dentro, m² na saída)
  quantitativo(p),          // lista de itens {codigo, descricao, unidade, quantidade}
  orcar(p, config),         // custo, preço, margem, impostos
  itensPdf(p) }             // o que o PDF mostra
```
Um registro (`nucleo/registro-modulos.js`) lista os módulos e alimenta a tela "O que deseja projetar?". `embreve` aparece com selo e sem tela.

## Regras
- Funções puras, sem tela e sem localStorage, testadas com `node:test` (`npm test`).
- Tudo em cm por dentro; área em m².
- Dados novos são sempre opcionais (`S.ambientes`, `S.projetos`): projetos antigos abrem iguais. Sem migração.
- `calc.js` (marmoraria) não é alterado; a Marmoraria entra como fachada sobre ele.
- Orçamento fechado congela valores (`snap`).
- Valores de negócio (margem, desperdício, preço) nunca são inventados: campos em branco até o usuário preencher.
- Versão: `V` em `sw.js`, `APP_V` e `?v=` em `index.html` sobem juntos a cada mudança de arquivo do app.

## Pastas (só adiciona; nada existente é movido no começo)
```
nucleo/      registro-modulos.js, projeto.js, quantitativo.js, orcamento.js
modulos/     marmoraria.js (fachada), ambientes.js, vidracaria.js, marcenaria.js ...
motor/       ambiente.js (existe), planta.js (paredes livres), medicao.js
contratos/   auth, sync, tenant, permissões (interfaces; sem backend)
docs/        ARQUITETURA.md, MODULOS.md
telas/       index.html é quebrado aos poucos, uma tela por vez
```

## Dados
- Hoje: `localStorage` chave `pedrafacil.v1` (nome mantido de propósito). Orçamentos de marmoraria em `S.quotes`; Ambientes em `S.ambientes`.
- Projetos de outros módulos: `S.projetos[]` com `{id, modulo, nome, cliente, itens, status, snap}`.
- Futuro (contratos/): login, empresa (tenant), sincronização e permissões, com isolamento por RLS no banco.

## O que NÃO muda agora
Nome técnico: chave `pedrafacil.v1`, prefixo de cache `marmofacil-`, URL do GitHub Pages.
