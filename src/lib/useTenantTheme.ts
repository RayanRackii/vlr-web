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
  /** Auth surfaces preserve the exact primary fill and use separate readable links. */
  auth?: boolean
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
        auth: logo?.auth,
      }),
    [
      primaryColor,
      secondaryColor,
      logo?.logoBackgroundColor,
      logo?.logoBackgroundIsDark,
      resolvedTheme,
      logo?.auth,
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
