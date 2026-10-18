import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { LocaleDateInput } from "@/components/LocaleDateInput"
import i18n from "@/lib/i18n"

describe("LocaleDateInput", () => {
  it("shows DD/MM for pt-BR and es while keeping the ISO value", () => {
    const { rerender } = render(
      <div>
        <label htmlFor="day">Data</label>
        <LocaleDateInput
          id="day"
          locale="pt-BR"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </div>,
    )

    expect(screen.getByText("14/10/2026")).toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toHaveValue("2026-10-14")

    rerender(
      <label>
        Fecha
        <LocaleDateInput
          locale="es"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </label>,
    )
    expect(screen.getByText("14/10/2026")).toBeInTheDocument()

    rerender(
      <label>
        Date
        <LocaleDateInput
          locale="en"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </label>,
    )
    expect(screen.getByText("10/14/2026")).toBeInTheDocument()
    expect(screen.queryByText("14/10/2026")).not.toBeInTheDocument()
  })

  it("opens a calendar in the field locale and reports days outside min/max", async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    render(
      <div>
        <label htmlFor="day">Data</label>
        <LocaleDateInput
          id="day"
          locale="pt-BR"
          today="2026-10-14"
          min="2026-10-14"
          max="2026-10-16"
          value="2026-10-14"
          onChange={(next) => {
            seen.push(next)
          }}
        />
      </div>,
    )

    await user.click(screen.getByLabelText("Data"))
    const dialog = await screen.findByRole("dialog", { name: /outubro de 2026/i })
    expect(dialog).toHaveAttribute("lang", "pt-BR")
    expect(screen.getByRole("button", { name: i18n.t("common.datePicker.today") })).toHaveTextContent(
      "Hoje",
    )
    expect(screen.getByRole("button", { name: i18n.t("common.datePicker.clear") })).toHaveTextContent(
      "Limpar",
    )
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument()
    expect(screen.queryByText("October 2026")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "20/10/2026" }))
    expect(seen).toEqual(["2026-10-20"])
    expect(screen.getByLabelText("Data")).toHaveAttribute("lang", "pt-BR")
  })

  it("uses English month and actions when the app language is English", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("en")
    try {
      render(
        <div>
          <label htmlFor="day">Date</label>
          <LocaleDateInput
            id="day"
            locale="en"
            today="2026-10-14"
            value="2026-10-14"
            onChange={() => undefined}
          />
        </div>,
      )
      await user.click(screen.getByLabelText("Date"))
      expect(await screen.findByRole("dialog", { name: "October 2026" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })
})
