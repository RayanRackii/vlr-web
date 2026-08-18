# Handoffs / specs

Mecanismo de passagem **architect → implementer**. Não é um segundo `ROADMAP.md`.

## Onde gravar

| Escopo | Caminho |
|---|---|
| Só `vlr-web` | `docs/plans/active/` (este repo) |
| Só `vlr-api` | `vlr-api/docs/plans/active/` |
| Cross-repo | **Uma** spec em `vlr-api/docs/plans/active/`, com `Repositories` listando `vlr-api` e `vlr-web`. **Não** criar espelho neste repo. |

Nome: `YYYY-MM-DD-descricao-curta.md`.

O architect é read-only: devolve o markdown ao parent. Depois das decisões humanas confirmadas, o parent/implementer materializa o arquivo no caminho canônico.

Uma spec com decisão humana pendente **não** está pronta para implementação.

## Conteúdo mínimo

Ver [HANDOFF-TEMPLATE.md](./HANDOFF-TEMPLATE.md).
