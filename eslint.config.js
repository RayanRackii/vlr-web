import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

// Legacy pages not yet on Page/PageHeader — remove entries as each feature migrates;
// never add new ones (docs/plans/active/2026-11-13-ui-standard-patterns.md)
const pageLegacy = [
  "src/features/admin/components/PortalMenuPreview.tsx",
  "src/features/admin/components/PortalModuleDiscovery.tsx",
  "src/features/admin/components/TenantEditForm.tsx",
  "src/features/admin/components/TenantOnboardingWizard.tsx",
  "src/features/admin/pages/AdminDashboardPage.tsx",
  "src/features/admin/pages/AdminUsersPage.tsx",
  "src/features/admin/pages/EditTenantPage.tsx",
  "src/features/admin/pages/NewTenantPage.tsx",
  "src/features/admin/pages/ResourceVisualCatalogPage.tsx",
  "src/features/admin/pages/TenantModuleMenuPage.tsx",
  "src/features/admin/pages/TenantRegistrationFieldsPage.tsx",
  "src/features/assets/components/AssetWizard.tsx",
  "src/features/assets/pages/ResourceTypeWizardPage.tsx",
  "src/features/assets/pages/ResourceTypesPage.tsx",
  "src/features/assistant/CadastroShell.tsx",
  "src/features/assistant/ProductAssistantPage.tsx",
  "src/features/assistant/ResourceAssistantPage.tsx",
  "src/features/catalog/components/productWizard/ProductWizardAccessStep.tsx",
  "src/features/catalog/components/productWizard/ProductWizardOfferStep.tsx",
  "src/features/catalog/pages/CatalogPolicyPage.tsx",
  "src/features/catalog/pages/CatalogProductEditorPage.tsx",
  "src/features/catalog/pages/CustomerGroupsPage.tsx",
  "src/features/catalog/pages/PedidoRequestDetailPage.tsx",
  "src/features/catalog/pages/PedidosPage.tsx",
  "src/features/catalog/pages/PortalCartPage.tsx",
  "src/features/catalog/pages/PortalCatalogPage.tsx",
  "src/features/catalog/pages/PortalCatalogProductPage.tsx",
  "src/features/catalog/pages/PortalOrderDetailPage.tsx",
  "src/features/catalog/pages/PortalOrdersPage.tsx",
  "src/features/catalog/pages/PortalProductRequestDetailPage.tsx",
  "src/features/catalog/pages/PortalProductRequestPage.tsx",
  "src/features/catalog/pages/PortalProductRequestsPage.tsx",
  "src/features/dashboard/components/ClientDashboard.tsx",
  "src/features/dashboard/components/DashboardOverview.tsx",
  "src/features/dashboard/components/TechnicianDashboard.tsx",
  "src/features/dashboard/pages/DashboardPage.tsx",
  "src/features/landing/components/ClosingSection.tsx",
  "src/features/landing/components/FeatureUiMockups.tsx",
  "src/features/landing/components/HeroSection.tsx",
  "src/features/landing/components/IntelligenceHubBridge.tsx",
  "src/features/landing/components/LandingFooter.tsx",
  "src/features/landing/components/MasterScrollStage.tsx",
  "src/features/landing/components/PricingSection.tsx",
  "src/features/landing/components/StoryStep.tsx",
  "src/features/maintenance/MaintenancePage.tsx",
  "src/features/maintenance/MaintenanceRoutes.tsx",
  "src/features/module-guide/ModuleGuide.tsx",
  "src/features/notifications/pages/NotificationChannelsPanel.tsx",
  "src/features/notifications/pages/NotificationHistoryPanel.tsx",
  "src/features/notifications/pages/NotificationsPage.tsx",
  "src/features/pmoc/pages/PmocLibraryPage.tsx",
  "src/features/pmoc/pages/PmocPlanDetailPage.tsx",
  "src/features/pmoc/pages/PmocTemplatePreviewPage.tsx",
  "src/features/rentals/components/RentalResourceEditorForm.tsx",
  "src/features/rentals/pages/BookingPolicyPage.tsx",
  "src/features/rentals/pages/FirstStepsPage.tsx",
  "src/features/rentals/pages/RentalLayoutsPage.tsx",
  "src/features/rentals/pages/RentalResourcesPage.tsx",
  "src/features/rentals/pages/SchedulePage.tsx",
  "src/features/rentals/pages/TeacherLessonsPage.tsx",
  "src/features/taxonomy/pages/TaxonomyPage.tsx",
  "src/features/tenantPortal/components/CustomerAppLayout.tsx",
  "src/features/tenantPortal/components/TenantPortalLayout.tsx",
  "src/features/tenantPortal/components/portal/PortalBookingHeader.tsx",
  "src/features/tenantPortal/components/portal/PortalRecoveryState.tsx",
  "src/features/tenantPortal/pages/TenantPortalHomePage.tsx",
  "src/features/tenantPortal/pages/TenantPortalProfilePage.tsx",
  "src/features/users/pages/PortalCustomerPage.tsx",
  "src/features/users/pages/RoleCreatePage.tsx",
  "src/features/users/pages/RoleEditorPage.tsx",
  "src/features/users/pages/StaffProfilePage.tsx",
  "src/features/workOrders/pages/CreateWorkOrderPage.tsx",
  "src/features/workOrders/pages/WorkOrderExecutionPage.tsx",
]

