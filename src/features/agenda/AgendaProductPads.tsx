import { useTranslation } from "react-i18next"
import { zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import type { AgendaBlock } from "./dayGridModel"

/** Decorations use the occupied/work instants already returned with an order. */
export function AgendaProductPads({ block, date, timeZone }: { block: AgendaBlock; date: string; timeZone: string }) {
  const { t } = useTranslation()
  const { startInstant, endInstant, workStart, workEnd } = block
  if (!startInstant || !endInstant || !workStart || !workEnd) return null
  const instants = [startInstant, workStart, workEnd, endInstant].map(Date.parse)
  if (instants.some((value) => !Number.isFinite(value)) || instants[0] > instants[1] || instants[1] >= instants[2] || instants[2] > instants[3]) return null
  const localStart = zonedDayAndMinutes(workStart, timeZone)
  const localEnd = zonedDayAndMinutes(workEnd, timeZone)
  if (!localStart || !localEnd) return null
  const bound = (local: typeof localStart) => local.dayKey < date ? 0 : local.dayKey > date ? 1440 : local.minutes
  const workLeft = Math.max(block.start, Math.min(block.end, bound(localStart)))
  const workRight = Math.max(block.start, Math.min(block.end, bound(localEnd)))
  const duration = block.end - block.start
  if (duration <= 0) return null
  return <>
    {workLeft > block.start && <span role="img" aria-label={t("agendas.prep")} className="agenda-product-pad absolute inset-y-0 left-0" style={{ width: `${(workLeft - block.start) / duration * 100}%` }} />}
    {workRight < block.end && <span role="img" aria-label={t("agendas.cleanup")} className="agenda-product-pad absolute inset-y-0 right-0" style={{ width: `${(block.end - workRight) / duration * 100}%` }} />}
  </>
}
