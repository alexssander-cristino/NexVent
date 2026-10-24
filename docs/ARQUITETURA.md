# NexVent — Arquitetura (proposta v0)

> **Status:** proposta para revisão. Do que está descrito aqui, só o núcleo de `packages/shared` existe e foi testado.
> Itens marcados **(a validar)** dependem de instalar pacotes e de um PostgreSQL, o que ainda não foi feito.

## 1. Stack proposta

| Camada | Escolha | Motivo |
|---|---|---|
| Monorepo | npm workspaces | Sem pré-requisito além de Node e npm |
| Web | Vite + React + TypeScript + Tailwind (tokens via CSS variables), React Router, TanStack Query, react-hook-form + Zod, Recharts | A área logada não precisa de SSR; o portal do cliente também é rota da SPA |
| API | Express + TypeScript + Zod, REST, erros em `application/problem+json` | Contrato único para a web e para um app móvel futuro |
| Banco | PostgreSQL gerenciado com pooler (Neon ou Supabase) + Prisma (migrações versionadas); relatórios em SQL | `numeric` para dinheiro; constraints e índices no próprio banco |
| Arquivos | Storage S3-compatível privado; upload direto por URL assinada; download por URL de curta duração | Arquivos grandes não passam pela API e nada fica público |
| Jobs | Rotas internas idempotentes acionadas pelo Vercel Cron; migráveis para um worker | Sem infraestrutura nova |
| Deploy | Web e API na Vercel, com `/api` no mesmo domínio **(a validar)** | Cookie de sessão same-origin, sem CORS |
| Testes | `node:test` em `shared`; Vitest com Postgres real na API; Playwright nos fluxos principais | |

## 2. Convenções

- Vocabulário de domínio em português (`empresa_id`, `lancamentos`, `eventos`); termos técnicos em inglês. Valores de enums em `snake_case` ASCII (`em_execucao`); rótulos com acento ficam num catálogo de textos (pt-BR agora, outros idiomas depois).
- Dinheiro: `numeric(14,2)` no banco, string decimal na API (`"1234.56"`), centavos inteiros (`bigint`) nos cálculos. Nunca `number` nem `float`.
- Datas de calendário (vencimento, data do evento) como `date`; instantes como `timestamptz` em UTC; o fuso da empresa só entra na exibição.

## 3. Multiempresa

- Toda tabela de negócio tem `empresa_id NOT NULL`. As tabelas-pai têm `UNIQUE (id, empresa_id)` e os filhos referenciam `(pai_id, empresa_id)`: o banco recusa ligar uma tarefa da empresa A a um evento da empresa B.
- `empresa_id` vem somente da sessão (middleware de empresa). Nenhum corpo, query string ou cabeçalho do cliente o define, e a camada de dados exige esse contexto.
- RLS do PostgreSQL como segunda camada, com variável de sessão por transação **(a validar com Prisma e pooler)**.
- Recurso de outra empresa responde 404, não 403, para não revelar que existe. Cada módulo só fecha com testes de acesso cruzado.

## 4. Autenticação e sessões

- Sessão opaca guardada no Postgres (só o hash do token), cookie `HttpOnly; Secure; SameSite=Lax`. Revogável: sessões ativas, desativação de usuário, troca de senha.
- Senha com Argon2id. Tokens de reset, convite e verificação de e-mail: aleatórios, de uso único, com validade e guardados como hash.
- Proteções: rate limit por IP e por conta, atraso progressivo no login, CSRF por `SameSite` mais cabeçalho próprio nas requisições que alteram estado.
- Administração da plataforma: tabela e login próprios (operadores), nunca um campo no usuário comum.

## 5. Permissões

- Permissões `modulo:acao`, catálogo em `packages/shared`. Os 7 papéis do prompt são modelos copiados para cada empresa e editáveis; a API confere as permissões gravadas da empresa.
- A verificação é sempre na API; a interface só esconde botões.
- Ninguém concede permissão que não possui (`exigirPodeConceder`); papéis personalizados não escrevem onde não leem (`validarCoerencia`); só o proprietário tem `assinatura:gerenciar`.
- Limites e recursos do plano são uma checagem separada, não são permissões.
- Último proprietário: proteção por transação com bloqueio de linha **(a validar)**.

## 6. Dados e regras de negócio

