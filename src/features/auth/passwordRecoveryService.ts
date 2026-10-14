import { z } from "zod"

import { publicApi, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const forgotPasswordResponseSchema = z.object({
  message: z.string().optional(),
})

function isUnknownTenantError(message: string): boolean {
  return message.startsWith("No active tenant found for subdomain")
}

function tenantSubdomainHeader(
  subdomain: string | null,
): Record<string, string> | undefined {
  const slug = subdomain?.trim().toLowerCase() ?? ""
  if (slug.length === 0) {
    return undefined
  }

  return { "X-Tenant-Subdomain": slug }
}

export async function requestPasswordReset(
  email: string,
  subdomain: string | null,
): Promise<string> {
  const headers = tenantSubdomainHeader(subdomain)

  try {
    const response = headers
      ? await publicApi.post(
          "/api/auth/forgot-password",
          { email },
          { headers },
        )
      : await publicApi.post("/api/auth/forgot-password", { email })
    const parsed = forgotPasswordResponseSchema.safeParse(response.data)
    const message = parsed.success ? (parsed.data.message?.trim() ?? "") : ""
    return message.length > 0 ? message : i18n.t("auth.login.resetSent")
  } catch (error) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      i18n.t("auth.login.resetFailed"),
    )
    if (isUnknownTenantError(message)) {
      return i18n.t("auth.login.resetSent")
    }

    throw new Error(message, { cause: error })
  }
}
