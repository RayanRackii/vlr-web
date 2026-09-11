import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom"
import { toast } from "sonner"

import { FormPrimaryButton } from "@/components/ui/form-primary-button"
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
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { maskEmail } from "@/features/tenantPortal/lib/maskEmail"
import {
  verifyEmailSchema,
  type VerifyEmailFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  clearPendingEmailVerification,
  persistPendingEmailVerification,
  readPendingEmailVerification,
  resendCustomerEmailVerification,
  tenantPortalPath,
  verifyCustomerEmail,
} from "@/features/tenantPortal/services/tenantPortalService"

const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 45

function isValidVerificationEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    verifyEmailSchema.shape.email.safeParse(value).success
  )
}

export function TenantPortalVerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const locationState =
    typeof location.state === "object" && location.state !== null
      ? (location.state as { email?: unknown; verificationSendFailed?: unknown })
      : null
  const stored = readPendingEmailVerification(subdomain)
  const rawStateEmail =
    typeof locationState?.email === "string" ? locationState.email.trim() : ""
  const emailFromState = isValidVerificationEmail(rawStateEmail)
    ? rawStateEmail
    : ""
  const resolvedEmail =
    emailFromState.length > 0 ? emailFromState : (stored?.email ?? "")
  const emailIsKnown = isValidVerificationEmail(resolvedEmail)
  const verificationSendFailed =
    locationState !== null &&
    Object.prototype.hasOwnProperty.call(locationState, "verificationSendFailed")
      ? locationState.verificationSendFailed === true
      : stored?.verificationSendFailed === true
  const maskedEmail = maskEmail(resolvedEmail)

  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    emailIsKnown && !verificationSendFailed
      ? EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
      : 0,
  )

  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: resolvedEmail, code: "" },
  })

  const watchedValues = form.watch()
  const isVerifyValid = verifyEmailSchema.safeParse(watchedValues).success

  const cooldownActive = cooldownSeconds > 0

  useEffect(() => {
    if (!emailIsKnown) {
      return
    }
    persistPendingEmailVerification(subdomain, {
      email: resolvedEmail,
      verificationSendFailed,
    })
  }, [emailIsKnown, resolvedEmail, subdomain, verificationSendFailed])

  useEffect(() => {
    if (!cooldownActive) {
      return
    }
    const timerId = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => {
      window.clearInterval(timerId)
    }
  }, [cooldownActive])

  async function onSubmit(values: VerifyEmailFormValues) {
    persistPendingEmailVerification(subdomain, {
      email: values.email,
      verificationSendFailed,
    })
    setSubmitting(true)
    try {
      await verifyCustomerEmail(subdomain, values)
      clearPendingEmailVerification(subdomain)
      toast.success(t("tenantPortal.verify.toastSuccess"))
      void navigate(tenantPortalPath(subdomain, "app"), { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.verify.toastError"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    const emailValid = await form.trigger("email")
    if (!emailValid) {
      return
    }

    const email = form.getValues("email")
    setResending(true)
    try {
      await resendCustomerEmailVerification(subdomain, { email })
      persistPendingEmailVerification(subdomain, {
        email,
        verificationSendFailed: false,
      })
      toast.success(t("tenantPortal.verify.resendToastSuccess"))
      setCooldownSeconds(EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.resendEmailVerification"),
      )
    } finally {
      setResending(false)
    }
  }

  const resendDisabled = submitting || cooldownSeconds > 0

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("tenantPortal.verify.title")}</h2>
        {emailIsKnown ? (
          <p className="text-sm text-muted-foreground">
            {t("tenantPortal.verify.subtitle", { maskedEmail })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.verify.expiresHint")}
        </p>
        {verificationSendFailed ? (
          <p
            className="text-sm text-amber-800 dark:text-amber-200"
            role="status"
          >
            <span className="font-medium">
              {t("tenantPortal.verify.sendFailedTitle")}{" "}
            </span>
            {t("tenantPortal.verify.sendFailedBody")}
          </p>
        ) : null}
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {emailIsKnown ? (
            <input type="hidden" {...form.register("email")} />
          ) : (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tenantPortal.fields.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.fields.code")}</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...field}
                    onChange={(event) => {
                      field.onChange(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormPrimaryButton
            type="submit"
            className="w-full"
            isValid={isVerifyValid}
            loading={submitting}
            loadingLabel={t("tenantPortal.verify.submitting")}
            disabled={resending}
          >
            {t("tenantPortal.verify.submit")}
          </FormPrimaryButton>
          <LoadingButton
            type="button"
            variant="outline"
            className="w-full"
            loading={resending}
            loadingLabel={t("tenantPortal.verify.resendSubmitting")}
            disabled={resendDisabled}
            onClick={() => {
              void onResend()
            }}
          >
            {cooldownSeconds > 0
              ? t("tenantPortal.verify.resendIn", { seconds: cooldownSeconds })
              : t("tenantPortal.verify.resend")}
          </LoadingButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to={tenantPortalPath(subdomain)}
          className="text-primary underline"
        >
          {t("tenantPortal.verify.backToLogin")}
        </Link>
      </p>
    </div>
  )
}
