<!-- Movido verbatim de AGENTS.md em 2026-10-24 (economia de tokens). Regras continuam vigentes. -->

## Roteamento multi-agent

Arquivos em [`.cursor/agents/`](./.cursor/agents/). São roteadores — não copiam produto, arquitetura, convenções nem o corpo dos skills.

Selecione o modelo por capacidade: **Luna (`gpt-6-luna`)** para mudanças pequenas, testes e documentação; **Terra (`gpt-5.6-terra`)** para endpoints e componentes; **Sol (`gpt-6.1-sol`)** para trabalho complexo ou transversal, segurança e reviews. O parent/orchestrator é dono do [Autonomous Delivery Workflow](#autonomous-delivery-workflow) neste repo (Git, review, PR e merge em `develop`). Subagentes não repetem `git fetch` na mesma tarefa. Se um agente nomeado não estiver disponível, use o próximo modelo adequado à capacidade necessária e prossiga; não pare nem simule uma indisponibilidade.

Architects canônicos (definidos no **vlr-api**, não duplicar aqui):

1. Architect (readonly) — Sol (`gpt-6.1-sol`) para arquitetura do Rolvix e Merge Review Dossier.
2. Revisão profunda readonly — Sol (`gpt-6.1-sol`) para arquitetura profunda com aprovação explícita ou Merge Risk Gate quando o `AGENTS.md` da API o exigir.

Ownership de implementação **neste** repo:

3. Implementação web geral — Terra (`gpt-5.6-terra`) para endpoints e componentes; Luna (`gpt-6-luna`) para alterações pequenas/testes/docs. Segue esta Git Work Policy.
4. Implementação visual/layout/UX/browser — Terra (`gpt-5.6-terra`) quando isso for central; não altera contrato/domínio/auth por conta própria.
5. Review web readonly — Sol (`gpt-6.1-sol`) no diff `origin/develop...HEAD` de `vlr-web`. O parent faz `git fetch --prune origin` **antes**; o reviewer não faz fetch.

Um writer ativo por working tree, nunca dois ao mesmo tempo neste repo. Paralelo com implementação API só no outro repo, e só se a spec não exigir ordem API→UI.

Cross-repo: `rolvix-architect` → uma spec → `api-implementer` **e** `web-implementer` / `ui-implementer` → `api-reviewer` **e** `web-reviewer`.

Tarefa trivial/localizada neste repo: pular architect. Tarefa arquitetural: Sol → spec → implementação adequada → Sol review.

Prompt cache do provider ≠ memória do projeto ≠ context pack. Nenhuma decisão do fluxo depende de cache hit.

