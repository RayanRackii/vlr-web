import type { ZodError } from "zod"

export function issueMessageAt(
  error: ZodError | undefined,
  path: readonly (string | number)[],
): string | undefined {
  if (!error) {
    return undefined
  }

  const target = path.map(String).join(".")
  const issue = error.issues.find(
    (item) => item.path.map(String).join(".") === target,
  )
  return issue?.message
}

export function uniqueIssueMessages(
  error: ZodError | undefined,
  include?: (path: readonly PropertyKey[]) => boolean,
): string[] {
  if (!error) {
    return []
  }

  const seen = new Set<string>()
  const messages: string[] = []

  for (const issue of error.issues) {
    if (include && !include(issue.path)) {
      continue
    }

    if (seen.has(issue.message)) {
      continue
    }

    seen.add(issue.message)
    messages.push(issue.message)
  }

  return messages
}
