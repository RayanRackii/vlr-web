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
