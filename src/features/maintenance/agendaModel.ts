import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { MaintenancePlanCoverage } from "@/features/pmoc/schemas/coverageSchemas"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"

export type AgendaSection = "overdue" | "week" | "upcoming"
export type AgendaFilter = "overdue" | "unassigned" | "mine"

export type AgendaRow = {
  id: string
  kind: "order" | "need"
  section: AgendaSection
  assetId: string
  assetName: string
  assetTag: string
  planId: string | null
  planName: string | null
  technician: string | null
  assignedUserId: string | null
  date: string
  /** Whole days past due (0 when not overdue). */
  daysLate: number
  status: string
  to: string
}

const DAY_MS = 86_400_000
const CIVIL = /^(\d{4})-(\d{2})-(\d{2})/

function civilToUtc(value: string): number {
  const match = CIVIL.exec(value)
  if (!match) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function addCivilDays(value: string, days: number): string {
  return new Date(civilToUtc(value) + days * DAY_MS).toISOString().slice(0, 10)
}

export function civilDaysBetween(from: string, to: string): number {
  return Math.round((civilToUtc(to) - civilToUtc(from)) / DAY_MS)
}

/** Civil date as "26 jun 2026" (locale month abbreviation, no calendar shift). */
export function formatHumanDate(value: string, locale: string): string {
  const time = civilToUtc(value)
  if (Number.isNaN(time)) return value
  const parts = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).formatToParts(time)
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? ""
  return `${pick("day")} ${pick("month").replace(/\.$/, "")} ${pick("year")}`
}

export function sectionFor(date: string, today: string): AgendaSection {
  if (date < today) return "overdue"
  return date <= addCivilDays(today, 6) ? "week" : "upcoming"
}

const CLOSED = ["Completed", "Canceled"]

export function buildAgendaRows(
  { orders, plans, coverage }: { orders: WorkOrder[]; plans: MaintenancePlan[]; coverage: Record<string, MaintenancePlanCoverage> },
  today: string,
): AgendaRow[] {
  const rows: AgendaRow[] = orders.filter(order => !CLOSED.includes(order.status)).map(order => ({
    id: `order-${order.id}`, kind: "order", section: sectionFor(order.scheduledDate, today),
    assetId: order.assetId, assetName: order.asset.name, assetTag: order.asset.tag,
    planId: order.maintenancePlanId ?? null, planName: order.sourcePlanName ?? null,
    technician: order.assignedUser?.fullName ?? null, assignedUserId: order.assignedUserId ?? order.assignedUser?.id ?? null,
    date: order.scheduledDate, daysLate: Math.max(0, civilDaysBetween(order.scheduledDate, today)),
    status: order.status, to: `/os/${order.id}`,
  }))
  for (const plan of plans) {
    const data = plan.isActive ? coverage[plan.id] : undefined
    if (!data) continue
    for (const asset of data.assets) {
      if (!asset.needsAttention || asset.openWorkOrder) continue
      rows.push({
        id: `need-${plan.id}-${asset.assetId}`, kind: "need", section: sectionFor(asset.effectiveNextDueDate, today),
        assetId: asset.assetId, assetName: asset.name, assetTag: asset.tag, planId: plan.id, planName: plan.name,
        technician: null, assignedUserId: null, date: asset.effectiveNextDueDate,
        daysLate: Math.max(0, civilDaysBetween(asset.effectiveNextDueDate, today)), status: "NeedsOrder", to: `/pmoc/${plan.id}`,
      })
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.assetName.localeCompare(b.assetName))
}

/** Earliest next due date per plan, from coverage (undefined when unknown). */
export function nextDueByPlan(coverage: Record<string, MaintenancePlanCoverage>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(coverage).map(([planId, data]) => [planId, data.assets.map(asset => asset.effectiveNextDueDate).sort()[0]]))
}
