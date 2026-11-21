import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Page } from "@/components/layout/Page"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { Card, CardContent } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import { StatusBadge } from "@/components/ui/status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModuleMenuItemsManager } from "@/features/admin/components/ModuleMenuItemsManager"
import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import { TenantCompanyTab } from "@/features/admin/components/TenantCompanyTab"
import { TenantAdvancedSettings } from "@/features/admin/components/TenantAdvancedSettings"
import { TenantModulesTab } from "@/features/admin/components/TenantModulesTab"
import { TenantPortalTab } from "@/features/admin/components/TenantPortalTab"
import { TenantSubscriptionPanel } from "@/features/admin/components/TenantSubscriptionPanel"
import { TenantUsersManager } from "@/features/admin/components/TenantUsersManager"
import { useAdminModuleCatalog } from "@/features/admin/hooks/useAdminModuleCatalog"
import { useEnterTenantEnvironment } from "@/features/admin/hooks/useEnterTenantEnvironment"
import {
  commercialModuleSelections,
  createTenantOnboardingSchemas,
  tenantAdminToEditFormValues,
  tenantOnboardingMessagesFromT,
  toTenantBrandingPayload,
  toTenantCompanyPayload,
  type TenantAdmin,
  type TenantEditFormValues,
} from "@/features/admin/schemas/adminTenantSchemas"
import { updateAdminTenant } from "@/features/admin/services/adminTenantsService"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import { listAdminAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import { toCanonicalModuleName } from "@/features/catalog/customerNav"

const TENANT_EDIT_TABS = [
  "empresa",
  "portal",
  "modulos",
  "assinatura",
  "usuarios",
  "cadastro",
  "menu",
  "avancado",
] as const

type TenantEditTab = (typeof TENANT_EDIT_TABS)[number]

const TAB_LABEL_KEYS: Record<TenantEditTab, string> = {
  empresa: "admin.edit.tabs.company",
  portal: "admin.edit.tabs.portal",
  modulos: "admin.edit.tabs.modules",
  assinatura: "admin.edit.tabs.subscription",
  usuarios: "admin.edit.tabs.users",
  cadastro: "admin.edit.tabs.registration",
  menu: "admin.edit.tabs.menu",
  avancado: "admin.edit.tabs.advanced",
}

const TAB_BY_FIELD: Partial<Record<keyof TenantEditFormValues, TenantEditTab>> = {
  legalName: "empresa",
  tradeName: "empresa",
  taxId: "empresa",
  contactEmail: "empresa",
  contactPhone: "empresa",
  postalCode: "empresa",
  street: "empresa",
  number: "empresa",
  complement: "empresa",
  district: "empresa",
  city: "empresa",
  state: "empresa",
  subdomain: "portal",
  logoSvg: "portal",
  primaryColor: "portal",
  accentColor: "portal",
  welcomeTagline: "portal",
  activeModules: "modulos",
  assetFamilyKeys: "modulos",
}

function isTenantEditTab(value: string | null): value is TenantEditTab {
  return TENANT_EDIT_TABS.some((tab) => tab === value)
}

type TenantEditFormProps = {
  tenant: TenantAdmin
  hasLegacyMaintenance?: boolean
}

export function TenantEditForm({
  tenant: initialTenant,
  hasLegacyMaintenance = false,
}: TenantEditFormProps) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tenant, setTenant] = useState(initialTenant)
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const { enteringId, enter } = useEnterTenantEnvironment()
  const {
    selectable: commercialModules,
    error: modulesError,
    isLoading: modulesLoading,
    retry: retryModules,
    modulesAvailable,
  } = useAdminModuleCatalog()

  const tenantId = tenant.id
  const requestedTab = searchParams.get("tab")
  const activeTab: TenantEditTab = isTenantEditTab(requestedTab)
    ? requestedTab
    : "empresa"

  const validationMessages = useMemo(
    () => tenantOnboardingMessagesFromT((key) => t(key)),
    [t],
  )
  const schemas = useMemo(
    () => createTenantOnboardingSchemas(validationMessages),
    [validationMessages],
  )

  const form = useForm<TenantEditFormValues>({
    resolver: zodResolver(schemas.tenantEditSchema),
    defaultValues: tenantAdminToEditFormValues(initialTenant),
    mode: "onTouched",
  })

  const { isDirty, isSubmitting, dirtyFields } = form.formState
  const unsavedCount = Object.keys(dirtyFields).length
  const portalValues = form.watch(["subdomain", "activeModules"])
  const subdomain = portalValues[0]
  const activeModules = portalValues[1]
  // The advanced settings (booking map) only exist for rentals.
  const showAdvancedTab = activeModules.some(
    (module) => toCanonicalModuleName(module) === "rentals",
  )
  const visibleTabs = TENANT_EDIT_TABS.filter(
    (tab) => tab !== "avancado" || showAdvancedTab,
  )

  useEffect(() => {
    let cancelled = false
    void listAdminAssetFamilyCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setFamilies(catalog)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFamilies([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function selectTab(next: string) {
    if (!isTenantEditTab(next) || next === activeTab) {
      return
    }
    const params = new URLSearchParams(searchParams)
    params.set("tab", next)
    setSearchParams(params, { replace: true })
  }

  function toggleKey(
    field: "activeModules" | "assetFamilyKeys",
    key: string,
  ) {
    if (isSubmitting) {
      return
    }

    const current = form.getValues(field)
    form.setValue(
      field,
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
      { shouldDirty: true, shouldValidate: true },
    )
  }

  function handleInvalid(errors: FieldErrors<TenantEditFormValues>) {
    // The first invalid field may live on a tab that is not visible: bring it forward.
    const firstInvalid = (Object.keys(errors) as (keyof TenantEditFormValues)[])
      .map((name) => TAB_BY_FIELD[name])
      .find((tab): tab is TenantEditTab => tab !== undefined)
    if (firstInvalid && firstInvalid !== activeTab) {
      selectTab(firstInvalid)
    }
  }

  async function handleSubmit(values: TenantEditFormValues) {
    try {
      const saved = await updateAdminTenant(tenantId, {
        legalName: values.legalName.trim(),
        taxId: values.taxId.trim(),
        subdomain: values.subdomain.trim().toLowerCase(),
        ...toTenantBrandingPayload(values),
        activeModules: commercialModuleSelections(values.activeModules),
        assetFamilyKeys: values.assetFamilyKeys,
        ...toTenantCompanyPayload(values, form.formState.dirtyFields),
      })

      toast.success(t("admin.edit.successTitle"), {
        description: t("admin.edit.success"),
      })

      setTenant(saved)
      form.reset(tenantAdminToEditFormValues(saved))
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.edit.errors.updateFailed")

      toast.error(t("admin.edit.errorTitle"), {
        description: message,
      })
    }
  }

  function submit() {
    void form.handleSubmit(handleSubmit, handleInvalid)()
  }

  const trialEnded = Boolean(tenant.isTrialReadOnly)

  const description = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 break-all">
        {tenant.subdomain ?? t("admin.dashboard.noSubdomain")}
      </span>
      <StatusBadge tone={tenant.isActive ? "success" : "neutral"}>
        {tenant.isActive
          ? t("admin.edit.status.active")
          : t("admin.edit.status.inactive")}
      </StatusBadge>
      {tenant.isTrial ? (
        <StatusBadge tone={trialEnded ? "danger" : "warning"}>
          {trialEnded
            ? t("admin.edit.status.trialEnded")
            : t("admin.edit.status.trial")}
        </StatusBadge>
      ) : null}
    </span>
  )

  return (
    <Page
      header={{
        title: tenant.legalName,
        description,
      }}
    >
      <UnsavedChangesGuard when={isDirty} />
      <Form {...form}>
        <Tabs value={activeTab} onValueChange={selectTab} className="gap-4">
          <TabsList variant="line" aria-label={t("admin.edit.tabs.label")}>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(TAB_LABEL_KEYS[tab])}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="empresa">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <TenantCompanyTab
                form={form}
                disabled={isSubmitting}
                isTrial={Boolean(tenant.isTrial)}
                isTrialReadOnly={trialEnded}
              />
            </form>
          </TabsContent>

          <TabsContent value="portal">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <TenantPortalTab
                form={form}
                disabled={isSubmitting}
                canEnter={tenant.isActive}
                isEntering={enteringId === tenantId}
                onEnter={() => {
                  void enter(tenant)
                }}
              />
            </form>
          </TabsContent>

          <TabsContent value="modulos">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <TenantModulesTab
                form={form}
                disabled={isSubmitting}
                hasLegacyMaintenance={hasLegacyMaintenance}
                commercialModules={commercialModules}
                modulesLoading={modulesLoading}
                modulesError={modulesError}
                onRetryModules={retryModules}
                families={families}
                onToggleModule={(key) => {
                  toggleKey("activeModules", key)
                }}
                onToggleFamily={(key) => {
                  toggleKey("assetFamilyKeys", key)
                }}
              />
            </form>
          </TabsContent>

          <TabsContent value="assinatura">
            <Card>
              <CardContent className="pt-6">
                <TenantSubscriptionPanel tenantId={tenantId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios">
            <Card>
              <CardContent className="pt-6">
                <TenantUsersManager tenantId={tenantId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cadastro">
            <Card>
              <CardContent className="pt-6">
                <RegistrationFieldsManager tenantId={tenantId} canWrite />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu">
            <Card>
              <CardContent className="pt-6">
                <ModuleMenuItemsManager
                  tenantId={tenantId}
                  subdomain={subdomain}
                  activeModules={activeModules.map(toCanonicalModuleName)}
                  canWrite
                />
              </CardContent>
            </Card>
          </TabsContent>

          {showAdvancedTab ? (
            <TabsContent value="avancado">
              <Card>
                <CardContent className="pt-6">
                  <TenantAdvancedSettings tenantId={tenantId} />
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </Form>

      {isDirty ? (
        <SaveBar
          dirty={isDirty}
          unsavedCount={unsavedCount}
          saving={isSubmitting}
          saveDisabled={!modulesAvailable}
          onSave={submit}
          onDiscard={() => {
            form.reset(tenantAdminToEditFormValues(tenant))
          }}
        />
      ) : null}
    </Page>
  )
}
