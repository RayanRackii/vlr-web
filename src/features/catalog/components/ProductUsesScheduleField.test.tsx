import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { ProductUsesScheduleField } from "@/features/catalog/components/ProductUsesScheduleField"

const t = (key: string) => i18n.t(`cadastro.product.salesMode.${key}`)

function Harness({ onChange }: { onChange: (v: boolean) => void }) {
  const [value, setValue] = useState(true)
  return (
    <ProductUsesScheduleField
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

it("renders both cards with titles and descriptions", () => {
  render(<Harness onChange={() => {}} />)
  expect(screen.getByText(t("label"))).toBeInTheDocument()
  expect(screen.getByText(t("description"))).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: t("titleWith") })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByRole("radio", { name: t("titleWithout") })).toHaveAttribute("aria-checked", "false")
  expect(screen.getByText(t("descWith"))).toBeInTheDocument()
  expect(screen.getByText(t("descWithout"))).toBeInTheDocument()
  expect(screen.getByText(t("helperWith"))).toBeInTheDocument()
})

it("selecting Sem agendamento calls onChange(false) and swaps the helper", async () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  await userEvent.setup().click(screen.getByRole("radio", { name: t("titleWithout") }))
  expect(onChange).toHaveBeenCalledWith(false)
  expect(screen.getByText(t("helperWithout"))).toBeInTheDocument()
  expect(screen.queryByText(t("helperWith"))).not.toBeInTheDocument()
})

it("supports keyboard selection with the arrow keys", async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness onChange={onChange} />)
  screen.getByRole("radio", { name: t("titleWith") }).focus()
  await user.keyboard("{ArrowRight}")
  expect(onChange).toHaveBeenLastCalledWith(false)
  expect(screen.getByRole("radio", { name: t("titleWithout") })).toHaveFocus()
  await user.keyboard("{ArrowLeft}")
  expect(onChange).toHaveBeenLastCalledWith(true)
})
