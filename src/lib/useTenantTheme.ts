import { useMemo } from "react"
import { useTheme } from "next-themes"

import {
  resolveTenantTheme,
  tenantThemeCssVars,
  tenantThemeStyle,
  type TenantThemeTokens,
} from "@/lib/resolveTenantTheme"

export type TenantThemeLogoBackground = {
  logoBackgroundColor?: string | null
  logoBackgroundIsDark?: boolean
}

export function useTenantTheme(
  primaryColor?: string | null,
  secondaryColor?: string | null,
  logo?: TenantThemeLogoBackground,
): TenantThemeTokens {
  const { resolvedTheme } = useTheme()

  return useMemo(
    () =>
      resolveTenantTheme({
        primaryColor,
        secondaryColor,
        logoBackgroundColor: logo?.logoBackgroundColor,
        logoBackgroundIsDark: logo?.logoBackgroundIsDark,
        resolvedTheme,
      }),
    [
      primaryColor,
      secondaryColor,
      logo?.logoBackgroundColor,
      logo?.logoBackgroundIsDark,
      resolvedTheme,
    ],
  )
}

export function useTenantThemeStyle(
  primaryColor?: string | null,
  secondaryColor?: string | null,
  logo?: TenantThemeLogoBackground,
) {
  const tokens = useTenantTheme(primaryColor, secondaryColor, logo)
  return { tokens, style: tenantThemeStyle(tokens) }
}

export function useTenantThemeCssVars(
  primaryColor?: string | null,
  secondaryColor?: string | null,
  logo?: TenantThemeLogoBackground,
) {
  const tokens = useTenantTheme(primaryColor, secondaryColor, logo)
  return { tokens, style: tenantThemeCssVars(tokens) }
}