// Legacy screens still on a hand-written table or TanStack outside src/components/data-table —
// remove entries as each feature migrates to DataList; never add new ones
// (docs/plans/active/2026-11-13-ui-datalist.md)
const tableLegacy = [
]

// Legacy files with a raw <label> instead of FormRow/FormLabel — remove entries as each
// screen migrates; never add new ones (docs/plans/active/2026-11-14-ui-form-page.md)
const formLegacy = [
  "src/features/admin/pages/ResourceVisualCatalogPage.tsx",
  "src/features/agenda/AgendaFilters.tsx",
  "src/features/assets/components/AssetWizard.tsx",
  "src/features/assets/pages/AssetsPage.tsx",
  "src/features/assets/pages/ResourceTypeWizardPage.tsx",
  "src/features/assistant/CadastroTaxonomyStep.tsx",
  "src/features/assistant/ResourceAssistantPage.tsx",
  "src/features/assistant/ResourceCadastroDadosStep.tsx",
  "src/features/auth/TenantPicker.tsx",
  "src/features/catalog/components/CatalogOrderAllocationPanel.tsx",
  "src/features/catalog/components/CatalogProductAccessSection.tsx",
  "src/features/catalog/components/CatalogProductResourceRequirements.tsx",
  "src/features/catalog/components/PortalCatalogFilters.tsx",
  "src/features/catalog/components/StaffCatalogChrome.tsx",
  "src/features/catalog/components/productWizard/ProductWizardAccessStep.tsx",
  "src/features/catalog/pages/CatalogProductEditorPage.tsx",
  "src/features/catalog/pages/CatalogProductsPage.tsx",
  "src/features/catalog/pages/CustomerGroupsPage.tsx",
  "src/features/module-guide/ModuleGuide.tsx",
  "src/features/notifications/pages/NotificationChannelsPanel.tsx",
  "src/features/notifications/pages/NotificationHistoryPanel.tsx",
  "src/features/rentals/components/CategoryBookingPolicySection.tsx",
  "src/features/rentals/components/RentalResourceEditorForm.tsx",
  "src/features/rentals/components/resourceWizard/ResourceWizardPricesStep.tsx",
  "src/features/rentals/components/schedule/DaySlotSheet.tsx",
  "src/features/rentals/components/schedule/RentableMultiSelect.tsx",
  "src/features/rentals/components/schedule/SchedulePolicyPanel.tsx",
  "src/features/rentals/components/schedule/TemplateSheet.tsx",
  "src/features/rentals/components/schedule/WeeklyRuleSheet.tsx",
  "src/features/rentals/pages/RentalLayoutsPage.tsx",
  "src/features/rentals/pages/ReservationsPage.tsx",
  "src/features/taxonomy/components/TaxonomyFilters.tsx",
  "src/features/tenantPortal/components/BookingMapExperience.tsx",
  "src/features/tenantPortal/pages/TenantPortalAgendaPage.tsx",
  "src/features/tenantPortal/pages/TenantPortalRegisterPage.tsx",
]

