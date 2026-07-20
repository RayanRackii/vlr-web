import { z } from "zod"
import type { TFunction } from "i18next"

export function createSetPasswordSchema(t: TFunction) {
  return z
    .object({
      password: z
        .string()
        .min(1, t("auth.invite.validation.passwordRequired"))
        .min(8, t("auth.invite.validation.passwordMin")),
      confirmPassword: z
        .string()
        .min(1, t("auth.invite.validation.confirmRequired")),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("auth.invite.validation.mismatch"),
      path: ["confirmPassword"],
    })
}

export type SetPasswordFormValues = z.infer<
  ReturnType<typeof createSetPasswordSchema>
>
