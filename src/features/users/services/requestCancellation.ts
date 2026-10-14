export function isCanceledRequest(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const record = error as Record<string, unknown>
  return (
    record.name === "CanceledError" ||
    record.name === "AbortError" ||
    record.code === "ERR_CANCELED" ||
    record.__CANCEL__ === true
  )
}