const pageRules = [
  {
    selector: "JSXOpeningElement[name.name='h1']",
    message: "Use PageHeader/Page from @/components/layout for the page title (docs/plans/active/2026-11-13-ui-standard-patterns.md).",
  },
  {
    selector: "JSXAttribute[name.name='className'] :matches(Literal[value=/^(?=.*mx-auto)(?=.*max-w-)/], TemplateElement[value.raw=/^(?=.*mx-auto)(?=.*max-w-)/])",
    message: "Use Page width instead of hand-set page widths.",
  },
]

const formRules = [
  {
    selector: "JSXOpeningElement[name.name='label']",
    message: "Use FormRow from @/components/ui/form-layout or FormLabel from @/components/ui/form (docs/plans/active/2026-11-14-ui-form-page.md).",
  },
]

const tableRules = [
  {
    selector: "JSXOpeningElement[name.name='table']",
    message: "Use DataList from @/components/data-table (docs/plans/active/2026-11-13-ui-datalist.md).",
  },
  {
    selector: "ImportDeclaration[source.value='@tanstack/react-table']",
    message: "TanStack tables only inside src/components/data-table.",
  },
]

const featureFiles = ["src/features/**/*.{ts,tsx}"]
const testIgnores = ["**/*.test.{ts,tsx}", "**/__tests__/**"]
// Flat config replaces (does not merge) a rule across blocks, so each combination of legacy
// lists gets its own block with exactly the rules that apply.
const ruleSets = [
  { legacy: pageLegacy, rules: pageRules },
  { legacy: tableLegacy, rules: tableRules },
  { legacy: formLegacy, rules: formRules },
]
const legacyFiles = [...new Set(ruleSets.flatMap((set) => set.legacy))]
// A flat-config block with an empty `files` array is a config error, so skip empty ones.
const scopedBlock = (files, rules) => (files.length > 0 ? [{ files, rules }] : [])
// Group the legacy files by the exact rule sets they are still exempt from.
const legacyBlocks = Object.values(
  Object.groupBy(legacyFiles, (file) => ruleSets.map((set) => set.legacy.includes(file) ? "1" : "0").join("")),
).flatMap((files) => {
  const exempt = ruleSets.filter((set) => set.legacy.includes(files[0]))
  const applied = ruleSets.filter((set) => !exempt.includes(set)).flatMap((set) => set.rules)
  return scopedBlock(files, { "no-restricted-syntax": ["error", ...applied] })
})

export default defineConfig([
  globalIgnores(["dist", "playwright-report", "test-results"]),
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "react-icons", "react-icons/*", "@heroicons/*", "@phosphor-icons/*",
            "phosphor-react", "@tabler/icons*", "@radix-ui/react-icons",
            "@fortawesome/*", "react-feather", "@mui/icons-material*",
            "iconoir-react", "@iconify/*", "remixicon*", "@hugeicons/*",
          ],
          message: "Use lucide-react (see src/lib/icon.ts)",
        }],
      }],
    },
  },
  {
    files: featureFiles,
    ignores: [...testIgnores, ...legacyFiles],
    rules: { "no-restricted-syntax": ["error", ...ruleSets.flatMap((set) => set.rules)] },
  },
  ...legacyBlocks,
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
