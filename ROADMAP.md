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
- [x] Teacher date-only lessons (FICC pilot) em `develop`: `src/features/rentals/pages/TeacherLessonsPage.tsx` e `src/features/rentals/hooks/useTeacherLessons.ts` (página no PR #87; correção de release no PR #90, https://github.com/RayanRackii/vlr-web/pull/90, merge `64657ea`). A tela só cria/remove aula na data e na quadra SlotGrid selecionadas. Slot `Available` com `reservationId` não entra na oferta nem na remoção, e o toast de sucesso exige o corpo esperado (aula sem reserva no create, open sem reserva no remove). Agenda admin permanece em `rentals.schedule.write`. Modelo de permissão da tela de professor: `rentals.schedule.lessons.write` + `rentals.assets.read` + `rentals.schedule.read`, sem `rentals.schedule.write`. Rota `/configuracoes/agenda` e o nav continuam em `rentals.schedule.read`. API já mergeada (`vlr-api` #92 / #95 / #126). A aula criada permanece em “Aulas nesta data” na data selecionada (`?date=` sobrevive ao reload; o refresh do mesmo dia não apaga a lista). O horário esvaziado depois do create não mostra `Invalid input`. Um slot persistido `closed` (no DEV, Quadra 1 `20:00–21:00` em 2026-10-15, “Reserva manual (M6)”) sai da oferta de horário; não é fuso nem buraco de template. `GET /api/schedule/days/{date}` admin já devolve a aula não reservável. Pendente humano, fora deste PR: aplicar no DEV a migration `AddRentalsScheduleLessonsWritePermission` e conceder explicitamente `rentals.schedule.lessons.write` (Rayan).

### 3.7. Cancelamento B2C pelo cliente

Spec: `vlr-api/docs/plans/active/2026-09-07-rentals-b2c-self-cancel.md`. Branch `feat/rentals-b2c-self-cancel`. API already on `develop` (`89b3e6d` / PR #64). Wave 1 remains **PROD_COMPLETE**.

- [x] `cancelMyPortalReservation` via `POST /api/reservations/mine/{id}/cancel` (`customerApi` + Zod)
- [x] Minhas reservas: Cancelar em `PendingDeposit`|`Confirmed` com start futuro; sem diálogo; sem Complete B2C
- [x] Vitest: helper + service + agenda page
- [x] Playwright `e2e/tests/10-b2c-self-cancel.spec.ts` (DEV; Confirmed path passed against Railway + develop Preview)
- [x] **CLOSED_DEV** — not PROD. API `89b3e6d` / PR #64; WEB `3478355` / PR #59. Wave 1 remains **PROD_COMPLETE**.

### 3.6. Fila de reservas (WaitingQueue)

Spec: `vlr-api/docs/plans/active/2026-08-22-reservation-waiting-queue.md`. Branch `feat/reservation-waiting-queue`. Feature-detect `queueEnabled === true`.

- [x] Admin wizard Operação (Location): toggle fila (default off) + horário de abertura; persistir em create/update/bulk
- [x] B2C agenda: poll GET queue 4s (pausa se a aba estiver oculta); Closed / WaitingRoom / Waiting / Active 90s / Expired
- [x] Reserva continua em `bookPortalSlot` / `createPortalReservation`; 409 `QUEUE_*` muda o estado da fila
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

## 4.11. PMOC / OS — FEITO (PROD)

Phases 1–3 are **COMPLETE / RELEASED PROD**. Phase 4 is **NOT PLANNED**. Canonical spec: `vlr-api/docs/plans/active/2026-09-19-pmoc-os-phase3.md`. WEB release merge `254bd333ef2b2c3b4f798ef6327091f85890fd36` (PR #85).

Historical Slice 5 note below. Spec: `vlr-api/docs/plans/active/2026-09-18-pmoc-os-phase1.md`. Branch `feat/pmoc-os-phase1-web-library-detail`.

- [x] Rotas estáticas `/pmoc/biblioteca`, `/pmoc/biblioteca/:templateId`, `/pmoc/:id` (depois de `/pmoc/novo`)
- [x] Nav: Meus PMOCs, Biblioteca Rolvix (`pmoc.templates.read`), Novo personalizado
- [x] Biblioteca + preview + Usar modelo (`POST /api/maintenance-plans/from-template`)
- [x] Detalhe empilhado: origem, ativo, auto-gerar, checklist replace-set; delete 409 `PLAN_IN_USE` → desativar
- [x] `/pmoc/novo` só personalizado (sem import client-side / CREA)
- [x] Gerar OS, OS relacionadas, and Coverage V3 shipped in later slices and are on PROD. This checkbox is closed; it is not open work.

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
