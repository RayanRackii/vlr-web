import { render, screen } from "@testing-library/react"
import { CircleHelp, LucideProvider } from "lucide-react"
import { describe, expect, it } from "vitest"

import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { FieldHelp } from "./field-label"
import { Switch } from "./switch"

describe("small control accessibility", () => {
  it.each(["xs", "icon-xs", "icon-sm", "icon"] as const)("keeps %s Button (already >= 24px) free of the pseudo hit area so tight icon groups do not overlap", (size) => {
    render(<Button size={size}>Action</Button>)
    expect(screen.getByRole("button", { name: "Action" })).not.toHaveClass("touch-target")
  })

  it("expands the field help target while keeping the 16px info button", () => {
    render(<FieldHelp text="Field information" />)
    expect(screen.getByRole("button", { name: "Field information" })).toHaveClass("touch-target", "size-4")
  })

  it("expands checkbox and small switch targets", () => {
    render(<><Checkbox aria-label="Selected" /><Switch size="sm" aria-label="Enabled" /></>)
    expect(screen.getByRole("checkbox")).toHaveClass("touch-target", "size-4")
    expect(screen.getByRole("switch")).toHaveClass("touch-target", "h-5")
  })

  it("inherits Lucide defaults without overriding explicit props or custom SVG art", () => {
    const { container } = render(
      <LucideProvider strokeWidth={ICON_STROKE_WIDTH} className="shrink-0">
        <CircleHelp data-testid="default-icon" />
        <CircleHelp data-testid="explicit-icon" size={20} strokeWidth={2.5} />
        <Button><svg data-testid="illustration" strokeWidth={3}><path d="M0 0L5 5" /></svg></Button>
      </LucideProvider>,
    )
    expect(screen.getByTestId("default-icon")).toHaveAttribute("stroke-width", "1.75")
    expect(screen.getByTestId("default-icon")).toHaveClass("shrink-0")
    expect(screen.getByTestId("explicit-icon")).toHaveAttribute("stroke-width", "2.5")
    expect(screen.getByTestId("explicit-icon")).toHaveAttribute("width", "20")
    expect(screen.getByTestId("illustration")).toHaveAttribute("stroke-width", "3")
    expect(container.querySelector("button")?.className).not.toContain("[stroke-width:")
  })
})
