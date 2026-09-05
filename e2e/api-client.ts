import { loadE2eEnv } from "./env"

export type ApiResult<T = unknown> = {
  status: number
  body: T | null
  text: string
}

function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]*"/gi, '"refresh_token":"[redacted]"')
    .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"[redacted]"')
}

export class ApiClient {
  constructor(
    private readonly token: string,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    const env = loadE2eEnv()
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.extraHeaders,
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const text = await response.text()
    let parsed: T | null = null
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as T
      } catch {
        parsed = null
      }
    }

    return {
      status: response.status,
      body: parsed,
      text: redact(text),
    }
  }

  get<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("GET", path)
  }

  post<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("POST", path, body)
  }

  put<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("PUT", path, body)
  }

  delete<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("DELETE", path)
  }
}

export type AdminTenant = {
  id: string
  legalName: string
  taxId: string
  subdomain: string | null
  logoSvg?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  welcomeTagline?: string | null
  isActive: boolean
  createdAt: string
  activeModules: Array<{ moduleName: string; isActive: boolean }>
  assetFamilyKeys: string[]
}

export type CurrentUser = {
  role: string
  email: string
  tenantId: string | null
  activeModules: string[]
  activeAssetFamilies: string[]
}

export async function expectStatus(
  result: ApiResult,
  expected: number | readonly number[],
  label: string,
): Promise<void> {
  const allowed = typeof expected === "number" ? [expected] : expected
  if (!allowed.includes(result.status)) {
    throw new Error(
      `${label}: expected ${allowed.join("|")}, got ${result.status} ${result.text.slice(0, 300)}`,
    )
  }
}
