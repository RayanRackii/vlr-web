<!-- Movido verbatim de AGENTS.md em 2026-10-24 (economia de tokens). Regras continuam vigentes. -->

## Autonomous Delivery Workflow

Canônico (contrato de revisão, blockers, merge methods, GitHub): **`vlr-api/AGENTS.md`** + `vlr-api/docs/runbooks/autonomous-delivery.md`. Este arquivo só afirma o que o parent faz **neste** repo.

O parent é dono do ciclo técnico completo. O usuário não precisa pedir branch/commit/push/PR/review/approve/merge. “MR” = Pull Request.

Neste repo: `web-implementer` ou `ui-implementer` (um writer por working tree) → `npm`/Vite build → `web-reviewer` em `origin/develop...HEAD` depois do parent `git fetch origin --prune`. Critical = 0, High = 0. Medium corrigido ou justificado como non-blocking.

Merge Risk Gate: Sol (`gpt-6.1-sol`) prepara o dossier compacto e a revisão de risco é **obrigatória** se o PR tocar auth, tenant, contrato FE↔BE, clients de API compartilhados (`api` / `customerApi` / `publicApi`), roteamento DEV/PROD, ou blast radius alto — critérios completos no `AGENTS.md` da API. Copy/i18n/CSS isolado/docs: `DEEP_REVIEW_NOT_REQUIRED` se reviewers e build estiverem limpos.

Merge automático só `feat` / `fix` / `refactor` / `test` / `chore` → `develop` após todos os gates (**Squash and merge**). Nunca `main`/PROD automático. Release `develop` → `main` (Human Gate): **Create a merge commit**. Cross-repo: mesmo nome de branch; não mergear metade incompatível (`COORDINATED_MERGE_REQUIRED`). Sem `gh`: `PR_AUTOMATION_UNAVAILABLE` + compare URL; não parar o review.

Testes: se houver infra, adicionar regressão automática; senão `TEST_INFRASTRUCTURE_MISSING`. Auth/tenant/contrato de API compartilhado não devem depender só de build.

Fila: `READY` / `IN_PROGRESS` / `BLOCKED_HUMAN` / `BLOCKED_TECHNICAL` / `PR_OPEN` / `MERGE_REVIEW` / `MERGED_DEVELOP` / `VALIDATION_REQUIRED`. Task bloqueada não encerra o sprint.

