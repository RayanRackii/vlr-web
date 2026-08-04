import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom"
import { toast } from "sonner"

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
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  verifyPhoneSchema,
  type VerifyPhoneFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  tenantPortalPath,
  verifyCustomerPhone,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalVerifyPhonePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { subdomain, primary } = useOutletContext<TenantPortalOutletContext>()
  const emailFromState =
    typeof location.state === "object"
    && location.state !== null
    && "email" in location.state
    && typeof (location.state as { email?: unknown }).email === "string"
      ? (location.state as { email: string }).email
      : ""

  const [submitting, setSubmitting] = useState(false)

  const form = useForm<VerifyPhoneFormValues>({
    resolver: zodResolver(verifyPhoneSchema),
    defaultValues: { email: emailFromState, code: "" },
  })

  async function onSubmit(values: VerifyPhoneFormValues) {
    setSubmitting(true)
    try {
      await verifyCustomerPhone(subdomain, values)
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

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("tenantPortal.verify.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.verify.subtitle")}
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            style={{ backgroundColor: primary }}
          >
            {submitting
              ? t("tenantPortal.verify.submitting")
              : t("tenantPortal.verify.submit")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to={tenantPortalPath(subdomain)}
          className="underline"
          style={{ color: primary }}
        >
          {t("tenantPortal.verify.backToLogin")}
        </Link>
      </p>
    </div>
  )
}
