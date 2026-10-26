import { zodResolver } from "@hookform/resolvers/zod"
import { Mail } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
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
import { InputWithIcon } from "@/components/ui/input-icon"
import { iconProps } from "@/lib/icon"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { attachAutofillSync } from "@/features/tenantPortal/lib/syncRegisterAutofill"
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
    mode: "onChange",
  })
  const emailValue = useWatch({ control: form.control, name: "email" }) ?? ""
  const isRequestValid = schema.safeParse({ email: emailValue }).success
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const formElement = formRef.current
    if (!formElement) {
      return
    }

    const applyEmail = (raw: string) => {
      if (raw.length === 0 || form.getValues("email") === raw) {
        return
      }
      form.setValue("email", raw, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
    }

    const detach = attachAutofillSync(formElement, (name, raw) => {
      if (name !== "email") {
        return
      }
      applyEmail(raw)
    })

    const rescan = () => {
      const input = formElement.querySelector<HTMLInputElement>(
        'input[name="email"]',
      )
      if (!input) {
        return
      }
      applyEmail(input.value)
    }

    const timer = window.setTimeout(rescan, 0)

    return () => {
      detach()
      window.clearTimeout(timer)
    }
  }, [form])

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
        <form
          ref={formRef}
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
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
          <FormPrimaryButton
            type="submit"
            className="h-11 w-full"
            isValid={isRequestValid}
            loading={submitting}
            loadingLabel={t("tenantPortal.passwordReset.requestSubmitting")}
          >
            {t("tenantPortal.passwordReset.requestSubmit")}
          </FormPrimaryButton>
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
