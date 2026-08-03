import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
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
  customerRegisterSchema,
  type CustomerRegisterFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fileToCompressedDataUrl,
  registerCustomer,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain, primary } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CustomerRegisterFormValues>({
    resolver: zodResolver(
      customerRegisterSchema.refine(
        (values) => values.password === values.confirmPassword,
        {
          message: t("tenantPortal.validation.passwordMismatch"),
          path: ["confirmPassword"],
        },
      ),
    ),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      cpf: "",
      postalCode: "",
      phone: "",
      photoDataUrl: "",
    },
  })

  async function onPhotoChange(file: File | undefined) {
    if (!file) {
      form.setValue("photoDataUrl", "", { shouldValidate: true })
      return
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      form.setValue("photoDataUrl", dataUrl, { shouldValidate: true })
    } catch {
      toast.error(t("tenantPortal.register.photoError"))
    }
  }

  async function onSubmit(values: CustomerRegisterFormValues) {
    setSubmitting(true)
    try {
      await registerCustomer(subdomain, {
        name: values.name,
        email: values.email,
        password: values.password,
        cpf: values.cpf,
        postalCode: values.postalCode,
        phone: values.phone,
        photoUrl: values.photoDataUrl,
      })
      toast.success(t("tenantPortal.register.toastSuccess"))
      void navigate(`/t/${subdomain}/verify-phone`, {
        replace: true,
        state: { email: values.email },
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.register.toastError"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t("tenantPortal.register.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.register.subtitle")}
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <FormItem>
            <FormLabel>{t("tenantPortal.fields.photo")}</FormLabel>
            <FormControl>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void onPhotoChange(event.target.files?.[0])
                }}
              />
            </FormControl>
            <FormMessage>
              {form.formState.errors.photoDataUrl?.message}
            </FormMessage>
          </FormItem>

          {(
            [
              ["name", "text", "name"],
              ["email", "email", "email"],
              ["password", "password", "new-password"],
              ["confirmPassword", "password", "new-password"],
              ["cpf", "text", "off"],
              ["postalCode", "text", "postal-code"],
              ["phone", "tel", "tel"],
            ] as const
          ).map(([name, type, autoComplete]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(`tenantPortal.fields.${name}`)}</FormLabel>
                  <FormControl>
                    <Input
                      type={type}
                      autoComplete={autoComplete}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            style={{ backgroundColor: primary }}
          >
            {submitting
              ? t("tenantPortal.register.submitting")
              : t("tenantPortal.register.submit")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("tenantPortal.register.hasAccount")}{" "}
        <Link
          to={`/t/${subdomain}`}
          className="font-medium underline"
          style={{ color: primary }}
        >
          {t("tenantPortal.register.loginLink")}
        </Link>
      </p>
    </div>
  )
}
