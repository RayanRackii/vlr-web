import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Building2,
  Check,
  ClipboardList,
  Package,
  Tent,
  Wrench,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getTenantBaseDomain } from "@/features/admin/hooks/usePlatformAdmin"
import {
  MODULE_KEYS,
  PRICE_PER_MODULE_BRL,
  step1Schema,
  step2Schema,
  step3Schema,
  tenantOnboardingSchema,
  type ModuleKey,
  type TenantOnboardingFormValues,
} from "@/features/admin/schemas/adminTenantSchemas"
import { createAdminTenant } from "@/features/admin/services/adminTenantsService"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type TenantOnboardingWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const STEP_COUNT = 4

const MODULE_ICONS = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
} as const

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function TenantOnboardingWizard({
  open,
  onOpenChange,
  onCreated,
}: TenantOnboardingWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const baseDomain = useMemo(() => getTenantBaseDomain(), [])

  const form = useForm<TenantOnboardingFormValues>({
    resolver: zodResolver(tenantOnboardingSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      subdomain: "",
      logoUrl: "",
      activeModules: [],
    },
    mode: "onTouched",
  })

  const isSubmitting = form.formState.isSubmitting
  const values = form.watch()
  const monthlyTotal = values.activeModules.length * PRICE_PER_MODULE_BRL

  function resetWizard() {
    setStep(1)
    setSubmitError(null)
    form.reset()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetWizard()
    }

    onOpenChange(nextOpen)
  }

  async function handleNext() {
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
        logoUrl: form.getValues("logoUrl"),
      })

      if (!parsed.success) {
        await form.trigger(["subdomain", "logoUrl"])
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
    }
  }

  function handleBack() {
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
        logoUrl: payload.logoUrl?.trim() ? payload.logoUrl.trim() : null,
        activeModules: payload.activeModules,
      })

      resetWizard()
      onOpenChange(false)
      onCreated()
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("admin.wizard.errors.createFailed")
      setSubmitError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>{t("admin.wizard.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.wizard.stepLabel", { current: step, total: STEP_COUNT })}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex gap-1">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index + 1 <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
            }}
          >
            {step === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("admin.wizard.steps.company")}
                </p>
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.wizard.fields.legalName")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="organization"
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
                <p className="text-sm text-muted-foreground">
                  {t("admin.wizard.steps.identity")}
                </p>
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
                              event.target.value.toLowerCase().replace(/\s+/g, ""),
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
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.wizard.fields.logoUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://"
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("admin.wizard.steps.modules")}
                </p>
                <FormField
                  control={form.control}
                  name="activeModules"
                  render={() => (
                    <FormItem>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {MODULE_KEYS.map((moduleKey) => {
                          const Icon = MODULE_ICONS[moduleKey]
                          const selected =
                            values.activeModules.includes(moduleKey)

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
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("admin.wizard.steps.summary")}
                </p>
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
                      {values.logoUrl ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {values.logoUrl}
                        </p>
                      ) : null}
                    </div>
                  </div>

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
              </div>
            ) : null}

            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
          </form>
        </Form>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting || step === 1}
            onClick={handleBack}
          >
            {t("admin.wizard.actions.back")}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                handleOpenChange(false)
              }}
            >
              {t("common.cancel")}
            </Button>

            {step < STEP_COUNT ? (
              <Button type="button" onClick={() => void handleNext()}>
                {t("admin.wizard.actions.next")}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleFinish()}
              >
                {isSubmitting
                  ? t("admin.wizard.actions.finishing")
                  : t("admin.wizard.actions.finish")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
