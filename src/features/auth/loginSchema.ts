import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .email("Informe um e-mail válido."),
  password: z.string().min(1, "Senha é obrigatória."),
})

export type LoginFormValues = z.infer<typeof loginSchema>
