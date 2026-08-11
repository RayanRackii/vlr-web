import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Check,
  ClipboardList,
  Layers,
  Package,
  Tent,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { getTenantBaseDomain } from "@/lib/tenantDomain"
import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import { ModuleMenuItemsManager } from "@/features/admin/components/ModuleMenuItemsManager"
import { TenantUsersManager } from "@/features/admin/components/TenantUsersManager"
import {
  MODULE_KEYS,
  tenantOnboardingSchema,
  type ModuleKey,
  type TenantOnboardingFormValues,
  toTenantBrandingPayload,
} from "@/features/admin/schemas/adminTenantSchemas"
import { updateAdminTenant } from "@/features/admin/services/adminTenantsService"
import { listAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const SUCCESS_REDIRECT_MS = 5000

const MODULE_ICONS = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
} as const

const FAMILY_ICONS: Record<string, LucideIcon> = {
  spaces: Tent,
  electrical: Zap,
  goods: Package,
  generic: Layers,
}

function familyIcon(key: string): LucideIcon {
  return FAMILY_ICONS[key] ?? Layers
}

type TenantEditFormProps = {
  tenantId: string
  initialValues: TenantOnboardingFormValues
}

export function TenantEditForm({ tenantId, initialValues }: TenantEditFormProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const redirectTimeoutRef = useRef<number | null>(null)
  const baseDomain = useMemo(() => getTenantBaseDomain(), [])

  const form = useForm<TenantOnboardingFormValues>({
    resolver: zodResolver(tenantOnboardingSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  })

  const isSubmitting = form.formState.isSubmitting
  const isActionLocked = isSubmitting || isSubmitSuccess
  const values = form.watch()

  useEffect(() => {
    form.reset(initialValues)
  }, [form, initialValues])

  useEffect(() => {
    let cancelled = false
    void listAssetFamilyCatalog()
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

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  function toggleModule(moduleKey: ModuleKey) {
    if (isActionLocked) {
      return
    }

    const current = form.getValues("activeModules")
    const exists = current.includes(moduleKey)

    form.setValue(
      "activeModules",
      exists
        ? current.filter((item) => item !== moduleKey)
        : [...current, moduleKey],
      { shouldDirty: true, shouldValidate: true },
    )
  }

  function toggleFamily(familyKey: string) {
    if (isActionLocked) {
      return
    }

    const current = form.getValues("assetFamilyKeys")
    const exists = current.includes(familyKey)

    form.setValue(
      "assetFamilyKeys",
      exists
        ? current.filter((item) => item !== familyKey)
        : [...current, familyKey],
      { shouldDirty: true, shouldValidate: true },
    )
  }

  async function handleSubmit(values: TenantOnboardingFormValues) {
    if (isSubmitSuccess) {
      return
    }

    try {
      await updateAdminTenant(tenantId, {
        legalName: values.legalName.trim(),
        taxId: values.taxId.trim(),
        subdomain: values.subdomain.trim().toLowerCase(),
        ...toTenantBrandingPayload(values),
        activeModules: values.activeModules,
        assetFamilyKeys: values.assetFamilyKeys,
      })

      toast.success(t("admin.edit.successTitle"), {
        description: t("admin.edit.success"),
      })

      setIsSubmitSuccess(true)

      redirectTimeoutRef.current = window.setTimeout(() => {
        void navigate("/admin/dashboard", { replace: true })
      }, SUCCESS_REDIRECT_MS)
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.edit.errors.updateFailed")

      toast.error(t("admin.edit.errorTitle"), {
        description: message,
      })

      setIsSubmitSuccess(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("admin.edit.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.edit.description")}
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit(handleSubmit)()
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">
                {t("admin.edit.sections.basic")}
              </CardTitle>
              <CardDescription>
                {t("admin.edit.sections.basicDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.legalName")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="organization"
                        disabled={isActionLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.taxId")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        disabled={isActionLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">
                {t("admin.edit.sections.identity")}
              </CardTitle>
              <CardDescription>
                {t("admin.edit.sections.identityDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.subdomain")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="acme"
                        disabled={isActionLocked}
                        {...field}
                        onChange={(event) => {
                          field.onChange(
                            event.target.value
                              .toLowerCase()
                              .replace(/\s+/g, ""),
                          )
                        }}
                      />
                    </FormControl>
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                      {field.value
                        ? `${field.value}.${baseDomain}`
                        : `{subdomain}.${baseDomain}`}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logoSvg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.logoSvg")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        className="font-mono text-xs"
                        placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
                        disabled={isActionLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.wizard.fields.primaryColor")}
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            className="h-9 w-12 cursor-pointer p-1"
                            disabled={isActionLocked}
                            value={
                              field.value?.startsWith("#")
                                ? field.value
                                : field.value
                                  ? `#${field.value}`
                                  : "#1E293B"
                            }
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                          />
                          <Input
                            autoComplete="off"
                            placeholder="#1E293B"
                            disabled={isActionLocked}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accentColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.wizard.fields.accentColor")}
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            className="h-9 w-12 cursor-pointer p-1"
                            disabled={isActionLocked}
                            value={
                              field.value?.startsWith("#")
                                ? field.value
                                : field.value
                                  ? `#${field.value}`
                                  : "#14B8A6"
                            }
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                          />
                          <Input
                            autoComplete="off"
                            placeholder="#14B8A6"
                            disabled={isActionLocked}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="welcomeTagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.wizard.fields.welcomeTagline")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        maxLength={120}
                        disabled={isActionLocked}
                        placeholder={t(
                          "admin.wizard.fields.welcomeTaglinePlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">
                {t("admin.edit.sections.modules")}
              </CardTitle>
              <CardDescription>
                {t("admin.edit.sections.modulesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="activeModules"
                render={() => (
                  <FormItem>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {MODULE_KEYS.map((moduleKey) => {
                        const Icon = MODULE_ICONS[moduleKey]
                        const selected = values.activeModules.includes(moduleKey)

                        return (
                          <button
                            key={moduleKey}
                            type="button"
                            disabled={isActionLocked}
                            onClick={() => {
                              toggleModule(moduleKey)
                            }}
                            className={cn(
                              "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40 hover:bg-muted/40",
                              isActionLocked && "pointer-events-none opacity-60",
                            )}
                          >
                            {selected ? (
                              <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                                <Check className="size-3" />
                              </span>
                            ) : null}
                            <Icon className="size-5 text-foreground" />
                            <span className="text-sm font-medium">
                              {t(`admin.modules.${moduleKey}`)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t(`admin.modules.${moduleKey}Description`)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">
                {t("admin.edit.sections.families")}
              </CardTitle>
              <CardDescription>
                {t("admin.edit.sections.familiesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="assetFamilyKeys"
                render={() => (
                  <FormItem>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {families.map((family) => {
                        const selected = values.assetFamilyKeys.includes(
                          family.key,
                        )
                        const Icon = familyIcon(family.key)
                        const descriptionKey = `admin.wizard.families.descriptions.${family.key}`
                        const description = i18n.exists(descriptionKey)
                          ? t(descriptionKey)
                          : null

                        return (
                          <button
                            key={family.id}
                            type="button"
                            disabled={isActionLocked}
                            onClick={() => {
                              toggleFamily(family.key)
                            }}
                            className={cn(
                              "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40 hover:bg-muted/40",
                              isActionLocked && "pointer-events-none opacity-60",
                            )}
                          >
                            {selected ? (
                              <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                                <Check className="size-3" />
                              </span>
                            ) : null}
                            <Icon className="size-5 text-foreground" />
                            <span className="text-sm font-medium">
                              {family.label}
                            </span>
                            {description ? (
                              <span className="text-xs text-muted-foreground">
                                {description}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <TenantUsersManager tenantId={tenantId} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <RegistrationFieldsManager tenantId={tenantId} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <ModuleMenuItemsManager
                tenantId={tenantId}
                subdomain={values.subdomain}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isActionLocked}
              onClick={() => {
                void navigate("/admin/dashboard")
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isActionLocked}>
              {isSubmitting
                ? t("admin.edit.actions.saving")
                : t("admin.edit.actions.save")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
