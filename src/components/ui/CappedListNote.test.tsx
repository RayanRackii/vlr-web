import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CappedListNote } from "@/components/ui/CappedListNote"
import i18n from "@/lib/i18n"
import { withListTotal } from "@/lib/listTotal"

describe("CappedListNote", () => {
  it("shows the note only when the total exceeds the rows shown", async () => {
    await i18n.changeLanguage("pt-BR")
    const rows = withListTotal(Array.from({ length: 500 }, (_, i) => i), { "x-total-count": "1234" })
    const { rerender } = render(<CappedListNote rows={rows} />)
    expect(screen.getByRole("note").textContent).toBe("Mostrando os 500 mais recentes de 1.234")

    rerender(<CappedListNote rows={withListTotal([1, 2], { "x-total-count": "2" })} />)
    expect(screen.queryByRole("note")).toBeNull()
    rerender(<CappedListNote rows={[1]} />)
    expect(screen.queryByRole("note")).toBeNull()
  })
})
