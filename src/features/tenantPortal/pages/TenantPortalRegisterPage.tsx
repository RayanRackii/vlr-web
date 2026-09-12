import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TENANT_PORTAL_OUTLINE_BUTTON_CLASS } from "@/features/tenantPortal/lib/tenantPortalControlStyles"
import {
  buildCustomerRegisterSchema,
  formatCnpjMask,
  formatCpfMask,
  isReservedRegisterFieldKey,
  normalizeBrazilianPhoneDigits,
  onlyDigits,
  type CustomerType,
  type RegistrationField,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { attachAutofillSync } from "@/features/tenantPortal/lib/syncRegisterAutofill"
import {
  fetchRegistrationSchema,
  fileToCompressedDataUrl,
  persistPendingEmailVerification,
  registerCustomer,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

function extraFieldAutoComplete(fieldType: string): string | undefined {
  if (fieldType === "email") {
    return "email"
  }
  if (fieldType === "phone") {
    return "tel"
  }
  if (fieldType === "cep") {
    return "postal-code"
  }
  return undefined
}

export function TenantPortalRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  const [submitting, setSubmitting] = useState(false)
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [blockedAttempted, setBlockedAttempted] = useState(false)

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
        {
          nameMin: t("tenantPortal.validation.nameMin"),
          nameMax: t("tenantPortal.validation.nameMax"),
          emailInvalid: t("tenantPortal.validation.emailInvalid"),
          passwordMin: t("tenantPortal.validation.passwordMin"),
          phoneInvalid: t("tenantPortal.validation.phoneInvalid"),
          documentRequired: t("tenantPortal.validation.documentRequired"),
          invalidCep: t("tenantPortal.validation.invalidCep"),
          photoRequired: t("tenantPortal.validation.photoRequired"),
          fieldRequired: t("tenantPortal.validation.fieldRequired"),
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
  const formRef = useRef<HTMLFormElement>(null)

  const watchedValues = form.watch()
  const isRegisterValid = schema.safeParse(watchedValues).success
  const extraFields = fields.filter(
    (extra) => !isReservedRegisterFieldKey(extra.fieldKey),
  )
  const missingRequiredPhoto = extraFields.some(
    (extra) =>
      extra.fieldType === "photo" &&
      extra.isRequired &&
      !String(watchedValues[extra.fieldKey] ?? "").trim(),
  )

  useEffect(() => {
    const formElement = formRef.current
    if (!formElement) {
      return
    }

    return attachAutofillSync(formElement, (name, raw) => {
      let next = raw
      if (name === "document") {
        next =
          form.getValues("customerType") === "Company"
            ? formatCnpjMask(raw)
            : formatCpfMask(raw)
      } else if (name === "phone") {
        next = normalizeBrazilianPhoneDigits(raw)
      }
      if (form.getValues(name) === next) {
        return
      }
      form.setValue(name, next, { shouldDirty: true, shouldTouch: true })
    })
  }, [form, schemaLoading, schemaError])

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
        phone: normalizeBrazilianPhoneDigits(String(values.phone ?? "")),
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
      persistPendingEmailVerification(subdomain, {
        email,
        verificationSendFailed,
      })
      void navigate(tenantPortalPath(subdomain, "verify-email"), {
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
          ref={formRef}
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
                      onChange={(event) => {
                        field.onChange(
                          name === "phone"
                            ? normalizeBrazilianPhoneDigits(event.target.value)
                            : event.target.value,
                        )
                      }}
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
                        className={
                          current === "Individual"
                            ? undefined
                            : TENANT_PORTAL_OUTLINE_BUTTON_CLASS
                        }
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
                        className={
                          current === "Company"
                            ? undefined
                            : TENANT_PORTAL_OUTLINE_BUTTON_CLASS
                        }
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
                      name={field.name}
                      ref={field.ref}
                      inputMode="numeric"
                      autoComplete="off"
                      value={String(field.value ?? "")}
                      onBlur={field.onBlur}
                      onChange={(event) => {
                        const next =
                          customerType === "Company"
                            ? formatCnpjMask(event.target.value)
                            : formatCpfMask(event.target.value)
                        field.onChange(next)
                      }}
                      onInput={(event) => {
                        const next =
                          customerType === "Company"
                            ? formatCnpjMask(event.currentTarget.value)
                            : formatCpfMask(event.currentTarget.value)
                        field.onChange(next)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          {extraFields.map((extra) => (
            <FormField
              key={extra.id}
              control={form.control}
              name={extra.fieldKey}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {extra.label}
                    {extra.isRequired
                      ? ` (${t("tenantPortal.register.requiredMark")})`
                      : ` (${t("common.optional")})`}
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
                      <Select
                        modal={false}
                        value={String(field.value ?? "") || null}
                        onValueChange={(value) => {
                          if (typeof value === "string") {
                            field.onChange(value)
                          }
                        }}
                        items={(extra.options ?? []).map((option) => ({
                          value: option,
                          label: option,
                        }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t(
                              "tenantPortal.register.selectPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(extra.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={
                          extra.fieldType === "number"
                            ? "number"
                            : extra.fieldType === "date"
                              ? "date"
                              : extra.fieldType === "email"
                                ? "email"
                                : extra.fieldType === "phone"
                                  ? "tel"
                                  : "text"
                        }
                        autoComplete={extraFieldAutoComplete(extra.fieldType)}
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    )}
                  </FormControl>
                  {extra.fieldType === "photo" && extra.isRequired ? (
                    <p className="text-xs text-muted-foreground">
                      {t("tenantPortal.register.photoRequired")}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <div
            onClick={() => {
              if (isRegisterValid || submitting) {
                return
              }
              setBlockedAttempted(true)
              void form.trigger()
            }}
          >
            <FormPrimaryButton
              type="submit"
              className="w-full"
              isValid={isRegisterValid}
              loading={submitting}
              loadingLabel={t("tenantPortal.register.submitting")}
              aria-describedby={
                blockedAttempted && !isRegisterValid
                  ? "register-blocked-hint"
                  : undefined
              }
            >
              {t("tenantPortal.register.submit")}
            </FormPrimaryButton>
          </div>
          {blockedAttempted && !isRegisterValid ? (
            <p
              id="register-blocked-hint"
              role="status"
              className="text-sm text-destructive"
            >
              {missingRequiredPhoto
                ? t("tenantPortal.register.photoRequired")
                : t("tenantPortal.register.blockedHint")}
            </p>
          ) : null}
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
