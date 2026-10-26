import { useEffect } from "react"

import { sanitizeTenantLogoSvg } from "@/features/tenantPortal/lib/sanitizeTenantLogoSvg"

export const DEFAULT_DOCUMENT_TITLE = "Rolvix"
export const DEFAULT_FAVICON_HREF = "/favicon.svg"

export type TenantDocumentMeta = {
  /** Tenant subdomain; shown uppercased in the tab title when present. */
  slug?: string | null
  name?: string | null
  logoSvg?: string | null
  primaryColor?: string | null
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Standalone SVG images must be valid XML with xmlns and a fixed size.
 * Sanitized logos are HTML-serialized (e.g. `&nbsp;`) and often ship width="100%".
 */
export function toFaviconSvg(svg: string): string | null {
  const root = new DOMParser().parseFromString(svg, "text/html").querySelector("svg")
  if (!root) {
    return null
  }
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  root.setAttribute("width", "64")
  root.setAttribute("height", "64")
  return new XMLSerializer().serializeToString(root)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Letter icon used when the tenant has a name but no logo. */
export function tenantLetterIcon(name: string, primaryColor?: string | null): string {
  const letter = escapeXml(name.trim().charAt(0).toUpperCase())
  const fill = primaryColor && HEX_COLOR.test(primaryColor) ? primaryColor : "#334155"
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${fill}"/><text x="32" y="44" font-family="system-ui,Arial,sans-serif" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`,
  )
}

/** Title and favicon href for a tenant; Rolvix defaults when nothing is known. */
export function resolveTenantDocumentMeta(meta: TenantDocumentMeta | null | undefined): {
  title: string
  iconHref: string
} {
  const slug = meta?.slug?.trim().toUpperCase() ?? ""
  const name = meta?.name?.trim() || slug
  if (name.length === 0) {
    return { title: DEFAULT_DOCUMENT_TITLE, iconHref: DEFAULT_FAVICON_HREF }
  }
  const sanitized = sanitizeTenantLogoSvg(meta?.logoSvg)
  const logo = sanitized ? toFaviconSvg(sanitized) : null
  return {
    title: `${slug || name} · ${DEFAULT_DOCUMENT_TITLE}`,
    iconHref: logo ? svgDataUri(logo) : tenantLetterIcon(name, meta?.primaryColor),
  }
}

function iconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  return link
}

export function applyDocumentMeta(title: string, iconHref: string): void {
  document.title = title
  const link = iconLink()
  link.type = "image/svg+xml"
  link.href = iconHref
}

/** Shows the tenant subdomain (or name) and logo in the browser tab; restores Rolvix on unmount. */
export function useTenantDocumentMeta(meta: TenantDocumentMeta | null | undefined): void {
  const slug = meta?.slug ?? null
  const name = meta?.name ?? null
  const logoSvg = meta?.logoSvg ?? null
  const primaryColor = meta?.primaryColor ?? null
  useEffect(() => {
    const { title, iconHref } = resolveTenantDocumentMeta({ slug, name, logoSvg, primaryColor })
    applyDocumentMeta(title, iconHref)
    return () => applyDocumentMeta(DEFAULT_DOCUMENT_TITLE, DEFAULT_FAVICON_HREF)
  }, [slug, name, logoSvg, primaryColor])
}
