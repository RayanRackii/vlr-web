import i18n from "@/lib/i18n"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"

/** "America/Manaus" -> "Manaus"; "America/Sao_Paulo" -> "Sao Paulo". */
function tenantTimeZoneCityName(timeZoneId: string): string {
  const segment = timeZoneId.split("/").pop() ?? timeZoneId
  return segment.replace(/_/g, " ")
}

function tenantTimeZoneOffsetLabel(
  timeZoneId: string,
  locale: string,
  displayedAt: Date,
): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timeZoneId,
      timeZoneName: "shortOffset",
    }).formatToParts(displayedAt)
    const offset = parts.find((part) => part.type === "timeZoneName")?.value
    return offset ?? ""
  } catch {
    return ""
  }
}

/** "horário de Manaus (GMT-4)" — tenant clock label for agenda/reservations/toasts. */
export function formatTenantTimeZoneLabel(
  timeZoneId: string | null | undefined,
  locale: string,
  displayedAt: Date | string = new Date(),
): string {
  const resolved = resolveTenantTimeZone(timeZoneId)
  const city = tenantTimeZoneCityName(resolved)
  const instant = typeof displayedAt === "string"
    ? new Date(displayedAt.length === 10 ? `${displayedAt}T12:00:00Z` : displayedAt)
    : displayedAt
  const offset = tenantTimeZoneOffsetLabel(resolved, locale, instant)
  return i18n.t("tenantPortal.timeZoneLabel", {
    city,
    offset,
    lng: locale,
  })
}
