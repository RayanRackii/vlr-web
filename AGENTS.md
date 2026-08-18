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
- Não versionar docs na pasta pai do workspace local.

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

O parent/orchestrator é **Grok 4.6**. Não substitua modelos em silêncio. Se o subagent configurado não puder rodar, emita `SUBAGENT_UNAVAILABLE` (agent, modelo esperado, motivo, ação do usuário) e **pare**. Não simule o papel.

Um writer ativo por working tree: **implementer** (Grok) **ou** **ui-implementer** (Kimi), nunca os dois editando ao mesmo tempo. Sequência ok.

1. **architect** (`glm-5.2`, readonly) — arquitetura padrão. Investigação focada. Não chama Fable; se excepcional, devolve `FABLE_ESCALATION_RECOMMENDED`.
2. **deep-architect** (`claude-fable-5`, readonly) — só após autorização **explícita** do usuário **nesta** conversa, com o dossier do GLM. Silêncio não autoriza.
3. **implementer** (`grok-4.6`, write) — implementação geral (API, auth, estado, regras, TypeScript estrutural). Segue esta Git Work Policy. **Não** é substituído pelo Kimi só porque o repo é frontend.
4. **ui-implementer** (`kimi-k3`, write) — visual/layout/UX/browser, **somente** quando isso for central. Não altera contrato/domínio/auth por conta própria.
5. **reviewer** (`grok-4.6`, readonly) — Standards × Spec no diff `origin/develop...HEAD`, inclusive após Kimi. O parent faz `git fetch --prune origin` **antes**; o reviewer não faz fetch.

Tarefa trivial/localizada: pular architect. Tarefa arquitetural: architect → Human Decision Gate e/ou escalada Fable se o usuário autorizar → spec em `docs/plans` → Grok e/ou Kimi (sequencial) → reviewer.

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

## Workspace skills

Procedimentos locais (fora deste Git), referidos **por nome**: `grilling`, `domain-modeling`, `implement`, `tdd`, `code-review`.

Fallback de arquivo, relativo à raiz deste repo: `../.agents/skills/<skill>/SKILL.md`.

Agents apontam para esses skills; não duplicam o corpo. Se a skill esperada não estiver no workspace, não improvisar cópia — informar.
