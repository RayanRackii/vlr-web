# Contexto Global e Diretrizes do Projeto (Rolvix — SaaS Modular B2B)

> **Espelho (repo `vlr-web`).** Fonte canônica de glossário/beachhead: `CONTEXT.md` no repo **`vlr-api`**. Ao mudar Language ou beachhead, atualize **os dois**.

## 1. Visão Global (O "Hub" Corporativo)
Você atua como Arquiteto de Software e Desenvolvedor Full-Stack Sênior. O sistema é a plataforma **Rolvix**: um SaaS B2B modular e multi-tenant. O Core é agnóstico ao negócio: Tenants, Users, Units, Roles e Permissions. Sobre o Core, "Módulos" são aplicativos ativáveis por tenant.

### Beachhead atual (prioridade de execução)
O primeiro cliente pagante é um **clube** que precisa (1) avisar clientes sobre o estado das quadras e (2) permitir **reserva de horários**. O módulo **Rentals** (`rentals`) é o foco. Não expandir RH, Financeiro, Estoque etc. enquanto o beachhead não estiver operacional.

**Ordem de etapas (ciclo atual):**
1. **Resend + WhatsApp (Meta)** — **adiada** (config externa); não bloquear o beachhead.
2. **Portal B2C branded** — shell, login e-mail+senha, register dinâmico e menu multi-item já em código; fechar DNS/deploy.
3. **Agenda por Slot** — admin (kinds/templates/dia) + B2C book por `slotId` (APIs no `vlr-api`; UX neste repo). Ver `ROADMAP.md` §3.5.
4. Demais: gating B2B por módulos, admin de reservas, onboarding legado.

Detalhe: este `ROADMAP.md` e o do repo `vlr-api`. Regras: `.cursor/rules/`.

### Portal B2C do Tenant

**Objetivo:** ambiente exclusivo por empresa em `{subdomain}.rolvix.com.br` (também `/t/:subdomain` em apex/dev).

**UX:**
- Login branded (`LogoSvg`, cores, trade name).
- Cadastro no mesmo shell; Customer só daquele Tenant.

**Campos de cadastro (beachhead):** foto, nome, e-mail (login), senha, CPF, CEP, celular (SMS = prova de posse, **não** autentica).

**Auth B2C:** login = e-mail + senha → JWT `Customer`. OTP-only por telefone é legado a aposentar.

**Branding (baixa manutenção):** `TradeName`, `LogoSvg` (SVG sanitizado — não URL), `PrimaryColor`, `AccentColor` opcional, `SupportWhatsApp` opcional, `WelcomeTagline` ≤120. `LogoUrl` legado — não usar no produto. Novos tenants partem da paleta Rolvix (`#4D6A92` / `#5A8FA0`); valores salvos por tenant continuam soberanos no login e app B2C.

**Validações BR:** CPF/CEP no front para UX; API é autoridade. SMS enfileirado (nunca síncrono na request).

## Language

**Tenant**:
The customer organization that subscribes to and is isolated within the platform.
_Avoid_: Company, account, empresa (in code)

**User**:
A person who accesses the platform on behalf of a Tenant (B2B). Authentication is handled externally (Supabase Auth); the platform stores the profile and authorization data.
_Avoid_: Employee, account holder

**Customer**:
An end consumer registered exclusively under one Tenant (B2C). Logs in with email + password. Profile also includes name, CPF, postal address (via CEP), SMS-verified mobile (for WhatsApp notifications, not login), and optional photo. Not a platform User (B2B).
_Avoid_: Client, member, sócio (in code)

**Unit**:
A physical or logical site belonging to a Tenant, such as a hotel property, club facility, or branch. Module data must always reference a Unit when the domain requires site scope.
_Avoid_: Branch, site, location, unidade (in code)

**Role**:
A named bundle of Permissions scoped to a single Tenant. Users receive capabilities through Role assignments.
_Avoid_: Profile, group

