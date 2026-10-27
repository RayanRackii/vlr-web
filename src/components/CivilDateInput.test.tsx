import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { CivilDateInput } from "@/components/CivilDateInput"

function DateField({ locale, min, max }: { locale: string; min?: string; max?: string }) {
  const [value, setValue] = useState("")
  return <>
    <CivilDateInput aria-label="Date" locale={locale} value={value} min={min} max={max} onChange={setValue} />
    <output aria-label="Form value">{value}</output>
    <button type="button" onClick={() => setValue("")}>Reset</button>
  </>
}

describe("CivilDateInput", () => {
  it("clears an incomplete draft when its form is reset", async () => {
    const user = userEvent.setup()
    render(<DateField locale="pt-BR" />)
    await user.type(screen.getByRole("textbox"), "14/")
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(screen.getByRole("textbox")).toHaveValue("")
  })

  it("lets the user replace the day in a filled date without moving the caret", async () => {
    const user = userEvent.setup()
    render(<DateField locale="pt-BR" />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    await user.type(input, "14/10/2026")
    input.setSelectionRange(0, 2)
    await user.keyboard("20")
    expect(input).toHaveValue("20/10/2026")
    expect(screen.getByLabelText("Form value")).toHaveTextContent("2026-10-20")
  })

  it("preserves the four-digit year without changing the century", async () => {
    const user = userEvent.setup()
    render(<DateField locale="pt-BR" />)
    await user.type(screen.getByRole("textbox"), "14/10/0099")
    expect(screen.getByRole("textbox")).toHaveValue("14/10/0099")
    expect(screen.getByLabelText("Form value")).toHaveTextContent("0099-10-14")
  })
  it.each([
    ["pt-BR", "dd/mm/aaaa", "14/10/2026"],
    ["en", "mm/dd/yyyy", "10/14/2026"],
    ["es", "dd/mm/aaaa", "14/10/2026"],
  ])("edits dates in %s and emits ISO for complete dates", async (locale, placeholder, date) => {
    const user = userEvent.setup()
    render(<DateField locale={locale} />)
    const input = screen.getByRole("textbox", { name: "Date" })
    expect(input).toHaveAttribute("placeholder", placeholder)
    await user.type(input, date.slice(0, 3))
    expect(input).toHaveValue(date.slice(0, 3))
    expect(screen.getByLabelText("Form value")).toHaveTextContent(date.slice(0, 3))
    await user.type(input, date.slice(3))
    expect(input).toHaveValue(date)
    expect(screen.getByLabelText("Form value")).toHaveTextContent("2026-10-14")
  })

  it("reformats on locale change, accepts calendar changes, and respects external reset and blur", async () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    const { container, rerender } = render(<CivilDateInput aria-label="Date" locale="pt-BR" value="2026-10-14" onChange={onChange} onBlur={onBlur} />)
    expect(screen.getByRole("textbox")).toHaveValue("14/10/2026")
    fireEvent.blur(screen.getByRole("textbox"))
    expect(onBlur).toHaveBeenCalledOnce()
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-10-20" } })
    expect(onChange).toHaveBeenCalledWith("2026-10-20")
    rerender(<CivilDateInput aria-label="Date" locale="en" value="2026-10-14" onChange={onChange} />)
    expect(screen.getByRole("textbox")).toHaveValue("10/14/2026")
    rerender(<CivilDateInput aria-label="Date" locale="en" value="" onChange={onChange} />)
    expect(screen.getByRole("textbox")).toHaveValue("")
  })

  it.each(["31/02/2026", "29/02/2025", "14/13/2026"])("keeps invalid calendar date %s available for form validation", async (date) => {
    const user = userEvent.setup()
    render(<DateField locale="pt-BR" />)
    await user.type(screen.getByRole("textbox"), date)
    expect(screen.getByRole("textbox")).toHaveValue(date)
    expect(screen.getByLabelText("Form value")).toHaveTextContent(date)
  })

  it.each([
    ["13/10/2026", "2026-10-13", "2026-10-14", undefined],
    ["15/10/2026", "2026-10-15", undefined, "2026-10-14"],
  ])("preserves ISO for typed date %s outside the allowed range", async (text, iso, min, max) => {
    const user = userEvent.setup()
    render(<DateField locale="pt-BR" min={min} max={max} />)
    await user.type(screen.getByRole("textbox"), text)
    expect(screen.getByLabelText("Form value")).toHaveTextContent(iso)
    expect(screen.getByRole("textbox")).toHaveValue(text)
  })
})
