import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FirstStepsPage } from "@/features/rentals/pages/FirstStepsPage"
import i18n from "@/lib/i18n"

vi.mock("@/features/rentals/services/setupStatusService", () => ({
  getSetupStatus: vi.fn(),
}))

import { getSetupStatus } from "@/features/rentals/services/setupStatusService"

const getSetupStatusMock = vi.mocked(getSetupStatus)

describe("FirstStepsPage", () => {
  beforeEach(() => {
    getSetupStatusMock.mockReset()
  })

  it("waits for the server before showing a missing badge", async () => {
    let resolveStatus: (value: Awaited<ReturnType<typeof getSetupStatus>>) => void = () => {}
    getSetupStatusMock.mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve
    }))

    render(
      <MemoryRouter>
        <FirstStepsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("common.loading"))
    expect(screen.queryByText(i18n.t("assistant.firstSteps.state.missing"))).not.toBeInTheDocument()
    resolveStatus({
      checklist: [{ key: "hours", state: "missing" }],
      resources: [],
    })
    expect(await screen.findByRole("heading", { name: i18n.t("assistant.firstSteps.hours") })).toBeInTheDocument()
  })

  it("shows the server state for each row", async () => {
    getSetupStatusMock.mockResolvedValue({
      checklist: [
        { key: "company", state: "published" },
        { key: "pricedOffer", state: "published" },
        { key: "hours", state: "missing" },
        { key: "resource", state: "draft" },
        { key: "admin", state: "missing" },
        { key: "preview", state: "missing" },
      ],
      resources: [],
    })

    render(
      <MemoryRouter>
        <FirstStepsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: i18n.t("assistant.firstSteps.hours") })).toBeInTheDocument()
    expect(screen.getAllByText(i18n.t("assistant.firstSteps.state.missing")).length).toBe(3)
    expect(screen.getByText(i18n.t("assistant.firstSteps.state.draft"))).toBeInTheDocument()
    expect(screen.getAllByText(i18n.t("assistant.firstSteps.state.published")).length).toBeGreaterThan(0)
  })
})
