import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createStaffReservation, StaffReservationError } from "@/features/rentals/services/reservationsService"
import { listTenantCustomers } from "@/features/users/services/usersService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { tenantKey } from "@/lib/queryKeys"
import { agendaQueries } from "./agendaQueries"
import { endMinutes, minutes } from "./blockPeriod"
import { defaultEnd } from "./newReservation"

export type NewReservationPrefill = {
  resourceId?: string | null
  date: string
  /** "HH:mm" */
  start?: string
  /** "HH:mm" */
  end?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: NewReservationPrefill
  tenantId: string | null
  /** Called after the reservation was created. */
  onCreated?: () => void
}

export function NewReservationDialog({ open, onOpenChange, prefill, tenantId, onCreated }: Props) {
  const { can } = usePermissions()
  if (!can("rentals.reservations.create")) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {/* Mounted only while open, so the form re-seeds from the prefill every time. */}
        <NewReservationForm onOpenChange={onOpenChange} prefill={prefill} tenantId={tenantId} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  )
}

type FormProps = Omit<Props, "open">
/** Maps an API failure to a localized message key; raw server text is never shown. */
function errorKey(cause: unknown, newCustomerPath: boolean) {
  if (!(cause instanceof StaffReservationError)) return "error"
  if (cause.code === "START_IN_THE_PAST") return "startInThePast"
  if (cause.status === 409) return "slotTaken"
  if (cause.status === 404) return "customerNotFound"
  if (cause.status === 400 && newCustomerPath) return "invalidPhone"
  return "error"
}

type PickedCustomer = { id: string; name: string }

