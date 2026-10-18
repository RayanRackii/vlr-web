# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e o `ROADMAP.md` do repo irmão **`vlr-api`**.

**Foco de produto agora:** portal B2C estável + **agenda por Slot** (APIs no `vlr-api`; UX aqui).  
**Adiado:** OTP real E2E / WhatsApp **PROD** até enablement humano. DEV WhatsApp live smoke CLOSED_DEV.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `ROADMAP.md` do **`vlr-api`**.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).
4. Entregas relevantes de produto/incidentes também atualizam o diário canônico em `vlr-api/docs/sessions/` (um consolidado por data ou período; não duplicar no frontend).
5. Ordem de leitura do agente: `AGENTS.md` → `CONTEXT.md` → este arquivo → `.cursor/rules/`.

## 1. Registro dinâmico por tenant — FEITO (código)

- [x] `/register` dinâmico + UI admin de campos.
- [x] Confirmar migration + deploy FE/BE — `AddTenantRegistrationFields` + seed + `AddCatalogOrdersAndCustomerDocument` applied DEV and PROD; feature in API/WEB PROD SHAs; live public schema + `/register` 200. Authenticated admin/B2B PROD smoke not executed.

## 2. Shell B2C + menu multi-item — FEITO (código)

- [x] `AppShell` compartilhado com B2B `MainLayout`.
- [x] Pós-login: `CustomerAppLayout` com sidebar dos itens de `GET .../menu`.
- [x] Menu do cliente logado (#142): Reservar horário (item de rentals), Minhas reservas (`agenda/:id#minhas-reservas`) e Perfil (`app/perfil`). Header do portal com alvo de toque 44px e código PT/EN/ES. Telefone do perfil só na tela, máscara BR. “Enviar código” habilita com cola e autofill.
- [x] Login/register/verify permanecem no card branded (`TenantPortalLayout`).
- [x] Cadastro B2C verifica **e-mail** (código); `/verify-email` + redirect de `/verify-phone`. Celular coletado, não bloqueia. **Não PROD.**
- [x] Agenda em `agenda/:menuItemId` com asset pré-selecionado quando configurado.
- [x] Admin: `/configuracoes/menu` + seção no edit de tenant (platform).
- [x] B2C agenda por Slot + admin mínimo de escala (ver §3.5).
- [x] Admin B2B de reservas.

## 2.5. Dashboard B2B dinâmico — FEITO (código)

- [x] Centro de comando por módulo (clientes portal + inventory/rentals/os/pmoc/maintenance).
- [x] i18n pt-BR / en / es.

## 2.9. Meu Perfil B2C — FEITO (código)

Spec (canônica no `vlr-api`): `docs/plans/active/2026-08-18-b2c-meu-perfil.md`. Branch `feat/customer-profile`.

Decisões: DTO próprio (`CustomerProfileDto`); PATCH só Nome + Foto; identidade (e-mail/telefone/CPF/senha) somente leitura.

- [x] Página `/app/perfil` (host) e `/t/:subdomain/app/perfil` (path) em `CustomerAppLayout`
- [x] Menu da conta via AppShell `profileTo` (B2B `MainLayout` sem o item)
- [x] `GET`/`PATCH /api/customers/me` (nome + foto via file picker; `safeParse` em schema separado do login)
- [x] Erro de carga: botão Tentar novamente (re-GET), sem sair do layout; sucesso recarrega via GET
- FOLLOW_UP (fora deste MVP): e-mail com verificação; telefone com SMS; CPF; senha B2C (troca/recuperação); CEP/endereço; ExtraAttributes. Upload de foto **não** aberto — cadastro já comprime e persiste `PhotoUrl`.

## 2.10. Verificação de e-mail no cadastro B2C — FEITO (código, DEV)

Spec: `vlr-api/docs/plans/active/2026-09-11-b2c-email-verification.md`. Branch `feat/b2c-email-verification`.

- [x] Register navega para `/verify-email` (redirect de `/verify-phone` preservando `location.state`)
- [x] Página: e-mail mascarado, código 6 dígitos (paste-friendly), cooldown 45s, i18n pt-BR/en/es sem copy de SMS no signup
- [x] #196: Reenviar código mostra toast e um estado na tela (enviado ou falha, inclusive limite). O texto fixo diz que um novo código substitui o anterior. A espera de 45s só começa depois do sucesso.
- [x] Zod: `requiresEmailVerification` obrigatório; `requiresPhoneVerification` opcional (compat); `emailVerified` nos perfis
- **Não PROD.**

## 3. Portal branding / host

- [x] Host `{subdomain}.rolvix.com.br` + path `/t/:subdomain`.
- [x] Marca via **`LogoSvg`** (admin textarea + `TenantLogoMark` + DOMPurify); sem `logoUrl` no produto.
- [x] Logo com fundo sólido embutido: markup original no portal; o canvas dark usa a cor detectada (sem pad branco automático).
- [x] Fundo B2C do portal (login/register/verify) adapta light/dark a partir das cores do tenant, sem forçar a página escura a ficar clara.
- [x] Confirmar DNS/Vercel wildcard `*.rolvix.com.br` — live in PROD (wildcard TLS valid; arbitrary first-level tenant hosts; `/t/:slug` fallback preserved). Reserved infrastructure names (`www`, `api`, `app`, `admin`, `dev`, `staging`, `preview`, `mail`, `support`) enforced by API (`vlr-api` develop `c873833ac6f70bf8f82b81e315cc63a32a8d4166`).
- [x] Migration `AddTenantLogoSvg` (`core.tenants.logo_svg` text nullable) confirmed on DEV and PROD: history `20260804152356_AddTenantLogoSvg` + column present. No apply in this audit.

## 3.5. Agenda por Slots (Rentals genérico)

Backend API pronta (ver `vlr-api` `ROADMAP` §2.6 + ADR slots). Frontend:

- [x] Admin mínimo: seed grade horária + publish/edit day list (`/configuracoes/agenda`)
- [x] Admin completo: occupancy kinds CRUD + weekly template editor fino
- [x] B2C agenda: listar slots do dia (inclui SlotGrid derivado da grade semanal) / book por `slotId` ou create-reservation
- [x] UX admin Escala/Agenda: abas Agenda diária / Templates / Tipos + Sheet forms + timeline de slots
- [x] Política OpenHours na Agenda diária + seed SlotGrid via `POST .../templates/seed-default` (1 request)
- [x] Agenda multi-espaço: seletor múltiplo, política em lote, agenda agrupada; UI **Horário padrão** / **Grade personalizada** (domínio OpenHours/SlotGrid permanece no código)
- [x] Padrões de loading **em toda a app**: `Skeleton` default shimmer; `LoadingButton` em mutações; `TopProgressBar` (React Router, delay ~250ms); skeletons estruturados (agenda, dashboard KPIs, tabelas, páginas de lista)
- [x] Layout canvas (mapa de rentables) em Operação + picker B2C data+horário (fallback em grade se não houver layout)
- [x] Admin: **Concluir** em reserva `Confirmed` (`POST /api/reservations/{id}/complete`) só com `rentals.reservations.complete`. Sem UI B2C Complete/cancel nesta wave.
- [x] Wave 1 **PROD_COMPLETE** (Phase A + Phase B T1): staff Complete (`rentals.reservations.complete`); reservation start/end and Rentals “today” format in `America/Sao_Paulo`. API instants stay UTC. No parallel civil fields. WEB PROD `0d995955dd56338cc8cbfda6bf8ff6950afb68f6`; API PROD `54b385d5d14d0438fceb0c358872cf7ef1e1f589`. Public/read-only smoke only (no customer write smoke). Follow-ups (WEB today-boundary and other timezone tests) remain non-blocking and are **not** authorized by this closeout.
- [x] Agenda B2C (#135): data mínima = hoje em `America/Sao_Paulo`; horários de hoje que já começaram ficam ocultos, com explicação; em Minhas reservas, reserva com fim já alcançado mostra “Reserva passada” e não oferece Cancelar. Pós-login B2B: sem `core.dashboard.read`, `/dashboard` abre a primeira rota da sidebar que o usuário pode ver; sem nenhuma, permanece Acesso negado.
- [x] Agenda B2C `?reservation=` (#179 e, link do e-mail em `vlr-api` #178): se o id é um UUID da lista do próprio cliente e o status não é cancelado, a linha é destacada e a página rola até ela. Id ausente, inválido, de outro cliente ou cancelado permanece na agenda normal, sem toast e sem mostrar o id. Data e horários do dia não mudam. Itens (a)–(d) ficam no `vlr-api`.
- [x] Teacher date-only lessons (FICC pilot) em `develop`: `src/features/rentals/pages/TeacherLessonsPage.tsx` e `src/features/rentals/hooks/useTeacherLessons.ts` (página no PR #87; correção de release no PR #90, https://github.com/RayanRackii/vlr-web/pull/90, merge `64657ea`). A tela só cria/remove aula na data e na quadra SlotGrid selecionadas. Slot `Available` com `reservationId` não entra na oferta nem na remoção, e o toast de sucesso exige o corpo esperado (aula sem reserva no create, open sem reserva no remove). Agenda admin permanece em `rentals.schedule.write`. Modelo de permissão da tela de professor: `rentals.schedule.lessons.write` + `rentals.assets.read` + `rentals.schedule.read`, sem `rentals.schedule.write`. Rota `/configuracoes/agenda` e o nav continuam em `rentals.schedule.read`. API já mergeada (`vlr-api` #92 / #95 / #126). A aula criada permanece em “Aulas nesta data” na data selecionada (`?date=` sobrevive ao reload; o refresh do mesmo dia não apaga a lista). O horário esvaziado depois do create não mostra `Invalid input`. Um slot persistido `closed` (no DEV, Quadra 1 `20:00–21:00` em 2026-10-15, “Reserva manual (M6)”) sai da oferta de horário; não é fuso nem buraco de template. `GET /api/schedule/days/{date}` admin já devolve a aula não reservável. A leitura inicial da quadra e da data (`?date=`) mostra carregamento enquanto o GET está em voo, em vez de “Nenhuma aula nesta data.”. O horário liberado ao remover volta em ordem de início. Remover aula pede confirmação. Pendente humano, fora deste PR: aplicar no DEV a migration `AddRentalsScheduleLessonsWritePermission` e conceder explicitamente `rentals.schedule.lessons.write` (Rayan).
- [x] #177: enquanto os espaços carregam, a tela mostra “Carregando os espaços...” e o seletor fica desabilitado. Assim que a lista chega, o primeiro espaço aparece selecionado e habilitado, e só então “Carregando as aulas desta data.”. `/dashboard` e `/configuracoes/agenda` direto terminam iguais.
- [x] #205 #199: confirmar o cancelamento junta a lista como o assinante e ignora a resposta se a revisão da agenda mudou. Uma lista que mostra a reserva cancelada solta a chave do horário. Data e horário escolhidos ficam na URL (`date` só fora de hoje; `time` quando há escolha). Sem escolha, hoje e o primeiro horário livre.
- [x] #201: depois de remover uma aula com sucesso, um GET antigo do mesmo dia não volta a mostrar a aula nesta aba. O GET do dia pede para não reutilizar cache.
- [x] #200: o horário da aula explica por que está vazio. Carregando, erro com “Tentar novamente”, recurso fechado na data, e dia da semana sem horário (aponta para Configuração semanal) são estados diferentes. Sábado 24/10 continua sendo a data civil pedida em `GET /api/schedule/days/{date}`; a resposta `{ date, slots }` não traz um motivo, então `slots` vazio é “sem horário configurado” e slots só `closed` são “fechado”. Não é índice de dia nem fuso.
- [x] #207: uma aula recriada no mesmo intervalo, com outro id, volta a aparecer nesta aba. O mesmo id continua oculto enquanto o GET antigo o lista.

### 3.7. Cancelamento B2C pelo cliente

Spec: `vlr-api/docs/plans/active/2026-09-07-rentals-b2c-self-cancel.md`. Branch `feat/rentals-b2c-self-cancel`. API already on `develop` (`89b3e6d` / PR #64). Wave 1 remains **PROD_COMPLETE**.

- [x] `cancelMyPortalReservation` via `POST /api/reservations/mine/{id}/cancel` (`customerApi` + Zod)
- [x] Minhas reservas: Cancelar em `PendingDeposit`|`Confirmed` com start futuro pede confirmação e explica que o portal não cobra nem reembolsa (inclusive reserva já confirmada; depósito continua confirmação do clube, sem estorno nesta tela). Sem Complete B2C. O botão de reservar/cancelar solta ao fim do POST; a lista usa a resposta na hora e o refetch do dia não segura o loading.
- [x] Vitest: helper + service + agenda page
- [x] Playwright `e2e/tests/10-b2c-self-cancel.spec.ts` (DEV; Confirmed path passed against Railway + develop Preview)
- [x] **CLOSED_DEV** — not PROD. API `89b3e6d` / PR #64; WEB `3478355` / PR #59. Wave 1 remains **PROD_COMPLETE**.
- [x] Agenda B2C (#164 #160): “reservado” sai das reservas do cliente e dos slots do dia, com a data civil no chaveamento. Cancelar rebusca o dia da reserva e o dia visto; falha de refetch tenta uma vez e então mostra toast. Trocar o idioma não refaz o GET do dia. Sem mudança no `vlr-api`.
- [x] #181: o 409 de horário ocupado rebusca Minhas reservas antes do aviso. Se a reserva é desta pessoa (inclusive feita em outra aba), o toast aponta um link para Minhas reservas. Caso contrário, continua “este horário acabou de ser reservado”.
- [x] #170: foco da janela e a aba visível de novo rebuscam Minhas reservas e o dia visto, no máximo uma vez a cada 2s, sem intervalo. Reservar desabilita se a grade atualizada mostra o horário ocupado. Card, conflito e “não oferecido” usam “Este horário já está reservado.”. A reserva desta pessoa continua no toast com link para Minhas reservas. Cancelar o que a lista já mostra cancelado avisa “Esta reserva já estava cancelada.” e não mostra sucesso.
- [x] #208 #207: total e estimativa usam o formatador da moeda do tenant no idioma ativo (pt-BR `R$ 80,00`, en `R$ 80.00`, es `80,00 R$`). Voltar restaura data e horário. `2026-11-31` não vai ao GET do dia. Se a revisão da agenda muda durante o cancelar e a reserva já está cancelada, o toast é o de já cancelada. EN de falha do dia diz “times”.
- [x] Agenda B2C (#187): o POST de reservar, ao concluir, rebusca Minhas reservas e os horários do dia num cliente de query fora do componente. Voltar no meio de “Reservando…” mantém a reserva na lista e o horário ocupado mesmo se o GET voltar vazio, sem segundo POST. Se o horário que falhou com 409 já é desta pessoa, o aviso aponta para Minhas reservas (#181, neste navegador).
- [x] Horário já iniciado (#180): no dia de hoje, no fuso do tenant (`America/Sao_Paulo`), o portal, a tela de aulas e a grade do dia não oferecem slot cujo início já passou. Aula já criada e ocupação já reservada continuam acessíveis. O servidor segue sendo a autoridade.
- [x] #210: a grade do dia reavalia o início passado a cada minuto e ao voltar o foco ou a aba. O nome acessível inclui o horário. `?date=` além do horizonte espera a política pública antes do primeiro GET do dia. Um link além do horizonte com `time` corrige a URL com replace, então Voltar chega na entrada anterior. Enquanto o dia seguinte espera a política, a grade anterior sai e Reservar fica desabilitado.
- [x] P2 UX (#183 #188 #167 #185 #184): “Reservar horário” fica desabilitado enquanto “Calculando o valor…”; login e cadastro com sessão saem com `replace` antes do card público; um formatador de moeda (símbolo, não o código ISO) e a troca de idioma mantém data, horário e recurso; Recursos resolve a permissão antes da sidebar; aba nova já logada não mostra a landing deslogada.

### 3.8. Política de reservas (texto de cancelamento + limite diário)

API `vlr-api` #174 em `develop` (migration DEV aplicada). O contrato é genérico: vale para qualquer tipo de recurso e qualquer tenant. O PUT substitui o texto e o limite diário. `maxAdvanceBookingDays` é à parte (`vlr-api` #207): omitido conserva o horizonte gravado, `null` apaga (ilimitado na política; no recurso, herda), um número de 0 a 3650 substitui.

- [x] Agenda B2C (#189): o seletor de data usa `max` quando a política pública traz `maxAdvanceBookingDays` ou o recurso traz `effectiveMaxAdvanceBookingDays`. O maior horizonte entre os recursos visíveis vale; `null` não limita. Sem o campo, o seletor não ganha teto. `400` `booking_horizon_exceeded` vira a frase do horizonte (pt-BR/en/es) no dia, na reserva e na estimativa.
- [x] Agenda B2C: com horizonte, o campo de data diz até qual dia (`Reservas disponíveis até DD/MM (N dias à frente)`). Data fora do intervalo (digitada ou dia desabilitado) avisa no campo e não troca a seleção. Trocar o dia mostra carregamento neutro, sem “já está reservado” em todos os espaços. Cancelar mantém a data da URL. O calendário segue o idioma (pt-BR/en/es).
- [x] Agenda B2C: uma data digitada além do horizonte vai para o último dia reservável, com a mesma frase do calendário, sem pintar os espaços como reservados. Voltar de `#minhas-reservas` recarrega os horários do dia. O menu conserva `date` e `time` nesse salto.
- [x] Agenda B2C: Voltar troca a data pela URL e, se o dia é válido, o campo deixa de ficar inválido e some o aviso de limite ou de data anterior.

- [x] Admin `/configuracoes/politica-reservas` (`rentals.booking_policy.read` para ver, `rentals.booking_policy.write` para salvar): texto simples até 2000 caracteres (em branco = null) e limite 1–100 ou sem limite (`null`). i18n pt-BR/en/es. Validity gate no salvar.
- [x] #217: a política grava o horizonte só quando muda (ilimitado envia `null`; N dias envia o número; sem mudança o campo sai do body). No recurso, “usar o padrão do ambiente” omite (ou envia `null` para apagar um número gravado), “ilimitado” envia `null`, e N dias envia o número. A ficha mostra `effectiveMaxAdvanceBookingDays`. Sem `rentals.booking_policy.write` ou `rentals.assets.write` os controles ficam desabilitados. Uma data N+1 dias à frente é recusada (`booking_horizon_exceeded`). pt-BR/en/es.
- [x] Cancelar no portal B2C mostra `cancellationPolicyText` como texto puro, além da nota que já existia. Sem texto, o diálogo usa uma nota neutra (o horário volta a ficar disponível; consulte as regras) nos três idiomas. O texto do tenant substitui essa nota.
- [x] 409 `DAILY_BOOKING_LIMIT_REACHED` em `POST /api/reservations` e `POST /api/schedule/slots/book` vira frase traduzida com o limite.
- [x] Conflito de horário (409 em que o recurso/horário já foi reservado) avisa que o horário acabou de ser reservado, solta “Reservando…” quando a resposta chega e atualiza a agenda. “Horário já reservado.” só no 409 de intervalo já reservado, na reserva feita neste navegador, ou quando o `reservationId` do dia está na lista deste cliente. Status `booked` ou `reservationId` de outra reserva, e os 409 “Slot is not available for booking.” / “Insufficient quantity”, mostram “Horário indisponível.” (esses 409 ainda avisam, sem marcar o card como reservado). Cancelar apaga a marca local. O slug de `tenantPortalPath` só entra na URL se for `[a-z0-9-]+`. Cores de disponível são as mesmas no mapa e nos espaços fora do mapa. `/t/{tenant}` com sessão desse tenant abre o portal; sessão de outro tenant continua no login. #146 #132.

### 3.6. Fila de reservas (WaitingQueue)

Spec: `vlr-api/docs/plans/active/2026-08-22-reservation-waiting-queue.md`. Branch `feat/reservation-waiting-queue`. Feature-detect `queueEnabled === true`.

- [x] Admin wizard Operação (Location): toggle fila (default off) + horário de abertura; persistir em create/update/bulk
- [x] B2C agenda: poll GET queue 4s (pausa se a aba estiver oculta); Closed / WaitingRoom / Waiting / Active 90s / Expired
- [x] Reserva continua em `bookPortalSlot` / `createPortalReservation`; 409 `QUEUE_*` muda o estado da fila
- [x] Recurso com fila explica o ticket (`requiresTicket`, pt-BR/en/es). Com a fase Open e ninguém à frente, a agenda oferece só “Entrar na fila e reservar” (entra e, se o ticket ficar Active, reserva). Sem fila, o texto não aparece. (#165)
- [x] Validar E2E com a API na mesma branch (Playwright `e2e/tests/10-queue-rentals.spec.ts` against Railway DEV + develop Preview). Join/Waiting/Active→book/reload/auth/module-off covered. Closed UI skipped near São Paulo midnight wrap (API `ReservationQueueTests` still cover Closed). Single E2E Customer — multi-customer atomicity stays in API `ReservationQueueConcurrencyTests`.
