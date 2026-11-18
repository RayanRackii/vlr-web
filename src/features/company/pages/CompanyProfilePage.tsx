import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, MapPin } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Page } from "@/components/layout/Page"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BRAZILIAN_STATES, maskCepInput, maskTaxIdInput } from "@/features/company/lib/companyMasks"
import {
  createCompanyFormSchema,
  emptyCompanyForm,
  formToWriteBody,
  profileToForm,
  type CompanyFormValues,
  type CompanyProfile,
} from "@/features/company/schemas/companySchemas"
import { getCompanyProfile, updateCompanyProfile } from "@/features/company/services/companyService"
import { maskPhoneInput } from "@/features/tenantPortal/lib/masks"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type TextFieldName = Exclude<keyof CompanyFormValues, "state">

type TextFieldOptions = {
  mask?: (raw: string) => string
  type?: string
  inputMode?: "numeric" | "tel" | "email" | "text"
  autoComplete?: string
  maxLength?: number
  className?: string
  help?: string
}

/** Server values arrive as digits; the form shows them masked. */
function toMaskedForm(profile: CompanyProfile): CompanyFormValues {
  const values = profileToForm(profile)
  return {
    ...values,
    taxId: maskTaxIdInput(values.taxId),
    contactPhone: maskPhoneInput(values.contactPhone),
    postalCode: maskCepInput(values.postalCode),
  }
}

