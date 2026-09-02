import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
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
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  buildCustomerRegisterSchema,
  formatCnpjMask,
  formatCpfMask,
  isReservedRegisterFieldKey,
  onlyDigits,
  type CustomerType,
  type RegistrationField,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fetchRegistrationSchema,
  fileToCompressedDataUrl,
  registerCustomer,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSchemaLoading(true)
    void fetchRegistrationSchema(subdomain)
      .then((schema) => {
        if (!cancelled) {
          setFields(schema.fields)
          setSchemaError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSchemaError(t("tenantPortal.register.schemaError"))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSchemaLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [subdomain, t])

  const schema = useMemo(
    () =>
      buildCustomerRegisterSchema(
        fields,
        t("tenantPortal.validation.passwordMismatch"),
        {
          invalidCpf: t("tenantPortal.validation.invalidCpf"),
          invalidCnpj: t("tenantPortal.validation.invalidCnpj"),
        },
      ),
    [fields, t],
  )

  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      customerType: "Individual",
      document: "",
    }
    for (const field of fields) {
      if (isReservedRegisterFieldKey(field.fieldKey)) {
        continue
      }
      values[field.fieldKey] = field.fieldType === "boolean" ? false : ""
    }
    return values
  }, [fields])

  const form = useForm<Record<string, unknown>>({
    // Dynamic schema includes core + tenant extras.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    values: defaultValues,
  })

  async function onPhotoChange(fieldKey: string, file: File | undefined) {
    if (!file) {
      form.setValue(fieldKey, "", { shouldValidate: true })
      return
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      form.setValue(fieldKey, dataUrl, { shouldValidate: true })
    } catch {
      toast.error(t("tenantPortal.register.photoError"))
    }
  }

  async function onSubmit(values: Record<string, unknown>) {
    setSubmitting(true)
    try {
      const attributes: Record<string, string | number | boolean> = {}
      for (const field of fields) {
        if (isReservedRegisterFieldKey(field.fieldKey)) {
          continue
        }
        const value = values[field.fieldKey]
        if (value === undefined || value === null || value === "") {
          continue
        }
        attributes[field.fieldKey] = value as string | number | boolean
      }

      const email = String(values.email ?? "")
      const data = await registerCustomer(subdomain, {
        name: String(values.name ?? ""),
        email,
        password: String(values.password ?? ""),
        phone: String(values.phone ?? ""),
        customerType:
          values.customerType === "Company" ? "Company" : "Individual",
        document: onlyDigits(String(values.document ?? "")),
        attributes,
      })
      const verificationSendFailed = !data.verificationStarted
      if (verificationSendFailed) {
        toast.warning(t("tenantPortal.register.pendingContinue"))
      } else {
        toast.success(t("tenantPortal.register.toastSuccess"))
      }
      void navigate(tenantPortalPath(subdomain, "verify-phone"), {
        replace: true,
        state: { email, verificationSendFailed },
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

  if (schemaLoading) {
    return <FormSkeleton fields={5} />
  }

  if (schemaError) {
    return <p className="text-sm text-destructive">{schemaError}</p>
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
          {(
            [
              ["name", "text", "name"],
              ["email", "email", "email"],
              ["password", "password", "new-password"],
              ["confirmPassword", "password", "new-password"],
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
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <FormField
            control={form.control}
            name="customerType"
            render={({ field }) => {
              const current: CustomerType =
                field.value === "Company" ? "Company" : "Individual"
              return (
                <FormItem>
                  <FormLabel>{t("tenantPortal.fields.customerType")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={current === "Individual" ? "default" : "outline"}
                        onClick={() => {
                          field.onChange("Individual")
                          form.setValue("document", "")
                        }}
                      >
                        {t("tenantPortal.fields.individual")}
                      </Button>
                      <Button
                        type="button"
                        variant={current === "Company" ? "default" : "outline"}
                        onClick={() => {
                          field.onChange("Company")
                          form.setValue("document", "")
                        }}
                      >
                        {t("tenantPortal.fields.company")}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormField
            control={form.control}
            name="document"
            render={({ field }) => {
              const customerType =
                form.watch("customerType") === "Company"
                  ? "Company"
                  : "Individual"
              return (
                <FormItem>
                  <FormLabel>
                    {customerType === "Company"
                      ? t("tenantPortal.fields.cnpj")
                      : t("tenantPortal.fields.cpf")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      value={String(field.value ?? "")}
                      onChange={(event) => {
                        const next =
                          customerType === "Company"
                            ? formatCnpjMask(event.target.value)
                            : formatCpfMask(event.target.value)
                        field.onChange(next)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          {fields
            .filter((extra) => !isReservedRegisterFieldKey(extra.fieldKey))
            .map((extra) => (
            <FormField
              key={extra.id}
              control={form.control}
              name={extra.fieldKey}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {extra.label}
                    {extra.isRequired ? "" : ` (${t("common.optional")})`}
                  </FormLabel>
                  <FormControl>
                    {extra.fieldType === "boolean" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(event) => {
                            field.onChange(event.target.checked)
                          }}
                        />
                        {extra.label}
                      </label>
                    ) : extra.fieldType === "photo" ? (
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          void onPhotoChange(
                            extra.fieldKey,
                            event.target.files?.[0],
                          )
                        }}
                      />
                    ) : extra.fieldType === "select" ? (
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        value={String(field.value ?? "")}
                        onChange={field.onChange}
                      >
                        <option value="">
                          {t("tenantPortal.register.selectPlaceholder")}
                        </option>
                        {(extra.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={
                          extra.fieldType === "number"
                            ? "number"
                            : extra.fieldType === "date"
                              ? "date"
                              : extra.fieldType === "email"
                                ? "email"
                                : "text"
                        }
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <LoadingButton
            type="submit"
            className="w-full"
            loading={submitting}
            loadingLabel={t("tenantPortal.register.submitting")}
          >
            {t("tenantPortal.register.submit")}
          </LoadingButton>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("tenantPortal.register.hasAccount")}{" "}
        <Link
          to={tenantPortalPath(subdomain)}
          className="font-medium text-primary underline"
        >
          {t("tenantPortal.register.loginLink")}
        </Link>
      </p>
    </div>
  )
}
