# Equipe de agentes — Marmofácil

## Objetivo do produto
Evoluir o protótipo Marmofácil para uma ferramenta mobile-first para marmorarias, permitindo:
1. capturar fotos e usar a câmera do celular durante a visita;
2. registrar medidas verificáveis do ambiente;
3. criar/editar bancadas e peças em 3D;
4. associar geometria, medidas e materiais ao cálculo de chapas e ao orçamento;
5. preservar o fluxo existente de clientes, materiais, serviços, PDF e WhatsApp.

## Como trabalhar
- Responder sempre em português do Brasil, de forma direta e guiada, um passo por vez.
- Antes de alterar código, resumir o plano e os arquivos que pretende tocar.
- Fazer alterações pequenas, testáveis e reversíveis. Não reescrever o app inteiro sem justificativa.
- Nunca remover funcionalidades existentes sem aprovação explícita.
- Não alterar a chave `pedrafacil.v1` do `localStorage` sem migração compatível.
- Não afirmar que a câmera mede dimensões reais apenas com uma foto. Toda medida inferida deve ser apresentada como estimativa e confirmada pelo usuário.
- Separar cálculos de negócio de interface e cobrir cálculos com testes.
- Não armazenar chaves de API no navegador. Integrações com IA devem passar por backend.
- Não considerar o plano de corte atual como otimização industrial certificada; validar com projetos reais.
- Priorizar Android de entrada, interface em português, alvos de toque de pelo menos 44 px e desempenho mobile.
- Antes de adicionar bibliotecas pesadas, explicar o impacto no tamanho, desempenho e compatibilidade.
- Não introduzir autenticação ou banco de dados improvisados no front-end. Isolamento entre empresas deve ser garantido no servidor/banco.

## Arquitetura recomendada
- Curto prazo: manter o protótipo funcional, corrigir riscos e testar os cálculos.
- Próxima etapa: migrar gradualmente para Vite + TypeScript, separando domínio, UI e renderização.
- 3D: avaliar Three.js para visualização/editor, com geometria parametrizada para peças (reta, L, U, ilha, lavatório, nicho, escada e peças livres).
- Câmera: separar captura de imagem, calibração/medidas, reconhecimento assistido e rastreamento espacial. Detectar suporte a APIs e oferecer modo manual quando indisponíveis.
- Medição: exigir pelo menos uma referência dimensional conhecida ou calibração/AR compatível; nunca prometer precisão sem validação.
- Persistência: IndexedDB para dados locais/fotos e, quando for SaaS, Supabase com RLS, Storage e sincronização offline planejada.

## Critérios de aceite para câmera + 3D
- Usuário consegue tirar/importar foto no celular.
- Pode marcar pontos/linhas e inserir uma medida conhecida para calibrar escala, quando aplicável.
- O app mostra claramente quais dimensões são medidas, calculadas ou estimadas.
- Pode criar uma peça parametrizada, editar dimensões e visualizar em 3D, rotacionar e aproximar.
- Dimensões e peças são salvas e reutilizadas no orçamento.
- Funciona em navegadores móveis compatíveis e oferece alternativa quando câmera/AR não é suportada.
- Testes cobrem conversão de unidades, geometria e cálculos de área/custo.
