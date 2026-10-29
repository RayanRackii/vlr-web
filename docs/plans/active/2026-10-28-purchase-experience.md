# Customer purchase experience implementation plan

Goal: apply the authorized visual purchase redesign to the existing portal.
Spec: session request and `/workspace/rolvix-synthetic-evidence/t1156-purchase-experience/` v4, including README Nota v3.

Architecture: keep services, payloads, routes and session guards intact. Add small presentation components for tactile add buttons, cart count, order feedback and the status stepper. Use an opt-in FormPrimaryButton loading presentation so other forms retain their behavior.

Constraints: no Git commands or metadata writes, dependencies, API changes or production actions. All copy in pt-BR/en/es; semantic success/error tokens; reduced motion; mobile safe area and navigation clearance.

- [x] Verify a failing FormPrimaryButton test, implement opt-in stable loading, run its tests.
- [x] Verify failing cart feedback tests, implement inline error/retry/dismiss and success navigation state, run cart tests.
- [x] Verify failing detail tests, implement one-shot success hero and real-status stepper with full history, run detail tests.
- [x] Implement and test tactile add feedback and count increases; add CSS including reduced motion and mobile clearance.
- [x] Run TypeScript, catalog/components Vitest and lint ratchet; inspect file changes without Git. Leave ROADMAP unchanged per the continuation request.

Review focus: loading geometry with translated labels; duplicate submit while pending; error preserves note/cart; success state consumed with replace (also under StrictMode); terminal orders do not imply completion; narrow viewport and safe-area clearance.

Continuation results (2026-10-28): completed the add buttons and cart badge, repaired interrupted JSX in the detail page, and corrected test setup/scoping for media queries and the collapsed history. Added coverage for pointer position/release, keyboard/disabled controls, first-item pulse and consecutive increases. A read-only reviewer reported Critical/High/Medium = 0.

Verification used the installed Node 22.23.4. `npx tsc -b` passed; catalog/components Vitest passed (458 tests, 59 files), using `--configLoader runner --no-cache --maxWorkers=2 --reporter=dot --silent` to avoid writes to read-only node_modules; `npm run lint:ratchet` passed (189 existing violations). No Git commands were run.

Remaining manual verification: inspect catalog/add, checkout/loading/error, confirmation/tracking at 390/768/1440, including reduced motion and mobile safe area. Chromium cannot launch in this sandbox: crashpad `setsockopt: Operation not permitted`, followed by SIGTRAP. No backend changes are required for this visual task.
