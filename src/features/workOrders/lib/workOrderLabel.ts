/** Short, human-readable OS reference (the list's "ID" column uses the same value). */
export function formatWorkOrderShortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
