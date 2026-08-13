import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"

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
import {
  customerLoginSchema,
  type CustomerLoginFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  loginCustomer,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain, primary } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CustomerLoginFormValues>({
    resolver: zodResolver(customerLoginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: CustomerLoginFormValues) {
    setSubmitting(true)
    try {
      await loginCustomer(subdomain, values)
      toast.success(t("tenantPortal.login.toastSuccess"))
      void navigate(tenantPortalPath(subdomain, "app"), { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.login.toastError"),
      )
    } finally {
      setSubmitting(false)
    }
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
                  <Input type="email" autoComplete="email" {...field} />
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
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <LoadingButton
            type="submit"
            className="w-full"
            loading={submitting}
            loadingLabel={t("tenantPortal.login.submitting")}
            style={{ backgroundColor: primary }}
          >
            {t("tenantPortal.login.submit")}
          </LoadingButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("tenantPortal.login.noAccount")}{" "}
        <Link
          to={tenantPortalPath(subdomain, "register")}
          className="font-medium underline"
          style={{ color: primary }}
        >
          {t("tenantPortal.login.registerLink")}
        </Link>
      </p>
    </div>
  )
}
