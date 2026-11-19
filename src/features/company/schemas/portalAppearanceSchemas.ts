import { z } from "zod"

/** Same limits as the API (PUT /api/portal-appearance returns 400 above them). */
export const PORTAL_KICKER_MAX = 60
export const PORTAL_HEADLINE_MAX = 120
export const PORTAL_SUBTITLE_MAX = 240

const nullableText = z.string().nullish().transform((value) => value ?? "")

/** GET/PUT/POST/DELETE /api/portal-appearance. Absent fields are tolerated as blank. */
export const portalAppearanceSchema = z.object({
  landingImageUrl: z.string().nullish().transform((value) => value || null),
  landingKicker: nullableText,
  landingHeadline: nullableText,
  landingSubtitle: nullableText,
  welcomeTagline: nullableText,
})

export type PortalAppearance = z.infer<typeof portalAppearanceSchema>

export type PortalAppearanceFormValues = {
  landingKicker: string
  landingHeadline: string
  landingSubtitle: string
}

export const emptyPortalAppearanceForm: PortalAppearanceFormValues = {
  landingKicker: "",
  landingHeadline: "",
  landingSubtitle: "",
}

export function createPortalAppearanceFormSchema(messages: { kickerTooLong: string; headlineTooLong: string; subtitleTooLong: string }) {
  return z.object({
    landingKicker: z.string().max(PORTAL_KICKER_MAX, messages.kickerTooLong),
    landingHeadline: z.string().max(PORTAL_HEADLINE_MAX, messages.headlineTooLong),
    landingSubtitle: z.string().max(PORTAL_SUBTITLE_MAX, messages.subtitleTooLong),
  })
}

export function appearanceToForm(appearance: PortalAppearance): PortalAppearanceFormValues {
  return {
    landingKicker: appearance.landingKicker,
    landingHeadline: appearance.landingHeadline,
    landingSubtitle: appearance.landingSubtitle,
  }
}

/** The PUT is a full replace: all three fields are sent, blank as null. */
export type PortalAppearanceWriteBody = {
  landingKicker: string | null
  landingHeadline: string | null
  landingSubtitle: string | null
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formToWriteBody(values: PortalAppearanceFormValues): PortalAppearanceWriteBody {
  return {
    landingKicker: blankToNull(values.landingKicker),
    landingHeadline: blankToNull(values.landingHeadline),
    landingSubtitle: blankToNull(values.landingSubtitle),
  }
}
