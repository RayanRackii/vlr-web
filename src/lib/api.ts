import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { z } from "zod"

import { supabase } from "@/lib/supabase"

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
  const accessToken = data.session?.access_token

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
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