**Permission**:
A global, system-defined capability key (for example, `pmoc.work_orders.read`) that Roles grant to Users. The catalog is shared across all Tenants.
_Avoid_: Right, privilege (in code)

**Reservation**:
A booking of one Rentable by a Customer for a concrete time window, owned by a Tenant. Prefer linking to a Slot when the tenant uses slot schedules.
_Avoid_: Booking, appointment, agendamento (in code)

**Rentable**:
Anything a Tenant offers for time-based rental through the Rentals module — a space, court, room, vehicle, or physical good. In code this is the existing `RentalAsset` (typed as location/good; categories refine the label). Bulk create: Location yields N assets (one per number in the range, quantity 1 each); Good yields one asset whose stock is `TotalQuantity`.
_Avoid_: Court-only language in the module core; Quadra as the only product shape; treating bulk Good as N serialized individual goods

**RequiresDeposit**:
Rentable-level flag: a Customer booking waits for admin payment confirmation before becoming Confirmed. Default on. Not a per-window pricing setting.
_Avoid_: needPayment; assuming every booking waits for deposit

**Asset**:
A Tenant-scoped inventory resource (space, electrical equipment, good, …). Core fields are shared; family-specific values live in `Attributes` (JSONB). Linked 1:1 to a Rentable when `IsRentable`. Create/edit wizard: Geral → Operação → Preços (if rentable) → Revisão. Pricing UI offers same-every-day, weekday+weekend, or per-day presets and expands them into per-weekday pricing rows. Bulk create follows rental type: Location = N entities with numbered tags; Good = one entity with stock quantity.
_Avoid_: One physical table per use case; dynamic per-tenant tables; asking the admin to type seven identical price rows as the default path

**AssetFamily**:
A platform catalog entry (`spaces`, `electrical`, `goods`, `generic`, …) with a FieldSchema describing extra attribute fields. Tenants enable families at onboarding (`TenantAssetFamily`). Drives asset forms and copy tone.
_Avoid_: STI / child tables per family; inventing new CREATE TABLE migrations for each vertical

**ResourceCategory**:
A Tenant-defined label for grouping Rentables (for example padel, society, tennis, meeting room, van). Used for filters, legends, and layout meaning — not a hard-coded enum in the platform. In inventory UI this is **AssetCategory** (Tipo) within an AssetFamily.
_Avoid_: Fixed platform enum of sport types

**OccupancyKind**:
A Tenant-defined kind of time occupancy on a Rentable (for example Open, Closed, Lesson, Event). Controls whether Customers may book that cell and whether it blocks capacity. Catalog is per Tenant, not a global closed set. When several kinds cover the same weekday interval, a higher-precedence kind occupies the overlap on unpublished days (Closed over Lesson over Open; a custom kind that blocks capacity sits with Lesson).
_Avoid_: Hard-coded Lesson/Open/Closed-only enums as the only kinds; last-write-wins between overlapping templates

**Slot**:
One dated occupancy cell on one Rentable: date + start + end + OccupancyKind. The operational unit of a published schedule day. Duration is whatever the admin defined (1h, 2h, 3h, …).
_Avoid_: Free-typed start/end as the only booking path for slot-mode tenants

**ScheduleTemplate**:
The default weekly pattern of Slots (or open-hours rules) used to materialize each Schedule Day. Each template belongs to a `DayOfWeek` and recurs on every occurrence of that weekday (all Mondays, all Tuesdays, etc.); it is not tied to one calendar date. A single day can still be edited after publish. Different OccupancyKinds may overlap on the same Rentable and weekday (Open 08:00–22:00 plus Lesson 18:00–19:00). The same kind cannot overlap itself, and the same interval+kind cannot be stored twice. Weekly apply matches an existing row by that full interval and kind, not by start time alone.
_Avoid_: Forcing admins to rebuild every day from scratch as the only path; treating start time alone as the identity of a weekly row