/** Configurações › Dados da empresa: the tenant's own company profile. Read-only without core.company.write. */
export function CompanyProfilePage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("core.company.write") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [subdomain, setSubdomain] = useState("")
  const [loaded, setLoaded] = useState<CompanyFormValues>(emptyCompanyForm)

  const schema = useMemo(() => createCompanyFormSchema({
    legalNameRequired: t("company.validation.legalNameRequired"),
    taxIdInvalid: t("company.validation.taxIdInvalid"),
    emailInvalid: t("company.validation.emailInvalid"),
    phoneInvalid: t("company.validation.phoneInvalid"),
    postalCodeInvalid: t("company.validation.postalCodeInvalid"),
    stateInvalid: t("company.validation.stateInvalid"),
  }), [t])

  const form = useForm<CompanyFormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: emptyCompanyForm })
  const { control, handleSubmit, reset, formState: { isDirty, isValid } } = form

  const apply = useCallback((profile: CompanyProfile) => {
    const values = toMaskedForm(profile)
    setSubdomain(profile.subdomain)
    setLoaded(values)
    reset(values)
    setLoadError(null)
    setLoading(false)
  }, [reset])

  const fail = useCallback((error: unknown) => {
    setLoadError(error instanceof Error ? error.message : t("company.loadError"))
    setLoading(false)
  }, [t])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    getCompanyProfile().then(apply, fail)
  }, [apply, fail])

  // First load: state is only set from the promise callbacks, never synchronously in the effect.
  useEffect(() => {
    let cancelled = false
    getCompanyProfile().then(
      (profile) => { if (!cancelled) apply(profile) },
      (error: unknown) => { if (!cancelled) fail(error) },
    )
    return () => { cancelled = true }
  }, [apply, fail])

  async function onSubmit(values: CompanyFormValues) {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const updated = await updateCompanyProfile(formToWriteBody(values))
      const next = toMaskedForm(updated)
      setLoaded(next)
      reset(next)
      toast.success(t("company.saved"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company.saveError"))
    } finally {
      setSaving(false)
    }
  }

  const disabled = !canEdit || saving
  const pageState = loading
    ? ({ state: "loading" } as const)
    : loadError
      ? ({ state: "error", error: loadError, onRetry: retry } as const)
      : ({ state: "ready" } as const)

  function textField(name: TextFieldName, labelKey: string, options: TextFieldOptions = {}) {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={options.className}>
            <FormLabel>{t(labelKey)}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type={options.type}
                inputMode={options.inputMode}
                autoComplete={options.autoComplete}
                maxLength={options.maxLength}
                disabled={disabled}
                className="min-h-11 w-full"
                onChange={(event) => field.onChange(options.mask ? options.mask(event.target.value) : event.target.value)}
              />
            </FormControl>
            {options.help ? <FormDescription>{t(options.help)}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <div data-testid="company-profile-page">
      <Page
        header={{ icon: Building2, title: t("nav.company"), description: t("company.description") }}
        width="form"
        {...pageState}
      >
        <UnsavedChangesGuard when={canEdit && isDirty && !saving} />
        <Form {...form}>
          <form
            id="company-profile-form"
            className="min-w-0 space-y-5"
            onSubmit={(event) => { event.preventDefault(); void handleSubmit(onSubmit)(event) }}
          >
            {!canEdit ? (
              <p className="text-sm text-muted-foreground" data-testid="company-read-only">{t("company.readOnly")}</p>
            ) : null}

            <FormSection title={t("company.sections.identity")}>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {textField("legalName", "company.fields.legalName", { className: "sm:col-span-2", maxLength: 200, autoComplete: "organization" })}
                {textField("tradeName", "company.fields.tradeName", { maxLength: 200 })}
                {textField("taxId", "company.fields.taxId", { mask: maskTaxIdInput, inputMode: "numeric", help: "company.fields.taxIdHelp" })}
              </div>
            </FormSection>

            <FormSection title={t("company.sections.contact")}>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {textField("contactEmail", "company.fields.contactEmail", { type: "email", inputMode: "email", autoComplete: "email", maxLength: 200 })}
                {textField("contactPhone", "company.fields.contactPhone", { mask: maskPhoneInput, type: "tel", inputMode: "tel", autoComplete: "tel" })}
              </div>
            </FormSection>

            <FormSection title={t("company.sections.address")}>
              <div className="grid min-w-0 gap-4 sm:grid-cols-6">
                {textField("postalCode", "company.fields.postalCode", { mask: maskCepInput, inputMode: "numeric", autoComplete: "postal-code", className: "sm:col-span-2" })}
                {textField("street", "company.fields.street", { maxLength: 200, autoComplete: "address-line1", className: "sm:col-span-4" })}
                {textField("number", "company.fields.number", { maxLength: 30, className: "sm:col-span-2" })}
                {textField("complement", "company.fields.complement", { maxLength: 100, className: "sm:col-span-4" })}
                {textField("district", "company.fields.district", { maxLength: 100, className: "sm:col-span-3" })}
                {textField("city", "company.fields.city", { maxLength: 100, className: "sm:col-span-2" })}
                <FormField
                  control={control}
                  name="state"
                  render={({ field }) => {
                    const items = [{ value: "none", label: t("company.fields.stateNone") }, ...BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }))]
                    return (
                      <FormItem className="sm:col-span-1">
                        <FormLabel>{t("company.fields.state")}</FormLabel>
                        <Select
                          modal={false}
                          value={field.value ? field.value.toUpperCase() : "none"}
                          onValueChange={(value) => { if (typeof value === "string") field.onChange(value === "none" ? "" : value) }}
                          items={items}
                          disabled={disabled}
                        >
                          <FormControl>
                            <SelectTrigger icon={MapPin} className="w-full" data-testid="company-state-select"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
            </FormSection>

            {subdomain ? (
              <FormSection title={t("company.sections.portal")} description={t("company.portalHelp")}>
                <p className="min-w-0 break-all text-sm font-medium" data-testid="company-subdomain">{subdomain}</p>
              </FormSection>
            ) : null}
          </form>
        </Form>

        {canEdit ? (
          <SaveBar
            dirty={isDirty}
            saving={saving}
            saveDisabled={!isValid}
            saveLabel={t("common.save")}
            unsavedCount={isDirty ? 1 : 0}
            onDiscard={() => reset(loaded)}
            onSave={() => { void handleSubmit(onSubmit)() }}
          />
        ) : null}
      </Page>
    </div>
  )
}
