import { z } from "zod"

import i18n from "@/lib/i18n"

function translated(key: string) {
  return {
    error: () => i18n.t(key),
  }
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, translated("auth.login.validation.emailRequired"))
    .email(translated("auth.login.validation.emailInvalid")),
  password: z.string().min(1, translated("auth.login.validation.passwordRequired")),
})

export type LoginFormValues = z.infer<typeof loginSchema>
