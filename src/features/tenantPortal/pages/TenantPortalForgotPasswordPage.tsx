import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
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
import { Input } from "@/components/ui/input"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  buildPasswordResetRequestSchema,
  type PasswordResetRequestFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  requestCustomerPasswordReset,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)
  const schema = useMemo(
    () =>
      buildPasswordResetRequestSchema({
        emailInvalid: t("tenantPortal.validation.emailInvalid"),
      }),
    [t],
  )
  const form = useForm<PasswordResetRequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onTouched",
  })
  const watchedValues = form.watch()
  const isRequestValid = schema.safeParse(watchedValues).success

  async function onSubmit(values: PasswordResetRequestFormValues) {
    setSubmitting(true)
    try {
      await requestCustomerPasswordReset(subdomain, values)
      toast.success(t("tenantPortal.passwordReset.requestToast"))
      void navigate(tenantPortalPath(subdomain, "forgot-password/confirm"), {
        state: { email: values.email },
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.passwordReset.requestError"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t("tenantPortal.passwordReset.requestTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.passwordReset.requestSubtitle")}
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
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormPrimaryButton
            type="submit"
            className="w-full"
            isValid={isRequestValid}
            loading={submitting}
            loadingLabel={t("tenantPortal.passwordReset.requestSubmitting")}
          >
            {t("tenantPortal.passwordReset.requestSubmit")}
          </FormPrimaryButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link to={tenantPortalPath(subdomain)} className="text-primary underline">
          {t("tenantPortal.passwordReset.backToLogin")}
        </Link>
      </p>
    </div>
  )
}