**ScheduleDay**:
The concrete set of bookable windows for one calendar date (optionally per Unit). Includes persisted Slot rows plus unpublished SlotGrid cells derived from that weekday’s templates (overlapping kinds are split; the higher-precedence kind occupies the overlap). **PublishDay** still gap-fills Slot rows for dated exceptions and EntireRecurrence cascade without wiping a day that already has slots.
_Avoid_: Requiring PublishDay before customers can book a weekly grid; treating the weekly editor itself as the B2C booking UI

**OpenHours**:
A schedule policy where a Rentable is continuously available between open and close times; bookable windows are derived from that interval (and allowed durations), without requiring the admin to draw every cell. Prefer this for the common club case (~08:00–22:00). Admin: `PUT /api/rental-assets/{id}/schedule-policy` (one) or `PUT /api/rental-assets/schedule-policy` (bulk, transactional — invalid ID aborts all). **UI copy: Horário padrão** — never show `OpenHours` or “80%” in the product UI.
_Avoid_: Forcing explicit Slot drawing when the tenant only needs “18:00–00:00 all open”; seeding dozens of identical SlotGrid templates when OpenHours fits

**SlotGrid**:
Schedule policy that authors the week as explicit **ScheduleTemplate** cells. Day reads derive unpublished bookable windows from that weekday’s templates, splitting overlapping kinds so the higher-precedence kind wins the shared interval; **PublishDay** optionally materializes **Slot** rows for exceptions and recurrence cascade (gap-fill by rentable + start; existing slots including Booked stay). Use for fine exceptions (lesson blocks, closed mornings). Default grid seed is a **single** API call: `POST /api/schedule/templates/seed-default` (`rentalAssetIds` for a set). Day query/publish accept the same ID list. **UI copy: Grade personalizada** — never show `SlotGrid` in the product UI. Fine edits stay per rentable on Weekly templates.
_Avoid_: N client-side POSTs per hour×day as the product path; empty B2C days after seed because publish was skipped

**Admin Daily Agenda UX**:
Operational resource grid with compact toolbar and a content-sized time × resource matrix (columns fill width; height follows the day’s hours). Cells open a contextual drawer (day override vs SlotGrid recurrence). Copy is generic for spaces/goods across modules.
_Avoid_: Vertical per-resource card stacks; sports-specific labels; mixing weekly editors into the day grid; a clipped inner scroll for a typical club day

**Weekly setup UX**:
Same time × resource matrix as Day agenda, navigated by weekday instead of calendar date. OpenHours columns show the derived repeating windows; SlotGrid columns show that weekday’s templates. Empty cells create a template; OpenHours cells open schedule setup (the whole window, not one hour). Policy, seed and bulk weekly rules stay in compact toolbar sheets.
_Avoid_: A one-resource dropdown plus empty-state card; a left-hand form column that hides the matrix

**Day occurrence**:
Dated Slot or OpenHours-derived window. Day-only edits vs EntireRecurrence (SlotGrid templates + safe future cascade). OpenHours window edits stay in Weekly setup.
_Avoid_: Editing all future weekdays from an OpenHours cell drawer

**Day read path**:
Two parallel requests for day slots + weekday templates; unpublished SlotGrid hours come from the day payload (derived). Overrides via `daily-occurrence`; weekly grids via `apply-weekly-rule`. Cache by sorted resource IDs + date. B2C books derived SlotGrid windows via create-reservation until a Slot row exists.
_Avoid_: One request per selected resource; fetching the whole week of templates for a single day

**Layout**:
A Tenant-authored visual arrangement of Rentables on a 2D canvas (positions and sizes) so Customers pick a resource from a map after choosing date and time. Unavailable Rentables stay visible and disabled. If no Layout is active, the picker falls back to a grid of all Rentables. Multiple Layouts are allowed (different venues or views).
_Avoid_: Hard-coding a single FICC court map; hiding unavailable Rentables; requiring court-first selection as the only path

**Subdomain**:
The tenant-owned URL slug used to resolve which Tenant a public B2C request belongs to (for example `clube-x` → `clube-x.rolvix.com.br`). It is identity routing, not the branded experience itself.
_Avoid_: custom domain (until real custom hostnames are supported), slug alone without tenant resolution

