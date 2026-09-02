import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"

const useThemeMock = vi.fn()

vi.mock("next-themes", () => ({
  useTheme: () => useThemeMock(),
}))

const darkBackgroundLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#000000" /><circle cx="300" cy="300" r="80" fill="#22d3ee" /></svg>`
const transparentLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><circle cx="300" cy="300" r="80" fill="#22d3ee" /></svg>`

describe("TenantLogoMark", () => {
  beforeEach(() => {
    useThemeMock.mockReturnValue({ resolvedTheme: "light" })
  })

  it("keeps a transparent logo on the original surface", () => {
    render(
      <TenantLogoMark logoSvg={transparentLogo} displayName="Clube" />,
    )

    expect(screen.getByRole("img", { name: "Clube" })).toHaveAttribute(
      "data-logo-surface",
      "none",
    )
  })

  it("renders a dark-background logo without an adaptive white surface in dark theme", () => {
    useThemeMock.mockReturnValue({ resolvedTheme: "dark" })

    render(
      <TenantLogoMark logoSvg={darkBackgroundLogo} displayName="Clube" />,
    )

    const mark = screen.getByRole("img", { name: "Clube" })
    expect(mark).toHaveAttribute("data-logo-surface", "none")
    expect(mark.className).not.toMatch(/bg-neutral-100/)
    expect(mark.className).not.toMatch(/bg-neutral-300/)
  })

  it("still applies an adaptive surface when renderMode is adaptive-surface", () => {
    useThemeMock.mockReturnValue({ resolvedTheme: "dark" })

    render(
      <TenantLogoMark
        logoSvg={darkBackgroundLogo}
        displayName="Clube"
        renderMode="adaptive-surface"
      />,
    )

    expect(screen.getByRole("img", { name: "Clube" })).toHaveAttribute(
      "data-logo-surface",
      "light",
    )
  })

  it("does not adapt a dark-background logo in light theme", () => {
    render(
      <TenantLogoMark logoSvg={darkBackgroundLogo} displayName="Clube" />,
    )

    expect(screen.getByRole("img", { name: "Clube" })).toHaveAttribute(
      "data-logo-surface",
      "none",
    )
  })

  it("never adapts when renderMode is original", () => {
    useThemeMock.mockReturnValue({ resolvedTheme: "dark" })

    render(
      <TenantLogoMark
        logoSvg={darkBackgroundLogo}
        displayName="Clube"
        renderMode="original"
      />,
    )

    expect(screen.getByRole("img", { name: "Clube" })).toHaveAttribute(
      "data-logo-surface",
      "none",
    )
  })

  it("renders the sanitized original surface for malformed SVG", () => {
    render(<TenantLogoMark logoSvg="<svg><rect" displayName="Clube Acme" />)

    expect(screen.getByRole("img", { name: "Clube Acme" })).toHaveAttribute(
      "data-logo-surface",
      "none",
    )
  })
})
