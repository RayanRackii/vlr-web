import { z } from "zod"

export const invitePreviewSchema = z.object({
  email: z.string().min(1),
  fullName: z.string(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  existingAccount: z.boolean(),
  expiresAt: z.string().min(1),
})

export type InvitePreview = z.infer<typeof invitePreviewSchema>

export const acceptInviteResponseSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().min(1),
  existingAccount: z.boolean(),
})

export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>