## 2. Dinâmica de Módulos e Customização
- **Cardápio:** Super Admin ativa módulos por Tenant (`inventory`, `maintenance`, `pmoc`, `os`, `rentals`). UI B2B filtra a sidebar por `activeModules` em seções **Visão geral** / **Pessoas & portal** / **Operação** (parcial; `ModuleGuard` + Users do tenant ainda no ROADMAP).
- **Chrome B2B / landing Rolvix:** paleta padrão `#4D6A92` (primary), `#5A8FA0` (accent) e `#A2C6E9` (complementary), com gradiente azul suave em superfícies de destaque. O portal B2C continua personalizado por tenant (`PrimaryColor` / `AccentColor`); a paleta Rolvix é apenas fallback e default de novos cadastros.
- **Regra de ouro:** admin **nunca** define senha de outro User. Convite → `/invite?token=` → convidado define senha. Onboarding público com senha do admin é legado.
- **Modo suporte:** “Abrir ambiente” no apex B2B (`rolvix.com.br`) — membership Admin + `app_metadata.tenant_id`. **Não** redirecionar para o portal B2C. “Voltar à plataforma” limpa `tenant_id`. E-mails `PlatformAdmin` não aparecem/contam como usuários do tenant e não podem ser excluídos pela UI de users.
- **Subdomain** = roteamento + branding; o portal é a UI B2C.

## 3. Mapa mental (o que este repo renderiza)

```
B2B (rolvix.com.br)     → Users / Super-Admin / módulos operacionais
B2C ({sub}.rolvix.com.br) → Customers / login-register / agenda Rentals
```

API e domínio vivem em **`vlr-api`**. Este repo **nunca** acessa Postgres via Supabase SDK — só Auth B2B.

**Dois repositórios Git:**
```
vlr-web (este repo)                 vlr-api (repo irmão)
├── CONTEXT.md  ← espelho           ├── CONTEXT.md  ← canônico
├── ROADMAP.md                      ├── ROADMAP.md
├── AGENTS.md                       ├── docs/adr|sessions|runbooks
├── docs/sessions/                  └── …
├── .cursor/rules/
└── src/
```

## 4. Fases (resumo para o FE)
- Fase 1.5 notificações reais — **adiada**.
- Fase 2a PMOC/OS/Inventário — base entregue.
- Fase 2b Rentals beachhead — **foco**: portal estável + agenda por Slot + admin de reservas.
- Não antecipar módulos futuros (RH, Financeiro, …).

## 5. Idioma e nomenclatura
- Código: **Inglês**. UI: Português via i18n.
- React/TS: componentes `PascalCase`; funções/hooks `camelCase`. Zero `any`. Zod espelha DTOs da API.

## 6. Stack deste repo
- React + Vite, shadcn/ui, Tailwind. Deploy **Vercel**.
- `VITE_API_URL` → `vlr-api` (Railway). JWT Bearer (Supabase B2B ou Customer JWT B2C).
- Hosts: apex = landing + app B2B; `{subdomain}.rolvix.com.br` = portal B2C.
- **Loading (produto):** Skeleton shimmer (default) na 1ª carga; `LoadingButton` em ações pontuais; `TopProgressBar` nas navegações React Router (delay ~250ms). Não sobrepor indicadores para o mesmo evento.

## 7. Disciplina do agente
1. Atualizar este `ROADMAP.md` em toda tarefa relevante (+ Histórico se o plano mudar).
2. Ao encerrar, descrever próximo passo deste roadmap **e** o do `vlr-api`.
3. Em etapa concluída: **como testar** (UI concreta e/ou endpoint).
4. Mudança de glossário/beachhead → este arquivo **e** `CONTEXT.md` do `vlr-api`.

## 8. Antes de implementar
1. Respeita beachhead (Rentals / clube) e a ordem (WA adiada → portal → slots)?
2. Respeita `.cursor/rules` deste repo?
3. Atualizei o `ROADMAP.md`?
