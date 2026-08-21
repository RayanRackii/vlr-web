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

Deve parar, explicar a decisão necessária, apresentar alternativas relevantes, recomendar uma opção com motivo e pedir decisão ao usuário antes de continuar. Depois da escolha, o parent retoma o [Autonomous Delivery Workflow](#autonomous-delivery-workflow) sozinho.

Regra: *Escalate uncertainty, not implementation.*

## Git Work Policy

Uma implementação = uma branch própria + N commits + uma review.

**Base:** `develop`. Nunca implementar, commitar ou fazer push diretamente em `main` ou `develop`.

**Branches:** `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `test/<slug>`, `chore/<slug>`. Mudança cross-repo usa o **mesmo nome** em `vlr-api` e `vlr-web`.

`main` permanece PROD-ready. `develop` permanece integration/DEV. Implementação só em `feat` / `fix` / `refactor` / `test` / `chore`.

O usuário trabalha nos mesmos repos a partir de mais de um computador. Nenhum agente pode assumir que a branch local, os refs `origin/*` locais, os commits locais ou a working tree representam o estado remoto atual.

**Quem coordena Git:** o parent/orchestrator. Subagentes (architect, implementer, reviewer) **não** repetem `git fetch` nem o bootstrap completo durante a mesma tarefa.

```
parent
  ├─ git bootstrap
  ├─ classify risk / Human Decision Gate
  ├─ architect (se necessário)
  ├─ implementer
  ├─ build / test
  ├─ reviewer
  ├─ PR
  ├─ Merge Risk Gate (dossier GLM ± Fable)
  ├─ approve → merge em develop (quando os gates passarem)
  └─ git checkpoint
```

Detecção por **evento**, não por adivinhar se uma janela do Cursor abriu ou vai fechar:

| Evento | Ação |
|---|---|
| Antes da primeira operação que altere o repo | Automatic Session Bootstrap |
| Depois de implementação concluída e validada | Automatic Task Checkpoint |
| Usuário indica parar / trocar de PC / encerrar sessão | Explicit Session Handoff |

Fluxo: pedido do usuário → parent → Git bootstrap **uma vez** → agentes → implementação → review → PR → Merge Risk Gate → merge em `develop` (se os gates passarem) → checkpoint.

### Automatic Session Bootstrap

Antes da primeira operação que altere o repositório de qualquer tarefa (editar arquivos, criar branch de implementação, continuar uma implementação, chamar agente com escrita, commit, push), o parent executa:

```bash
git status --short --branch
git fetch origin --prune
git status --short --branch
git branch -vv
```

**Nunca confie em refs `origin/*` locais antes do fetch.** `git status` sem fetch pode mostrar a branch "sincronizada" com um `origin/*` stale.

Não repetir este bootstrap a cada subagente da mesma tarefa. Exemplo: se o usuário abre outro PC e diz "vamos continuar Slots", o parent faz o bootstrap **antes** de qualquer alteração — o usuário não precisa perguntar se houve fetch.

**Nova implementação** (working tree limpa; refs já atualizados pelo fetch acima):

```bash
git switch develop
git pull --ff-only origin develop
git switch -c <new-branch>
```

**Continuar uma feature existente noutro PC** (refs já atualizados pelo fetch acima): localizar a branch remota, switch para a local/tracking, atualizar só por fast-forward:

```bash
git switch <feature-branch>
git pull --ff-only origin <feature-branch>
```

Não fazer automaticamente merge de `develop` na feature nem rebase da feature sobre `develop`. Se for necessário, é decisão explícita da tarefa ou Human Decision Gate.

Parar com `SESSION_BOOTSTRAP_BLOCKED` se encontrar: uncommitted changes inesperadas; local e remote divergidos; branch atual inesperada; tracking ausente; fast-forward impossível; conflito; commit local não publicado cuja origem não esteja clara.

Nesses casos: explicar o estado, apresentar opções, pedir decisão humana. Nunca resolver em silêncio com stash, reset, rebase, force, `clean`, restore ou checkout para esconder trabalho.

### Automatic Task Checkpoint

Não depender do usuário dizer que está encerrando a sessão. Depois de cada implementação concluída e validada, **antes** de anunciar que a tarefa terminou, o parent executa:

```bash
git status --short --branch
git log -5 --oneline
```

e verifica: branch atual, working tree, commits locais, commits ainda não no remote, tracking.

Se a implementação estiver concluída, validada, numa branch `feat` / `fix` / `refactor` / `test` / `chore`, e as regras deste arquivo permitirem: **commit**, **push**, e o restante do [Autonomous Delivery Workflow](#autonomous-delivery-workflow). Trabalho completo e validado não deve ficar só numa máquina.

Não commitar código incompleto só para "limpar" a máquina. Trabalho incompleto deve ser reportado como incompleto.

### Explicit Session Handoff

Quando o usuário indicar que vai parar, trocar de PC, continuar noutro computador, encerrar por hoje, finalizar por hoje, fazer o handoff ou encerrar sessão, o parent faz um handoff completo:

```bash
git status --short --branch
git log -5 --oneline
```

e, quando necessário, `git diff --stat`.

Retornar:

```
SESSION_HANDOFF

Repository:
Branch:
HEAD:
Tracking:
Working tree:
Ahead:
Behind:
Last pushed commit:
Uncommitted changes:
Unpushed commits:
Safe to continue on another PC:
```

Se não estiver seguro continuar noutro PC, dizer o motivo explicitamente.

### Autonomia do implementer

**O implementer pode autonomamente** (na feature branch, depois do Session Bootstrap do parent nesta tarefa): consultar status; editar; stage controlado; commits (incluindo vários coerentes); push da feature branch; configurar upstream.

**O implementer NÃO pode autonomamente:** trabalhar/commitar/push em `main` ou `develop`; force push; merge; rebase automático; `reset --hard`; stash silencioso; `clean`; deploy de produção; alterar dados, segredos ou infraestrutura de produção; iniciar um segundo Session Bootstrap (`fetch` + sync de `develop` + criar branch) na mesma tarefa. PR, aprovação e merge em `develop` são do **parent**, depois dos gates.

## Autonomous Delivery Workflow

Canônico (contrato Fable, blockers, squash-aware, GitHub): **`vlr-api/AGENTS.md`** + `vlr-api/docs/runbooks/autonomous-delivery.md`. Este arquivo só afirma o que o parent faz **neste** repo.

O parent é dono do ciclo técnico completo. O usuário não precisa pedir branch/commit/push/PR/review/approve/merge. “MR” = Pull Request.

Neste repo: `web-implementer` ou `ui-implementer` (um writer por working tree) → `npm`/Vite build → `web-reviewer` em `origin/develop...HEAD` depois do parent `git fetch origin --prune`. Critical = 0, High = 0. Medium corrigido ou justificado como non-blocking.

Merge Risk Gate: GLM prepara dossier compacto. Fable (`rolvix-deep-architect` no `vlr-api`) é **obrigatório** se o PR tocar auth, tenant, contrato FE↔BE, clients de API compartilhados (`api` / `customerApi` / `publicApi`), roteamento DEV/PROD, ou blast radius alto — critérios completos no `AGENTS.md` da API. Copy/i18n/CSS isolado/docs: `FABLE_MERGE_REVIEW_NOT_REQUIRED` se reviewers e build estiverem limpos.

Merge automático só `feat` / `fix` / `refactor` / `test` / `chore` → `develop` após todos os gates. Nunca `main`/PROD. Cross-repo: mesmo nome de branch; não mergear metade incompatível (`COORDINATED_MERGE_REQUIRED`). Sem `gh`: `PR_AUTOMATION_UNAVAILABLE` + compare URL; não parar o review.

Testes: se houver infra, adicionar regressão automática; senão `TEST_INFRASTRUCTURE_MISSING`. Auth/tenant/contrato de API compartilhado não devem depender só de build.

Fila: `READY` / `IN_PROGRESS` / `BLOCKED_HUMAN` / `BLOCKED_TECHNICAL` / `PR_OPEN` / `MERGE_REVIEW` / `MERGED_DEVELOP` / `VALIDATION_REQUIRED`. Task bloqueada não encerra o sprint.

## Roteamento multi-agent

Arquivos em [`.cursor/agents/`](./.cursor/agents/). São roteadores — não copiam produto, arquitetura, convenções nem o corpo dos skills.

O parent/orchestrator é **Grok 4.6**. Dono do [Autonomous Delivery Workflow](#autonomous-delivery-workflow) neste repo (Git, `web-reviewer`, PR, merge em `develop`). Subagentes não repetem `git fetch` na mesma tarefa. Não substitua modelos em silêncio. Se o subagent configurado não puder rodar, emita `SUBAGENT_UNAVAILABLE` (agent, modelo esperado, **root esperado**, motivo, ação do usuário) e **pare**. Não simule o papel e não use outro agent/modelo no lugar.

Architects canônicos (definidos no **vlr-api**, não duplicar aqui):

1. **rolvix-architect** (`glm-5.2`, readonly) — arquitetura do Rolvix (API + web); Merge Review Dossier.
2. **rolvix-deep-architect** (`claude-fable-5`, readonly) — arquitetura profunda com aprovação explícita **ou** Merge Risk Gate quando o `AGENTS.md` da API o tornar obrigatório.

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
