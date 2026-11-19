import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { AssetAttributeFields } from "@/features/assets/components/AssetAttributeFields"
import type { AttributeFormValue } from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

function Harness({
  fields,
  initial,
  errors = {},
  onValues,
}: {
  fields: AssetFamilyField[]
  initial: Record<string, AttributeFormValue>
  errors?: Record<string, string>
  onValues?: (values: Record<string, AttributeFormValue>) => void
}) {
  const [values, setValues] = useState(initial)
  return (
    <AssetAttributeFields
      fields={fields}
      values={values}
      onChange={(key, value) => {
        const next = { ...values, [key]: value }
        setValues(next)
        onValues?.(next)
      }}
      controlProps={(key, required) => ({ id: `f-${key}`, "aria-required": required || undefined, onBlur: vi.fn() })}
      errorFor={(key) => errors[key]}
    />
  )
}

const f = (partial: Partial<AssetFamilyField> & Pick<AssetFamilyField, "key" | "type">): AssetFamilyField => ({
  required: false,
  label: partial.key,
  ...partial,
})

describe("AssetAttributeFields", () => {
  it("text and url controls change", async () => {
    const user = userEvent.setup()
    const onValues = vi.fn()
    render(<Harness fields={[f({ key: "model", type: "text" }), f({ key: "src", type: "url" })]} initial={{ model: "", src: "" }} onValues={onValues} />)
    await user.type(screen.getByLabelText(/model/), "CR")
    await user.type(screen.getByLabelText(/src/), "https://a.b")
    expect(onValues).toHaveBeenLastCalledWith({ model: "CR", src: "https://a.b" })
    expect(screen.getByLabelText(/src/)).toHaveAttribute("type", "url")
  })

  it("date control uses a date input", () => {
    render(<Harness fields={[f({ key: "when", type: "date" })]} initial={{ when: "2026-11-19" }} />)
    expect(screen.getByLabelText(/when/)).toHaveAttribute("type", "date")
    expect(screen.getByLabelText(/when/)).toHaveValue("2026-11-19")
  })

  it("longtext renders a textarea with a counter", async () => {
    const user = userEvent.setup()
    render(<Harness fields={[f({ key: "notes", type: "longtext", maxLength: 50 })]} initial={{ notes: "" }} />)
    const area = screen.getByLabelText(/notes/)
    expect(area.tagName).toBe("TEXTAREA")
    await user.type(area, "abc")
    expect(screen.getByText("3/50")).toBeInTheDocument()
  })

  it("number uses decimal input mode, shows unit and range hint, keeps a typed comma for later normalization", async () => {
    const user = userEvent.setup()
    const onValues = vi.fn()
    render(<Harness fields={[f({ key: "res", type: "number", unit: "mm", min: 0, max: 5 })]} initial={{ res: "" }} onValues={onValues} />)
    const input = screen.getByLabelText(/res/)
    expect(input).toHaveAttribute("inputmode", "decimal")
    expect(screen.getByText("mm")).toBeInTheDocument()
    expect(screen.getByText(/0.*5/, { selector: "p" })).toBeInTheDocument()
    await user.type(input, "0,02")
    expect(onValues).toHaveBeenLastCalledWith({ res: "0,02" })
  })

  it("boolean toggles a switch", async () => {
    const user = userEvent.setup()
    const onValues = vi.fn()
    render(<Harness fields={[f({ key: "covered", type: "boolean" })]} initial={{ covered: false }} onValues={onValues} />)
    await user.click(screen.getByRole("switch"))
    expect(onValues).toHaveBeenLastCalledWith({ covered: true })
  })

  it("select shows the chosen option and changes", async () => {
    const user = userEvent.setup()
    const onValues = vi.fn()
    render(<Harness fields={[f({ key: "kind", type: "select", options: ["A", "B"] })]} initial={{ kind: "A" }} onValues={onValues} />)
    expect(screen.getByRole("combobox")).toHaveTextContent("A")
    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "B" }))
    expect(onValues).toHaveBeenLastCalledWith({ kind: "B" })
  })

  it("multiselect toggles chips in option order and shows legacy tokens as removable", async () => {
    const user = userEvent.setup()
    const onValues = vi.fn()
    render(<Harness fields={[f({ key: "mat", type: "multiselect", options: ["PLA", "PETG", "ABS"] })]} initial={{ mat: ["ABS", "PLA especial"] }} onValues={onValues} />)
    expect(screen.getByRole("button", { name: "ABS" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "PLA" })).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: "PLA" }))
    expect(onValues).toHaveBeenLastCalledWith({ mat: ["PLA especial", "PLA", "ABS"] })
    await user.click(screen.getByRole("button", { name: "PLA especial" }))
    expect(onValues).toHaveBeenLastCalledWith({ mat: ["PLA", "ABS"] })
    await user.click(screen.getByRole("button", { name: "ABS" }))
    expect(onValues).toHaveBeenLastCalledWith({ mat: ["PLA"] })
  })

  it("lays out fields with the same group together and hides archived fields", () => {
    render(
      <Harness
        fields={[
          f({ key: "x", type: "number", group: "Volume" }),
          f({ key: "y", type: "number", group: "Volume" }),
          f({ key: "old", type: "text", archived: true }),
          f({ key: "other", type: "text" }),
        ]}
        initial={{ x: "", y: "", old: "", other: "" }}
      />,
    )
    const group = screen.getByRole("group", { name: "Volume" })
    expect(group).toContainElement(screen.getByLabelText(/^x/))
    expect(group).toContainElement(screen.getByLabelText(/^y/))
    expect(group).not.toContainElement(screen.getByLabelText(/other/))
    expect(screen.queryByLabelText(/old/)).not.toBeInTheDocument()
  })

  it("shows help, the required mark and the error", () => {
    render(<Harness fields={[f({ key: "cap", type: "text", required: true, help: "Ajuda aqui" })]} initial={{ cap: "" }} errors={{ cap: "Obrigatório" }} />)
    expect(screen.getByText("Ajuda aqui")).toBeInTheDocument()
    expect(screen.getByText("Obrigatório")).toBeInTheDocument()
    expect(screen.getByLabelText(/cap/)).toHaveAttribute("aria-required", "true")
  })
})
