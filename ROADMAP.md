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

## 4. Gating B2B por módulos

- [x] Sidebar B2B em seções (Visão geral / Pessoas & portal / Operação) filtrada por `activeModules`.
- [x] Skeleton shimmer na sidebar enquanto `activeModules` carrega (mantém Visão geral visível).
- [x] `PermissionRoute` nas rotas de produto (módulo **e** permissão) + página **Pessoas e acesso** (`/pessoas-e-acesso`) com usuários e funções.
- [x] Docs: Inventory opcional; Rentals/PMOC/OS não forçam Ativos (ADR 0004 no `vlr-api`; spec `docs/plans/active/2026-09-04-module-dependencies-asset-registry.md`).
- [x] Wave 3: wizard/edit (Super-Admin) consomem `GET /api/admin/modules`; Explore (tenant B2B) usa metadados de apresentação WEB + `activeModules` porque o GET do catálogo é PlatformAdmin-only. Copy comercial, nunca “Asset Registry”; sem auto-select de Inventory.
- [x] Wave 4: nav Recursos (`/configuracoes/recursos`, `rentals.assets.*`) quando Rentals está on; `/ativos` permanece só com Inventory. PMOC/OS pickers leem Wave 2 (`maintenance-plans/asset-categories`, `work-orders/assets`) sem mandar o usuário a Ativos. **Não** há criação self-sufficient de tipos/recursos em PMOC/OS nesta wave.
- [x] Enforcement API 403 para módulos inativos certificado no Playwright DEV (`npm run test:e2e:release`).
- [x] Pós-login: usuário sem `core.dashboard.read` não permanece em Acesso negado em `/dashboard`; cai na primeira rota permitida (ordem da sidebar, módulo + permissão). Platform admin fora do tenant continua no dashboard.
- [x] #168: cada item do menu declara as permissões que a página exige e some se faltar alguma (sem regra por função). Recursos exige `rentals.assets.read` e `core.units.read` porque a página chama `GET /api/units`. Quem só lê quadras (professor) não vê Recursos; `/dashboard` explica a troca para a primeira rota permitida. Cabeçalho usa `tenantTradeName` de `GET /api/users/me`, ou `tenantLegalName`, e só então “Área autenticada”. `?date=` passada na tela de aulas avisa que os horários são de hoje. Código `FORBIDDEN` na carga de Recursos vira a frase de `rbac.errors.FORBIDDEN`.
- [x] #176: `/perfil` no shell do staff (nome, e-mail, funções de `GET /api/users/me`; menu da conta). URL autenticada desconhecida fica na shell com página não encontrada. Celular do staff não entra: `CurrentUserResponse` não tem telefone nem rota de atualização.
- [x] #194: a tela de notificações diz que o e-mail para clientes começa ligado em organizações novas e pode ser desligado ali. O interruptor usa `isActive` da API, sem default otimista.
- [x] #186: no mapa de recursos, a ordem de foco e do leitor de tela segue a posição visual (cima para baixo, esquerda para direita); o empate usa ordem natural do nome. A grade automática também nasce nessa ordem de nome.

## 4.11. PMOC / OS — FEITO (PROD)

