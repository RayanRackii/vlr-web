import type { PackageKey } from "@/features/billing/schemas/billingSchemas"

/**
 * Vertical landing pages as data. The page component is generic: a new vertical is a new entry here
 * plus its copy under `landing.verticals.<id>` in the locale files. Nothing here is tenant specific.
 */
export type VerticalDefinition = {
  /** Key of the copy under `landing.verticals.<id>`. */
  id: string
  /** Public route. */
  path: string
  /** Package whose plans the pricing teaser and the CTA point to. */
  packageKey: PackageKey
  /** Keys under `landing.verticals.<id>.benefits` (three benefits). */
  benefitIds: readonly string[]
  /** Number of entries in `proofs` and `screenshots` (strings in the locale files). */
  proofCount: number
  screenshotCount: number
}

export const VERTICALS = {
  arenas: {
    id: "arenas",
    path: "/arenas",
    packageKey: "reservas",
    benefitIds: ["booking", "payment", "waitlist"],
    proofCount: 4,
    screenshotCount: 3,
  },
  pmoc: {
    id: "pmoc",
    path: "/pmoc",
    packageKey: "manutencao",
    benefitIds: ["plan", "offline", "portal"],
    proofCount: 4,
    screenshotCount: 3,
  },
} as const satisfies Record<string, VerticalDefinition>

export type VerticalId = keyof typeof VERTICALS
