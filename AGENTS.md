# AGENTS.md — vlr-web

## Ordem de leitura
1. [`CONTEXT.md`](./CONTEXT.md) — glossário + beachhead (**espelho**; canônico em `vlr-api`)
2. [`ROADMAP.md`](./ROADMAP.md) — checklist e histórico deste repo
3. [`.cursor/rules/`](./.cursor/rules/) — produto, arquitetura, convenções
4. [`docs/sessions/`](./docs/sessions/) — diários FE (quando existirem)

ADRs de domínio (ex.: slots) vivem em **`vlr-api/docs/adr/`**.

## Repos
- **Este:** `vlr-web` (React + Vite, Vercel).
- **Irmão:** `vlr-api` (.NET 10, Fly.io app `rolvix-api-prod`) — API e domínio. Web em Vercel; banco em Supabase.
- Workspace Cursor pretendido: roots `backend` + `frontend` (dois Git repos, **não** monorepo). O diretório pai no disco não precisa ser workspace root.

## Ao concluir trabalho
- Atualizar `ROADMAP.md` (checks + Histórico se o plano mudou).
- Se glossário/beachhead mudou → atualizar também o canônico em `vlr-api`.
- No chat: próximo passo deste roadmap **e** do `vlr-api`; **como testar**.

## Regras duras (resumo — detalhe nos docs abaixo)
- Base `develop`; nunca commit/push direto em `main` ou `develop`; uma task = uma branch (`feat|fix|refactor|test|chore/<slug>`) = um PR pequeno. Detalhe: [`docs/agents/git-workflow.md`](./docs/agents/git-workflow.md).
- Feature → `develop`: **Squash and merge**, só com CI verde e todos os gates. Release `develop` → `main`: **Create a merge commit**, nunca squash/rebase, nunca automático (`PRODUCTION_HUMAN_APPROVAL_REQUIRED`).
- Proibido sem humano: force push, `reset --hard`, stash/`clean` silencioso, deploy/dados/segredos/infra/DNS de PROD, migration destrutiva, deletar dados.
- Nunca imprimir senhas, tokens ou segredos. Trabalho autônomo só em DEV.
- Sempre `git fetch origin --prune` antes de alterar o repo (refs locais podem estar stale); bloqueios → `SESSION_BOOTSTRAP_BLOCKED`, nunca resolver em silêncio.
- Reviewer gate: Critical = 0, High = 0; Medium corrigido ou justificado. Review só do diff (`origin/develop...HEAD`).
- **Revisão profunda (canônica) obrigatória** se tocar: auth/authz, tenant isolation, segurança, concorrência, transação/integridade, migration/schema, dados persistidos, contrato FE↔BE, clients compartilhados, DEV/PROD, Fly/Vercel/Supabase, notificações, Hangfire, fronteiras de arquitetura, cross-repo, blast radius alto. Dossier ≤ ~1200 palavras, sem crawl; ≤ 1 chamada por PR. Detalhe e contrato `FABLE_MERGE_REVIEW`/`MERGE_BLOCKED`: [`docs/agents/delivery-and-merge-gate.md`](./docs/agents/delivery-and-merge-gate.md).
- Bug de alta severidade (concorrência, auth, tenant, pricing) não pode depender só de build.

## Roteamento de modelo/esforço
Resumo: Luna/mini para mecânico, testes e docs; Terra para endpoints/componentes; Sol medium por padrão, Sol high só em passos de dados/tenant/preço; revisão canônica: Sol (padrão do gate) ou Claude Opus read-only como substituto permitido; um revisor canônico por PR (ambos só em auth/tenant/migration). Não trocar modelo/esforço no meio de uma sessão; sessão nova por task, começando pela nota de handoff. Detalhe: [`docs/agents/routing.md`](./docs/agents/routing.md) e `~/rolvix-ai-docs/ROUTING.md`.

## Skills por tipo de task (não carregar todas sempre)
Skills user-level por nome (`grilling`, `domain-modeling`, `implement`, `tdd`, `code-review`); não duplicar o corpo; não usar caminhos de workspace (`C:\Free\...`, `../.agents/...`); se a skill exigida pela task não for descoberta, parar e informar — não improvisar cópia.
- `implement`: toda task que escreve código.
- `tdd`: mudança de lógica ou correção de bug (não para docs, copy, CSS, rename).
- `grilling` + `domain-modeling`: só passo novo de domínio/design/arquitetura ou spec.
- `code-review`: só no papel de reviewer.
- Docs/config/mecânico: nenhuma skill além de `implement` (ou nenhuma, se for só docs).

## Saída quieta (economia de tokens)
- Testes: `npx vitest run --reporter=dot --silent`; rodar só o projeto/arquivo afetado antes da suíte inteira.
- CI: `gh run view <id> --log-failed | tail -n 200`; nunca colar log inteiro no contexto.
- Saída grande → redirecionar para arquivo e ler só o trecho necessário.

## Human Decision Gate

Agentes podem decidir detalhes técnicos locais, reversíveis e já cobertos por regras/padrões existentes.

Se surgir uma dúvida cuja resposta possa afetar arquitetura, modelo de domínio, outra funcionalidade, contrato frontend/backend, compatibilidade retroativa, autenticação/autorização, isolamento multi-tenant, segurança, dados persistidos ou comportamento em produção, o agente **não assume**.

Deve parar, explicar a decisão necessária, apresentar alternativas relevantes, recomendar uma opção com motivo e pedir decisão ao usuário antes de continuar. Depois da escolha, o parent retoma o [Autonomous Delivery Workflow](./docs/agents/delivery-and-merge-gate.md) sozinho.

Regra: *Escalate uncertainty, not implementation.*

## Context packs

[`docs/context-packs/`](./docs/context-packs/) — packs **frontend-specific** só. Domínio compartilhado é canônico em `vlr-api/docs/context-packs/`. **Não** é fonte da verdade. Comece pelo INDEX local e, se o assunto for domínio, pelo INDEX da API. Canônico vence pack. Pack stale → `CONTEXT_PACK_STALE`. Atualize pack **depois** da fonte canônica.

## Agent feedback

Histórico canônico: **`vlr-api/docs/agent-feedback/`** (não duplicar aqui). **Não** é rule até promotion. Não carregar incidents no início de toda tarefa; use o INDEX da API. Reviewer readonly devolve `AGENT_FEEDBACK_RECOMMENDED`.

## Handoffs (`docs/plans`)

Specs só deste repo: [`docs/plans/`](./docs/plans/). Não substituem `ROADMAP.md` nem o espelho de `CONTEXT.md`.

- Só web: `docs/plans/active/`
- Só API: `vlr-api/docs/plans/active/`
- Cross-repo: **uma** spec em `vlr-api/docs/plans/active/`, com `Repositories: vlr-api` e `vlr-web`. **Não** espelhar a mesma spec aqui.

Nome: `YYYY-MM-DD-descricao-curta.md`. Spec com decisão humana pendente **não** está pronta para implementar.

