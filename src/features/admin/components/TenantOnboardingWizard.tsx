import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Building2,
  Check,
  ClipboardList,
  Layers,
  Package,
  ShoppingBag,
  Tent,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import {
  tenantPortalHref,
  tenantPortalHrefPlaceholder,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  ROLVIX_ACCENT_COLOR,
  ROLVIX_PRIMARY_COLOR,
} from "@/lib/brandColors"
import {
  MODULE_KEYS,
  PRICE_PER_MODULE_BRL,
  step1Schema,
  step2Schema,
  step3Schema,
  stepAdminInviteSchema,
  stepFamiliesSchema,
  tenantOnboardingSchema,
  type ModuleKey,
  type TenantOnboardingFormValues,
  toTenantBrandingPayload,
} from "@/features/admin/schemas/adminTenantSchemas"
import { createAdminTenant } from "@/features/admin/services/adminTenantsService"
import { listAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import { Button } from "@/components/ui/button"
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
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SUCCESS_REDIRECT_MS = 5000

const STEP_COUNT = 6

const MODULE_ICONS = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
  Catalog: ShoppingBag,
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

const STEP_TITLE_KEYS = [
  "admin.wizard.steps.company",
  "admin.wizard.steps.identity",
  "admin.wizard.steps.modules",
  "admin.wizard.steps.families",
  "admin.wizard.steps.admin",
  "admin.wizard.steps.summary",
] as const

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function TenantOnboardingWizard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [familiesError, setFamiliesError] = useState<string | null>(null)
  const redirectTimeoutRef = useRef<number | null>(null)
  const finishInFlightRef = useRef(false)
  const portalUrlPlaceholder = useMemo(() => tenantPortalHrefPlaceholder(), [])

  const form = useForm<TenantOnboardingFormValues>({
    resolver: zodResolver(tenantOnboardingSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      subdomain: "",
      logoSvg: "",
      primaryColor: ROLVIX_PRIMARY_COLOR,
      accentColor: ROLVIX_ACCENT_COLOR,
      welcomeTagline: "",
      activeModules: [],
      assetFamilyKeys: [],
      adminFullName: "",
      adminEmail: "",
    },
    mode: "onTouched",
  })

  const isActionLocked = isFinishing || isSubmitSuccess
  const values = form.watch()
  const monthlyTotal = values.activeModules.length * PRICE_PER_MODULE_BRL

  useEffect(() => {
    let cancelled = false

    void listAssetFamilyCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setFamilies(catalog)
          setFamiliesError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFamilies([])
          setFamiliesError(
            error instanceof Error
              ? error.message
              : t("admin.wizard.errors.familiesLoadFailed"),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  async function handleNext() {
    if (isSubmitSuccess || isFinishing) {
      return
    }

    if (step === 1) {
      const parsed = step1Schema.safeParse({
        legalName: form.getValues("legalName"),
        taxId: form.getValues("taxId"),
      })

      if (!parsed.success) {
        await form.trigger(["legalName", "taxId"])
        return
      }

      setStep(2)
      return
    }

    if (step === 2) {
      const parsed = step2Schema.safeParse({
        subdomain: form.getValues("subdomain"),
        logoSvg: form.getValues("logoSvg"),
        primaryColor: form.getValues("primaryColor"),
        accentColor: form.getValues("accentColor"),
        welcomeTagline: form.getValues("welcomeTagline"),
      })

      if (!parsed.success) {
        await form.trigger([
          "subdomain",
          "logoSvg",
          "primaryColor",
          "accentColor",
          "welcomeTagline",
        ])
        return
      }

      setStep(3)
      return
    }

    if (step === 3) {
      const parsed = step3Schema.safeParse({
        activeModules: form.getValues("activeModules"),
      })

      if (!parsed.success) {
        await form.trigger(["activeModules"])
        return
      }

      setStep(4)
      return
    }

    if (step === 4) {
      if (families.length === 0) {
        toast.error(t("admin.wizard.errorTitle"), {
          description:
            familiesError
            ?? t("admin.wizard.errors.familiesLoadFailed"),
        })
        return
      }

      const parsed = stepFamiliesSchema.safeParse({
        assetFamilyKeys: form.getValues("assetFamilyKeys"),
      })

      if (!parsed.success) {
        await form.trigger(["assetFamilyKeys"])
        return
      }

      setStep(5)
      return
    }

    if (step === 5) {
      const parsed = stepAdminInviteSchema.safeParse({
        adminFullName: form.getValues("adminFullName"),
        adminEmail: form.getValues("adminEmail"),
      })

      if (!parsed.success) {
        await form.trigger(["adminFullName", "adminEmail"])
        return
      }

      setStep(6)
    }
  }

  function handleBack() {
    if (isSubmitSuccess || isFinishing) {
      return
    }

    setStep((current) => Math.max(1, current - 1))
  }

  function toggleModule(moduleKey: ModuleKey) {
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

  async function handleFinish() {
    if (finishInFlightRef.current || isSubmitSuccess) {
      return
    }

    finishInFlightRef.current = true
    setIsFinishing(true)

    const isValid = await form.trigger()

    if (!isValid) {
      finishInFlightRef.current = false
      setIsFinishing(false)
      return
    }

    const payload = form.getValues()

    try {
      await createAdminTenant({
        legalName: payload.legalName.trim(),
        taxId: payload.taxId.trim(),
        subdomain: payload.subdomain.trim().toLowerCase(),
        ...toTenantBrandingPayload(payload),
        activeModules: payload.activeModules,
        assetFamilyKeys: payload.assetFamilyKeys,
        adminFullName: payload.adminFullName.trim() || null,
        adminEmail: payload.adminEmail.trim() || null,
      })

      toast.success(t("admin.wizard.successTitle"), {
        description: t("admin.wizard.success"),
      })

      setIsSubmitSuccess(true)

      redirectTimeoutRef.current = window.setTimeout(() => {
        void navigate("/admin/dashboard", { replace: true })
      }, SUCCESS_REDIRECT_MS)
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.wizard.errors.createFailed")

      toast.error(t("admin.wizard.errorTitle"), {
        description: message,
      })

      setIsSubmitSuccess(false)
      finishInFlightRef.current = false
      setIsFinishing(false)
    }
  }

  const familyLabelByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const family of families) {
      map.set(family.key, family.label)
    }
    return map
  }, [families])

  const panelSteps = useMemo(
    () =>
      STEP_TITLE_KEYS.map((_, index) => ({
        id: `step-${index + 1}`,
        label: t(`admin.wizard.stepShort.${index + 1}`),
      })),
    [t],
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("admin.wizard.stepLabel", { current: step, total: STEP_COUNT })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("admin.wizard.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(STEP_TITLE_KEYS[step - 1])}
          </p>
        </div>

        <WizardPanelsStepper
          steps={panelSteps}
          currentIndex={step - 1}
          onStepClick={(index) => {
            if (!isActionLocked && index < step - 1) {
              setStep(index + 1)
            }
          }}
        />
      </div>

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          {step === 1 ? (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.legalName")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="organization" {...field} />
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
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.subdomain")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        className="font-mono"
                        placeholder="acme"
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
                        ? tenantPortalHref(field.value)
                        : portalUrlPlaceholder}
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
                        autoComplete="off"
                        rows={5}
                        className="min-h-24 font-mono text-xs"
                        placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
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
                          <input
                            type="color"
                            aria-label={t("admin.wizard.fields.primaryColor")}
                            className="size-9 cursor-pointer rounded border border-border bg-transparent p-0"
                            value={
                              field.value?.startsWith("#")
                                ? field.value
                                : field.value
                                  ? `#${field.value}`
                                  : ROLVIX_PRIMARY_COLOR
                            }
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                          />
                          <Input
                            autoComplete="off"
                            placeholder={ROLVIX_PRIMARY_COLOR}
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
                          <input
                            type="color"
                            aria-label={t("admin.wizard.fields.accentColor")}
                            className="size-9 cursor-pointer rounded border border-border bg-transparent p-0"
                            value={
                              field.value?.startsWith("#")
                                ? field.value
                                : field.value
                                  ? `#${field.value}`
                                  : ROLVIX_ACCENT_COLOR
                            }
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                          />
                          <Input
                            autoComplete="off"
                            placeholder={ROLVIX_ACCENT_COLOR}
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
            </div>
          ) : null}

          {step === 3 ? (
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
                          onClick={() => {
                            toggleModule(moduleKey)
                          }}
                          className={cn(
                            "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/40 hover:bg-muted/40",
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
          ) : null}

          {step === 4 ? (
            <FormField
              control={form.control}
              name="assetFamilyKeys"
              render={() => (
                <FormItem>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t("admin.wizard.families.hint")}
                  </p>
                  {familiesError ? (
                    <p className="mb-3 text-sm text-destructive">{familiesError}</p>
                  ) : null}
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
                          onClick={() => {
                            toggleFamily(family.key)
                          }}
                          className={cn(
                            "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/40 hover:bg-muted/40",
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
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("admin.wizard.admin.hint")}
              </p>
              <FormField
                control={form.control}
                name="adminFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.adminFullName")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={t(
                          "admin.wizard.fields.adminFullNamePlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.wizard.fields.adminEmail")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="admin@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{values.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.wizard.fields.taxId")}: {values.taxId}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {tenantPortalHref(values.subdomain)}
                  </p>
                  {values.logoSvg ? (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.wizard.fields.logoSvgSet")}
                    </p>
                  ) : null}
                  {values.welcomeTagline ? (
                    <p className="text-xs text-muted-foreground">
                      {values.welcomeTagline}
                    </p>
                  ) : null}
                </div>
              </div>

              {values.adminEmail || values.adminFullName ? (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.wizard.summary.admin")}
                  </p>
                  <p className="text-sm">{values.adminFullName || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {values.adminEmail}
                  </p>
                </div>
              ) : null}

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.wizard.summary.modules")}
                </p>
                <ul className="space-y-1">
                  {values.activeModules.map((moduleKey) => (
                    <li
                      key={moduleKey}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{t(`admin.modules.${moduleKey}`)}</span>
                      <span className="text-muted-foreground">
                        {formatCurrencyBRL(PRICE_PER_MODULE_BRL)}
                        {t("admin.wizard.summary.perMonth")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.wizard.summary.families")}
                </p>
                <ul className="space-y-1">
                  {values.assetFamilyKeys.map((key) => (
                    <li key={key} className="text-sm">
                      {familyLabelByKey.get(key) ?? key}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium">
                  {t("admin.wizard.summary.total")}
                </span>
                <span className="text-base font-semibold">
                  {formatCurrencyBRL(monthlyTotal)}
                  {t("admin.wizard.summary.perMonth")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.wizard.summary.demoNote")}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={isActionLocked || step === 1}
              onClick={handleBack}
            >
              {t("admin.wizard.actions.back")}
            </Button>

            <div className="flex gap-2">
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

              {step < STEP_COUNT ? (
                <Button
                  type="button"
                  disabled={isActionLocked}
                  onClick={() => void handleNext()}
                >
                  {t("admin.wizard.actions.next")}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={isActionLocked}
                  onClick={() => void handleFinish()}
                >
                  {isFinishing
                    ? t("admin.wizard.actions.finishing")
                    : t("admin.wizard.actions.finish")}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
