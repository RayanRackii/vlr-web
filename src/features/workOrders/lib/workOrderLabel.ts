/** Short, human-readable OS reference (the list's "ID" column uses the same value). */
export function formatWorkOrderShortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

type WorkOrderLabelSource = {
  id: string
  number?: number | null
  asset: { name: string }
}

/** "OS #12", or "OS <short id>" when the API did not send a number. `prefix` is the localized "OS"/"WO"/"OT". */
export function formatWorkOrderNumber(
  wo: Pick<WorkOrderLabelSource, "id" | "number">,
  prefix = "OS",
): string {
  return wo.number != null
    ? `${prefix} #${wo.number}`
    : `${prefix} ${formatWorkOrderShortId(wo.id)}`
}

/** "OS #12 · <asset name>" (short id fallback when `number` is missing). */
export function formatWorkOrderTitle(wo: WorkOrderLabelSource, prefix = "OS"): string {
  return `${formatWorkOrderNumber(wo, prefix)} · ${wo.asset.name}`
}
