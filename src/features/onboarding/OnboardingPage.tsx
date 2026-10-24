import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Building2,
  CircleCheck,
  Hash,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { InputWithIcon } from "@/components/ui/input-icon"
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import { iconProps } from "@/lib/icon"
import { createTenant } from "@/features/onboarding/createTenant"
import {
  createTenantRequestSchema,
  isPublicOnboardingStepValid,
  type CreateTenantRequest,
} from "@/features/onboarding/createTenantSchema"

export function OnboardingPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [inviteEmail, setInviteEmail] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

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
      isTrial: true,
    },
    mode: "onTouched",
  })

  const legalName = useWatch({ control: form.control, name: "legalName" }) ?? ""
  const taxId = useWatch({ control: form.control, name: "taxId" }) ?? ""
  const tradeName = useWatch({ control: form.control, name: "tradeName" }) ?? ""
  const headquartersUnitName =
    useWatch({ control: form.control, name: "headquartersUnitName" }) ?? ""
  const headquartersUnitCode =
    useWatch({ control: form.control, name: "headquartersUnitCode" }) ?? ""
  const adminFullName =
    useWatch({ control: form.control, name: "adminFullName" }) ?? ""
  const adminEmail = useWatch({ control: form.control, name: "adminEmail" }) ?? ""
  const adminPhone = useWatch({ control: form.control, name: "adminPhone" }) ?? ""
  const stepValues: CreateTenantRequest = {
    legalName,
    taxId,
    tradeName,
    headquartersUnitName,
    headquartersUnitCode,
    adminFullName,
    adminEmail,
    adminPhone,
    isTrial: true,
  }
  const isCurrentStepValid = isPublicOnboardingStepValid(step, stepValues)

  const panelSteps = useMemo(
    () => [
      { id: "company", label: t("trial.onboarding.steps.company") },
      { id: "admin", label: t("trial.onboarding.steps.admin") },
      { id: "review", label: t("trial.onboarding.steps.review") },
    ],
    [t],
  )

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
      ])
      if (!ok) {
        return
      }
      setStep(2)
    }
  }

  async function onFinish() {
    const parsed = createTenantRequestSchema.safeParse({
      ...form.getValues(),
      isTrial: true,
    })
    if (!parsed.success) {
      await form.trigger()
      return
    }

    setSubmitting(true)
    try {
      await createTenant(parsed.data)
      setInviteEmail(parsed.data.adminEmail)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("trial.onboarding.errors.failed")
      form.setError("root", { message })
    } finally {
      setSubmitting(false)
    }
  }

  if (inviteEmail !== null) {
    return (
      <AuthLayout
        title={t("trial.onboarding.successTitle")}
        widthClassName="max-w-lg"
      >
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-green-600/30 bg-green-600/10 p-6 text-green-900 dark:text-green-300"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            {t("trial.onboarding.successBody", { email: inviteEmail })}
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t("trial.onboarding.title")}
      subtitle={t("trial.onboarding.description")}
      widthClassName="max-w-2xl"
    >
      <WizardPanelsStepper
        steps={panelSteps}
        ariaLabel={t("trial.onboarding.stepsAria")}
        currentIndex={step}
        onStepClick={(index) => {
          if (index < step) {
            setStep(index)
          }
        }}
        className="mb-6"
      />

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
          }}
          noValidate
        >
          <fieldset className="space-y-6">
            {step === 0 ? (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("trial.onboarding.fields.legalName")}</FormLabel>
                      <FormControl>
                        <InputWithIcon
                          icon={<Building2 {...iconProps("sm")} />}
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
                      <FormLabel>{t("trial.onboarding.fields.taxId")}</FormLabel>
                      <FormControl>
                        <InputWithIcon
                          icon={<Hash {...iconProps("sm")} />}
                          {...field}
                        />
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
                        <InputWithIcon
                          icon={<MapPin {...iconProps("sm")} />}
                          {...field}
                        />
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
                        <InputWithIcon
                          icon={<UserRound {...iconProps("sm")} />}
                          autoComplete="name"
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
                      <FormLabel>{t("trial.onboarding.fields.adminEmail")}</FormLabel>
                      <FormControl>
                        <InputWithIcon
                          icon={<Mail {...iconProps("sm")} />}
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
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
                        <InputWithIcon
                          icon={<Phone {...iconProps("sm")} />}
                          type="tel"
                          placeholder={t("trial.onboarding.fields.phonePlaceholder")}
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-sm text-muted-foreground">
                  {t("trial.onboarding.inviteHint")}
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3 rounded-md border border-border p-4 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.legalName")}:{" "}
                  </span>
                  {stepValues.legalName}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.taxId")}:{" "}
                  </span>
                  {stepValues.taxId}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.adminEmail")}:{" "}
                  </span>
                  {stepValues.adminEmail}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("trial.onboarding.fields.adminPhone")}:{" "}
                  </span>
                  {stepValues.adminPhone}
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
              disabled={step === 0 || submitting}
              onClick={() => {
                setStep((current) => Math.max(0, current - 1))
              }}
            >
              {t("common.back")}
            </Button>
            {step < 2 ? (
              <FormPrimaryButton
                type="button"
                isValid={isCurrentStepValid}
                loading={submitting}
                onClick={() => {
                  void goNext()
                }}
              >
                {t("common.next")}
              </FormPrimaryButton>
            ) : (
              <FormPrimaryButton
                type="button"
                isValid={isCurrentStepValid}
                loading={submitting}
                loadingLabel={t("trial.onboarding.submitting")}
                onClick={() => {
                  void onFinish()
                }}
              >
                {t("trial.onboarding.finish")}
              </FormPrimaryButton>
            )}
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
