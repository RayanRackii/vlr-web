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
  "src/features/catalog/pages/CustomerGroupFormPage.tsx",
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
  "src/features/pmoc/pages/CreatePlanPage.tsx",
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
const onlyIn = (list, other) => list.filter((file) => !other.includes(file))
// A flat-config block with an empty `files` array is a config error, so skip empty ones.
const scopedBlock = (files, rules) => (files.length > 0 ? [{ files, rules }] : [])

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
    ignores: [...testIgnores, ...pageLegacy, ...tableLegacy],
    rules: { "no-restricted-syntax": ["error", ...pageRules, ...tableRules] },
  },
  ...scopedBlock(onlyIn(pageLegacy, tableLegacy), { "no-restricted-syntax": ["error", ...tableRules] }),
  ...scopedBlock(onlyIn(tableLegacy, pageLegacy), { "no-restricted-syntax": ["error", ...pageRules] }),
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
