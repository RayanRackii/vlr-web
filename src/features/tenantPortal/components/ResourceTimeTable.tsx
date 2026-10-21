import { useTranslation } from "react-i18next"

import type { PortalDailyAvailability } from "@/features/tenantPortal/services/tenantPortalService"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import { cn } from "@/lib/utils"

export type ReservationGridSelection = { rentalAssetId: string; startTime: string; endTime: string; quantity: number }
type Selection = ReservationGridSelection | null
type Props = {
  availability: PortalDailyAvailability
  locale: string
  selection: Selection
  onSelect: (selection: NonNullable<Selection>) => void
  onQuantityChange: (quantity: number) => void
  onViewQueue: (rentalAssetId: string) => void
}
const clock = (value: string) => value.slice(0, 5)
const keyOf = (start: string, end: string) => `${start}|${end}`

function stateTranslationKey(state: string): string {
  switch (state) {
    case "Taken": return "slotOccupied"
    case "Past": return "slotPast"
    case "OutsideHorizon": return "slotOutsideHorizon"
    case "Unpriced": return "priceUnavailable"
    case "Available": return "slotAvailable"
    default: return "slotBlocked"
  }
}

export function ResourceTimeTable({ availability, locale, selection, onSelect, onQuantityChange, onViewQueue }: Props) {
  const { t } = useTranslation()
  const intervals = [...new Map(availability.resources.flatMap((resource) => resource.windows.map((window) => [keyOf(window.startTime, window.endTime), window] as const))).values()].sort((a, b) => keyOf(a.startTime, a.endTime).localeCompare(keyOf(b.startTime, b.endTime)))
  if (availability.resources.length === 0) return <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.noResources")}</p>
  if (intervals.length === 0) return <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.noSchedule")}</p>
  const freeByInterval = new Map(intervals.map((interval) => [keyOf(interval.startTime, interval.endTime), availability.resources.filter((resource) => resource.windows.some((window) => keyOf(window.startTime, window.endTime) === keyOf(interval.startTime, interval.endTime) && window.state === "Available" && window.totalAmount !== null)).length]))
  const hasAvailable = [...freeByInterval.values()].some((count) => count > 0)
  return <div className="space-y-2">{!hasAvailable ? <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.noAvailability")}</p> : null}<div className="overflow-x-auto rounded-lg border"><table className="min-w-max border-collapse text-sm"><thead><tr><th scope="col" className="sticky left-0 z-10 min-w-36 bg-background p-3 text-left">{t("tenantPortal.agenda.resource")}</th>{intervals.map((interval) => { const count = freeByInterval.get(keyOf(interval.startTime, interval.endTime)) ?? 0; return <th key={keyOf(interval.startTime, interval.endTime)} scope="col" className="min-w-36 border-l p-2 text-left"><span className="block">{clock(interval.startTime)}–{clock(interval.endTime)}</span><span className="text-xs font-normal text-muted-foreground">{t("tenantPortal.agenda.freeAt", { time: clock(interval.startTime), count })}</span></th> })}</tr></thead><tbody>{availability.resources.map((resource) => { const selectedGood = resource.type === "Good" && selection?.rentalAssetId === resource.rentalAssetId; return <tr key={resource.rentalAssetId} className="border-t"><th scope="row" className="sticky left-0 z-10 bg-background p-3 text-left font-medium">{resource.name}{resource.queueEnabled ? <button type="button" className="mt-1 block min-h-11 text-xs text-primary underline underline-offset-2" onClick={() => onViewQueue(resource.rentalAssetId)}>{t("tenantPortal.agenda.queue.view")}</button> : null}{selectedGood ? <label className="mt-2 block text-xs font-normal"><span className="block">{t("tenantPortal.agenda.quantity")}</span><input type="number" min={1} max={resource.totalQuantity} value={selection.quantity} onChange={(event) => onQuantityChange(Math.max(1, Math.min(resource.totalQuantity, Number(event.target.value) || 1)))} className="mt-1 h-11 w-20 rounded-md border bg-background px-2 text-sm" aria-label={t("tenantPortal.agenda.quantityFor", { name: resource.name })} /></label> : null}</th>{intervals.map((interval) => { const window = resource.windows.find((item) => keyOf(item.startTime, item.endTime) === keyOf(interval.startTime, interval.endTime)); if (!window) return <td key={keyOf(interval.startTime, interval.endTime)} className="border-l p-2" />; const selectable = window.state === "Available"; const selected = selection?.rentalAssetId === resource.rentalAssetId && selection.startTime === window.startTime && selection.endTime === window.endTime; const stateKey = stateTranslationKey(window.state); const price = window.totalAmount === null ? t("tenantPortal.agenda.priceUnavailable") : formatLocaleCurrency(window.totalAmount, availability.currency, locale); return <td key={keyOf(interval.startTime, interval.endTime)} className="border-l p-2"><button type="button" disabled={!selectable} aria-pressed={selected} aria-label={t("tenantPortal.agenda.slotAccessible", { resource: resource.name, date: availability.date, start: clock(window.startTime), end: clock(window.endTime), quantity: selection?.rentalAssetId === resource.rentalAssetId ? selection.quantity : 1, price, state: t(`tenantPortal.agenda.${stateKey}`) })} onClick={() => onSelect({ rentalAssetId: resource.rentalAssetId, startTime: window.startTime, endTime: window.endTime, quantity: resource.type === "Good" ? selection?.rentalAssetId === resource.rentalAssetId ? selection.quantity : 1 : 1 })} className={cn("min-h-11 w-full rounded-md border px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary bg-primary text-primary-foreground", !selected && selectable && "border-emerald-600 hover:bg-emerald-50", !selectable && "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through")}><span className="block font-medium">{t(`tenantPortal.agenda.${stateKey}`)}</span><span className="block text-xs no-underline">{price}</span></button></td>})}</tr>})}</tbody></table></div></div>
}
