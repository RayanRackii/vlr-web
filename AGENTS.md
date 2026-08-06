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