function NewReservationForm({ onOpenChange, prefill, tenantId, onCreated }: FormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const assets = useQuery(agendaQueries.assets(tenantId))
  const resources = useMemo(() => (assets.data ?? []).filter((asset) => asset.isActive && !asset.scheduledDeletionAt), [assets.data])
  const [resourceId, setResourceId] = useState(prefill.resourceId ?? "")
  const resource = resources.find((asset) => asset.id === resourceId)
  const initialStart = prefill.start ?? "08:00"
  const [date, setDate] = useState(prefill.date)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(prefill.end ?? defaultEnd(initialStart))
  const endTouched = useRef(prefill.end !== undefined)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [name, setName] = useState("")
  const [whatsApp, setWhatsApp] = useState("")
  const [email, setEmail] = useState("")
  const [awaiting, setAwaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [failure, setFailure] = useState<{ form: string; message: string } | null>(null)
  // An error belongs to the form values it was raised for: any edit makes it stale.
  const formKey = JSON.stringify([resourceId, date, start, end, mode, customer?.id, name, whatsApp, email, awaiting])
  const error = failure !== null && failure.form === formKey ? failure.message : null

  useEffect(() => {
    const handle = setTimeout(() => setTerm(search.trim()), 250)
    return () => clearTimeout(handle)
  }, [search])
  const found = useQuery({
    queryKey: tenantKey("staff", tenantId, "customer-search", term),
    queryFn: ({ signal }) => listTenantCustomers({ q: term, page: 1, pageSize: 8 }, signal),
    enabled: mode === "existing" && customer === null && term.length >= 2,
  })

  // Until the user types an end, it follows the resource's duration; a prefilled end is kept.
  function pickResource(id: string) {
    setResourceId(id)
    if (!endTouched.current) setEnd(defaultEnd(start, resources.find((asset) => asset.id === id)?.allowedDurationMinutes))
  }

  const showDeposit = resource?.requiresDeposit === true
  const customerReady = mode === "existing" ? customer !== null : name.trim() !== "" && whatsApp.trim() !== ""
  const timesOk = start !== "" && end !== "" && endMinutes(end) > minutes(start)
  const valid = resource !== undefined && date !== "" && timesOk && customerReady
  const resourceItems = resources.map((asset) => ({ value: asset.id, label: asset.name }))

  async function submit() {
    if (!valid || busy || submitting.current || !resource) return
    submitting.current = true
    setBusy(true)
    setFailure(null)
    const newCustomerPath = mode === "new"
    try {
      await createStaffReservation({
        ...(mode === "existing" && customer
          ? { customerId: customer.id }
          : { newCustomer: { name: name.trim(), whatsApp: whatsApp.trim(), ...(email.trim() ? { email: email.trim() } : {}) } }),
        date,
        startTime: start,
        endTime: endMinutes(end) === 24 * 60 ? "23:59" : end,
        // The API item carries the underlying asset id, not the rental asset id the agenda rows use.
        items: [{ assetId: resource.assetId, quantity: 1 }],
        awaitingDeposit: showDeposit && awaiting,
      })
      await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "schedule-day") }).catch(() => undefined)
      await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "reservations") }).catch(() => undefined)
      onCreated?.()
      toast.success(t("agendas.newReservationDialog.success"))
      onOpenChange(false)
    } catch (cause) {
      if (cause instanceof StaffReservationError && cause.code === "CUSTOMER_EXISTS" && cause.customerId) {
        setCustomer({ id: cause.customerId, name: name.trim() })
        setMode("existing")
        toast.info(t("agendas.newReservationDialog.customerExists"))
      } else {
        setFailure({ form: formKey, message: t(`agendas.newReservationDialog.${errorKey(cause, newCustomerPath)}`) })
      }
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("agendas.newReservationDialog.title")}</DialogTitle>
        <DialogDescription>{t("agendas.newReservationDialog.description")}</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="space-y-1.5">
          <Label htmlFor="new-res-resource">{t("agendas.newReservationDialog.resource")}</Label>
          <Select modal={false} value={resourceId} onValueChange={(value) => { if (typeof value === "string") pickResource(value) }} items={resourceItems}>
            <SelectTrigger id="new-res-resource" className="min-h-11 w-full"><SelectValue placeholder={t("agendas.newReservationDialog.resourcePlaceholder")} /></SelectTrigger>
            <SelectContent>{resourceItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-res-date">{t("agendas.newReservationDialog.date")}</Label>
          <Input id="new-res-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-res-start">{t("agendas.newReservationDialog.start")}</Label>
            <Input id="new-res-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-res-end">{t("agendas.newReservationDialog.end")}</Label>
            <Input id="new-res-end" type="time" value={end} onChange={(event) => { endTouched.current = true; setEnd(event.target.value) }} />
          </div>
        </div>
        {start !== "" && end !== "" && !timesOk && <p className="text-xs text-destructive">{t("agendas.newReservationDialog.endAfterStart")}</p>}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("agendas.newReservationDialog.customer")}</legend>
          {mode === "existing" ? (
            customer ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm" role="status">
                <span data-testid="selected-customer">{customer.name || t("agendas.newReservationDialog.customerSelected")}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomer(null); setSearch(""); setTerm("") }}>{t("agendas.newReservationDialog.customerClear")}</Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input aria-label={t("agendas.newReservationDialog.customerSearch")} placeholder={t("agendas.newReservationDialog.customerSearch")} value={search} onChange={(event) => setSearch(event.target.value)} />
                {term.length < 2 ? <p className="text-xs text-muted-foreground">{t("agendas.newReservationDialog.customerSearchHint")}</p>
                  : found.data && found.data.items.length === 0 ? <p className="text-xs text-muted-foreground">{t("agendas.newReservationDialog.customerNone")}</p>
                  : (
                    <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                      {(found.data?.items ?? []).map((item) => (
                        <li key={item.id}>
                          <button type="button" className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setCustomer({ id: item.id, name: item.name })}>
                            {item.name}{item.email ? <span className="text-muted-foreground"> · {item.email}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                <Button type="button" variant="outline" size="sm" onClick={() => setMode("new")}>{t("agendas.newReservationDialog.newCustomer")}</Button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-res-name">{t("agendas.newReservationDialog.newName")}</Label>
                <Input id="new-res-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-res-whatsapp">{t("agendas.newReservationDialog.newWhatsApp")}</Label>
                <Input id="new-res-whatsapp" type="tel" inputMode="tel" value={whatsApp} onChange={(event) => setWhatsApp(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-res-email">{t("agendas.newReservationDialog.newEmail")}</Label>
                <Input id="new-res-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("existing")}>{t("agendas.newReservationDialog.existingCustomer")}</Button>
            </div>
          )}
        </fieldset>

        {showDeposit && (
          <div className="flex items-start gap-2">
            <Checkbox id="new-res-awaiting" checked={awaiting} onChange={(event) => setAwaiting(event.target.checked)} className="mt-1" />
            <div className="space-y-0.5">
              <Label htmlFor="new-res-awaiting">{t("agendas.newReservationDialog.awaiting")}</Label>
              <p className="text-xs text-muted-foreground">{t("agendas.newReservationDialog.awaitingHelp")}</p>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="sticky bottom-0 -mx-4 bg-background px-4 pt-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>{t("agendas.newReservationDialog.cancel")}</Button>
          <Button type="submit" className="min-h-11" disabled={!valid || busy}>{busy ? t("agendas.newReservationDialog.saving") : t("agendas.newReservationDialog.submit")}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
