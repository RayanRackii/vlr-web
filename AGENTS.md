# AGENTS.md — vlr-web

## Ordem de leitura
1. [`CONTEXT.md`](./CONTEXT.md) — glossário + beachhead (**espelho**; canônico em `vlr-api`)
2. [`ROADMAP.md`](./ROADMAP.md) — checklist e histórico deste repo
3. [`.cursor/rules/`](./.cursor/rules/) — produto, arquitetura, convenções
4. [`docs/sessions/`](./docs/sessions/) — diários FE (quando existirem)

ADRs de domínio (ex.: slots) vivem em **`vlr-api/docs/adr/`**.

## Repos
- **Este:** `vlr-web` (React + Vite, Vercel).
- **Irmão:** `vlr-api` (.NET 10, Railway) — API e domínio.
- Workspace Cursor pretendido: roots `backend` + `frontend` (dois Git repos, **não** monorepo). O diretório pai no disco não precisa ser workspace root.

## Ao concluir trabalho
- Atualizar `ROADMAP.md` (checks + Histórico se o plano mudou).
- Se glossário/beachhead mudou → atualizar também o canônico em `vlr-api`.
- No chat: próximo passo deste roadmap **e** do `vlr-api`; **como testar**.

## Human Decision Gate

Agentes podem decidir detalhes técnicos locais, reversíveis e já cobertos por regras/padrões existentes.

Se surgir uma dúvida cuja resposta possa afetar arquitetura, modelo de domínio, outra funcionalidade, contrato frontend/backend, compatibilidade retroativa, autenticação/autorização, isolamento multi-tenant, segurança, dados persistidos ou comportamento em produção, o agente **não assume**.

Deve parar, explicar a decisão necessária, apresentar alternativas relevantes, recomendar uma opção com motivo e pedir decisão ao usuário antes de continuar.

Regra: *Escalate uncertainty, not implementation.*

## Git Work Policy

Uma implementação = uma branch própria + N commits + uma review.

**Base:** `develop`. Nunca implementar, commitar ou fazer push diretamente em `main` ou `develop`.

**Branches:** `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `chore/<slug>`. Mudança cross-repo usa o **mesmo nome** em `vlr-api` e `vlr-web`.

**Preflight** (antes de implementar):

```bash
git status --short --branch
git fetch --prune origin
git switch develop
git pull --ff-only origin develop
git switch -c <branch>
```

Adapte só se a branch já existir por motivo conhecido. Working tree suja por trabalho não reconhecido: **PARE E PERGUNTE.** Não usar stash, reset, clean, restore ou checkout para esconder trabalho.

**O implementer pode autonomamente** (na feature branch): consultar status; fetch; `pull --ff-only`; criar a branch; editar; stage controlado; commits (incluindo vários coerentes); push da feature branch; configurar upstream.

**O implementer NÃO pode autonomamente:** trabalhar/commitar/push em `main` ou `develop`; force push; merge; rebase destrutivo de trabalho desconhecido; `reset --hard` de trabalho desconhecido; stash silencioso de trabalho desconhecido; deploy de produção; alterar dados, segredos ou infraestrutura de produção.

## Roteamento multi-agent

Arquivos em [`.cursor/agents/`](./.cursor/agents/). São roteadores — não copiam produto, arquitetura, convenções nem o corpo dos skills.

O parent/orchestrator é **Grok 4.6**. Não substitua modelos em silêncio. Se o subagent configurado não puder rodar, emita `SUBAGENT_UNAVAILABLE` (agent, modelo esperado, **root esperado**, motivo, ação do usuário) e **pare**. Não simule o papel e não use outro agent/modelo no lugar.

Architects canônicos (definidos no **vlr-api**, não duplicar aqui):

1. **rolvix-architect** (`glm-5.2`, readonly) — arquitetura do Rolvix (API + web).
2. **rolvix-deep-architect** (`claude-fable-5`, readonly) — Fable só com autorização **explícita** nesta conversa.

Ownership de implementação **neste** repo:

3. **web-implementer** (`grok-4.6`, write) — engenharia frontend geral (React, TypeScript, API, Zod, auth, estado, forms, routing, i18n técnico). Segue esta Git Work Policy. **Não** é substituído pelo Kimi só porque o repo é frontend.
4. **ui-implementer** (`kimi-k3`, write) — visual/layout/UX/browser, **somente** quando isso for central. Não altera contrato/domínio/auth por conta própria.
5. **web-reviewer** (`grok-4.6`, readonly) — Standards × Spec no diff `origin/develop...HEAD` de `vlr-web`, inclusive após Kimi. O parent faz `git fetch --prune origin` **antes**; o reviewer não faz fetch.

Um writer ativo por working tree: `web-implementer` **ou** `ui-implementer`, nunca os dois ao mesmo tempo neste repo. Sequência ok. Paralelo com `api-implementer` só no outro repo, e só se a spec não exigir ordem API→UI.

Cross-repo: `rolvix-architect` → uma spec → `api-implementer` **e** `web-implementer` / `ui-implementer` → `api-reviewer` **e** `web-reviewer`.

Tarefa trivial/localizada neste repo: pular architect. Tarefa arquitetural: `rolvix-architect` → spec → writers deste repo → `web-reviewer`.

Prompt cache do provider ≠ memória do projeto ≠ context pack. Nenhuma decisão do fluxo depende de cache hit.

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

## User-level skills

Required user-level Cursor skills (descoberta do Cursor, tipicamente `~/.agents/skills/`): `grilling`, `domain-modeling`, `implement`, `tdd`, `code-review`.

Agents referem skills **por nome**. Não duplicar o corpo. Não usar caminhos de workspace (`C:\Free\...`, `../.agents/...`). Se a skill não for descoberta, parar e informar — não improvisar cópia.
