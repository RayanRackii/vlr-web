import i18n from "@/lib/i18n"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"

/** Localized city names for IANA segments whose plain form reads wrong. */
const CITY_NAMES: Record<string, Partial<Record<"pt" | "es" | "en", string>>> = {
  Sao_Paulo: { pt: "São Paulo", es: "São Paulo", en: "São Paulo" },
  Belem: { pt: "Belém", es: "Belém", en: "Belém" },
  Maceio: { pt: "Maceió", es: "Maceió", en: "Maceió" },
  Cuiaba: { pt: "Cuiabá", es: "Cuiabá", en: "Cuiabá" },
  Araguaina: { pt: "Araguaína", es: "Araguaína", en: "Araguaína" },
  New_York: { pt: "Nova York", es: "Nueva York" },
  Mexico_City: { pt: "Cidade do México", es: "Ciudad de México" },
  Lisbon: { pt: "Lisboa", es: "Lisboa" },
  London: { pt: "Londres", es: "Londres" },
}

/** "America/Manaus" -> "Manaus"; "America/Sao_Paulo" -> "São Paulo"; pt "America/New_York" -> "Nova York". */
export function tenantTimeZoneCityName(timeZoneId: string, locale = "pt-BR"): string {
  const segment = timeZoneId.split("/").pop() ?? timeZoneId
  const lang = locale.slice(0, 2).toLowerCase() as "pt" | "es" | "en"
  return CITY_NAMES[segment]?.[lang] ?? segment.replace(/_/g, " ")
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
  const city = tenantTimeZoneCityName(resolved, locale)
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
