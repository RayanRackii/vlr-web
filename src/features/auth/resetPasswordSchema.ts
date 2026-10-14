import type { TFunction } from "i18next"
import { z } from "zod"

export function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      password: z
        .string()
        .min(8, t("auth.resetPassword.validation.passwordMin")),
      confirmPassword: z
        .string()
        .min(1, t("auth.resetPassword.validation.confirmRequired")),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("auth.resetPassword.validation.mismatch"),
      path: ["confirmPassword"],
    })
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof createResetPasswordSchema>
>
