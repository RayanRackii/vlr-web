# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e `backend/ROADMAP.md`.

**Foco de produto agora:** **agenda B2C** no portal do tenant.  
**Adiado:** OTP/WhatsApp real E2E até config Meta/Resend.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `backend/vlr-api/ROADMAP.md`.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).

## 1. Registro dinâmico por tenant — FEITO (código)

Decisões (2026-08-03):
- Quem configura: **superadmin (platform)** e **admin do clube (tenant)**.
- Ir **direto** ao formulário dinâmico (sem versão fixa intermediária).
- Campos mínimos fixos (auth): **nome, e-mail, senha, celular**.
- Extras (CPF, CEP, foto, “tem bagagem”, etc.) vêm do **schema do tenant**; FICC = caso de uso opcional.
- Extras **não** precisam ser filtráveis; índice de listagem = **nome**.

- [x] Tela `/register` no host do tenant monta campos a partir de `GET .../registration-schema`.
- [x] UI admin (platform em editar tenant + tenant em `/configuracoes/cadastro`) para CRUD dos campos extras.
- [ ] Confirmar migration aplicada no Railway + deploy FE/BE (seed FICC cpf/cep/photo vem da migration BE).

## 2. Agenda B2C — EM ANDAMENTO

- [x] Rota `agenda` no host do tenant e em `/t/:subdomain/agenda`.
- [x] Listar assets públicos, checar disponibilidade, criar reserva, listar minhas reservas.
- [x] CTA “Abrir agenda” na home autenticada.
- [ ] UX de calendário/slots (hoje: data + hora manual).
- [ ] Admin B2B de reservas.

## 3. Portal do tenant — login + shell branded

- [x] Rotas `/t/:subdomain` e host `{subdomain}.rolvix.com.br` → login branded.
- [x] Shell branding (logo/cores/tagline).
- [x] Login e-mail/senha + verify-phone.
- [x] Campos de branding no wizard/edit admin.
- [ ] Confirmar DNS/Vercel wildcard `*.rolvix.com.br`.

## 4. Notificações — ADIADO no frontend

SMS aparece no log Dev da API até haver provider real.

## 5. Gating por módulos do tenant

- [ ] Sidebar dinâmica + `ModuleGuard`.

## 6. Fluxo de convite B2B

- [ ] `submitInvitePassword` ainda stub.

## Dívidas técnicas conhecidas

- Branding inconsistente (`Platform` vs Rolvix).
- Login/Onboarding B2B com strings hardcoded.
- Landing anuncia módulos futuros.

## Histórico

| Data | Mudança |
|------|---------|
| 2026-08-03 | Portal elevado a próximo foco. |
| 2026-08-03 | Login B2C = e-mail + senha. |
| 2026-08-03 | **Executado:** feature `tenantPortal` (layout + login/register/verify + i18n). |
| 2026-08-03 | **Executado:** host `{subdomain}.rolvix.com.br` serve portal em `/`. |
| 2026-08-03 | **Executado:** branding no wizard/edit admin. Disciplina “como testar”. |
| 2026-08-03 | **Prioridade:** registro dinâmico por tenant (mínimo nome/e-mail/senha/celular; extras via schema). Agenda adiada. |
| 2026-08-03 | **Executado:** register dinâmico + UI de campos (platform/tenant). |
| 2026-08-04 | Agenda B2C no portal (assets + disponibilidade + reserve + mine); i18n pt/en/es. |
