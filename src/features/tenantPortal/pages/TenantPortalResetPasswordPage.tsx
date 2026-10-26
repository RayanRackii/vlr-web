import { zodResolver } from "@hookform/resolvers/zod"
import { Lock, Mail } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
import { iconProps } from "@/lib/icon"
import { cn } from "@/lib/utils"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { InputWithIcon } from "@/components/ui/input-icon"
import { PasswordInput } from "@/components/ui/password-input"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { maskEmail } from "@/features/tenantPortal/lib/maskEmail"
import { TENANT_PORTAL_OUTLINE_BUTTON_CLASS } from "@/features/tenantPortal/lib/tenantPortalControlStyles"
import {
  buildPasswordResetConfirmSchema,
  isValidCustomerEmail,
  type PasswordResetConfirmFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  clearCustomerSession,
  confirmCustomerPasswordReset,
  requestCustomerPasswordReset,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 45

export function TenantPortalResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const locationState =
    typeof location.state === "object" && location.state !== null
      ? (location.state as { email?: unknown })
      : null
  const rawEmail =
    typeof locationState?.email === "string" ? locationState.email.trim() : ""
  const emailFromState = isValidCustomerEmail(rawEmail) ? rawEmail : ""

  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    emailFromState.length > 0 ? PASSWORD_RESET_RESEND_COOLDOWN_SECONDS : 0,
  )

  const schema = useMemo(
    () =>
      buildPasswordResetConfirmSchema({
        emailInvalid: t("tenantPortal.validation.emailInvalid"),
        codeInvalid: t("tenantPortal.validation.codeInvalid"),
        passwordMin: t("tenantPortal.validation.passwordMin"),
        passwordMismatch: t("tenantPortal.validation.passwordMismatch"),
      }),
    [t],
  )

  const form = useForm<PasswordResetConfirmFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: emailFromState,
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const watchedValues = form.watch()
  const isConfirmValid = schema.safeParse(watchedValues).success
  const cooldownActive = cooldownSeconds > 0
  const maskedEmail = maskEmail(emailFromState)

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

  async function onSubmit(values: PasswordResetConfirmFormValues) {
    setSubmitting(true)
    try {
      await confirmCustomerPasswordReset(subdomain, {
        email: values.email,
        code: values.code,
        newPassword: values.newPassword,
      })
      clearCustomerSession()
      toast.success(t("tenantPortal.passwordReset.toastSuccess"))
      void navigate(tenantPortalPath(subdomain), { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.passwordReset.toastError"),
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
      await requestCustomerPasswordReset(subdomain, { email })
      toast.success(t("tenantPortal.passwordReset.resendToast"))
      setCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.passwordReset.requestError"),
      )
    } finally {
      setResending(false)
    }
  }

  const resendDisabled = submitting || cooldownSeconds > 0

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t("tenantPortal.passwordReset.confirmTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {emailFromState.length > 0
            ? t("tenantPortal.passwordReset.confirmSubtitle", { maskedEmail })
            : t("tenantPortal.passwordReset.confirmSubtitleNoEmail")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.passwordReset.expiresHint")}
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {emailFromState.length > 0 ? (
            <input type="hidden" {...form.register("email")} />
          ) : (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tenantPortal.fields.email")}</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      icon={<Mail {...iconProps("sm")} />}
                      type="email"
                      autoComplete="email"
                      className="h-11"
                      {...field}
                    />
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
                    className="h-11"
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
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.passwordReset.newPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    autoComplete="new-password"
                    showLabel={t("auth.showPassword")}
                    hideLabel={t("auth.hidePassword")}
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("tenantPortal.passwordReset.confirmPassword")}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    autoComplete="new-password"
                    showLabel={t("auth.showPassword")}
                    hideLabel={t("auth.hidePassword")}
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormPrimaryButton
            type="submit"
            className="h-11 w-full"
            isValid={isConfirmValid}
            loading={submitting}
            loadingLabel={t("tenantPortal.passwordReset.submitting")}
            disabled={resending}
          >
            {t("tenantPortal.passwordReset.submit")}
          </FormPrimaryButton>
          <LoadingButton
            type="button"
            variant="outline"
            className={cn("h-11 w-full", TENANT_PORTAL_OUTLINE_BUTTON_CLASS)}
            loading={resending}
            loadingLabel={t("tenantPortal.passwordReset.resendSubmitting")}
            disabled={resendDisabled}
            onClick={() => {
              void onResend()
            }}
          >
            {cooldownSeconds > 0
              ? t("tenantPortal.passwordReset.resendIn", {
                  seconds: cooldownSeconds,
                })
              : t("tenantPortal.passwordReset.resend")}
          </LoadingButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to={tenantPortalPath(subdomain)}
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {t("tenantPortal.passwordReset.backToLogin")}
        </Link>
      </p>
    </div>
  )
}
