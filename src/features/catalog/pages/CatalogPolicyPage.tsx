import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { catalogPolicyFormSchema, orderCancellationStatuses, type CatalogPolicyFormValues } from "@/features/catalog/schemas/catalogPolicySchemas"
import { getCatalogPolicy, saveCatalogPolicy } from "@/features/catalog/services/catalogService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"

export function CatalogPolicyPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("catalog.products.manage") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const form = useForm<CatalogPolicyFormValues>({
    resolver: zodResolver(catalogPolicyFormSchema), mode: "onChange",
    defaultValues: { customerCanCancelOrders: true, orderCancelableUpToStatus: "Requested", customerCanCancelRequests: false, requestCancelableUpToStatus: "Submitted", cancellationPolicyText: "" },
  })
  const { reset } = form
  const values = useWatch({ control: form.control })
  useEffect(() => {
    if (!can("catalog.products.manage")) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getCatalogPolicy().then((policy) => {
      if (!cancelled) reset({ ...policy, cancellationPolicyText: policy.cancellationPolicyText ?? "" })
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : t("catalog.policy.loadError"))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [can, reset, reload, t])

  async function submit(data: CatalogPolicyFormValues) {
    if (!canEdit || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await saveCatalogPolicy({ ...data, cancellationPolicyText: data.cancellationPolicyText.trim() || null })
      reset({ ...saved, cancellationPolicyText: saved.cancellationPolicyText ?? "" })
      toast.success(t("catalog.policy.saved"))
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("catalog.policy.saveError"))
    } finally { savingRef.current = false; setSaving(false) }
  }
  if (!can("catalog.products.manage")) return <p>{t("catalog.policy.readOnly")}</p>
  return <div className="mx-auto max-w-3xl space-y-6">
    <h1 className="text-2xl font-semibold">{t("catalog.policy.title")}</h1>
    <p className="text-sm text-muted-foreground">{t("catalog.policy.description")}</p>
    {loading ? <FormSkeleton fields={5} /> : error ? <div role="alert" className="space-y-3">
      <p>{error}</p>
      <Button onClick={() => setReload((value) => value + 1)}>{t("catalog.retry")}</Button>
    </div> :
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-6 rounded-lg border p-4">
          <fieldset disabled={!canEdit || saving} className="space-y-6">
            {!canEdit ? <p>{t("catalog.policy.readOnly")}</p> : null}
            <FormField control={form.control} name="customerCanCancelOrders" render={({ field }) => <FormItem className="flex items-center justify-between gap-3">
              <FormLabel>{t("catalog.policy.ordersEnabled")}</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>} />
            <FormField control={form.control} name="orderCancelableUpToStatus" render={({ field }) => <FormItem>
              <FormLabel>{t("catalog.policy.ordersUpTo")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={!values.customerCanCancelOrders || !canEdit || saving} items={orderCancellationStatuses.map((value) => ({ value, label: t(`catalog.status.${value}`) }))}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>{orderCancellationStatuses.map((value) => <SelectItem key={value} value={value}>{t(`catalog.status.${value}`)}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>} />
            <FormField control={form.control} name="customerCanCancelRequests" render={({ field }) => <FormItem className="flex items-center justify-between gap-3">
              <FormLabel>{t("catalog.policy.requestsEnabled")}</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>} />
            <FormField control={form.control} name="requestCancelableUpToStatus" render={({ field }) => <FormItem>
              <FormLabel>{t("catalog.policy.requestsUpTo")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={!values.customerCanCancelRequests || !canEdit || saving} items={[{ value: "Submitted", label: t("catalog.productRequestStatus.Submitted") }]}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Submitted">{t("catalog.productRequestStatus.Submitted")}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>} />
            <FormField control={form.control} name="cancellationPolicyText" render={({ field }) => <FormItem>
              <FormLabel>{t("catalog.policy.text")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={5} maxLength={2000} placeholder={t("catalog.policy.placeholder")} />
              </FormControl>
              <p className="text-xs text-muted-foreground">{t("catalog.policy.textHint", { length: values.cancellationPolicyText?.length ?? 0 })}</p>
              <FormMessage />
            </FormItem>} />
          </fieldset>
          <FormPrimaryButton type="submit" isValid={catalogPolicyFormSchema.safeParse(values).success} disabled={!canEdit} loading={saving}>{t("common.save")}</FormPrimaryButton>
        </form>
      </Form>}
  </div>
}
