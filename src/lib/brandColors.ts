export const ROLVIX_PRIMARY_COLOR = "#4D6A92"
export const ROLVIX_ACCENT_COLOR = "#5A8FA0"
export const ROLVIX_COMPLEMENTARY_COLOR = "#A2C6E9"

export function tenantBrandGradient(
  primary: string,
  accent: string,
  complementary = ROLVIX_COMPLEMENTARY_COLOR,
): string {
  return [
    `radial-gradient(ellipse 85% 65% at 12% 0%, color-mix(in srgb, ${primary} 24%, transparent), transparent 70%)`,
    `radial-gradient(ellipse 70% 55% at 100% 18%, color-mix(in srgb, ${accent} 22%, transparent), transparent 72%)`,
    `linear-gradient(135deg, color-mix(in srgb, ${primary} 8%, white), color-mix(in srgb, ${complementary} 20%, white) 52%, color-mix(in srgb, ${accent} 10%, white))`,
  ].join(", ")
}
