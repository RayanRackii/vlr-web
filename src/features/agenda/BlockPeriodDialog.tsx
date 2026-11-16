import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { tenantKey } from "@/lib/queryKeys"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { agendaQueries } from "./agendaQueries"
import { blockingKinds, blockPeriod, type BlockPeriodResult } from "./blockPeriod"

export type BlockPeriodPrefill = {
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
  resources: readonly { id: string; name: string }[]
  prefill: BlockPeriodPrefill
  tenantId: string | null
  /** Called after at least one slot was blocked. */
  onBlocked?: () => void
}

const hourLater = (start: string) => {
  const [hour = 0, minute = 0] = start.split(":").map(Number)
  const total = Math.min(hour * 60 + minute + 60, 24 * 60 - 1)
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export function BlockPeriodDialog({ open, onOpenChange, resources, prefill, tenantId, onBlocked }: Props) {
  const { can } = usePermissions()
  if (!can("rentals.schedule.write")) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the form re-seeds from the prefill every time. */}
        <BlockPeriodForm onOpenChange={onOpenChange} resources={resources} prefill={prefill} tenantId={tenantId} onBlocked={onBlocked} />
      </DialogContent>
    </Dialog>
  )
}

type FormProps = Omit<Props, "open">

function BlockPeriodForm({ onOpenChange, resources, prefill, tenantId, onBlocked }: FormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const kinds = useQuery(agendaQueries.kinds(tenantId))
  const options = useMemo(() => blockingKinds(kinds.data ?? []), [kinds.data])
  const initialStart = prefill.start ?? "08:00"
  const [resourceId, setResourceId] = useState(prefill.resourceId ?? "")
  const [date, setDate] = useState(prefill.date)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(prefill.end ?? hourLater(initialStart))
  const [pickedKind, setKindId] = useState("")
  // A single eligible reason is preselected.
  const kindId = pickedKind || (options.length === 1 ? options[0].id : "")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BlockPeriodResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const valid = resourceId !== "" && date !== "" && start !== "" && end !== "" && end > start && kindId !== ""
  const resourceItems = resources.map((resource) => ({ value: resource.id, label: resource.name }))
  const kindItems = options.map((kind) => ({ value: kind.id, label: kind.label }))

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await blockPeriod({ rentalAssetId: resourceId, date, start, end, kindId, note })
      if (outcome.blocked > 0) {
        await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "schedule-day") }).catch(() => undefined)
        onBlocked?.()
      }
      if (outcome.skipped.length === 0 && outcome.failed.length === 0) {
        toast.success(t("agendas.block.success", { count: outcome.blocked }))
        onOpenChange(false)
      } else {
        setResult(outcome)
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : t("agendas.block.error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{t("staffAgenda.blockPeriod")}</DialogTitle>
          <DialogDescription>{t("agendas.block.description")}</DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <div className="space-y-2 text-sm" role="status">
              <p>{t("agendas.block.success", { count: result.blocked })}</p>
              {result.skipped.length > 0 && <p>{t("agendas.block.skipped", { count: result.skipped.length, ranges: result.skipped.join(", ") })}</p>}
              {result.failed.length > 0 && <p className="text-destructive">{t("agendas.block.failed", { ranges: result.failed.map((item) => item.range).join(", ") })}</p>}
            </div>
            <DialogFooter><Button className="min-h-11" onClick={() => onOpenChange(false)}>{t("agendas.block.close")}</Button></DialogFooter>
          </>
        ) : (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <div className="space-y-1.5">
              <Label htmlFor="block-resource">{t("agendas.block.resource")}</Label>
              <Select modal={false} value={resourceId} onValueChange={(value) => { if (typeof value === "string") setResourceId(value) }} items={resourceItems}>
                <SelectTrigger id="block-resource" className="min-h-11 w-full"><SelectValue placeholder={t("agendas.block.resourcePlaceholder")} /></SelectTrigger>
                <SelectContent>{resourceItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-date">{t("agendas.block.date")}</Label>
              <Input id="block-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="block-start">{t("agendas.block.start")}</Label>
                <Input id="block-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-end">{t("agendas.block.end")}</Label>
                <Input id="block-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
              </div>
            </div>
            {start !== "" && end !== "" && end <= start && <p className="text-xs text-destructive">{t("agendas.block.endAfterStart")}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="block-kind">{t("agendas.block.reason")}</Label>
              <Select modal={false} value={kindId} onValueChange={(value) => { if (typeof value === "string") setKindId(value) }} items={kindItems}>
                <SelectTrigger id="block-kind" className="min-h-11 w-full"><SelectValue placeholder={t("agendas.block.reasonPlaceholder")} /></SelectTrigger>
                <SelectContent>{kindItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              {!kinds.isPending && options.length === 0 && <p className="text-xs text-muted-foreground">{t("agendas.block.noReasons")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-note">{t("agendas.block.note")}</Label>
              <Input id="block-note" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>{t("agendas.block.cancel")}</Button>
              <Button type="submit" className="min-h-11" disabled={!valid || busy}>{busy ? t("agendas.block.saving") : t("agendas.block.submit")}</Button>
            </DialogFooter>
          </form>
        )}
    </>
  )
}
