import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import { createTenant } from "@/features/onboarding/createTenant"
import {
  createTenantRequestSchema,
  type CreateTenantRequest,
} from "@/features/onboarding/createTenantSchema"

const SUCCESS_REDIRECT_DELAY_MS = 3000

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)

  const form = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantRequestSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      tradeName: "",
      headquartersUnitName: "Matriz",
      headquartersUnitCode: "",
      adminFullName: "",
      adminEmail: "",
      adminPhone: "",
      adminPassword: "",
      isTrial: true,
    },
  })

  const isSubmitting = form.formState.isSubmitting
  const values = form.watch()

  const panelSteps = useMemo(
    () => [
      { id: "company", label: t("trial.onboarding.steps.company") },
      { id: "admin", label: t("trial.onboarding.steps.admin") },
      { id: "review", label: t("trial.onboarding.steps.review") },
    ],
    [t],
  )

  useEffect(() => {
    if (!showSuccessAlert) {
      return
    }

    window.scrollTo({ top: 0, behavior: "smooth" })

    const timeoutId = window.setTimeout(() => {
      void navigate("/login")
    }, SUCCESS_REDIRECT_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [navigate, showSuccessAlert])

  async function goNext() {
    if (step === 0) {
      const ok = await form.trigger([
        "legalName",
        "taxId",
        "headquartersUnitName",
      ])
      if (!ok) {
        return
      }
      setStep(1)
      return
    }

    if (step === 1) {
      const ok = await form.trigger([
        "adminFullName",
        "adminEmail",
        "adminPhone",
        "adminPassword",
      ])
      if (!ok) {
        return
      }
      setStep(2)
    }
  }

  async function onFinish() {
    try {
      await createTenant({ ...form.getValues(), isTrial: true })
      setShowSuccessAlert(true)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("trial.onboarding.errors.failed")
      form.setError("root", { message })
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("trial.onboarding.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("trial.onboarding.description")}
        </p>
      </header>

      <WizardPanelsStepper
        steps={panelSteps}
        currentIndex={step}
        onStepClick={(index) => {
          if (index < step) {
            setStep(index)
          }
        }}
      />

      {showSuccessAlert ? (
        <div
          role="alert"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">{t("trial.onboarding.successTitle")}</p>
              <p className="text-sm">{t("trial.onboarding.successBody")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
          }}
          noValidate
        >
          <fieldset className="space-y-6" disabled={showSuccessAlert}>
            {step === 0 ? (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("trial.onboarding.fields.legalName")}</FormLabel>
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
                      <FormLabel>{t("trial.onboarding.fields.taxId")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="headquartersUnitName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("trial.onboarding.fields.headquarters")}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t("trial.onboarding.subdomainHint")}
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="adminFullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("trial.onboarding.fields.adminName")}</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" {...field} />
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
                      <FormLabel>{t("trial.onboarding.fields.adminEmail")}</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("trial.onboarding.fields.adminPhone")}</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="11999999999"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("trial.onboarding.fields.adminPassword")}
                      </FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3 rounded-md border border-border p-4 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.legalName")}:{" "}
                  </span>
                  {values.legalName}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.taxId")}:{" "}
                  </span>
                  {values.taxId}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.adminEmail")}:{" "}
                  </span>
                  {values.adminEmail}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.adminPhone")}:{" "}
                  </span>
                  {values.adminPhone}
                </p>
                <p className="text-muted-foreground">
                  {t("trial.onboarding.reviewLimits")}
                </p>
              </div>
            ) : null}

            {form.formState.errors.root ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            ) : null}
          </fieldset>

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || showSuccessAlert || isSubmitting}
              onClick={() => {
                setStep((current) => Math.max(0, current - 1))
              }}
            >
              {t("common.back")}
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                disabled={showSuccessAlert || isSubmitting}
                onClick={() => {
                  void goNext()
                }}
              >
                {t("common.next")}
              </Button>
            ) : (
              <LoadingButton
                type="button"
                loading={isSubmitting}
                loadingLabel={t("trial.onboarding.submitting")}
                disabled={showSuccessAlert}
                onClick={() => {
                  void onFinish()
                }}
              >
                {t("trial.onboarding.finish")}
              </LoadingButton>
            )}
          </div>
        </form>
      </Form>
    </main>
  )
}
