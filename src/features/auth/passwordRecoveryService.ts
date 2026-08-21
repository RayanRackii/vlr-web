import { publicApi, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

export async function requestPasswordReset(email: string): Promise<string> {
  try {
    const response = await publicApi.post<{ message: string }>(
      "/api/auth/forgot-password",
      { email },
    )
    return response.data.message ?? i18n.t("auth.login.resetSent")
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("auth.login.resetFailed"),
      ),
    )
  }
}
