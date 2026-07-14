import { z } from "zod"

export const createTenantRequestSchema = z.object({
  legalName: z.string().trim().min(1, "Razão social é obrigatória."),
  taxId: z.string().trim().min(1, "CNPJ/CPF é obrigatório."),
  tradeName: z.string().trim().optional(),
  headquartersUnitName: z
    .string()
    .trim()
    .min(1, "Nome da unidade matriz é obrigatório."),
  headquartersUnitCode: z.string().trim().optional(),
  adminFullName: z.string().trim().min(1, "Nome do administrador é obrigatório."),
  adminEmail: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .email("Informe um e-mail válido."),
  adminPassword: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres."),
})

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>

export const createTenantResponseSchema = z.object({
  tenantId: z.string().uuid(),
  headquartersUnitId: z.string().uuid(),
  adminUserId: z.string().uuid(),
  superAdminRoleId: z.string().uuid(),
  supabaseAuthId: z.string().min(1),
})

export type CreateTenantResponse = z.infer<typeof createTenantResponseSchema>

const apiErrorSchema = z.object({
  error: z.string(),
})

export function parseApiError(payload: unknown): string {
  const parsed = apiErrorSchema.safeParse(payload)

  if (parsed.success) {
    return parsed.data.error
  }

  return "Não foi possível concluir o cadastro. Tente novamente."
}
