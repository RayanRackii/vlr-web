# Agenda do portal — QA de 20/10/2026

## Item 1 — INTENDED

O botão **Entrar na fila e reservar** já confirma a intenção de reservar o
horário escolhido. Quando o POST de join retorna `Open` + ticket `Active`, a
página chama `onReserve()` sem outro clique. O estado “Sua vez” pode aparecer
enquanto a reserva está sendo enviada. Isso não é uma regressão de 19/10.

Evidências consultadas com `git log -p` e `git log -S`:

- WEB `a9dc2def923b6eafd278ff3f33fe5f61d2058cee` (15/10, #172): mensagem
  “a single "Entrar na fila e reservar" action that joins and books if the
  ticket becomes active”. Introduziu `onJoinAndReserve`, a condição
  `next?.phase === "Open" && next.myTicket?.status === "Active"`, a chamada
  `await onReserve()` e o teste que faz **um** clique e verifica join antes
  de booking. A entrada correspondente permanece em `ROADMAP.md:140`:
  “entra e, se o ticket ficar Active, reserva”.
- WEB `2c9a23530400ddbd45a45afc0b49331ae2b60fda` (19/10):
  `src/features/tenantPortal/pages/TenantPortalAgendaPage.tsx:1018`, no
  conteúdo desse commit, conserva a mesma condição nas linhas 1029–1030.
  A alteração de 19/10 no hook só descarta respostas de outra geração de
  sessão; não adiciona confirmação nem muda o fluxo join → booking.
- Código atual: `src/features/tenantPortal/pages/TenantPortalAgendaPage.tsx:1147`.
- ADR canônico da API, `docs/adr/0003-reservation-waiting-queue.md:3`
  (introduzido por `64caf14`, consultado no checkout local `wqa-api`):
  “the queue only serializes **who may attempt** a booking”. O ticket autoriza
  uma reserva durante 90 segundos; o ADR não exige um segundo clique. A
  sessão pertence à Location e à abertura diária, não ao slot (linha 9).

Limite: um join que retorna `Waiting` **não** reserva automaticamente quando
um polling posterior promove o ticket. Nesse caso, ou ao reconectar com ticket
Active, continua existindo a ação de reservar. Nenhum comportamento do item 1
foi alterado.

## Item 2 — causas encontradas e correção

A reconciliação de disponibilidade e o fallback de horário limpavam escolhas
sem aviso. Com fila, #247 mantém a Location selecionada, mas o `startTime`
continuava fazendo parte da chave do timeout: cada fallback automático
reiniciava o prazo de inatividade, embora não houvesse interação do cliente.

Agora as limpezas automáticas por indisponibilidade usam um helper que só
avisa quando há seleção; os fallbacks de horário também avisam e preservam
a fila diária. A chave de inatividade independe do fallback automático de
horário. Trocar o horário manualmente já limpa o recurso e inicia uma nova
escolha. Os checks de prazo antes de aplicar respostas tardias foram mantidos.

Auditoria dos caminhos de limpeza em `TenantPortalAgendaPage.tsx`:

| Caminho | Feedback |
| --- | --- |
| Mudança automática de escopo, bloqueio pela política ou recurso removido | “Este horário não está mais disponível” |
| Reconciliação de slot ausente, não reservável ou ocupado, sem fila | Mesmo aviso |
| Fallback de horário no GET do dia ou no snapshot | Mesmo aviso; fila diária permanece acessível |
| Idle | “Sua seleção expirou” e destino configurado |
| Reserva concluída, inclusive recuperação de 409 próprio | Toast de sucesso existente |
| 409 de terceiro ou slot indisponível | Toast de erro existente antes de limpar |
| Alteração manual de data/horário | Ação explícita do cliente |

Regressões simulam seleção de 20/10 às 16:01:30, retirada do slot 17:00 às
16:02:32 e expiração no prazo original, por snapshot e refetch do mesmo dia.
Também cobrem o horário que passa com a página aberta. Essas causas foram
reproduzidas localmente; não foi capturado o tráfego da sessão original de PROD.

## Item 3 — reserva própria

O detalhe do tile usava sempre `slotTaken` quando indisponível. Agora consulta
`customerAlreadyHoldsSlot` (reserva recém-criada neste navegador ou presente
em Minhas reservas) e mostra **Sua reserva**. Vale para mapa e tiles fora do
mapa, com traduções pt-BR/en/es. Reservas alheias conservam a indicação de
ocupação. O teste do vencedor da fila verifica o rótulo após a criação;
os testes existentes de remount e cancelamento verificam a remoção do rótulo.

## Validação

Seis testes falharam contra a página original de `HEAD`: aviso de limpeza,
quatro casos de fila (snapshot/refetch × slot retirado/passado) e rótulo do
vencedor. A página corrigida foi restaurada após essa verificação.

Comandos finais: `npx vitest run --maxWorkers=2 src/features/tenantPortal` e
`npx tsc -b --noEmit`: **463 testes em 36 arquivos aprovados; TypeScript
aprovado**. `git diff --check` também aprovado.

Próximo WEB: repetir em DEV Q-1 sem interação, perda de disponibilidade e
reserva do vencedor. Próximo API: observar o GET queue e o read model de
Minhas reservas nesses fluxos; sem alteração de contrato nesta tarefa.
