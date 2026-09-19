import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanRelatedWorkOrders } from "@/features/pmoc/components/PlanRelatedWorkOrders"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import i18n from "@/lib/i18n"

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  getWorkOrders: vi.fn(),
}))

import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

const getWorkOrdersMock = vi.mocked(getWorkOrders)

function renderRelated(
  permissions: readonly string[],
  onGenerate = vi.fn(),
) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/${PLAN_ID}`]}>
      <TestPermissionProvider
        permissions={permissions}
        activeModules={["pmoc", "os"]}
      >
        <Routes>
          <Route
            path="/pmoc/:id"
            element={
              <PlanRelatedWorkOrders
                planId={PLAN_ID}
                refreshKey={0}
                onGenerate={onGenerate}
              />
            }
          />
          <Route path="/os/:id" element={<div>os-detail</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PlanRelatedWorkOrders", () => {
  beforeEach(() => {
    getWorkOrdersMock.mockReset()
  })

  it("F: renders status, asset, scheduled date and opens the work order", async () => {
    getWorkOrdersMock.mockResolvedValue([
      makeWorkOrder({
        assignedUser: {
          id: "88888888-8888-4888-8888-888888888888",
          fullName: "Ana Souza",
          email: "ana@example.com",
        },
      }),
    ])

    renderRelated(["os.work_orders.read", "os.work_orders.create"])

    expect(
      await screen.findByText(i18n.t("workOrders.status.Pending")),
    ).toBeInTheDocument()
    expect(screen.getByText("AC-01 — Split sala 1")).toBeInTheDocument()
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
    expect(screen.getByText("18/09/2026")).toBeInTheDocument()

    const openLink = screen.getByRole("link", {
      name: i18n.t("workOrders.actions.open"),
    })
    expect(openLink).toHaveAttribute("href", `/os/${makeWorkOrder().id}`)
    expect(screen.queryByText(makeWorkOrder().id)).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.columns.origin")),
    ).not.toBeInTheDocument()
  })

  it("G: empty related OS is meaningful and offers Gerar OS when the user can create", async () => {
    getWorkOrdersMock.mockResolvedValue([])
    const onGenerate = vi.fn()

    renderRelated(["os.work_orders.read", "os.work_orders.create"], onGenerate)

    expect(
      await screen.findByText(i18n.t("pmoc.plans.related.empty")),
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
      }),
    )
    expect(onGenerate).toHaveBeenCalled()
  })

  it("G: empty related OS is informational only without create permission", async () => {
    getWorkOrdersMock.mockResolvedValue([])

    renderRelated(["os.work_orders.read"])

    expect(
      await screen.findByText(i18n.t("pmoc.plans.related.empty")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
      }),
    ).not.toBeInTheDocument()
  })
})
