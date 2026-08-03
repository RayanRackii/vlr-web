# ROADMAP — vlr-web

Prioridade geral: entregar a experiência do módulo **Rentals** para o primeiro cliente (clube: avisos sobre estado das quadras + reserva de horários).

## 1. Módulo de Aluguéis (feature `rentals/`)

Hoje só existe o cadastro de ativos alugáveis com grade de preços (aba Aluguel no `AssetDetailDialog`). Falta tudo de reservas:

- [ ] **Portal do cliente (B2C):** login por OTP (`POST /api/auth/customer/request-otp` + `verify-otp`, header `X-Tenant-Subdomain`), consulta de disponibilidade (`GET /api/reservations/availability`), criação de reserva (`POST /api/reservations`), minhas reservas.
- [ ] **Calendário/agenda de quadras** com estados (livre, reservado, indisponível/manutenção).
- [ ] **Admin do tenant:** listagem e gestão de reservas (confirmar depósito, cancelar), aviso de indisponibilidade de quadra (depende de endpoints novos — ver ROADMAP da vlr-api).
- [ ] Substituir os cards stub do `ClientDashboard` (Chamados/Locações) por dados reais.

## 2. Gating por módulos do tenant

- [ ] Sidebar dinâmica: `navigation.ts` é estático; filtrar itens pelos módulos ativos do tenant (a API precisa expor os módulos ativos, ex. em `/api/users/me`).
- [ ] `ModuleGuard` nas rotas de cada módulo (tenant só com Rentals não deve ver PMOC/OS).

## 3. Fluxo de convite

- [ ] `submitInvitePassword` (`setPasswordService.ts`) é stub — integrar com o endpoint real quando existir no backend.
- [ ] Remover a coleta de senha do onboarding público quando o fluxo de convite estiver completo (regra de ouro).

## Dívidas técnicas conhecidas

- Branding inconsistente: `index.html` title = "frontend", i18n `app.name` = "Platform", landing usa "Rolvix". Unificar para Rolvix.
- Strings hardcoded em PT em `LoginPage`, `OnboardingPage`, `ProtectedRoute` (violam a regra de i18n).
- `src/vite-env.d.ts` não tipa `VITE_PLATFORM_ADMIN_EMAILS` nem `VITE_TENANT_BASE_DOMAIN`.
- Papel do usuário não fica no `AuthContext` (cada tela busca `/api/users/me`).
- Sem TanStack Query — reavaliar se o cache local começar a doer.
- Landing anuncia módulos futuros (RH, Financeiro) que não existem no app.