- **Financeiro:** lançamento → parcelas → baixas. Baixas são imutáveis; estorno é uma baixa inversa ligada à original; cancelar muda a situação e nunca apaga. A situação da parcela é derivada das baixas; o saldo da conta é derivado de baixas e transferências; uma transferência são dois movimentos na mesma transação.
- **Exclusão:** sem `ON DELETE CASCADE` em dado financeiro ou documental. Usa-se `RESTRICT` mais arquivamento (`arquivado_em`).
- **Eventos:** tabela explícita de transições de situação, validada no serviço, com cada mudança no histórico. Cancelar um evento define o destino dos lançamentos em aberto e dos já recebidos (reembolso).
- **Conflitos de agenda:** intervalo `tstzrange` por local ou recurso com índice GiST; é aviso, não bloqueio. Exige as entidades `locais` e `recursos`, que não estão na lista do prompt.
- **Auditoria:** `log_atividades` só de inclusão, gravado na mesma transação da mudança.
- **Idempotência:** `dedup_key` único em notificações e execuções de automação; `eventos_webhook (provedor, id_evento)` único.
- **Entidades além da lista do prompt:** sessões, tokens de uso único, papéis e permissões, locais, recursos, versões de proposta e de contrato, comentários, eventos de webhook, operadores da plataforma.

## 7. Automações e notificações

- Cada automação é uma função idempotente chamada por uma rota interna protegida por segredo. O disparo é pelo Vercel Cron: no plano Hobby roda no máximo uma vez por dia (com imprecisão de até uma hora); no Pro, até uma vez por minuto. Conferir em vercel.com/docs/cron-jobs/usage-and-pricing antes de prometer frequências.
- Notificações são gravadas na transação do fato gerador. E-mail e push ficam atrás de interfaces e só saem com provedor configurado; nada é simulado.

## 8. Assinaturas

- Interface `ProvedorDeCobranca`, com Mercado Pago primeiro e Stripe pela mesma interface se a estratégia pedir.
- Webhook: validar a assinatura, gravar o evento (único por id do provedor) e processar na mesma transação. Nada vira "pago" sem confirmação do provedor.
- Planos e limites em tabelas editáveis; preços ficam em branco até haver decisão comercial.

## 9. Fases

| Etapa | Escopo | Critério de pronto |
|---|---|---|
| 3a | Monorepo e núcleo de regras (`packages/shared`) | **Feita:** testes e `tsc` passando |
| 3b | API Express + Prisma + PostgreSQL: cadastro de empresa, login, recuperação de senha, convites, sessões, contexto de empresa, papéis, log de atividades, padrão de erros, CI | Cadastrar empresa, entrar, convidar usuário; testes de isolamento entre empresas e de permissão passando |
| 3c | Web: layout (sidebar, cabeçalho), tema claro/escuro persistido, kit de componentes, telas de autenticação | Fluxo da 3b utilizável pela interface nos dois temas |
| 4 | Clientes, fornecedores, eventos (situações, detalhe em abas), tarefas e checklists com datas relativas, calendário com conflitos, equipe, dashboard operacional | Cadastros e fluxos principais com testes; indicadores vindos do banco |
| 5 | Financeiro primeiro (lançamentos, parcelas, baixas, contas, resultado por evento); depois pipeline, propostas, contratos, relatórios e os cards financeiros do dashboard | Cálculos, baixas parciais, cancelamentos e estornos testados |
| 6 | Notificações, automações, portal do cliente, planos e assinaturas, painel da plataforma | Webhooks idempotentes e portal sem vazamento entre clientes, com testes |
| 7 | Revisão de segurança, E2E, documento de LGPD, backup e restauração testados, deploy | Checklist da seção 28 do prompt cumprido |

Os cards financeiros do dashboard entram na Etapa 5, junto com o módulo financeiro: antes disso eles ficariam zerados ou com números fictícios, o que o prompt proíbe.

## 10. Decisões em aberto

1. Vite com API separada (proposto) ou Next.js full-stack.
2. Prisma (proposto) ou Drizzle.
3. Vocabulário de domínio em português (proposto) ou em inglês.
4. Banco gerenciado: Neon ou Supabase.
5. Gateway: Mercado Pago (proposto) ou Stripe.
6. Pagamento maior que o saldo: recusar (proposto) ou gerar crédito explícito.

## 11. Ajustes de acessibilidade na paleta sugerida

| Token | Sugerido | Usado | Motivo |
|---|---|---|---|
| Texto secundário (claro) | `#77778F` | `#6E6E88` | 4,36:1 sobre branco e 4,08:1 sobre `#F7F7FC`; o AA exige 4,5:1 |
| Destaque ciano (claro) | `#22D3EE` | `#0891B2` | 1,81:1 sobre branco; elementos gráficos exigem 3:1. O tema escuro mantém `#22D3EE` (9,5:1) |
| Texto de links (escuro) | `#7965D8` | `#A99CF0` | `#7965D8` dá 3,81:1 sobre `#1A1A29`; ele fica só em preenchimentos |
| Texto branco sobre `#7965D8` | — | mantido | 4,50:1, no limite do AA: não clarear o botão |

## 12. Limitações conhecidas

- Não existe ainda tela, API ou banco. Tudo marcado **(a validar)** é desenho, não comportamento comprovado.
- O núcleo foi testado com `node:test` e `tsc` em Node 22; a API e a web terão testes próprios (Vitest, Playwright).
