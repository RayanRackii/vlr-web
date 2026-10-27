/**
 * Guards the `returnTo` query param carried through tenant portal login.
 * Only a same-origin relative path is accepted — anything with a scheme,
 * a protocol-relative `//host`, or a backslash is rejected so the param
 * cannot be used as an open redirect.
 */
const UNSAFE_RETURN_TO = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i

export function isSafeReturnToPath(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return false
  }
  if (!value.startsWith("/") || UNSAFE_RETURN_TO.test(value)) {
    return false
  }
  return !/[\r\n\t]/.test(value)
}

/** Reads `returnTo` from a login URL, or `null` when absent or unsafe. */
export function readReturnToParam(
  searchParams: URLSearchParams,
): string | null {
  const value = searchParams.get("returnTo")
  return value !== null && isSafeReturnToPath(value) ? value : null
}

/** Appends a validated `returnTo` onto a login path, e.g. before redirecting a signed-out visitor. */
export function appendReturnToParam(basePath: string, returnTo: string): string {
  if (!isSafeReturnToPath(returnTo)) {
    return basePath
  }
  const params = new URLSearchParams()
  params.set("returnTo", returnTo)
  return `${basePath}?${params.toString()}`
}
