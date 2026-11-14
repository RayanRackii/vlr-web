# PR 6a — Resource type wizard on Page + Wizard (2026-11-14)

Repositories: vlr-web only. Branch: `refactor/resource-type-wizard`. Source plan: vlr-web#562 (PR 6).
Builds on #563 (Page) and #570 (FormPage/form-layout). Owner approved PR 6.

## Findings (session)
- `src/components/wizard/Wizard.tsx` already renders `WizardPanelsStepper` (horizontal on desktop,
  `compact` on mobile) and owns back/next/finish + per-step `validate`. Used only by
  `rentals/pages/RentalLayoutsPage.tsx`.
- `assets/components/AssetWizard.tsx`, `admin/components/TenantOnboardingWizard.tsx`,
  `onboarding/OnboardingPage.tsx` use `WizardPanelsStepper` directly with their own navigation
  (later PRs 6b–6d, one per screen).
- `assets/pages/ResourceTypeWizardPage.tsx` (435 lines) hand-builds its stepper (`<ol>` +
  `aria-current="step"`) and has its own `<h1>` → this PR.

## Changes
1. `src/features/assets/pages/ResourceTypeWizardPage.tsx`: render inside `<Page header={{ title,
   description, eyebrow?, back? }}>` (same texts; a back link if today there is one) and drive the
   steps with `Wizard` (`steps` with ids/labels, per-step `validate` returning today's validation
   messages, `children(stepIndex)` rendering today's step bodies, `finalReview` if today there is a
   review step, `onFinish` = today's submit, same labels for back/next/finish, `finishDisabled` while
   saving). Use `FormSection`/`FormGrid`/`FormRow` (`@/components/ui/form-layout`) for any form fields
   with raw labels in the step bodies. Same data, validation, payload, success navigation and error
   handling as today. Remove the hand-made `<ol>` stepper and its CSS (verify unused in src/e2e).
2. `Wizard.tsx`: only minimal, backwards-compatible additions if the page needs them (e.g.
   `onStepChange`, `busy`/`finishing` from the parent, a `stepError` slot). Keep `RentalLayoutsPage`
   behaviour unchanged. Mobile: stepper `compact`, Back left / Next right, Next full width under
   `md`, touch targets ≥ 44px — fix in `Wizard` if not already true (tokens only).
3. Guard (`eslint.config.js`): add a rule banning `JSXAttribute[name.name='aria-current'][value.value='step']`
   in `src/features/**` ("Use Wizard / WizardPanelsStepper from src/components") with a `stepperLegacy`
   list of today's other offenders (`assistant/CadastroShell.tsx`, `catalog/components/PortalOrderStepper.tsx`,
   `module-guide/ModuleGuide.tsx` — verify by running lint), wired through the existing `ruleSets`
   mechanism so coverage stays exact. Remove `ResourceTypeWizardPage.tsx` from `pageLegacy` (and from
   `formLegacy` if it no longer has raw labels). `.eslint-baseline.json` unchanged.

## Tests (vitest; write first)
- `ResourceTypeWizardPage` test (existing or new): single h1; stepper shows the steps with the
  current one marked; Next blocked with today's validation message on an invalid step; Back keeps
  entered values; finishing submits the same payload and navigates as today; a submit error is
  shown and the user stays on the review/last step.
- `Wizard` tests (existing or new) for any added prop; `RentalLayoutsPage` tests stay green.

## Checks
`npx vitest run src/features/assets src/components/wizard src/components/ui src/features/rentals/pages/RentalLayoutsPage* --testTimeout=60000`,
`npm run lint:ratchet`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.
Ignore the local `tokens:check` CRLF failure.

## Done when
Checks pass; commit `refactor(assets): resource type wizard on Page and Wizard` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, **open the PR** to `develop` with
`gh pr create` (title = subject, body: what/why, behaviour differences, checks, link to this spec and
#562, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do not merge.
