# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e o `ROADMAP.md` do repo irmão **`vlr-api`**.

**Foco de produto agora:** portal B2C estável + **agenda por Slot** (APIs no `vlr-api`; UX aqui).  
**Adiado:** OTP/WhatsApp real E2E até config Meta/Resend.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `ROADMAP.md` do **`vlr-api`**.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).
4. Entregas relevantes de produto/incidentes também atualizam o diário canônico em `vlr-api/docs/sessions/` (um consolidado por data ou período; não duplicar no frontend).
5. Ordem de leitura do agente: `AGENTS.md` → `CONTEXT.md` → este arquivo → `.cursor/rules/`.

## 1. Registro dinâmico por tenant — FEITO (código)

- [x] `/register` dinâmico + UI admin de campos.
- [ ] Confirmar migration + deploy FE/BE.

## 2. Shell B2C + menu multi-item — FEITO (código)

- [x] `AppShell` compartilhado com B2B `MainLayout`.
- [x] Pós-login: `CustomerAppLayout` com sidebar dos itens de `GET .../menu`.
- [x] Login/register/verify permanecem no card branded (`TenantPortalLayout`).
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

## 3. Portal branding / host

- [x] Host `{subdomain}.rolvix.com.br` + path `/t/:subdomain`.
- [x] Marca via **`LogoSvg`** (admin textarea + `TenantLogoMark` + DOMPurify); sem `logoUrl` no produto.
- [ ] Confirmar DNS/Vercel wildcard `*.rolvix.com.br`.
- [ ] Aplicar migration `AddTenantLogoSvg` no Supabase (`logo_svg` text).

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

### 3.6. Fila de reservas (WaitingQueue)

Spec: `vlr-api/docs/plans/active/2026-08-22-reservation-waiting-queue.md`. Branch `feat/reservation-waiting-queue`. Feature-detect `queueEnabled === true`.

- [x] Admin wizard Operação (Location): toggle fila (default off) + horário de abertura; persistir em create/update/bulk
- [x] B2C agenda: poll GET queue 4s (pausa se a aba estiver oculta); Closed / WaitingRoom / Waiting / Active 90s / Expired
- [x] Reserva continua em `bookPortalSlot` / `createPortalReservation`; 409 `QUEUE_*` muda o estado da fila
- [ ] Validar E2E com a API na mesma branch (merge API first)

## 4. Gating B2B por módulos

- [x] Sidebar B2B em seções (Visão geral / Pessoas & portal / Operação) filtrada por `activeModules`.
- [x] Skeleton shimmer na sidebar enquanto `activeModules` carrega (mantém Visão geral visível).
- [x] `PermissionRoute` nas rotas de produto (módulo **e** permissão) + página **Pessoas e acesso** (`/pessoas-e-acesso`) com usuários e funções.
- [ ] Enforcement API 403 para módulos inativos (ver `vlr-api`).

## 4.5. UX de Ativos (fundação)

- [x] Nav Recursos / Tipos; empty state guia criar tipos primeiro.
- [x] Copy por tom de módulo (`rentals` | `maintenance` | `generic`) via `useAssetCopyTone`.
- [x] Famílias no wizard/edit tenant + formulários dinâmicos por `fieldSchema`.
- [x] Copy preferindo famílias ativas do tenant (`spaces` / `goods` / `electrical` …).
- [x] Wizard: “É necessário pagamento prévio?” (`requiresDeposit` / `RequiresDeposit`) em todo rentable.
- [x] Wizard: passo Operação; preços por preset (todos os dias / fim de semana / por dia); estado preservado entre passos
- [x] Wizard Location: “Fila de reservas” + horário de abertura (`queueEnabled` / `queueOpeningTime`); oculto para Good
- [x] F-16: lote — tipo Location gera N recursos numerados; tipo Good gera um recurso com quantidade em estoque (sem toggle extra)
- [ ] Considerar `inventory` sempre ativo no create de tenant (follow-up).

## 5. Fluxo de convite B2B

- [x] Wizard + edit tenant: convidar admin (sem senha)
- [x] `submitInvitePassword` → `POST /api/invites/accept`
- [x] Super-Admin `/admin/users` — lista global com filtro nome/tenant + exclusão
- [x] Modo suporte: Abrir ambiente = login real (membership + `tenant_id` JWT); Voltar limpa metadata
- [x] Esqueci a senha → `POST /api/auth/forgot-password` (e-mail Rolvix/Resend); `/reset-password` inalterado
- [ ] Onboarding público ainda coleta senha (legado)

## Dívidas técnicas conhecidas

- Branding inconsistente (`Platform` vs Rolvix).
- Login/Onboarding B2B com strings hardcoded.
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
| 2026-08-27 | **Executado (código):** Tenant RBAC v1 no B2B — `GET /users/me` com `roles[]`/`permissions[]`, `usePermissions`/`Can`/`PermissionRoute`, nav por módulo+permissão, página **Pessoas e acesso**, funções Admin/User/personalizada. Vitest adicionado (`npm run test`). Dashboard mantém branching legado por `role`. |
