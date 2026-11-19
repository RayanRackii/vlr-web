export const LANDING_IMAGE_MAX_BYTES = 3 * 1024 * 1024
export const LANDING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const LANDING_IMAGE_ACCEPT = LANDING_IMAGE_TYPES.join(",")
export const LANDING_IMAGE_RECOMMENDED = { width: 1600, height: 1200 } as const

export type LandingImageProblem = "type" | "size"

/** Client-side pre-check; the API still validates the content. */
export function checkLandingImage(file: { type: string; size: number }): LandingImageProblem | null {
  if (!(LANDING_IMAGE_TYPES as readonly string[]).includes(file.type)) return "type"
  if (file.size > LANDING_IMAGE_MAX_BYTES) return "size"
  return null
}
