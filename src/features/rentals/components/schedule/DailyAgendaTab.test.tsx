import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

import { DailyAgendaTab } from "@/features/rentals/components/schedule/DailyAgendaTab"
import i18n from "@/lib/i18n"

function renderEmptyAgenda() {
  const router = createMemoryRouter(
    [
      {
        path: "/configuracoes/agenda",
        element: (
          <DailyAgendaTab
            assets={[]}
            selectedRentalAssetIds={[]}
            date="2026-09-04"
            day={null}
            loading={false}
            showSkeleton={false}
            busy={false}
            busyAction={null}
            busyTargetKey={null}
            readOnly={false}
            onSelectedRentalAssetIdsChange={() => undefined}
            onDateChange={() => undefined}
            onPublish={() => undefined}
            onSlotOrCellClick={() => undefined}
          />
        ),
      },
      {
        path: "/configuracoes/recursos",
        element: <p>recursos-page</p>,
      },
    ],
    { initialEntries: ["/configuracoes/agenda"] },
  )

  return render(<RouterProvider router={router} />)
}

const forbidden = /Ativos|Assets|Activos|Asset Registry|asset-registry/i

describe("DailyAgendaTab no-assets empty state", () => {
  it("does not mention Ativos in any locale copy", async () => {
    for (const language of ["pt-BR", "en", "es"] as const) {
      await i18n.changeLanguage(language)
      expect(i18n.t("rentals.schedule.noAssets")).not.toMatch(forbidden)
      expect(i18n.t("rentals.schedule.noAssetsDescription")).not.toMatch(
        forbidden,
      )
      expect(i18n.t("rentals.schedule.noAssetsAction")).not.toMatch(forbidden)
    }
    await i18n.changeLanguage("pt-BR")
  })

  it("offers a CTA to /configuracoes/recursos", async () => {
    await i18n.changeLanguage("pt-BR")
    const user = userEvent.setup()
    renderEmptyAgenda()

    expect(screen.getByText(i18n.t("rentals.schedule.noAssets"))).toBeInTheDocument()
    expect(screen.queryByText(/Ativos/)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.noAssetsAction"),
      }),
    )
    expect(await screen.findByText("recursos-page")).toBeInTheDocument()
  })
})
