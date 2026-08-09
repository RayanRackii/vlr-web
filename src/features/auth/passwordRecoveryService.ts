import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"

export async function requestPasswordReset(email: string): Promise<string> {
  try {
    const response = await api.post<{ message: string }>(
      "/api/auth/forgot-password",
      { email },
    )
    return (
      response.data.message ??
      "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha."
    )
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        "Não foi possível enviar o e-mail de reset. Tente novamente.",
      ),
    )
  }
}