Phases 1–3 are **COMPLETE / RELEASED PROD**. Phase 4 is **NOT PLANNED**. Canonical spec: `vlr-api/docs/plans/active/2026-09-19-pmoc-os-phase3.md`. WEB release merge `254bd333ef2b2c3b4f798ef6327091f85890fd36` (PR #85).

Historical Slice 5 note below. Spec: `vlr-api/docs/plans/active/2026-09-18-pmoc-os-phase1.md`. Branch `feat/pmoc-os-phase1-web-library-detail`.

- [x] Rotas estáticas `/pmoc/biblioteca`, `/pmoc/biblioteca/:templateId`, `/pmoc/:id` (depois de `/pmoc/novo`)
- [x] Nav: Meus PMOCs, Biblioteca Rolvix (`pmoc.templates.read`), Novo personalizado
- [x] Biblioteca + preview + Usar modelo (`POST /api/maintenance-plans/from-template`)
- [x] Detalhe empilhado: origem, ativo, auto-gerar, checklist replace-set; delete 409 `PLAN_IN_USE` → desativar
- [x] `/pmoc/novo` só personalizado (sem import client-side / CREA)
- [x] Gerar OS, OS relacionadas, and Coverage V3 shipped in later slices and are on PROD. This checkbox is closed; it is not open work.
- [x] QA de planos: confirmar exclusão (snapshot das ordens e desativar quando já existem), editar nome e descrição, opções de escolha única, validação visível no salvar, confirmar remoção de tarefa, toast com link ao gerar ordem, ocultar geração em plano inativo, aviso quando não há técnico, abrir o plano criado e ordenar ordens relacionadas pela data.

## 4.9. DEV E2E / Release Certification

- [x] Playwright contra Preview `vlr-web-git-develop` + Railway DEV API.
- [x] Guard `E2E_PROD_GUARD` (`E2E_ENV=development`, URLs DEV obrigatórias).
- [x] Matriz 32 combinações comerciais + gate 403 + restore do tenant compartilhado.

## 4.5. UX de Ativos (fundação)

- [x] Nav Recursos / Tipos; empty state guia criar tipos primeiro.
- [x] Copy por tom de módulo (`rentals` | `maintenance` | `generic`) via `useAssetCopyTone`.
- [x] Famílias no wizard/edit tenant + formulários dinâmicos por `fieldSchema`.
- [x] Copy preferindo famílias ativas do tenant (`spaces` / `goods` / `electrical` …).
- [x] Wizard: “É necessário pagamento prévio?” (`requiresDeposit` / `RequiresDeposit`) em todo rentable.
- [x] Wizard: passo Operação; preços por preset (todos os dias / fim de semana / por dia); estado preservado entre passos
- [x] Wizard Location: “Fila de reservas” + horário de abertura (`queueEnabled` / `queueOpeningTime`); oculto para Good
- [x] F-16: lote — tipo Location gera N recursos numerados; tipo Good gera um recurso com quantidade em estoque (sem toggle extra)
- [x] Wave 4: cadastro de recursos alugáveis via Rentals (`POST/PUT /api/rental-assets`) quando `inventory` está off. Ativos permanece o CRUD geral quando Inventory está on. Sem serial number / data de instalação / RequiresMaintenance / exclusão em lote nesta tela.

## 6. Catalog & Orders v1 — EM ANDAMENTO

Spec canônica: `vlr-api/docs/plans/active/2026-08-28-catalog-orders.md`. Branch `feat/catalog-orders`.

- [x] Module key Catalog + permissions in admin MODULE_KEYS / MODULE_ORDER
- [x] B2B: Produtos, Pedidos; `/catalogo/notificacoes` é histórico/reenvio (sem matriz de canais)
- [x] Settings unificadas `/configuracoes/notificacoes` (Catalog + Rentals; `core.notifications.read` / `core.notifications.write`)
- [x] B2C: Catálogo + Meus pedidos (não label combinada); cart client-side; solicitar produto
- [x] Register PF/PJ (CPF/CNPJ); perfil não edita tipo/documento
- [x] CustomerAppLayout.modulePath para `catalog`
- [x] P2 create UX: código gerado do nome até edição manual; arquivos na criação; um save sem virar edição
- [x] Carrossel de imagens do produto (jpeg/png/webp) na lista/detalhe B2C e no diálogo de edição B2B; `object-contain`; sem lib extra
- [x] Grade B2C de produtos: cards compactos 1–4 colunas, placeholder sem foto, stepper de quantidade; sem mudança de contrato/API
- [x] Carrinho B2C: subtotal da linha, total parcial (“A partir de” quando há item sob consulta), remover item, quantidade 0 não apaga a linha (1–99, só ao sair do campo; vazio não vira 1 enquanto se digita). Cancelar pedido pede confirmação e ignora um segundo clique enquanto o POST está em voo. Total misto em Pedidos mostra a soma conhecida e “Sob consulta”. Solicitar produto confirma na tela com link ao catálogo: o portal não tem GET de solicitações do cliente (`POST /api/catalog/portal/product-requests` e URL de arquivo apenas). es agrupa milhar (`1.500,00 R$`). EN do portal usa “Canceled”.
- [x] B2C Minhas solicitações: lista paginada (`GET /api/catalog/portal/product-requests`, pageSize 20) e detalhe (`GET .../{id}`). Menu do catálogo, botão no catálogo e confirmação do envio apontam para a lista. 404/501 da lista é um estado de indisponível, separado da caixa vazia, até o `vlr-api` #224 existir. Sem lógica de clube.

## 5. Fluxo de convite B2B

- [x] Wizard + edit tenant: convidar admin (sem senha)
- [x] `submitInvitePassword` → `POST /api/invites/accept`
- [x] Super-Admin `/admin/users` — lista global com filtro nome/tenant + exclusão
- [x] Modo suporte: Abrir ambiente = login real (membership + `tenant_id` JWT); Voltar limpa metadata
- [x] Esqueci a senha → `POST /api/auth/forgot-password` com `X-Tenant-Subdomain`. No host ou `/t/:slug` o slug vem de `resolveTenantSubdomain`. No apex `/login` um passo pede o identificador da empresa antes do POST. Sem consulta de e-mail entre tenants. Resposta não-5xx fica na frase genérica; 5xx mostra o erro. Portal B2C já envia o header em `POST /api/auth/customer/password-reset/request`. Ship junto com `vlr-api` #100. `/reset-password` inalterado. Sem secrets.
- [x] Onboarding público não coleta senha. `POST /api/onboarding/tenants` segue só com `isTrial: true`; o admin define a senha no e-mail de convite (`/invite?token=`). Pareia com `vlr-api` #111.

## Dívidas técnicas conhecidas

- [x] Branding inconsistente (`Platform` vs Rolvix).
- [x] Login/Onboarding B2B com strings hardcoded.
- Landing anuncia módulos futuros.
- Hygiene sweep 2026-08-04: ver `docs/code-hygiene-findings.md` no **`vlr-api`** (canônico).

## Histórico

| Data | Mudança |
|------|---------|
| 2026-08-03 | Portal + registro dinâmico. |
| 2026-08-04 | Agenda B2C inicial. |
| 2026-08-04 | **Executado:** shell B2C (AppShell) + menu dinâmico multi-item; admin de menu. |
| 2026-08-04 | Header Rolvix no portal B2C (sem Features/Pricing); default idioma pt-BR no portal. |
| 2026-08-04 | **Executado:** branding `LogoSvg` (admin + portal sanitizado); `getTenantBaseDomain` unificado em `lib/tenantDomain`. |
| 2026-08-04 | Agenda slots: backend iniciado; FE admin/B2C slot UX + layout canvas pendentes. |
| 2026-08-04 | Convite admin do tenant no wizard/edit + accept real em `/invite`. |
| 2026-08-05 | **Executado (com API):** Abrir ambiente / Voltar; `/admin/users`; nav por `activeModules`; reset password B2B. |
| 2026-08-06 | **Docs:** `CONTEXT.md` espelho neste repo; `AGENTS.md`; rules apontam para paths deste repo + irmão `vlr-api` (não monorepo). |
| 2026-08-06 | **Executado:** agenda B2C por Slot (`slots/book`) + admin mínimo de escala (seed templates + publish day). |
| 2026-08-06 | **Executado:** UX Ativos — Recursos/Tipos, empty states, copy por módulo (`useAssetCopyTone`). |
| 2026-08-06 | **Executado:** famílias de Asset no wizard/edit + forms dinâmicos + copy por família. |
| 2026-08-06 | **Executado:** Admin B2B de reservas em `/configuracoes/reservas` (listar / confirmar / cancelar). |
| 2026-08-06 | **Executado:** Dashboard B2B dinâmico por módulo (KPIs de login B2C + seções condicionais). |
| 2026-08-06 | **Executado:** Admin agenda completo — kinds CRUD + editor de templates em `/configuracoes/agenda`. |
| 2026-08-06 | **Executado:** WizardPanelsStepper compartilhado; AssetWizard create/edit/lote; onboarding trial público; banner trial + UX read-only. |
| 2026-08-09 | **Executado:** login “Esqueci a senha” chama API (Resend/Rolvix) em vez do e-mail genérico do Supabase. |
| 2026-08-09 | **Fix:** `/reset-password` valida `token_hash` via `verifyOtp` (link do e-mail aponta para o front, não para `supabase.co/verify`). |
| 2026-08-09 | **Executado:** exclusão em lote de ativos (checkbox + soft/hard via DELETE existente). |
| 2026-08-10 | **Docs:** PlatformAdmin não lista/conta como usuário do tenant (API). |
| 2026-08-11 | **UX:** sidebar B2B em Visão geral / Pessoas & portal / Operação; primary `#1E293B`. |
| 2026-08-11 | **UX:** Escala/Agenda em 3 abas (diária default, templates, kinds) + Sheets + empty states. |
| 2026-08-11 | **Executado:** OpenHours admin + seed bulk `templates/seed-default` (API + FE); docs CONTEXT. |
| 2026-08-13 | **Executado:** 3 padrões de loading na agenda (Skeleton shimmer / LoadingButton / TopProgressBar React Router). |
| 2026-08-13 | **Executado:** loading patterns estendidos a toda a app (Skeleton default=shimmer, tabelas/listas, LoadingButton em auth/portal/admin/assets/OS/PMOC). |
| 2026-08-14 | **UX:** skeleton shimmer na sidebar durante carregamento da navegação por módulos. |
| 2026-08-14 | **Executado:** Agenda multi-espaço (seleção em lote + agenda agrupada) e copy Horário padrão / Grade personalizada. Diário canônico no `vlr-api`: `docs/sessions/2026-08-14-product-delivery-log.md`. |
| 2026-08-14 | **Branding:** paleta Rolvix atualizada para steel blue (`#4D6A92` / `#5A8FA0` / `#A2C6E9`), gradientes suaves e novos defaults de tenant; cores já salvas por tenant permanecem personalizadas. |
| 2026-08-14 | **UX Agenda:** workspace responsivo em duas colunas; busca local de espaços/bens nos controles à esquerda, agendas agrupadas à direita e cards de política com estado selecionado explícito. |
| 2026-08-14 | **Refino Agenda:** cabeçalho centralizado, maior respiro entre colunas, remoção da faixa redundante da agenda e copy explícita de recorrência por dia da semana. |
| 2026-10-08 | **Código (WEB, merged PR #87):** teacher date-only lessons — controles restritos a dia único. Página em `develop`: `TeacherLessonsPage.tsx` e `useTeacherLessons.ts`. |
| 2026-10-12 | **Fix (WEB, merged PR #90):** `fix/teacher-lessons-release-blockers` (`64657ea`). A tela de aulas ignora slot `Available` que já tem `reservationId` e só mostra sucesso quando o corpo confirma aula ou open sem reserva, na data e no intervalo pedidos. Rota e nav da agenda permanecem em `rentals.schedule.read`. Spec no `vlr-api`: `docs/plans/active/2026-10-12-teacher-lessons-release-blockers.md`. |
| 2026-08-14 | **Perf Agenda:** templates do dia pedidos com `dayOfWeek` (payload ~7x menor); correção principal de lentidão foi no `vlr-api` (fim do N+1 na derivação de horários). |
| 2026-08-14 | **UX Agenda:** cards diários clicáveis (ajuste/indisponibilizar/restaurar só na data); abas Agenda do dia vs Configuração semanal; política/seed movidos para a config semanal. |
| 2026-08-14 | **Redesign Agenda:** grade virtualizada tempo × recursos, toolbar compacta, drawer com escopo diário/recorrente e construtor de regra semanal em lote. |
| 2026-08-17 | **Configuração semanal:** mesma grade tempo × recursos da Agenda do dia, navegação por dia da semana e horários padrão visíveis em todas as colunas selecionadas. |
| 2026-08-17 | **Cadastro de rentable:** flag “É necessário pagamento prévio?”; sem a flag, a reserva B2C já nasce confirmada. |
| 2026-08-17 | **Layout:** página em Operação para posicionar espaços; portal reserva com data + horário e mapa/grade (indisponíveis visíveis, não clicáveis). |
| 2026-08-17 | **Layout:** redimensionar o mapa; organizar espaços em grade igual; save estável. |
| 2026-08-17 | **Fix escala:** grade semanal vira horários reserváveis no portal sem “Aplicar grade neste dia”; grade admin maior, sem scroll interno no dia típico. |
| 2026-08-18 | **Wizard de recursos:** passo Operação; presets de preço; formulário não zera ao mudar de passo. |
| 2026-08-18 | **Docs:** fundação multi-agent (architect / implementer / reviewer), Human Decision Gate, Git Work Policy e `docs/plans`. |
| 2026-08-18 | **Docs:** GLM architect padrão; Fable só com aprovação; Kimi ui-implementer; context-packs FE. |
| 2026-08-18 | **Docs:** ids de subagent disambiguados (`web-implementer`, `web-reviewer`, `ui-implementer`); architects canônicos no `vlr-api`. |
| 2026-08-18 | **Executado:** Meu Perfil B2C — `/app/perfil` + menu da conta (`profileTo`); GET/PATCH `/api/customers/me` (nome + foto). |
| 2026-08-18 | **Fix:** Meu Perfil — retry no erro de GET (permanece no layout); refresh GET após PATCH. |
| 2026-08-18 | **UX:** Meu Perfil — cartão de identidade, foto por botão (sem input nativo), dados somente leitura agrupados. |
| 2026-08-19 | **Fix:** Meu Perfil — bloqueia salvar enquanto a foto recém-selecionada ainda está sendo comprimida. |
| 2026-08-20 | **Docs:** protocolo Git multi-machine no `AGENTS.md` (Session Bootstrap, Task Checkpoint, Session Handoff). |
| 2026-08-21 | **Docs:** Autonomous Delivery neste repo (ciclo até merge em `develop`); contrato Fable canônico no `vlr-api`. |
| 2026-08-21 | **Fix F-09:** `publicApi` sem Authorization para endpoints AllowAnonymous do portal/onboarding. |
| 2026-08-21 | **Fix F-07:** 401 autenticado no `customerApi` limpa só a sessão B2C e volta ao login do tenant. |
| 2026-08-21 | **Fix F-03:** wizard aplica preços de aluguel em um único POST `/api/assets/pricing-bulk` (`replace: true`). |
| 2026-08-22 | **F-10 (espelho):** templates semanais podem sobrepor OccupancyKinds diferentes; precedência Closed > Lesson > Open na grade inédita; glossário alinhado ao `vlr-api`. |
| 2026-08-22 | **Fix F-16:** wizard de lote envia `rentalType` + `totalQuantity`; Location usa faixa start/end (N entidades); Good usa estoque num único recurso. |
| 2026-08-22 | **Executado:** fila opcional por Location (default off). Admin: toggle + horário no wizard. B2C: poll 4s, sala T−30, turno 90s FIFO. Sem fila = UX igual. **Como testar:** (1) Location com fila desligada — portal reserva como hoje. (2) Ligar fila 07:30 no wizard → portal: antes da sala de espera não entra; na sala entra e não reserva; após abertura o 1º Active reserva um horário em 90s. (3) 2º cliente vê posição 2. (4) Refresh mantém posição/tempo. (5) Após expirar, “Entrar novamente na fila”. Merge API first. Follow-up: testes FE do hook quando houver runner. |
| 2026-08-28 | **Iniciado:** Catalog & Orders v1 (cross-repo). Spec no `vlr-api`. Branch `feat/catalog-orders`. |
| 2026-08-28 | **Review-fix:** cart B2C aponta para `/catalogo/carrinho`; i18n de eventos e peopleAccess do módulo catalog. |
| 2026-08-31 | **Executado:** B2C verify-phone resend via Twilio Verify API; subtitle no longer mentions API log. |
| 2026-08-31 | **Fix:** cadastro B2C pendente navega para `/verify-phone` se o SMS falhar (`verificationStarted` / 503 legado); banner + Reenviar código. |
| 2026-09-01 | **Executado:** SuperAdmin company wizard redesign (shell 1200px, stepper vertical/compact, ações à direita); `/admin` redireciona para `/admin/dashboard`; detecção SuperAdmin via `GET /api/users/me` (`SUPER_ADMIN`) com fallback de e-mail `VITE_PLATFORM_ADMIN_EMAILS`. |
| 2026-09-01 | **Fix:** SuperAdmin wizard Recursos agora carrega o catálogo de famílias da plataforma em `GET /api/admin/asset-families` (não mais o endpoint B2B tenant-scoped). |
| 2026-09-01 | **Fix:** validity gate — Continuar/Finalizar do wizard de empresa (e Salvar no edit) desabilitados enquanto o passo/schema cliente for inválido; Back/Cancel livres; erros só-servidor no submit. Wrapper `FormPrimaryButton`. Outras telas: FOLLOWUP. |
| 2026-09-01 | **UX:** logo SVG com fundo sólido embutido ganha superfície neutra no tema oposto; markup original preservado (sem invert/recolor). |
| 2026-09-01 | **UX:** portal B2C resolve superfícies light/dark a partir das cores do tenant (`resolveTenantTheme`); fundo da página deixa de misturar sempre com branco. |
| 2026-09-01 | **UX:** fundo sólido detectado no SVG vira canvas do portal no tema dark (exato); logo original, sem card branco; light permanece light. |
| 2026-09-02 | **Executado:** Catalog P2 create UX — código gerado do nome (até override manual), arquivos na fila antes do productId, um save sem virar edição; 409 de código duplicado permanece no formulário. |
| 2026-09-02 | **Executado:** carrossel de imagens do produto (lista/detalhe B2C + edição B2B); filtra jpeg/png/webp; `object-contain`; sem Embla/Swiper. |
| 2026-09-02 | **Executado:** grade B2C do catálogo — cards compactos (`1/2/3/4` colunas), placeholder estável sem foto, stepper `[−][qtd][+]`, CTA Adicionar; sem mudança de contrato/API/carrinho. |
| 2026-09-03 | **UX (WEB):** Pessoas e acesso alinhado ao visual da agenda (cabeçalho, abas underline, empty state); RBAC/convite inalterados. |
| 2026-09-03 | **UX (WEB):** Formulário de cadastro B2C — 7 campos padrão obrigatórios (somente leitura) + personalizados em diálogo; chave gerada só no create; tipos traduzidos. |
| 2026-09-03 | **UX (WEB):** builder visual do menu do portal (lista + prévia B2C via `buildCustomerNavItems`); sem API nova, ícone persistido ou presets. |
| 2026-09-03 | **UX (WEB):** menu do portal — add só com módulos B2C ativos; discovery “Amplie seu portal”; catálogo sem Nome exibido editável. |
| 2026-09-03 | **UX (WEB):** discovery de módulos sai do builder e vira aba **Explore módulos** (catálogo Inventory/PMOC/OS/Rentals/Catalog). |
| 2026-09-04 | **Docs:** Inventory opcional; Rentals/PMOC/OS sem forçar Ativos (espelho ADR 0004 / spec no `vlr-api`). Explore não deve usar o termo Asset Registry. Sem código nesta entrega. |
| 2026-09-04 | **Executado (WEB Wave 3):** wizard/edit Super-Admin consomem `GET /api/admin/modules`; checkboxes só comerciais não-legado; Rentals/PMOC/OS não auto-selecionam Inventory; `maintenance` não é selecionável (nota legado só no edit); Asset Registry nunca aparece como módulo. Explore tenant usa apresentação WEB + `activeModules`. |
| 2026-09-04 | **Fix (WEB Wave 3):** Explore em `/configuracoes/menu` não chama `GET /api/admin/modules` (403 para JWT de tenant). Wizard/edit Super-Admin seguem no catálogo da API; Explore usa apresentação WEB + `activeModules`. |
| 2026-09-04 | **Executado (WEB Wave 4):** `/configuracoes/recursos` cria/edita rentables com `rentals.assets.*` (sem AssetWizard / `POST /api/assets`). Agenda empty state aponta para Recursos. PMOC/OS pickers usam GET Wave 2; empty states sem CTA para `/ativos`. PMOC/OS **não** criam tipos/recursos nesta wave. |
| 2026-09-05 | **Fix (WEB):** Super-Admin tenant edit (`/admin/tenants/:id/edit`) no longer calls `usePermissions`. Shared registration-fields and portal-menu managers take explicit `canWrite` plus target-tenant `activeModules` from the admin DTO/form. `/admin` stays outside `PermissionProvider`. |
| 2026-09-05 | **E2E (WEB):** Playwright release suite against deployed DEV (`npm run test:e2e:release`). Prod guard, 32-state commercial matrix, runtime 403, module flows, restore. Secrets stay in gitignored `.env.e2e.local`. |
| 2026-09-05 | **E2E (WEB):** Cleanup now cancels E2E work orders, double-deletes assets (30-day schedule + permanent when FK allows), and `RESTORE_MATCH` fails if active E2E leftovers remain. Tenant-edit asserts commercial modules only. |
| 2026-09-05 | **PROD:** Human Gate approved. Squash `develop` → `main` WEB PR #48 SHA `37a5266381ad5061cfda0299acb2c84a2726b050`. Vercel Production SUCCESS. `rolvix.com.br` 308→www 200; `www.rolvix.com.br` 200. API PR #51 SHA `48ad32a1e2ac3c71ec7df59a895ef1eecae55140`. DEV E2E_CERTIFIED (51 tests, 32/32). Migrations/config **NONE**. Rollback WEB `4b048c4f0e4f4a54efc5dca74404627699b9259d`. |
| 2026-09-05 | **Docs:** close wildcard infra — `*.rolvix.com.br` live in PROD, wildcard TLS valid, arbitrary first-level tenant hosts supported, `/t/:slug` fallback preserved. Reserved infrastructure names enforced by API (`c873833ac6f70bf8f82b81e315cc63a32a8d4166`). No WEB/DNS/Vercel/PROD mutation. |
| 2026-09-05 | **Docs:** confirm `AddTenantLogoSvg` applied. DEV: `core.__ef_migrations_history` + `core.tenants.logo_svg` text NULL. PROD: workflow `list/production` run `33261868461` (2026-08-29) lists `20260804152356_AddTenantLogoSvg`, `PENDING_COUNT=0`, identity `kbptdzfbngelzdhriyhf`. Runtime branding still returns `logoSvg`. No migration apply. |
| 2026-09-05 | **Docs:** close registration-fields migration + FE/BE deploy. History IDs `20260804012343_AddTenantRegistrationFields`, `20260804020748_CleanupFiccDuplicateCpfsAndSeedRegistrationFields`, `20260828175423_AddCatalogOrdersAndCustomerDocument` applied DEV (live schema) and PROD (`list/production` `33261868461`, `PENDING_COUNT=0`). Feature in API `48ad32a1e2ac3c71ec7df59a895ef1eecae55140` / WEB `37a5266381ad5061cfda0299acb2c84a2726b050`. Live `GET .../ficc/registration-schema` 200; host and path `/register` 200. No apply/deploy. Authenticated PROD config smoke not executed. |
| 2026-09-06 | **Fix (WEB):** Phase B T1 — `brazilTimeZone` helper; reservation range and B2C mine list render `America/Sao_Paulo`; Rentals “today” is Brazil civil today. API JSON remains UTC instant. Not deployed to PROD. |
| 2026-09-06 | **Executado (WEB Phase A):** Concluir reserva Confirmada no admin (`completeAdminReservation` + permissão `rentals.reservations.complete` + i18n). Sem timezone UI, sem Complete/cancel B2C. |
| 2026-09-07 | **E2E (WEB):** Rentals Queue validated against DEV API + portal. Playwright `10-queue-rentals.spec.ts`: join, duplicate ticket, waiting cannot book, Open turn → Reservation, occupancy reuse 409, reload keeps ticket, module-off 403, unauthenticated agenda → login. Closed phase skipped when São Paulo clock is too close to midnight. No runtime product change. |
| 2026-09-06 | **PROD:** Rentals Wave 1 **PROD_COMPLETE**. WEB `0d995955dd56338cc8cbfda6bf8ff6950afb68f6`; API `54b385d5d14d0438fceb0c358872cf7ef1e1f589`. Clocks in `America/Sao_Paulo`. Public/read-only smoke passed. No customer write smoke. This closeout does not authorize Wave 2 / Layout / timezone follow-up implementation. |
| 2026-09-07 | **DEV:** B2C self-cancel **CLOSED_DEV** (not PROD). WEB `3478355` / PR #59; API `89b3e6d` / PR #64. Minhas reservas Cancelar; Playwright Confirmed path passed. Wave 1 permanece PROD_COMPLETE. |
| 2026-09-07 | **Código (WEB):** B2C self-cancel em Minhas reservas (`POST /api/reservations/mine/{id}/cancel`). API first já em `develop` `89b3e6d` / PR #64. Sem Complete B2C. Wave 1 permanece PROD_COMPLETE. |
| 2026-09-07 | **Código (WEB):** settings unificadas de notificações em `/configuracoes/notificacoes` (Catalog + Rentals). `/catalogo/notificacoes` fica só histórico/reenvio. WhatsApp Rentals liga/desliga na UI (SQL não é o caminho normal). API already on `develop` (`51b7306` / PR #70). Branch `feat/unified-notification-settings`. |
| 2026-09-09 | **Ops DEV:** reminder template ACTIVE in Meta; live smoke no longer skipped. Unified settings PUT used for Catalog created, Rentals confirmed, then reminder. Meta returned **132001** on all three. Toggles restored off. No WEB code change. PROD WhatsApp still off. |
| 2026-09-11 | **Ops DEV:** WhatsApp live smoke **CLOSED_DEV**. Catalog created, Rentals confirmed, reminder Sent. Playwright `12-notification-settings` now launches after `npx playwright install`; persistence-after-reload assertion still fails (reload does not wait for PUT). PROD WhatsApp still off. |
| 2026-09-11 | **Test (WEB):** spec 12 waits for `PUT /api/notifications/channel-configs` 2xx before reload. Test race only; no runtime change. Branch `test/notification-settings-e2e-race`. |
| 2026-09-11 | **Git:** release `develop` → `main` passa a **Create a merge commit** (não squash). Reconciliação única `chore/final-main-develop-ancestry-reconciliation`. Sem delta de produto. PROD não deployado neste passo. |
| 2026-09-11 | **Código (WEB):** cadastro B2C verifica e-mail (código 6 dígitos) em `/verify-email`; redirect de `/verify-phone`; celular continua no formulário mas não bloqueia. Twilio não entra no UX de signup. **Não PROD.** |
| 2026-09-12 | **Fix (WEB):** cadastro B2C reconhece autofill do Chrome (input/change/animationstart → RHF) e habilita o submit; seletor de horário da agenda troca o `<select>` nativo pelo Select do design system (popup legível no tema dark). Sem backend, sem PROD. |
| 2026-09-12 | **Fix (WEB):** telefone B2C normaliza +55/formatação para DDD+número (10–11 dígitos) no autofill, cola e digitação, alinhado a `NormalizePhoneBr`. Sem contrato novo, sem PROD. |
| 2026-09-18 | **Código (WEB Slice 5):** Biblioteca Rolvix, preview/clone, detalhe de plano, checklist edit e auto toggle. Sem Gerar OS / OS relacionadas (Slice 6). Branch `feat/pmoc-os-phase1-web-library-detail`. |
| 2026-09-19 | **Código (WEB Phase 2 Slice 2):** cobertura de ativos no detalhe `/pmoc/:id` via `GET /api/maintenance-plans/{id}/coverage`. Sem H6/H7, sem API. Branch `feat/pmoc-os-phase2-coverage-web`. |
| 2026-09-24 | **Fechado (PMOC/OS):** Phases 1–3 COMPLETE / RELEASED PROD. Phase 4 NOT PLANNED. WEB `main` `254bd333ef2b2c3b4f798ef6327091f85890fd36` (PR #85). Current scheduling UI is interval + first due, not Frequency. |
| 2026-10-14 | **Fix (WEB):** Clientes do portal distingue busca sem resultado do ambiente sem clientes e descarta resposta obsoleta da listagem (`AbortSignal` + geração da request). |
| 2026-10-14 | **Código (WEB, sem merge):** `POST /api/auth/forgot-password` envia `X-Tenant-Subdomain` resolvido como os demais calls de tenant (path `/t/:slug` ou host). O login B2B passa esse slug em “Esqueci a senha”. No apex `/login` não há slug, então o header não vai e a frase genérica continua. O portal B2C já enviava o header no reset de Customer. Ship junto com `vlr-api` #100. Sem secrets, sem env. |
| 2026-10-14 | **Código (WEB, sem merge):** no apex `/login`, “Esqueci a senha” pede o identificador da empresa e só então envia `X-Tenant-Subdomain`. Sem consulta de e-mail entre tenants. Empresa desconhecida permanece na mesma frase genérica. |
| 2026-10-14 | **Review (WEB, sem merge):** o reset B2B deixa de comparar o texto inglês da API. Qualquer falha que não seja 5xx vira a frase genérica; 5xx continua erro. Alinhado ao `vlr-api` #100, que passa a responder 200 genérico para tenant desconhecido. |
| 2026-10-14 | **Código (WEB, sem merge):** onboarding público deixa de pedir senha. Sucesso pede para abrir o e-mail de convite; erros `ANONYMOUS_TRIAL_RATE_LIMITED`, `SIGNUP_REJECTED`, `SIGNUP_UNAVAILABLE`, `ANONYMOUS_TRIAL_REQUIRED` e trial já usado viram frases i18n. Pareia com `vlr-api` #111. |
| 2026-10-14 | **Fix (WEB):** validity gate em `/invite` (Definir senha), `/reset-password` (Salvar senha), “Esqueci a senha” no login B2B (só o e-mail; senha vazia não bloqueia) e no pedido de reset B2C. `FormPrimaryButton` + `safeParse` do schema do passo; Voltar/link de saída livres; erro de servidor permanece no formulário. Já estavam gated e ficaram de fora: identificador da empresa no apex e confirmação de senha B2C. “Entrar” no login B2B continua FOLLOWUP. |
| 2026-10-14 | **Fix (WEB):** validity gate em “Entrar” no login B2B (`/login`). `FormPrimaryButton` + `loginSchema.safeParse` em e-mail e senha; “Esqueci a senha” continua só com o e-mail; Voltar livre; erro de servidor permanece no formulário e reabilita o botão. |
| 2026-10-14 | **Fix (WEB):** validity gate em “Entrar” no portal B2C e em “Salvar” no perfil B2C. `FormPrimaryButton` + `safeParse` do schema do passo; “Esqueci a senha”, “Cadastre-se” e “Alterar foto” ficam livres; erro de servidor continua no toast, o formulário mantém os valores e o botão reabilita. Cadastro B2C (formulário único) e verificação de e-mail já usavam `FormPrimaryButton` e ficaram de fora; `/verify-phone` só redireciona para `/verify-email`. |
| 2026-10-14 | **Fix (WEB):** validity gate no onboarding público legado (`/onboarding`). `FormPrimaryButton` + `safeParse` do passo: empresa (razão social, documento, matriz), administrador (nome, e-mail, celular) e revisão (schema completo). Voltar fica livre; erro de servidor permanece na revisão, mantém os valores e reabilita “Criar conta de teste”. |
| 2026-10-14 | **Fix (WEB):** validity gate no AssetWizard (criar, editar e lote). `FormPrimaryButton` + `safeParse` do passo atual: geral, operação, preços e revisão. A revisão exige os passos anteriores; preços só entram quando o recurso é alugável. Voltar fica livre; erro de servidor permanece no diálogo, mantém os valores e reabilita “Concluir”. |
| 2026-10-14 | **Fix (WEB):** validity gate em Criar OS e Novo Plano de Manutenção. `FormPrimaryButton` + `safeParse` do schema do formulário (ativo, data e tarefa; plano com unidade, categoria, agendamento e checklist). Voltar e Cancelar ficam livres; erro de servidor permanece no formulário, mantém os valores e reabilita o botão. |
| 2026-10-14 | **Fix (WEB):** validity gate em tipos de ativo (criar e editar). `FormPrimaryButton` + `safeParse` do schema do diálogo (nome obrigatório; fabricante e descrição opcionais). Cancelar fica livre; erro de servidor permanece no diálogo, mantém os valores e reabilita “Salvar”. Exclusão continua caso especial. |
| 2026-10-14 | **Fix (WEB):** validity gate em Pessoas (convidar usuário, atribuir funções, criar e editar função). `FormPrimaryButton` + `safeParse` do schema do formulário (nome, e-mail e ao menos uma função no convite; ao menos uma função na atribuição; nome da função no criar/editar; permissões seguem o schema e não são obrigatórias). Fechar fica livre; erro de servidor permanece no formulário, mantém os valores e reabilita o botão. E-mail único continua só no servidor. Exclusão de função, busca e clientes do portal ficaram de fora. |
| 2026-10-14 | **Fix (WEB):** validity gate em criar e editar produto do catálogo. `FormPrimaryButton` + `safeParse` do schema do diálogo (nome obrigatório até 200; código até 80; descrição até 4000; moeda com 3 caracteres). Preço segue o schema (texto) e não ganha regra numérica no gate; o envio atual continua recusando preço inválido e aceitando vírgula. Cancelar e Fechar ficam livres; erro de servidor permanece no formulário, mantém os valores e reabilita “Salvar”. Carrinho, solicitação de produto e ativar/desativar ficaram de fora. |
| 2026-10-14 | **Fix (WEB):** validity gate no carrinho B2C (`/catalogo/carrinho`) e em solicitar produto. `FormPrimaryButton` + `safeParse` do schema do passo: observação do pedido até 2000; descrição (obrigatória até 2000), quantidade (inteiro de 1 a 9999, já no schema) e observação até 2000 na solicitação. Voltar, a quantidade do item e os arquivos ficam livres; carrinho vazio continua desabilitando “Enviar pedido” como já fazia. Erro de servidor permanece no toast, mantém os valores e reabilita o botão. Adicionar ao carrinho e cancelar pedido seguem caso especial (sem schema de formulário). |
| 2026-10-14 | **Docs:** ROADMAP marca teacher date-only lessons como código em `develop` (página PR #87; release-blocker PR #90). Permissão da tela: `rentals.schedule.lessons.write` + `rentals.assets.read` + `rentals.schedule.read`, sem `rentals.schedule.write`. Pendente humano: aplicar no DEV `AddRentalsScheduleLessonsWritePermission` e conceder `rentals.schedule.lessons.write` (Rayan). Sem UI, migration, role ou infra neste PR. |
| 2026-10-14 | **Código (WEB):** Super-Admin lista, cria, edita, desativa e exclui famílias globais em `/admin/asset-families` (`GET/POST/PUT/DELETE /api/admin/asset-families`, `?includeInactive=true`). Chave imutável; seeds `spaces`/`electrical`/`goods`/`generic` sem excluir ou desativar. Pareia com `vlr-api` #128. Não havia checkbox desmarcado correspondente neste ROADMAP. |
| 2026-10-14 | **Fix (WEB):** login B2B (`/login`, “Esqueci a senha” e o passo de identificador no apex) e onboarding público legado (`/onboarding`) passam labels, placeholders, botões, validação e o aria-label do stepper para i18n pt-BR/en/es. O texto pt-BR permanece o de hoje. O valor inicial da unidade matriz continua `Matriz` (entra no `POST /api/onboarding/tenants`). `/reset-password` fica de fora. |
| 2026-10-14 | **Fix (WEB):** `/reset-password` passa título, labels, botões, validação e o estado de link inválido para i18n pt-BR/en/es (`auth.resetPassword.*`). O texto pt-BR permanece o de hoje. `/invite` já estava em i18n. ROADMAP do `vlr-api` fora de escopo. |
| 2026-10-14 | **Fix (WEB):** nome do produto nas superfícies Rolvix deixa de ser `Platform`/`frontend` e passa a Rolvix (`app.name` nos três locales, `<title>`, seção de módulos do Super-Admin). |
| 2026-10-14 | **Fix (WEB):** "Voltar à plataforma" sai do ambiente do tenant e abre `/admin/dashboard` mesmo quando o JWT em memória ainda traz `app_metadata.tenant_id` ou o `refreshSession` falha. O `POST /api/admin/tenants/exit` continua obrigatório antes de limpar o estado local. Abrir ambiente e sign-out bem-sucedido desfazem essa saída. |
| 2026-10-14 | **Fix (WEB, sem merge):** a agenda B2C mostra a estimativa (`GET /api/reservations/availability`) antes de reservar, o total em Minhas reservas e o total + status no toast. Espaço com `requiresDeposit` avisa que a reserva nasce aguardando confirmação do clube; não há passo de pagamento. Contrato da API inalterado. |
| 2026-10-14 | **Fix (WEB, #135):** agenda B2C não oferece data anterior a hoje nem horário de hoje já iniciado (`America/Sao_Paulo`); Minhas reservas marca reserva passada (fim ≤ agora) sem Cancelar. Login B2B sem `core.dashboard.read` sai de `/dashboard` para a primeira rota permitida da sidebar. Sem deploy. |
| 2026-10-14 | **Fix (WEB):** tela de aulas do professor. Depois do create, “Aulas nesta data” mantém a aula na data selecionada (`?date=` no reload; refresh do mesmo dia não zera a lista; se o GET omitir o intervalo, a aula recém-criada continua). O horário deixa de mostrar `Invalid input` ao esvaziar. `20:00–21:00` fora da oferta é slot `closed` persistido, não bug de API/fuso. Sem mudança no `vlr-api`. |
| 2026-10-14 | **Fix (WEB):** tela de aulas do professor. A leitura inicial da quadra pré-selecionada e da data (`?date=`) não mostra “Nenhuma aula nesta data.” enquanto o GET do dia está em voo. O horário liberado ao remover volta ordenado pelo início. Remover aula pede confirmação. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #136):** agenda B2C pede confirmação antes de cancelar e explica que esta tela não cobra nem reembolsa, inclusive em reserva já confirmada. “Reservando…” / “Cancelando...” soltam quando o POST termina, com toast de sucesso ou erro; a reserva entra ou sai da lista pela resposta, e o refetch de horários não segura o botão. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Código (WEB):** política de reservas em `/configuracoes/politica-reservas` (`GET`/`PUT /api/rentals/booking-policy`, PUT substitui texto e limite). O cancelamento B2C mostra o texto do tenant como texto puro. 409 `DAILY_BOOKING_LIMIT_REACHED` vira frase traduzida. Conflito de horário avisa que o horário acabou de ser reservado e atualiza a agenda (#146 parcial). Pareia com `vlr-api` #174. |
| 2026-10-15 | **Fix (WEB, #138):** 401 B2B com bearer chama `refreshSession` uma vez e repete o request se voltar um access token. Falha de rede/5xx ou erro terminal de auth não chama `signOut`. 401 B2C repete uma vez e só então limpa a sessão do portal e volta ao login. `AuthContext` zera o usuário em `SIGNED_OUT` e na sessão inicial vazia; outro evento com sessão nula mantém o usuário. Log estruturado sem segredo. Sem mudança no `vlr-api`. Follow-up: `CustomerJwtSessionValidator` deve responder 500 numa exceção inesperada, não Fail("Session expired."). |
| 2026-10-15 | **Fix (WEB, #138):** o retry do 401 fica no principal que falhou. B2C só repete se `rolvix.customer.token` ainda é o bearer do 401; no segundo 401 limpa o storage, inclusive `rolvix.customer.id`, só se o token guardado ainda for esse bearer. B2B chama `refreshSession({ refresh_token })` desse usuário e descarta o retry se houve `signOut` ou o usuário mudou. Erro terminal do GoTrue (400/401, `refresh_token_not_found`, invalid grant) faz `signOut({ scope: 'local' })`; rede e 5xx não. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #179 e):** a agenda B2C lê `?reservation=` do e-mail (`vlr-api` #178). Destaca e rola até a reserva quando ela está em Minhas reservas e não está cancelada. Id ausente, malformado, alheio ou cancelado não altera a agenda e não aparece na tela. Sem contrato de API. Itens (a)–(d) permanecem no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #137):** no portal B2C deslogado (login, cadastro, esqueci a senha) o seletor de idioma troca o texto na hora e grava a escolha, como no app logado. O rótulo padrão "Reservar horário" segue o idioma no menu, no cabeçalho e no h2; nome de recurso digitado pelo tenant permanece como foi salvo. Datas e valores do portal passam por helpers de locale (`Intl`) com a moeda informada. O seletor mostra Português, English e Español. |
| 2026-10-15 | **Fix (WEB, #146 #132):** conflito de reserva solta o botão quando o POST responde, explica que o horário acabou de ser reservado e refaz o dia sem esperar o refetch. Espaço cinza mostra “Horário indisponível.” ou “Horário já reservado.” no próprio card. Disponível usa o mesmo verde no mapa, na seleção e fora do mapa. Legenda “Indisponível” em `text-foreground`. `/t/{tenant}` com sessão desse tenant vai ao portal; outro tenant não. Sem mudança no `vlr-api`. O ~8s até o 409 é o tempo do POST no servidor (o perdedor espera o `FOR UPDATE` do recurso até o commit do vencedor, que ainda publica a notificação; `EnsureReadyAsync` serializa antes, com advisory lock). Não há retry de 409 no cliente. Não medido nesta máquina. |
| 2026-10-15 | **Fix (WEB, #146 #132):** “Horário já reservado.” fica só para o 409 de intervalo já reservado, para a reserva deste navegador, ou para um `reservationId` que está em Minhas reservas. `booked` ou id de outra reserva mostra “Horário indisponível.”. 409 “Slot is not available for booking.” e “Insufficient quantity” continuam no toast e não marcam o card como reservado. Cancelar remove a marca local. `tenantPortalPath` / `tenantPortalHref` só interpolam slug `[a-z0-9-]+`. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #142):** menu mobile do cliente logado lista Reservar horário, Minhas reservas e Perfil nas rotas que já existiam. Ícones do header do portal têm alvo de 44px; o seletor mostra PT/EN/ES. O celular no perfil aparece com máscara brasileira e o valor enviado à API não muda. “Enviar código” habilita quando o e-mail é colado ou preenchido pelo navegador. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #149):** o 401 do staff só chama `refreshSession` se, depois da espera, a época, o usuário e o refresh token guardado ainda são os do request. Se mudaram, repete com o access token atual ou desiste, sem refresh. Erro terminal faz `signOut({ scope: 'local' })` só se esse refresh token ainda está guardado. `signInWithPassword` avança a época antes da chamada. Portal B2C sem mudança. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #166):** cadastro mascara o celular (BR / E.164) com placeholder i18n; o envio continua em dígitos. Perfil mostra CPF e celular mascarados, com botão para revelar. A foto obrigatória do FICC fica em `extraAttributes.fotoDePerfil` (a API só copia para `photoUrl` as chaves `photo` e `photoUrl`); o perfil lê esse atributo. Sem log de documento, telefone ou foto. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #164 #160):** a agenda B2C deixa de guardar o horário reservado num ref local. O card “Horário já reservado.” deriva das reservas bloqueantes do cliente e do `reservationId` do dia, com chave `data + recurso + início`. Cancelar rebusca os slots do dia cancelado e do dia visto; se o refetch falha, tenta de novo uma vez e só então mostra o erro. Trocar o idioma não dispara outro GET do dia. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #165):** recurso com fila mostra por que a reserva pede ticket. Com a fase Open e ninguém à frente, um único “Entrar na fila e reservar” entra e reserva se o ticket ficar Active. Sala de espera, espera, vez, expirado e fechado continuam nas suas ações. Sem fila, nada disso aparece. Sem mudança no `vlr-api`. |
| 2026-10-15 | **Fix (WEB, #168):** menu do staff filtra cada item pelas permissões que ele declara. Recursos exige `rentals.assets.read` e `core.units.read`. Professor sem unidades não vê o item e não cai nele ao sair de `/dashboard`; a troca de página mostra um aviso. Cabeçalho mostra `tenantTradeName` (ou `tenantLegalName`) quando `GET /api/users/me` enviar. `?date=` passada na tela de aulas avisa que os horários são de hoje. `FORBIDDEN` na carga de Recursos vira frase traduzida. O DTO atual de `/me` no `vlr-api` ainda não traz o nome do tenant. |
| 2026-10-15 | **Fix (WEB, #187 #180):** a reserva B2C rebusca a lista e os horários quando o POST termina, mesmo se a página saiu no meio de “Reservando…”. Repetir o horário que esta pessoa acabou de reservar aponta para Minhas reservas, em vez de dizer que outra pessoa pegou. No dia de hoje, portal e aulas ocultam slot cujo início já passou no fuso `America/Sao_Paulo`. Sem mudança de auth/tenant. O servidor continua a autoridade (`vlr-api` #184). |
| 2026-10-15 | **Fix (WEB, #183 #188 #167 #185 #184):** “Reservar horário” desabilita enquanto a estimativa carrega. Login/cadastro com sessão fazem `replace` para o app antes do chrome público (Back e aba nova). `formatLocaleCurrency` usa o símbolo da moeda do tenant em pt-BR, en e es (`R$`, não `BRL`). Trocar o idioma não rebusca a agenda nem zera data, horário e recurso. `/configuracoes/recursos` só monta a sidebar depois da permissão; sem ela, Acesso negado sem o skeleton antigo. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, #194 #181 #169 #186 #176):** notificações explicam que o e-mail ao cliente começa ligado e o interruptor segue a API. 409 de horário ocupado rebusca Minhas reservas e, se for desta pessoa, o toast leva até essa lista. Cancelar sem política mostra nota neutra. Cards do mapa seguem a ordem visual. Staff tem `/perfil`; URL autenticada desconhecida não vai para a home pública. Telefone do staff continua fora: a API não devolve nem grava `phone` em `/api/users/me`. |
| 2026-10-16 | **Fix (WEB, #170):** a agenda B2C rebusca Minhas reservas e o dia visto quando a janela ganha foco ou a aba volta a ficar visível, no máximo uma vez a cada 2s, sem intervalo. Se a grade atualizada mostra o horário ocupado, Reservar fica desabilitado. “Horário indisponível.”, “Horário já reservado.” e o toast de conflito passam a “Este horário já está reservado.” (en/es equivalentes). Se a reserva já é desta pessoa, o toast continua com o link para Minhas reservas. Cancelar uma reserva que a lista já mostra como cancelada avisa “Esta reserva já estava cancelada.” e não mostra sucesso. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, #177):** aulas do professor. Enquanto os espaços carregam, o campo e o estado mostram “Carregando os espaços...” e não “Carregando as aulas desta data.”. Assim que a lista chega, o primeiro espaço aparece selecionado e habilitado, e só então carregam as aulas do dia. O redirect de `/dashboard` e abrir `/configuracoes/agenda` direto terminam iguais. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, #196):** em `/verify-email`, Reenviar código mostra toast e um estado na tela (enviado ou falha, inclusive limite). O texto fixo diz que um novo código substitui o anterior. A espera de 45s só começa depois do sucesso. pt-BR/en/es. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, #205 #197 #199 #201 #198 #202):** o cancelamento da agenda junta a lista e solta o horário quando a reserva aparece cancelada. O idioma escolhido sobrevive ao logout no mesmo navegador. Data e horário da agenda ficam na URL. Uma aula removida não volta por um GET antigo nesta aba. EN usa “Book a time” no título e no botão. O login usa `name@example.com`. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, #180 #187 #189):** no dia de hoje a grade do dia não oferece início já passado (`America/Sao_Paulo`); portal e aulas já ocultavam. Voltar durante “Reservando…” mantém a reserva na lista e o horário ocupado mesmo com um GET vazio, sem segundo POST. O seletor B2C limita a data ao horizonte (`maxAdvanceBookingDays` / `effectiveMaxAdvanceBookingDays`); `booking_horizon_exceeded` vira frase traduzida. O PUT da política continua sem o horizonte. Sem auth, sem env, sem deploy. |
| 2026-10-16 | **Fix (WEB, #200):** na tela de aulas, “Horário disponível” vazio deixa de parecer um campo em branco. A data civil (ex.: sábado 2026-10-24) segue no `GET /api/schedule/days/{date}`; não há deslocamento de dia da semana nem de fuso. O corpo é só `{ date, slots }`. Sem slots: “Nenhum horário configurado para este dia da semana” e o nome da Configuração semanal. Slots só `closed`: “Este recurso está fechado nesta data.” Falha do GET: alerta e “Tentar novamente”. Enquanto o GET corre: “Carregando os horários deste recurso.” Intervalos que existem mas não estão abertos (aula ou reserva) têm frase própria. pt-BR, en e es. Sem mudança no `vlr-api`. |
| 2026-10-16 | **Código (WEB, #217):** `/configuracoes/politica-reservas` e a ficha do recurso passam a gravar `maxAdvanceBookingDays`. Na política, o campo só vai no PUT quando muda (`null` ilimitado, número 0..3650, omitido conserva). No recurso, padrão do ambiente omite ou apaga com `null`, ilimitado envia `null`, N dias envia o número; a ficha mostra o horizonte em vigor. Sem permissão de escrita os controles ficam desabilitados. Sem mudança de auth. |
| 2026-10-16 | **Fix (WEB, #208 #207 #210):** total e estimativa seguem o idioma ativo e a moeda do tenant (BRL: pt-BR `R$ 80,00`, en `R$ 80.00`, es `80,00 R$`, o mesmo formatador das outras superfícies). Aula recriada com outro id deixa de ficar oculta. Cancelar com revisão da agenda à frente avisa que já estava cancelada. Voltar restaura data e horário; data civil impossível não vai ao GET. A grade do dia fecha o início que passa com a página aberta. `?date=` além do horizonte espera a política. Sem auth, sem env, sem deploy, sem mudança no `vlr-api`. |
| 2026-10-16 | **Fix (WEB, review #211):** clamp de data além do horizonte faz replace na history, inclusive com `time` na URL, então Voltar não fica preso no deep link. Trocar o dia enquanto a política ou o GET do dia ainda não voltou limpa a grade e a seleção e desabilita Reservar. A grade do staff usa o relógio do minuto dentro do memo. Sem auth, sem mudança no `vlr-api`. |
| 2026-10-17 | **Fix (WEB):** planos de manutenção pedem confirmação antes de excluir (ordens já geradas mantêm o snapshot; plano com ordens não exclui e oferece desativar), editam nome e descrição no cabeçalho, editam opções de escolha única e unidade/mínimo/máximo de número, mostram o motivo quando Salvar está desabilitado, confirmam a remoção de tarefa, geram ordem com toast e link, escondem Gerar OS em plano inativo, traduzem “Maintenance plan is not active.”, avisam quando não há técnico, abrem o plano recém-criado e ordenam as ordens relacionadas pela data agendada. Sem mudança de contrato no `vlr-api` (`PUT /api/maintenance-plans/{id}` já aceita nome e descrição). |
| 2026-10-17 | **Fix (WEB):** QA de execução de OS, fila offline, catálogo e recursos. Lista de escolha nativa; imagem sem upload não bloqueia o cliente; Finalizar dispara o debounce; banner offline, “aguardando sincronizar”, conflito 4xx e sync no evento `online`; Executar é link; criar OS abre a OS; observações, data de conclusão, tarefas a partir de 1 e aba Canceladas; erros por código/mensagem. Catálogo: código duplicado, arquivo, Sim/Não, erro de upload na tela, confirmação ao desativar, aviso de produto inativo. Recursos: tag duplicada, exclusão com OS, tipo em uso, toasts, plural de exclusão agendada, Gerar OS omite recurso com exclusão agendada quando o campo vier. Dashboard sem `{subdomínio}`. Sem mudança no `vlr-api`: a API ainda não recebe arquivo de tarefa, não cancela exclusão agendada e o picker de OS ainda não envia `scheduledDeletionAt`. |
| 2026-10-17 | **Fix (WEB):** erros alinhados aos códigos do `vlr-api` #219: `ASSET_TAG_DUPLICATE`, `ASSET_IN_USE`, `CATEGORY_IN_USE`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_CONTENT_MISMATCH`, `MANDATORY_TASKS_INCOMPLETE`, `DUPLICATE_WORK_ORDER`, `ASSIGNEE_CANNOT_EXECUTE`, `WORK_ORDER_CLOSED`, `INVALID_TASK_VALUE` (campo `reason`) e `WORK_ORDER_REOPEN_NOT_ALLOWED`. Recurso inelegível segue a frase da API, que não envia código. O conflito da fila offline mostra o campo e o motivo, com descartar e tentar de novo; `WORK_ORDER_CLOSED` pode ser descartado. |
| 2026-10-17 | **Fix (WEB):** o banner Modo Offline permanece até uma resposta HTTP com o navegador online (evento `online` sozinho não esconde; falha de rede mostra mesmo com `navigator.onLine`). Conflito 409/400 da fila aparece mesmo quando o GET da OS falha, sem apagar o texto digitado. “Aguardando sincronizar” sai quando o PATCH entra. Exclusão permanente de recurso com OS (`ASSET_IN_USE`) mostra a frase e mantém a linha. Sem mudança no `vlr-api`. |
| 2026-10-17 | **Fix (WEB):** o PATCH direto de uma tarefa grava o valor novo na fila antes do envio, substituindo o campo numa única escrita e com `clientSequence` maior. Rede e 5xx deixam esse valor na fila; 4xx vai para o conflito e o erro sobe; sucesso remove só essa versão e limpa o conflito. Sem mudança no `vlr-api`. |
| 2026-10-17 | **Fix (WEB):** PATCH de tarefa com HTTP 2xx e corpo que não passa no schema sai da fila (o flush seguinte não reenvia o valor já aplicado) e a tela ainda mostra resposta inválida. Uma versão mais nova na fila apaga o conflito antigo daquele campo; Tentar de novo não grava o valor rejeitado por cima dela. Um 4xx direto avisa o banner na hora. Sem mudança no `vlr-api`. |
| 2026-10-18 | **Fix (WEB):** agenda B2C explica o horizonte ao lado da data, avisa no campo quando a data fica fora do intervalo, não pinta os espaços como reservados enquanto o dia carrega, mantém a data da URL depois de cancelar, e o calendário usa o idioma da tela. Sem mudança no `vlr-api`. |
| 2026-10-18 | **Fix (WEB):** data digitada além do horizonte da agenda B2C cai no último dia reservável e usa a frase do calendário, sem “já está reservado” em todos os espaços. Sair de `#minhas-reservas` recarrega os horários; o menu não apaga `date` nem `time`. Sem mudança no `vlr-api`. |
| 2026-10-18 | **Fix (WEB):** Tentar de novo na fila offline não substitui um valor já enfileirado para o mesmo campo, mesmo se o conflito guardou um `clientSequence` maior depois de recarregar a aba. Na agenda B2C, Voltar para um dia válido limpa o aviso e o `aria-invalid` do campo de data. Sem mudança no `vlr-api`. |
| 2026-10-18 | **Fix (WEB):** carrinho B2C mostra subtotal da linha e total (soma dos itens com preço; linha sem preço “Sob consulta”; total misto “A partir de”). Remover é um botão; quantidade 0 ou negativa fica em 1 e o teto é 99. Cancelar pedido pede confirmação. Lista e detalhe de pedido com total nulo mostram a soma conhecida mais “Sob consulta”. `/catalogo/solicitar` confirma na tela com link ao catálogo — a API do cliente não lista solicitações. es usa agrupamento (`1.500,00 R$`). EN do portal usa “Canceled”. Sem mudança no `vlr-api`. |
| 2026-10-18 | **Fix (WEB):** a quantidade do catálogo guarda o texto digitado, inclusive vazio, e só limita a 1–99 ao sair do campo. O nome do produto entra no rótulo do campo. Mais, menos e Adicionar usam esse valor. Confirmar o cancelamento do pedido não dispara um segundo POST enquanto o primeiro ainda não voltou. O teste da agenda do professor espera o nome da quadra. |
| 2026-10-18 | **Código (WEB):** portal B2C lista e abre as próprias solicitações de produto (`GET /api/catalog/portal/product-requests` paginado, mais novo primeiro, e `GET .../{id}`). Menu do catálogo, o catálogo e a confirmação do envio levam a Minhas solicitações. 404/501 da lista é indisponível, não a caixa vazia, até o `vlr-api` #224 entrar. Status conhecidos em pt-BR/en/es; status desconhecido permanece o texto da API. Sem lógica de um tenant. |
| 2026-10-18 | **Fix (WEB):** Bens deixa de mostrar `FORBIDDEN` cru quando tipos, unidades ou famílias são negados e esconde criar/editar/excluir sem a permissão de escrita. O detalhe da OS reatribui o técnico com `PUT /api/work-orders/{id}/assignee` (`os.work_orders.assign`); sem a lista de técnicos a OS continua visível. 403/404 na lista e no detalhe dizem que não há permissão ou a OS não está atribuída. Sem mudança no `vlr-api`. |

### Auditoria de formulários (2026-09-01) — FOLLOWUP fora do wizard/edit

| Superfície | Classificação |
|---|---|
| Wizard empresa / TenantEditForm | VALIDITY_GATE_APPLICABLE (**este PR**) |
| Login B2B (Entrar) | gated 2026-10-14 (`fix/form-validity-b2b-entrar`) — e-mail e senha válidos |
| B2B “Esqueci a senha” | gated 2026-10-14 (`fix/form-validity-invite-reset`) — e-mail válido; senha não entra no gate |
| Apex identificador da empresa | já usava `FormPrimaryButton` (skipped) |
| `/reset-password` | gated 2026-10-14 |
| `/invite` set-password | gated 2026-10-14 |
| B2C password-reset request | gated 2026-10-14 |
| B2C password-reset confirm | já usava `FormPrimaryButton` (skipped) |
| Portal login | gated 2026-10-14 (`fix/form-validity-b2c-portal`) — e-mail e senha válidos |
| Portal register | já usava `FormPrimaryButton` (skipped) — formulário único |
| Portal verify | já usava `FormPrimaryButton` (skipped) — código de 6 dígitos; `/verify-phone` redireciona; reenvio livre |
| Portal profile | gated 2026-10-14 (`fix/form-validity-b2c-portal`) — nome válido |
| OnboardingPage (legado) | gated 2026-10-14 (`fix/form-validity-onboarding-page`) — empresa, administrador e revisão |
| AssetWizard | gated 2026-10-14 (`fix/form-validity-asset-wizard`) — geral, operação, preços e revisão |
| CreateWorkOrder / CreatePlan | gated 2026-10-14 (`fix/form-validity-workorder-plan`) — schema do formulário |
| AssetCategories | gated 2026-10-14 (`fix/form-validity-asset-categories`) — nome obrigatório no criar/editar |
| People users / roles | gated 2026-10-14 (`fix/form-validity-people-users-roles`) — convite, atribuição e criar/editar função; e-mail único = SERVER_VALIDATION_ONLY; exclusão = SPECIAL_CASE |
| Catalog product form / cart / product request | Product create/edit: gated 2026-10-14 (`fix/form-validity-catalog-product`) — schema do diálogo; preço numérico fica no envio; código/nome duplicado = SERVER_VALIDATION_ONLY. Cart + product request: gated 2026-10-14 (`fix/form-validity-b2c-cart-product-request`) — observação do pedido; descrição, quantidade e observação da solicitação. Carrinho vazio continua no `disabled` já existente. Adicionar ao carrinho e cancelar pedido = SPECIAL_CASE (sem schema). Ativar/desativar produto = SPECIAL_CASE. |
| Reservations confirm / cancel | SPECIAL_CASE |
| Delete dialogs | SPECIAL_CASE |
| Credenciais erradas / unicidade / provider externo | SERVER_VALIDATION_ONLY |
