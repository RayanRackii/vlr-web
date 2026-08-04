# ROADMAP — vlr-web

Prioridade geral: beachhead **Rentals** (clube). Ver também `CONTEXT.md` e `backend/ROADMAP.md`.

**Foco de produto agora:** portal B2C branded (primeira fatia entregue).  
**Adiado:** OTP/WhatsApp real E2E até config Meta/Resend.

## 0. Disciplina

1. Atualizar este arquivo em tarefas relevantes + **Histórico** se o plano mudar.
2. Ao encerrar uma tarefa (ou após progresso relevante), o agente deve descrever no chat o **próximo passo previsto** deste roadmap **e** do `backend/vlr-api/ROADMAP.md`.
3. Em toda etapa concluída, descrever no chat **como testar** (passos de UI e/ou como disparar o back).

## 1. Portal do tenant — login + cadastro branded — EM ANDAMENTO

- [x] Rotas `/t/:subdomain` (login, register, verify-phone, app).
- [x] Shell branded (logo/cores/tagline via `GET .../branding`).
- [x] Cadastro: foto, nome, e-mail, senha, CPF, CEP, celular (Zod + compressão de foto).
- [x] Verificação SMS (código) + login e-mail/senha.
- [x] Host real `{subdomain}.rolvix.com.br`: em host de tenant, `/` abre o login branded (sem landing); links internos usam `tenantPortalPath`. Path `/t/:subdomain` continua no apex/dev.
- [x] Campos de branding no wizard/edit admin (cor primária, destaque, tagline + logo/subdomínio).
- [ ] Confirmar DNS/Vercel wildcard `*.rolvix.com.br` apontando para o mesmo projeto (infra; o app já trata o host).
- [ ] Agenda / reservas B2C (próxima fatia).
- [ ] Admin B2B de reservas.

## 2. Notificações — ADIADO no frontend

SMS aparece no log Dev da API até haver provider real.

## 3. Gating por módulos do tenant

- [ ] Sidebar dinâmica + `ModuleGuard`.

## 4. Fluxo de convite B2B

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
| 2026-08-03 | **Executado:** host `{subdomain}.rolvix.com.br` serve portal em `/` (ex.: `ficc.rolvix.com.br` → login), sem landing. |
| 2026-08-03 | **Executado:** branding no wizard/edit admin (cores + tagline). Disciplina: “como testar” no chat. |
