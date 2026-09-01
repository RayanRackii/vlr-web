# 2026-09-01 — Platform form validity gate

Status: approved (user product rule)

## Goal / Problem

Primary actions stay clickable while client-known required fields are invalid. Immediate case: `/admin/tenants/new` step Recursos shows “Selecione pelo menos uma família de recursos.” but **Continuar** remains enabled.

## Repositories

- vlr-web only. Do **not** edit vlr-api.

Branch: `feat/platform-form-validity-gate`

## Product rule

If required client-known constraints are invalid → primary action **disabled**.
When the current state is valid → primary **enabled**.

Primary examples: Continuar, Salvar, Criar, Finalizar, Confirmar.

Do **not** disable for server-only errors (uniqueness, external provider). Keep submit validation. Backend remains final authority. Do not hide field errors. Back/Cancel never gated by validity. Loading/submitting blocks duplicate primary click. Disabled must look unavailable (`disabled:opacity-50` already on `Button`).

## Architecture

Existing pieces: `Form` (RHF provider), `LoadingButton` (loading → disabled + spinner), `WizardPanelsStepper` (labels only), no `FormActions`/`SubmitButton`.

Create the **smallest** shared wrapper — do not invent a design system:

`src/components/ui/form-primary-button.tsx` wrapping `LoadingButton`:

- props: existing `LoadingButton` + required `isValid: boolean`
- `disabled = !isValid || loading || disabled`
- `aria-disabled` when blocked
- visual state comes from existing `Button` disabled styles

Do not replace every `LoadingButton` in the app this task.

Export a small helper if useful, e.g. `isTenantOnboardingStepValid(step, values, schemas)` next to wizard schemas (safeParse per step). Step 6 = full `tenantOnboardingSchema`. Step 5 empty admin is **valid** (optional invite). Step 4 also invalid when catalog failed/empty (cannot select).

## This task — must ship

1. **Company wizard** (`TenantOnboardingWizard`) — all 6 steps:
   - Watch values; `isValid` from the current step schema (not `formState.isValid` of the whole form — later steps are empty on purpose).
   - Continuar / Finalizar use `FormPrimaryButton`.
   - Back/Cancel **not** disabled for validity. Step 1 Back stays disabled (nowhere to go). After success, keep existing lock. Do not lock Cancel/Back solely because the step is invalid.
   - Step 4: empty `assetFamilyKeys` → Continuar disabled **and** keep/show `admin.wizard.validation.familiesMin` (trigger the field when entering step 4 so FormMessage is visible without requiring a click on Continuar).
   - Selecting a valid family enables Continuar; deselecting the last family disables again.
   - Finalizar loading (`isFinishing`) disables primary (duplicate click).
   - Keep `handleNext` / `form.trigger` / `handleFinish` as safety net + server error path (toast, stay on form, re-enable).

2. **Tests** (wizard + button):
   - invalid current step → primary disabled
   - valid current step → primary enabled
   - field invalid again → disabled again
   - loading → disabled (Finalizar while finishing, or mock finishing)
   - Back/Cancel remain enabled when the step is invalid (step ≥ 2)
   - server-only error still handled after submit (mock `createAdminTenant` reject; after a valid finish click, error toast/message, user stays, Finalizar not stuck)

   Update existing tests that **click Continuar on an empty step 1** — that path is no longer available. Cover empty-legal-name message via touch/blur or by filling taxId and a too-short name.

3. **Docs:** add the rule to `.cursor/rules/20-convencoes.mdc` under Formulários (validity gate + `FormPrimaryButton` + server-only exception). `ROADMAP.md` Histórico 2026-09-01.

4. **Audit** (report in ROADMAP Histórico or a short `docs/plans/active` note — do **not** migrate the whole app):
   Classify existing forms: `VALIDITY_GATE_APPLICABLE` | `SERVER_VALIDATION_ONLY` | `SPECIAL_CASE`.

## Safe extra in this task (optional, small)

`TenantEditForm` Salvar uses the same Zod schema / families min. If cheap, gate Salvar with `FormPrimaryButton` + `tenantOnboardingSchema.safeParse(values)` (admin invite empty is valid). Do not refactor the rest of that page.

## Do not

- Blindly `disabled={!isValid}` on every screen
- Change API contracts, business rules, i18n copy except if a new a11y string is required (prefer none)
- Touch main, PROD, API, migrations, Railway, Twilio, WhatsApp
- ui-implementer / visual redesign

## Verify

`npx vitest run` (or `npm test`) and `npm run build`.

## Forms audit (FOLLOWUP — do not migrate in this task)

| Superfície | Classificação |
|---|---|
| Wizard empresa / TenantEditForm | VALIDITY_GATE_APPLICABLE (**this task**) |
| Login / reset / set-password | VALIDITY_GATE_APPLICABLE |
| Portal login / register / verify / profile | VALIDITY_GATE_APPLICABLE |
| OnboardingPage (legado) | VALIDITY_GATE_APPLICABLE |
| AssetWizard | VALIDITY_GATE_APPLICABLE |
| CreateWorkOrder / CreatePlan | VALIDITY_GATE_APPLICABLE |
| AssetCategories | VALIDITY_GATE_APPLICABLE |
| People users / roles | VALIDITY_GATE_APPLICABLE (unique email = SERVER_VALIDATION_ONLY) |
| Catalog product form / cart / product request | VALIDITY_GATE_APPLICABLE |
| Reservations confirm / cancel | SPECIAL_CASE |
| Delete dialogs | SPECIAL_CASE |
| Wrong credentials / uniqueness / external provider | SERVER_VALIDATION_ONLY |

