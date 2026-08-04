# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e `backend/ROADMAP.md`.

**Foco de produto agora:** **shell B2C compartilhado** (sidebar) + menu dinâmico do tenant.  
**Adiado:** OTP/WhatsApp real E2E até config Meta/Resend.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `backend/vlr-api/ROADMAP.md`.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).

## 1. Registro dinâmico por tenant — FEITO (código)

- [x] `/register` dinâmico + UI admin de campos.
- [ ] Confirmar migration + deploy FE/BE.

## 2. Shell B2C + menu multi-item — FEITO (código)

- [x] `AppShell` compartilhado com B2B `MainLayout`.
- [x] Pós-login: `CustomerAppLayout` com sidebar dos itens de `GET .../menu`.
- [x] Login/register/verify permanecem no card branded (`TenantPortalLayout`).
- [x] Agenda em `agenda/:menuItemId` com asset pré-selecionado quando configurado.
- [x] Admin: `/configuracoes/menu` + seção no edit de tenant (platform).
- [ ] UX de calendário/slots (hoje: data + hora manual).
- [ ] Admin B2B de reservas.

## 3. Portal branding / host

- [x] Host `{subdomain}.rolvix.com.br` + path `/t/:subdomain`.
- [x] Marca via **`LogoSvg`** (admin textarea + `TenantLogoMark` + DOMPurify); sem `logoUrl` no produto.
- [ ] Confirmar DNS/Vercel wildcard `*.rolvix.com.br`.
- [ ] Aplicar migration `AddTenantLogoSvg` no Supabase (`logo_svg` text).

## 3.5. Agenda por Slots (Rentals genérico)

Backend API pronta (ver `backend/ROADMAP` §2.6). Frontend:

- [ ] Admin: occupancy kinds + weekly templates + publish/edit day
- [ ] B2C agenda: listar slots do dia / book por `slotId` (em vez de hora manual)
- [ ] Layout canvas (mapa de rentables) admin + picker B2C

## 4. Gating B2B por módulos

- [ ] Sidebar B2B filtrada por `tenant_modules` + `ModuleGuard`.

## 5. Fluxo de convite B2B

- [ ] `submitInvitePassword` ainda stub.

## Dívidas técnicas conhecidas

- Branding inconsistente (`Platform` vs Rolvix).
- Login/Onboarding B2B com strings hardcoded.
- Landing anuncia módulos futuros.
- Ver `docs/code-hygiene-findings.md` (sweep 2026-08-04).

## Histórico

| Data | Mudança |
|------|---------|
| 2026-08-03 | Portal + registro dinâmico. |
| 2026-08-04 | Agenda B2C inicial. |
| 2026-08-04 | **Executado:** shell B2C (AppShell) + menu dinâmico multi-item; admin de menu. |
| 2026-08-04 | Header Rolvix no portal B2C (sem Features/Pricing); default idioma pt-BR no portal. |
| 2026-08-04 | **Executado:** branding `LogoSvg` (admin + portal sanitizado); `getTenantBaseDomain` unificado em `lib/tenantDomain`. |
| 2026-08-04 | Agenda slots: backend iniciado; FE admin/B2C slot UX + layout canvas pendentes. |
