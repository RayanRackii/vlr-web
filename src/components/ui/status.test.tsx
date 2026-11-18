import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "@/components/ui/status"
import { STATUS_TONE_STYLES, type StatusTone } from "@/components/ui/status-tones"

const tones = Object.keys(STATUS_TONE_STYLES) as StatusTone[]

describe("StatusBadge", () => {
  it.each(tones)("renders the %s tone with its label and a decorative dot", (tone) => {
    render(<StatusBadge tone={tone}>Rótulo</StatusBadge>)
    const badge = screen.getByText("Rótulo")
    expect(badge).toHaveAttribute("data-status-tone", tone)
    const dot = badge.querySelector("[aria-hidden='true']")
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute("data-status-tone", tone)
  })

  it("uses tokens only: no raw palette classes or hex", () => {
    const all = JSON.stringify(STATUS_TONE_STYLES)
    expect(all).not.toMatch(/(emerald|amber|red|green|blue|yellow|orange|sky|slate|gray|zinc)-\d{2,3}/)
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
