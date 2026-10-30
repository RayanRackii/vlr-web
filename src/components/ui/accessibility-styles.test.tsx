import { readFileSync } from "node:fs"
import { render, screen } from "@testing-library/react"
import { CircleHelp, LucideProvider } from "lucide-react"
import { parse } from "postcss"
import { describe, expect, it } from "vitest"

import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { FieldHelp } from "./field-label"
import { Switch } from "./switch"
import { Input } from "./input"
import { Select, SelectTrigger, SelectValue } from "./select"
import { Textarea } from "./textarea"

describe("small control accessibility", () => {
  it("styles focused native segments and shared controls, with only destructive feedback when invalid", () => {
    render(<>
      <Input type="date" aria-label="Date" />
      <Input type="time" aria-label="Time" />
      <Input type="datetime-local" aria-label="Date and time" />
      <select aria-label="Native select"><option>Option</option></select>
      <Input aria-label="Name" />
      <Select><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></Select>
    </>)
    const css = parse(readFileSync("src/index.css", "utf8"))
    for (const label of ["Date", "Time", "Date and time", "Native select", "Name", "Type"]) {
      const control = screen.getByLabelText(label)
      for (const invalid of [false, true]) {
        control.setAttribute("aria-invalid", String(invalid))
        control.focus()
        const declarations: Record<string, string> = {}
        css.walkRules((rule) => {
          if (!rule.selector.startsWith(":root :is(") || !rule.selector.includes(":focus-within") || !control.matches(rule.selector)) return
          rule.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value })
        })
        const color = invalid ? "var(--destructive)" : "var(--focus-ring, var(--ring))"
        expect(declarations, `${label}, invalid=${invalid}`).toMatchObject({ outline: `2px solid ${color}`, "outline-offset": "2px", "border-color": color, "--tw-ring-color": color })
        if (invalid) expect(declarations["box-shadow"]).toBe("none")
      }
    }
  })

  it("gives touch targets a real 44px minimum box on coarse pointers and narrow screens", () => {
    render(<><Input aria-label="Name" /><Select><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></Select></>)
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass("touch-target")
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveClass("touch-target")

    const css = parse(readFileSync("src/index.css", "utf8"))
    let actualBox = false
    css.walkRules((rule) => {
      if (!rule.selector.startsWith(".touch-target:not(")) return
      expect(rule.parent?.type === "atrule" && rule.parent.params).toBe("(pointer: coarse), (max-width: 767px)")
      const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]))
      expect(declarations).toMatchObject({ "min-width": "44px", "min-height": "44px", "box-sizing": "border-box" })
      actualBox = true
    })
    expect(actualBox).toBe(true)
  })

  it.each(["default", "sm", "xs", "icon-xs", "icon-sm", "icon"] as const)("gives %s Button the shared touch-target so it reaches 44px on touch/narrow screens", (size) => {
    render(<Button size={size}>Action</Button>)
    expect(screen.getByRole("button", { name: "Action" })).toHaveClass("touch-target")
  })

  it("keeps invalid input, select and textarea borders and focus rings destructive in both themes", () => {
    render(<>
      <Input aria-label="Name" aria-invalid="true" />
      <Textarea aria-label="Notes" aria-invalid="true" />
      <Select><SelectTrigger aria-label="Type" aria-invalid="true"><SelectValue /></SelectTrigger></Select>
    </>)
    for (const control of [screen.getByRole("textbox", { name: "Name" }), screen.getByRole("textbox", { name: "Notes" }), screen.getByRole("combobox", { name: "Type" })]) {
      expect(control).toHaveClass("aria-invalid:border-destructive", "aria-invalid:focus-visible:border-destructive", "aria-invalid:focus-visible:ring-destructive", "dark:aria-invalid:focus-visible:ring-destructive")
      expect(control).not.toHaveClass("dark:aria-invalid:border-destructive/50")
    }
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
