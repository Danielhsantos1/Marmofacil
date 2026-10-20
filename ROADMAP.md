# Roadmap: do protótipo ao SaaS

Cada etapa termina com algo que funciona e pode ser testado no celular. Não pule etapas.

## Etapa 0: publicar o que existe
- Ligar o GitHub Pages (ou Vercel) para abrir o protótipo no celular e instalar como PWA.
- Critério: abrir a URL no Chrome do Android, instalar na tela inicial e usar em modo avião.

## Etapa 1: organizar o código
- Criar projeto Vite (React + TypeScript) e separar: cálculo (`lib/calc`), plano de corte, desenho SVG, telas.
- Escrever testes para o cálculo de preço, área, emendas e aproveitamento, usando como referência os 3 orçamentos de exemplo do protótipo.
- Critério: mesmos números do protótipo, testes passando.

## Etapa 2: banco e login (Supabase)
- Tabelas: `empresas`, `perfis`, `materiais`, `servicos`, `clientes`, `orcamentos` (peças em JSON), `fotos`.
- Todo registro leva `empresa_id`. Row Level Security: cada usuário só enxerga a própria empresa.
- Login por e-mail. Papéis: dono, vendedor (vendedor não vê lucro nem edita preços).
- Critério: duas empresas de teste sem conseguir ver os dados uma da outra.

## Etapa 3: offline de verdade
- Salvar localmente (IndexedDB), fila de sincronização quando voltar a internet, resolução simples de conflitos.
- Fotos no Supabase Storage com compressão antes de enviar.
- Critério: criar orçamento em modo avião e ver no outro aparelho depois.

## Etapa 4: IA de fotos
- Função de servidor (Supabase Edge Function) que chama a API da Anthropic. A chave fica só no servidor.
- Limitar uso por empresa. Sempre mostrar as medidas como sugestão a confirmar.

## Etapa 5: produto
- PDF com logo e cores da empresa, validade e condições de pagamento.
- Backup automático (dump diário do Supabase) e exportação.
- Cobrança por assinatura (Stripe ou Mercado Pago) e página de venda.

## Riscos conhecidos
- O plano de corte é estimado. Antes de vender, validar com 3 a 5 projetos reais de uma marmoraria e comparar com o que o cortador usaria.
- Cada marmoraria calcula preço de um jeito (por chapa, por m², com ou sem perda). Fazer isso configurável, não fixo.
