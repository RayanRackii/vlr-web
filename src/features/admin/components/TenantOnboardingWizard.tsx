import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Building2,
  Check,
  CircleCheck,
  ClipboardList,
  CircleAlert,
  Package,
  Tent,
  Wrench,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { getTenantBaseDomain } from "@/lib/tenantDomain"
import {
  MODULE_KEYS,
  PRICE_PER_MODULE_BRL,
  step1Schema,
  step2Schema,
  step3Schema,
  stepAdminInviteSchema,
  tenantOnboardingSchema,
  type ModuleKey,
  type TenantOnboardingFormValues,
  toTenantBrandingPayload,
} from "@/features/admin/schemas/adminTenantSchemas"
import { createAdminTenant } from "@/features/admin/services/adminTenantsService"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { cn } from "@/lib/utils"

const SUCCESS_REDIRECT_MS = 5000

const STEP_COUNT = 5

const MODULE_ICONS = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
} as const

const STEP_TITLE_KEYS = [
  "admin.wizard.steps.company",
  "admin.wizard.steps.identity",
  "admin.wizard.steps.modules",
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)
  const redirectTimeoutRef = useRef<number | null>(null)
  const baseDomain = useMemo(() => getTenantBaseDomain(), [])

  const form = useForm<TenantOnboardingFormValues>({
    resolver: zodResolver(tenantOnboardingSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      subdomain: "",
      logoSvg: "",
      primaryColor: "#0F766E",
      accentColor: "#14B8A6",
      welcomeTagline: "",
      activeModules: [],
      adminFullName: "",
      adminEmail: "",
    },
    mode: "onTouched",
  })

  const isSubmitting = form.formState.isSubmitting
  const isActionLocked = isSubmitting || isSubmitSuccess
  const values = form.watch()
  const monthlyTotal = values.activeModules.length * PRICE_PER_MODULE_BRL

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  async function handleNext() {
    if (isSubmitSuccess) {
      return
    }

    setSubmitError(null)

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
      const parsed = stepAdminInviteSchema.safeParse({
        adminFullName: form.getValues("adminFullName"),
        adminEmail: form.getValues("adminEmail"),
      })

      if (!parsed.success) {
        await form.trigger(["adminFullName", "adminEmail"])
        return
      }

      setStep(5)
    }
  }

  function handleBack() {
    if (isSubmitSuccess) {
      return
    }

    setSubmitError(null)
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

  async function handleFinish() {
    if (isSubmitSuccess) {
      return
    }

    setSubmitError(null)

    const isValid = await form.trigger()

    if (!isValid) {
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
        adminFullName: payload.adminFullName.trim() || null,
        adminEmail: payload.adminEmail.trim() || null,
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
      setSubmitError(message)
      setIsSubmitSuccess(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
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

        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index + 1 <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <ol className="hidden gap-2 sm:grid sm:grid-cols-5">
          {STEP_TITLE_KEYS.map((titleKey, index) => {
            const stepNumber = index + 1
            const isActive = stepNumber === step
            const isDone = stepNumber < step

            return (
              <li
                key={titleKey}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-center text-[11px] leading-tight",
                  isActive
                    ? "border-primary bg-primary/5 text-foreground"
                    : isDone
                      ? "border-border text-muted-foreground"
                      : "border-transparent text-muted-foreground/70",
                )}
              >
                {t(`admin.wizard.stepShort.${stepNumber}` as const)}
              </li>
            )
          })}
        </ol>
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
                        rows={5}
                        className="font-mono text-xs"
                        placeholder="<svg ...>...</svg>"
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
                            value={
                              field.value?.startsWith("#")
                                ? field.value
                                : field.value
                                  ? `#${field.value}`
                                  : "#0F766E"
                            }
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                          />
                          <Input
                            autoComplete="off"
                            placeholder="#0F766E"
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
                        placeholder={t("admin.wizard.fields.adminFullNamePlaceholder")}
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

          {step === 5 ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{values.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.wizard.fields.taxId")}: {values.taxId}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {values.subdomain}.{baseDomain}
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
                  <div className="flex items-center gap-2 pt-1">
                    {values.primaryColor ? (
                      <span
                        className="inline-block size-4 rounded-full border border-border"
                        style={{
                          backgroundColor: values.primaryColor.startsWith("#")
                            ? values.primaryColor
                            : `#${values.primaryColor}`,
                        }}
                        title={t("admin.wizard.fields.primaryColor")}
                      />
                    ) : null}
                    {values.accentColor ? (
                      <span
                        className="inline-block size-4 rounded-full border border-border"
                        style={{
                          backgroundColor: values.accentColor.startsWith("#")
                            ? values.accentColor
                            : `#${values.accentColor}`,
                        }}
                        title={t("admin.wizard.fields.accentColor")}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              {(values.adminEmail || values.adminFullName) ? (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.wizard.summary.admin")}
                  </p>
                  <p className="text-sm">{values.adminFullName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{values.adminEmail}</p>
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

          {isSubmitSuccess ? (
            <Alert>
              <CircleCheck />
              <AlertTitle>{t("admin.wizard.successTitle")}</AlertTitle>
              <AlertDescription>
                {t("admin.wizard.success")}
              </AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{t("admin.wizard.errorTitle")}</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
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
                  {isSubmitting
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
