/**
 * Every tenant auth page (login, register, forgot/reset password, verify
 * email) in both the "/t/:subdomain/..." and subdomain-host "/..." forms.
 * Everything else (e.g. the portal 404) keeps the centered card layout.
 */
export function isTenantAuthPagePath(pathname: string): boolean {
  return /^\/(?:t\/[a-z0-9-]+)?\/?(?:login|register|verify-email|forgot-password(?:\/confirm)?|reset-password)?\/?$/i.test(
    pathname,
  )
}
