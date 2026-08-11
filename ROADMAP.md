# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e o `ROADMAP.md` do repo irmão **`vlr-api`**.

**Foco de produto agora:** portal B2C estável + **agenda por Slot** (APIs no `vlr-api`; UX aqui).  
**Adiado:** OTP/WhatsApp real E2E até config Meta/Resend.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `ROADMAP.md` do **`vlr-api`**.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).
4. Ordem de leitura do agente: `AGENTS.md` → `CONTEXT.md` → este arquivo → `.cursor/rules/`.

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

## 3. Portal branding / host

- [x] Host `{subdomain}.rolvix.com.br` + path `/t/:subdomain`.
- [x] Marca via **`LogoSvg`** (admin textarea + `TenantLogoMark` + DOMPurify); sem `logoUrl` no produto.
- [ ] Confirmar DNS/Vercel wildcard `*.rolvix.com.br`.
- [ ] Aplicar migration `AddTenantLogoSvg` no Supabase (`logo_svg` text).

## 3.5. Agenda por Slots (Rentals genérico)

Backend API pronta (ver `vlr-api` `ROADMAP` §2.6 + ADR slots). Frontend:

- [x] Admin mínimo: seed grade horária + publish/edit day list (`/configuracoes/agenda`)
- [x] Admin completo: occupancy kinds CRUD + weekly template editor fino
- [x] B2C agenda: listar slots do dia / book por `slotId` (em vez de hora manual no SlotGrid)
- [x] UX admin Escala/Agenda: abas Agenda diária / Templates / Tipos + Sheet forms + timeline de slots
- [x] Política OpenHours na Agenda diária + seed SlotGrid via `POST .../templates/seed-default` (1 request)
- [ ] Layout canvas (mapa de rentables) admin + picker B2C

## 4. Gating B2B por módulos

- [x] Sidebar B2B em seções (Visão geral / Pessoas & portal / Operação) filtrada por `activeModules`.
- [ ] `ModuleGuard` nas rotas + listagem de Users B2B do tenant em **Pessoas & portal**.
- [ ] Enforcement API 403 para módulos inativos (ver `vlr-api`).

## 4.5. UX de Ativos (fundação)

- [x] Nav Recursos / Tipos; empty state guia criar tipos primeiro.
- [x] Copy por tom de módulo (`rentals` | `maintenance` | `generic`) via `useAssetCopyTone`.
- [x] Famílias no wizard/edit tenant + formulários dinâmicos por `fieldSchema`.
- [x] Copy preferindo famílias ativas do tenant (`spaces` / `goods` / `electrical` …).
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
