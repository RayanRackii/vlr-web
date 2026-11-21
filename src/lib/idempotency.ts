import i18n from "@/lib/i18n"
import { getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import { readApiErrorBody } from "@/lib/apiErrorText"

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
const IN_PROGRESS = "idempotency.in_progress"
const KEY_CODES = ["idempotency.key_reused", "idempotency.key_invalid"]
const MAX_IN_PROGRESS_RETRIES = 2
const MIN_RETRY_MS = 1000
const MAX_RETRY_MS = 5000

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/**
 * One key per submit attempt. The same signature (the request content) keeps the key across retries,
 * a different signature gets a fresh one, and `reset()` is called after success.
 */
export function createAttemptKey() {
  let current: { signature: string; key: string } | null = null
  return {
    keyFor(signature: string): string {
      if (current?.signature !== signature) {
        current = { signature, key: newIdempotencyKey() }
      }
      return current.key
    },
    reset() {
      current = null
    },
  }
}

function errorCode(error: unknown): string | null {
  return isAxiosError(error) ? readApiErrorBody(getAxiosErrorPayload(error)).code : null
}

/** Generic localized message for key_reused / key_invalid; null for any other error. */
export function idempotencyKeyErrorMessage(error: unknown): string | null {
  const code = errorCode(error)
  return code !== null && KEY_CODES.includes(code) ? i18n.t("apiErrors.idempotencyKey") : null
}

function retryDelayMs(error: unknown): number {
  const raw = isAxiosError(error) ? error.response?.headers?.["retry-after"] : undefined
  const seconds = Number(raw)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : MIN_RETRY_MS
  return Math.min(MAX_RETRY_MS, Math.max(MIN_RETRY_MS, ms))
}

/** Re-runs `send` (same key) while the API says the original request is still running. */
export async function retryWhileInProgress<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send()
    } catch (error) {
      if (attempt >= MAX_IN_PROGRESS_RETRIES || errorCode(error) !== IN_PROGRESS) throw error
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(error)))
    }
  }
}

export function idempotencyHeaders(key: string | undefined): Record<string, string> | undefined {
  return key ? { [IDEMPOTENCY_KEY_HEADER]: key } : undefined
}
