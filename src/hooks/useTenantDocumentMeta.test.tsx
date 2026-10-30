import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_FAVICON_HREF,
  resolveTenantDocumentMeta,
  useTenantDocumentMeta,
} from "@/hooks/useTenantDocumentMeta"

const iconHref = () =>
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute("href")

afterEach(() => {
  document.head.innerHTML = ""
  document.title = ""
})

describe("resolveTenantDocumentMeta", () => {
  it("falls back to Rolvix without a name", () => {
    expect(resolveTenantDocumentMeta(null)).toEqual({
      title: "Rolvix",
      iconHref: DEFAULT_FAVICON_HREF,
    })
  })

  it("uses the sanitized logo svg as favicon", () => {
    const r = resolveTenantDocumentMeta({
      name: "FICC",
      logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><rect/></svg>',
    })
    expect(r.title).toBe("FICC · Rolvix")
    const svg = decodeURIComponent(r.iconHref.replace("data:image/svg+xml,", ""))
    expect(svg).toContain("<rect")
    expect(svg).not.toContain("script")
  })

  it("gives percent-sized logos a fixed favicon size", () => {
    const r = resolveTenantDocumentMeta({
      name: "FICC",
      logoSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect/></svg>',
    })
    const svg = decodeURIComponent(r.iconHref)
    expect(svg).toContain('width="64"')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).not.toContain("100%")
  })

  it("emits well-formed XML even when the logo has nbsp entities", () => {
    const r = resolveTenantDocumentMeta({
      name: "FICC",
      logoSvg: '<svg xmlns="http://www.w3.org/2000/svg">\u00a0<rect/></svg>',
    })
    const svg = decodeURIComponent(r.iconHref.replace("data:image/svg+xml,", ""))
    expect(svg).not.toContain("&nbsp;")
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
    expect(doc.querySelector("parsererror")).toBeNull()
  })

  it("generates a letter icon when there is no logo", () => {
    const r = resolveTenantDocumentMeta({ name: "barbearia", primaryColor: "#123456" })
    const svg = decodeURIComponent(r.iconHref)
    expect(svg).toContain(">B</text>")
    expect(svg).toContain("#123456")
  })

  it("titles the tab with the uppercased subdomain instead of the display name", () => {
    const r = resolveTenantDocumentMeta({ slug: "ficc", name: "Foz do Iguaçu Country Club" })
    expect(r.title).toBe("FICC · Rolvix")
    expect(decodeURIComponent(r.iconHref)).toContain(">F</text>")
    expect(resolveTenantDocumentMeta({ slug: " zzr14locacao " }).title).toBe("ZZR14LOCACAO · Rolvix")
  })

  it("falls back to the display name without a subdomain", () => {
    expect(resolveTenantDocumentMeta({ slug: "", name: "Foz Club" }).title).toBe("Foz Club · Rolvix")
  })

  it("ignores a non-hex color", () => {
    const svg = decodeURIComponent(
      resolveTenantDocumentMeta({ name: "x", primaryColor: 'red" onload="1' }).iconHref,
    )
    expect(svg).not.toContain("onload")
  })
})

describe("useTenantDocumentMeta", () => {
  it("sets the tab and restores Rolvix on unmount", () => {
    const { unmount } = renderHook(() => useTenantDocumentMeta({ slug: "ficc", name: "Foz do Iguaçu Country Club" }))
    expect(document.title).toBe("FICC · Rolvix")
    expect(iconHref()).toMatch(/^data:image\/svg\+xml,/)
    unmount()
    expect(document.title).toBe("Rolvix")
    expect(iconHref()).toBe(DEFAULT_FAVICON_HREF)
  })
})
