import type { LucideProps } from "lucide-react"

/**
 * Standard lucide-react stroke width across the product UI. A touch lighter
 * than lucide's default (2) for a more refined, modern line weight.
 */
export const ICON_STROKE_WIDTH = 1.75

/**
 * Size tokens for lucide icons, keyed to the control scale. Use as a className
 * (`<Icon className={ICON_SIZE.sm} />`) so sizing stays consistent with the
 * primitives (inputs/buttons default to the `sm` glyph).
 */
export const ICON_SIZE = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const

export type IconSize = keyof typeof ICON_SIZE

/**
 * Default props to spread onto any lucide icon so stroke weight is uniform.
 * `<ChevronDown {...iconProps()} />` or `<Icon {...iconProps("md")} />`.
 */
export function iconProps(size?: IconSize): Partial<LucideProps> {
  return {
    strokeWidth: ICON_STROKE_WIDTH,
    "aria-hidden": true,
    ...(size ? { className: ICON_SIZE[size] } : {}),
  }
}
