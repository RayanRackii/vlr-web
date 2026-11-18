import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleDot, ShieldCheck } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Page } from "@/components/layout/Page"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormSection } from "@/components/ui/form-layout"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { catalogPolicyFormSchema, orderCancellationStatuses, type CatalogPolicyFormValues } from "@/features/catalog/schemas/catalogPolicySchemas"
import { getCatalogPolicy, saveCatalogPolicy } from "@/features/catalog/services/catalogService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"

const TEXT_MAX = 2000
const EMPTY_VALUES: CatalogPolicyFormValues = { customerCanCancelOrders: true, orderCancelableUpToStatus: "Requested", customerCanCancelRequests: false, requestCancelableUpToStatus: "Submitted", cancellationPolicyText: "" }

/** One rule as a sentence: "before [value] ☐ não permitir". The checkbox owns the off state and hides the value. */
function SentenceRow({ testId, before, notAllowedLabel, notAllowed, onNotAllowedChange, disabled, value }: {
  testId: string
  before: string
  notAllowedLabel: string
  notAllowed: boolean
  onNotAllowedChange: (notAllowed: boolean) => void
  disabled: boolean
  value: ReactNode
}) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" data-testid={testId}>
    <span>{before}</span>
    {notAllowed ? null : value}
    <Label className="ml-1 inline-flex min-h-11 cursor-pointer items-center gap-2 font-normal text-muted-foreground">
      <Checkbox checked={notAllowed} disabled={disabled} onChange={(event) => onNotAllowedChange(event.target.checked)} />
      {notAllowedLabel}
    </Label>
  </div>
}

export function CatalogPolicyPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("catalog.products.manage") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [textFocused, setTextFocused] = useState(false)
  const [loadedValues, setLoadedValues] = useState<CatalogPolicyFormValues | null>(null)
  const savingRef = useRef(false)
  const form = useForm<CatalogPolicyFormValues>({ resolver: zodResolver(catalogPolicyFormSchema), mode: "onChange", defaultValues: EMPTY_VALUES })
  const { reset, setValue, formState: { isDirty } } = form
  const values = useWatch({ control: form.control })
  const text = values.cancellationPolicyText ?? ""
  const isValid = catalogPolicyFormSchema.safeParse(values).success

  const applyLoaded = useCallback((next: CatalogPolicyFormValues) => {
    setLoadedValues(next)
    setTextOpen(next.cancellationPolicyText.length > 0)
    reset(next)
  }, [reset])

  useEffect(() => {
    if (!can("catalog.products.manage")) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getCatalogPolicy().then((policy) => {
      if (!cancelled) applyLoaded({ ...policy, cancellationPolicyText: policy.cancellationPolicyText ?? "" })
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : t("catalog.policy.loadError"))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [can, applyLoaded, reload, t])

  async function submit(data: CatalogPolicyFormValues) {
    if (!canEdit || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await saveCatalogPolicy({ ...data, cancellationPolicyText: data.cancellationPolicyText.trim() || null })
      applyLoaded({ ...saved, cancellationPolicyText: saved.cancellationPolicyText ?? "" })
      toast.success(t("catalog.policy.saved"))
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("catalog.policy.saveError"))
    } finally { savingRef.current = false; setSaving(false) }
  }

  function discard() {
    if (!loadedValues) return
    reset(loadedValues)
    setTextOpen(loadedValues.cancellationPolicyText.length > 0)
  }

  if (!can("catalog.products.manage")) return <p>{t("catalog.policy.readOnly")}</p>
  const fieldsDisabled = !canEdit || saving
  const orderItems = orderCancellationStatuses.map((value) => ({ value, label: t(`catalog.status.${value}`) }))
  const pageState = loading
    ? ({ state: "loading" } as const)
    : error
      ? ({ state: "error", error, onRetry: () => setReload((value) => value + 1) } as const)
      : ({ state: "ready" } as const)

  return <div data-testid="catalog-policy-page">
    <Page header={{ icon: ShieldCheck, title: t("catalog.policy.title"), description: t("catalog.policy.description") }} width="form" {...pageState}>
      <UnsavedChangesGuard when={canEdit && isDirty && !saving} />
      <Form {...form}>
        <form id="catalog-policy-form" className="space-y-5" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(submit)(event) }}>
          <FormSection title={t("catalog.policy.generalTitle")}>
            {!canEdit ? <p className="text-sm text-muted-foreground">{t("catalog.policy.readOnly")}</p> : null}
            <SentenceRow
              testId="rule-orders"
              before={t("catalog.policy.ordersBefore")}
              notAllowedLabel={t("catalog.policy.notAllowed")}
              notAllowed={!values.customerCanCancelOrders}
              onNotAllowedChange={(notAllowed) => setValue("customerCanCancelOrders", !notAllowed, { shouldDirty: true, shouldValidate: true })}
              disabled={fieldsDisabled}
              value={<FormField control={form.control} name="orderCancelableUpToStatus" render={({ field }) => <FormItem className="space-y-0">
                <Select modal={false} items={orderItems} value={field.value} disabled={fieldsDisabled} onValueChange={(next) => { if (typeof next === "string") field.onChange(next) }}>
                  <FormControl>
                    <SelectTrigger icon={CircleDot} className="min-h-11 w-48" aria-label={t("catalog.policy.ordersUpTo")}><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {orderItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>} />}
            />
            <SentenceRow
              testId="rule-requests"
              before={t("catalog.policy.requestsBefore")}
              notAllowedLabel={t("catalog.policy.notAllowed")}
              notAllowed={!values.customerCanCancelRequests}
              onNotAllowedChange={(notAllowed) => setValue("customerCanCancelRequests", !notAllowed, { shouldDirty: true, shouldValidate: true })}
              disabled={fieldsDisabled}
              value={<span className="font-medium">{t("catalog.productRequestStatus.Submitted")}</span>}
            />
            {textOpen ? <FormField control={form.control} name="cancellationPolicyText" render={({ field }) => <FormItem className="space-y-1.5">
              <FormLabel>{t("catalog.policy.text")}</FormLabel>
              <FormControl>
                <Textarea className="touch-target min-w-0" {...field} rows={5} maxLength={TEXT_MAX} disabled={fieldsDisabled} placeholder={t("catalog.policy.placeholder")}
                  onFocus={() => setTextFocused(true)} onBlur={() => { setTextFocused(false); field.onBlur() }} />
              </FormControl>
              {textFocused ? <p className="text-xs tabular-nums text-muted-foreground">{t("catalog.policy.textHint", { length: text.length })}</p> : null}
              <FormMessage />
            </FormItem>} /> : <Button type="button" variant="ghost" className="min-h-11 w-fit px-2" disabled={fieldsDisabled} onClick={() => setTextOpen(true)}>
              {t("catalog.policy.addText")}
            </Button>}
          </FormSection>
        </form>
      </Form>
      {canEdit ? <SaveBar dirty={isDirty} saving={saving} saveDisabled={!isValid} saveLabel={t("common.save")} unsavedCount={isDirty ? 1 : 0} onDiscard={discard} onSave={() => { void form.handleSubmit(submit)() }} /> : null}
    </Page>
  </div>
}
