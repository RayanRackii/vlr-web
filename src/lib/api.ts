import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { z } from "zod"

import { supabase } from "@/lib/supabase"
import { getSupportTenantIdForApi } from "@/features/admin/support/supportTenantSession"

const DEFAULT_API_BASE_URL = "http://localhost:5298"

const apiErrorSchema = z.object({
  error: z.string(),
})

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL

  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, "")
  }

  return DEFAULT_API_BASE_URL
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { data } = await supabase.auth.getSession()
  const supabaseToken = data.session?.access_token
  const customerToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("rolvix.customer.token")
      : null

  // B2B Supabase session wins when present; otherwise B2C customer JWT.
  const accessToken = supabaseToken ?? customerToken

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  const supportTenantId = getSupportTenantIdForApi()
  const requestUrl = config.url ?? ""
  const isPlatformAdminApi =
    requestUrl.includes("/api/admin/") || requestUrl.startsWith("admin/")

  if (supportTenantId && !isPlatformAdminApi) {
    config.headers["X-Support-Tenant-Id"] = supportTenantId
  }

  return config
})

export function parseApiError(payload: unknown, fallbackMessage: string): string {
  const parsed = apiErrorSchema.safeParse(payload)

  if (parsed.success) {
    return parsed.data.error
  }

  return fallbackMessage
}

export function getAxiosErrorPayload(error: unknown): unknown {
  if (error instanceof AxiosError) {
    return error.response?.data ?? null
  }

  return null
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof AxiosError
}
