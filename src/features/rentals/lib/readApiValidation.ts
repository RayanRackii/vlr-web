import { getAxiosErrorPayload } from "@/lib/api"

function fieldKey(key: string): string {
  const leaf = key.split(".").pop() ?? key
  return leaf.charAt(0).toLowerCase() + leaf.slice(1)
}

/** Field messages from an ASP.NET validation payload, including errors wrapped as `cause`. */
export function readApiValidation(error: unknown): { summary: string[]; fields: Record<string, string> } {
  const payload = getAxiosErrorPayload(error) ?? getAxiosErrorPayload((error as { cause?: unknown } | null)?.cause)
  const summary: string[] = []
  const fields: Record<string, string> = {}
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>
    const errors = record.errors
    if (typeof errors === "object" && errors !== null) {
      for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
        const messages = (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string" && item.trim() !== "")
        if (messages[0]) fields[fieldKey(key)] = messages[0]
        summary.push(...messages)
      }
    }
    if (typeof record.detail === "string" && record.detail.trim() !== "") summary.push(record.detail)
    if (typeof record.title === "string" && summary.length === 0 && record.title.trim() !== "") summary.push(record.title)
  }
  if (summary.length === 0 && error instanceof Error && error.message.trim() !== "") summary.push(error.message)
  return { summary: [...new Set(summary)], fields }
}
