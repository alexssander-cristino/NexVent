# NexVent

Plataforma SaaS multiempresa de gestão de eventos. O plano técnico completo está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Onde estamos: Etapa 3a (núcleo de regras)

| Parte | Situação |
|---|---|
| Permissões por papel, com bloqueio de escalada de privilégio | Implementado e testado |
| Tokens visuais claro/escuro, CSS gerado e testes de contraste (WCAG AA) | Implementado e testado |
| Erros de domínio com códigos estáveis | Implementado e testado |
| API, banco de dados, autenticação, isolamento entre empresas | Não iniciado (Etapa 3b) |
| Interface web, tema, componentes | Não iniciado (Etapa 3c) |

Nenhuma tela, rota de API ou tabela existe ainda.

## Como rodar

Requer Node 22.18 ou superior (ou 24+) e npm.

```bash
npm install
npm test                              # testes do núcleo (node:test, sem dependências)
npm run typecheck                     # tsc
npm run tokens -w @nexvent/shared     # regenera packages/shared/css/tokens.css
```

## O que foi verificado

- `node --test` em `packages/shared`: todos os testes passam.
- `tsc` sem erros (TypeScript 6.0.3).
- Mutações manuais (reverter um token, dar `assinatura:gerenciar` ao administrador, desincronizar o CSS) fazem os testes falharem, ou seja, os testes detectam essas regressões.

## Limitações conhecidas

- `packages/shared` exporta TypeScript puro, sem etapa de build. A web (Vite) e a API (tsx ou esbuild) vão consumi-lo direto do código-fonte.
- Os papéis e as permissões padrão são uma proposta para revisão, não uma decisão final.
- Typecheck e testes foram executados fora de um `npm install` limpo (o ambiente de desenvolvimento não tinha rede); na primeira execução local, rode os três comandos acima e relate qualquer diferença.
