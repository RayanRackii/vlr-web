import { useMemo } from "react"
import { useTheme } from "next-themes"

import {
  resolveTenantTheme,
  tenantThemeCssVars,
  tenantThemeStyle,
  type TenantThemeTokens,
} from "@/lib/resolveTenantTheme"

export function useTenantTheme(
  primaryColor?: string | null,
  secondaryColor?: string | null,
): TenantThemeTokens {
  const { resolvedTheme } = useTheme()

  return useMemo(
    () =>
      resolveTenantTheme({
        primaryColor,
        secondaryColor,
        resolvedTheme,
      }),
    [primaryColor, secondaryColor, resolvedTheme],
  )
}

export function useTenantThemeStyle(
  primaryColor?: string | null,
  secondaryColor?: string | null,
) {
  const tokens = useTenantTheme(primaryColor, secondaryColor)
  return { tokens, style: tenantThemeStyle(tokens) }
}

export function useTenantThemeCssVars(
  primaryColor?: string | null,
  secondaryColor?: string | null,
) {
  const tokens = useTenantTheme(primaryColor, secondaryColor)
  return { tokens, style: tenantThemeCssVars(tokens) }
}
