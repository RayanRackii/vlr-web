import { zodResolver } from "@hookform/resolvers/zod"
import { Lock, Mail } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"

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
import { PasswordInput } from "@/components/ui/password-input"
import { iconProps } from "@/lib/icon"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  buildCustomerLoginSchema,
  type CustomerLoginFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  CustomerLoginRateLimitedError,
  isCustomerSignedInForTenant,
  loginCustomer,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const schema = useMemo(
    () =>
      buildCustomerLoginSchema({
        emailInvalid: t("tenantPortal.validation.emailInvalid"),
        passwordRequired: t("tenantPortal.validation.passwordRequired"),
      }),
    [t],
  )

  const form = useForm<CustomerLoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })
  const email = useWatch({ control: form.control, name: "email" })
  const password = useWatch({ control: form.control, name: "password" })
  const isLoginValid = schema.safeParse({
    email: email ?? "",
    password: password ?? "",
  }).success

  async function onSubmit(values: CustomerLoginFormValues) {
    setSubmitting(true)
    setLoginError(null)
    try {
      await loginCustomer(subdomain, values)
      toast.success(t("tenantPortal.login.toastSuccess"))
      void navigate(tenantPortalPath(subdomain, "app"), { replace: true })
    } catch (error) {
      if (error instanceof CustomerLoginRateLimitedError) {
        const message =
          error.retryAfterSeconds === null
            ? t("tenantPortal.login.rateLimited")
            : t("tenantPortal.login.rateLimitedWithMinutes", {
                count: Math.ceil(error.retryAfterSeconds / 60),
              })
        toast.error(message)
        setLoginError(message)
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : t("tenantPortal.login.toastError")
      toast.error(message)
      setLoginError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (isCustomerSignedInForTenant(subdomain)) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("tenantPortal.login.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.login.subtitle")}
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.fields.password")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    autoComplete="current-password"
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
          <p className="text-right text-sm">
            <Link
              to={tenantPortalPath(subdomain, "forgot-password")}
              className="inline-flex min-h-11 items-center font-medium text-primary underline"
            >
              {t("tenantPortal.login.forgotPassword")}
            </Link>
          </p>

          {loginError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15 dark:text-destructive-foreground"
            >
              {loginError}
            </p>
          ) : null}

          <FormPrimaryButton
            type="submit"
            className="h-11 w-full"
            isValid={isLoginValid}
            loading={submitting}
            loadingLabel={t("tenantPortal.login.submitting")}
          >
            {t("tenantPortal.login.submit")}
          </FormPrimaryButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("tenantPortal.login.noAccount")}{" "}
        <Link
          to={tenantPortalPath(subdomain, "register")}
          className="inline-flex min-h-11 items-center font-medium text-primary underline"
        >
          {t("tenantPortal.login.registerLink")}
        </Link>
      </p>
    </div>
  )
}
