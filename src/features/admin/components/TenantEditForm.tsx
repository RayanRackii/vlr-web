import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Package,
  Tent,
  Wrench,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { getTenantBaseDomain } from "@/features/admin/hooks/usePlatformAdmin"
import {
  MODULE_KEYS,
  tenantOnboardingSchema,
  type ModuleKey,
  type TenantOnboardingFormValues,
} from "@/features/admin/schemas/adminTenantSchemas"
import { updateAdminTenant } from "@/features/admin/services/adminTenantsService"
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
import { cn } from "@/lib/utils"

const SUCCESS_REDIRECT_MS = 5000

const MODULE_ICONS = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
} as const

type TenantEditFormProps = {
  tenantId: string
  initialValues: TenantOnboardingFormValues
}

export function TenantEditForm({ tenantId, initialValues }: TenantEditFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)
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

  async function handleSubmit(values: TenantOnboardingFormValues) {
    if (isSubmitSuccess) {
      return
    }

    setSubmitError(null)

    try {
      await updateAdminTenant(tenantId, {
        legalName: values.legalName.trim(),
        taxId: values.taxId.trim(),
        subdomain: values.subdomain.trim().toLowerCase(),
        logoUrl: values.logoUrl?.trim() ? values.logoUrl.trim() : null,
        activeModules: values.activeModules,
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

      setSubmitError(message)
      setIsSubmitSuccess(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.edit.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.edit.description")}
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit(handleSubmit)()
          }}
        >
          <section className="space-y-4">
            <h2 className="text-sm font-medium">
              {t("admin.wizard.stepShort.1")}
            </h2>
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.wizard.fields.legalName")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="organization" disabled={isActionLocked} {...field} />
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
                    <Input autoComplete="off" disabled={isActionLocked} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium">
              {t("admin.wizard.stepShort.2")}
            </h2>
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
                    <Input type="url" placeholder="https://" disabled={isActionLocked} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium">
              {t("admin.wizard.stepShort.3")}
            </h2>
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
          </section>

          {isSubmitSuccess ? (
            <Alert>
              <CircleCheck />
              <AlertTitle>{t("admin.edit.successTitle")}</AlertTitle>
              <AlertDescription>{t("admin.edit.success")}</AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{t("admin.edit.errorTitle")}</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-end">
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
