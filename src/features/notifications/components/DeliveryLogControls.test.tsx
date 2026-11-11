import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { DeliveryLogControls } from "./DeliveryLogControls"

describe("delivery log dates", () => {
  it("shows dd/mm/aaaa on pt-BR instead of a native month-first field", async () => {
    await i18n.changeLanguage("pt-BR")
    render(
      <DeliveryLogControls
        status=""
        channel=""
        event=""
        from="2026-11-10"
        to=""
        pageSize={20}
        onStatus={() => {}}
        onChannel={() => {}}
        onEvent={() => {}}
        onFrom={() => {}}
        onTo={() => {}}
        onPageSize={() => {}}
      />,
    )
    expect(screen.getByLabelText("De")).toHaveValue("10/11/2026")
    expect(screen.getByLabelText("De")).toHaveAttribute("placeholder", "dd/mm/aaaa")
    expect(screen.getByLabelText("Até")).toHaveAttribute("placeholder", "dd/mm/aaaa")
    expect(document.querySelector('input[type="date"]')).toHaveAttribute("tabindex", "-1")
  })
})
