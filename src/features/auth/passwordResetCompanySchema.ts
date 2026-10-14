import { z } from "zod"

const SUBDOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function buildPasswordResetCompanySchema(messages: {
  subdomainMin: string
  subdomainMax: string
  subdomainFormat: string
}) {
  return z.object({
    subdomain: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, messages.subdomainMin)
      .max(63, messages.subdomainMax)
      .regex(SUBDOMAIN_PATTERN, messages.subdomainFormat),
  })
}

export type PasswordResetCompanyFormValues = {
  subdomain: string
}
