import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanCoverageSection } from "@/features/pmoc/components/PlanCoverageSection"
import { formatCivilDateHuman } from "@/features/pmoc/lib/formatCivilDate"
import {
  COVERAGE_AS_OF_DATE,
  COVERAGE_NEXT_DUE_DATE,
  emptyCoverageJson,
  OPEN_WORK_ORDER_ID,
  populatedCoverageJson,
} from "@/features/pmoc/test/coverageFixtures"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

import planCoverageSource from "@/features/pmoc/components/PlanCoverageSection.tsx?raw"

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getPlanCoverage: vi.fn(),
}))

import { getPlanCoverage } from "@/features/pmoc/services/pmocService"

const getPlanCoverageMock = vi.mocked(getPlanCoverage)

const PMOC_READ = ["pmoc.plans.read"] as const
const OS_READ = ["pmoc.plans.read", "os.work_orders.read"] as const

function renderCoverage(
  permissions: readonly string[] = PMOC_READ,
  activeModules: readonly string[] = ["pmoc"],
) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/${PLAN_ID}`]}>
      <TestPermissionProvider
        permissions={permissions}
        activeModules={activeModules}
      >
        <Routes>
          <Route
            path="/pmoc/:id"
            element={<PlanCoverageSection planId={PLAN_ID} refreshKey={0} />}
          />
          <Route path="/os/:id" element={<div>os-detail</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

function tableRows() {
  return screen
    .getAllByTestId("coverage-asset-row")
    .filter((row) => row.tagName === "TR")
}

describe("PlanCoverageSection", () => {
  beforeEach(() => {
    getPlanCoverageMock.mockReset()
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)
  })

  it("P-W: one summary line, labelled columns and the API due status per row", async () => {
    renderCoverage()

    const summary = await screen.findByTestId("coverage-summary")
    expect(summary).toHaveTextContent("1 equipamento atrasado · 1 vence hoje")
    expect(summary).toHaveAttribute("data-tone", "danger")
    expect(summary).toHaveClass("text-destructive")
    // The four KPI cards, the counters line and the automation sentence are gone.
    expect(screen.queryByTestId("coverage-summary-eligible")).not.toBeInTheDocument()
    expect(screen.queryByTestId("coverage-summary-never")).not.toBeInTheDocument()
    expect(screen.queryByTestId("coverage-considered")).not.toBeInTheDocument()
    expect(screen.queryByText(/processamento automático/i)).not.toBeInTheDocument()

    for (const key of ["asset", "last", "nextDue", "status", "openOrder"]) {
      expect(
        screen.getByRole("columnheader", { name: i18n.t(`pmoc.planDetail.coverage.columns.${key}`) }),
      ).toBeInTheDocument()
    }

    const rows = tableRows()
    expect(rows.map((row) => row.getAttribute("data-due-status"))).toEqual([
      "Overdue",
      "DueToday",
      "NotDue",
    ])
    expect(rows[0]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.Overdue"))
    expect(within(rows[0]!).getByText(i18n.t("pmoc.plans.coverage.due.Overdue")).closest("[data-status-tone]")).toHaveAttribute("data-status-tone", "danger")
    expect(rows[1]).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.history.NeverExecuted"),
    )
    expect(rows[1]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.DueToday"))
    expect(rows[1]).toHaveAttribute("data-needs-attention", "true")
    expect(rows[2]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.NotDue"))
    expect(rows[2]).toHaveAttribute("data-needs-attention", "false")
  })

  it("uses a neutral summary when nothing is overdue", async () => {
    getPlanCoverageMock.mockResolvedValue({
      ...populatedCoverageJson,
      summary: { ...populatedCoverageJson.summary, assetsOverdue: 0, assetsDueToday: 0 },
    })
    renderCoverage()

    const summary = await screen.findByTestId("coverage-summary")
    expect(summary).toHaveTextContent("Nenhum equipamento atrasado · 0 vencem hoje")
    expect(summary).toHaveAttribute("data-tone", "neutral")
    expect(summary).not.toHaveClass("text-destructive")
  })

  it("G: lastMaintenance null is shown as never executed, not a dash", async () => {
    renderCoverage()

    await screen.findByTestId("coverage-summary")
    const neverRow = tableRows()[1]!
    const last = within(neverRow).getByTestId("coverage-last-maintenance")
    expect(last).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.history.NeverExecuted"),
    )
    expect(last.textContent).not.toBe("—")
    expect(last.textContent).not.toBe("-")
  })

  it("X/Y: effectiveNextDueDate is rendered from the API and not recomputed", async () => {
    renderCoverage()

    const overdue = formatCivilDateHuman("2026-09-01", i18n.language)
    const today = formatCivilDateHuman(COVERAGE_AS_OF_DATE, i18n.language)
    const future = formatCivilDateHuman(COVERAGE_NEXT_DUE_DATE, i18n.language)
    const nextDues = await screen.findAllByTestId("coverage-next-due")
    expect(nextDues.map((cell) => cell.textContent)).toEqual([
      overdue,
      today,
      future,
    ])
    expect(overdue).toBe("1 set 2026")
    expect(planCoverageSource).not.toMatch(/AddDays|intervalDays\s*\+/)
    expect(planCoverageSource).not.toMatch(/new Date\(\)/)
  })

  it("I/J: open WorkOrder is rendered and links when OS read is allowed", async () => {
    renderCoverage(OS_READ, ["pmoc", "os"])

    await screen.findByTestId("coverage-summary")
    const rows = tableRows()
    const open = within(rows[1]!).getByTestId("coverage-open-work-order")
    expect(open).toHaveTextContent(i18n.t("workOrders.status.InProgress"))
    expect(within(open).getByTestId("coverage-open-work-order-link")).toHaveAttribute(
      "href",
      `/os/${OPEN_WORK_ORDER_ID}`,
    )
    expect(
      within(rows[0]!).getByTestId("coverage-last-maintenance"),
    ).toHaveTextContent("3 ago 2026")
  })

  it("K: last OS and open WorkOrder are not actionable links without OS read", async () => {
    renderCoverage(PMOC_READ, ["pmoc", "os"])

    expect(await screen.findAllByTestId("coverage-open-work-order")).not.toHaveLength(0)
    expect(
      screen.queryByTestId("coverage-open-work-order-link"),
    ).not.toBeInTheDocument()
  })

  it("K: open WorkOrder link is absent when the OS module is inactive", async () => {
    renderCoverage(OS_READ, ["pmoc"])

    expect(await screen.findAllByTestId("coverage-open-work-order")).not.toHaveLength(0)
    expect(
      screen.queryByTestId("coverage-open-work-order-link"),
    ).not.toBeInTheDocument()
  })

  it("L: empty eligible assets shows the unit/category empty state", async () => {
    getPlanCoverageMock.mockResolvedValue(emptyCoverageJson)

    renderCoverage()

    expect(await screen.findByTestId("coverage-empty")).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.empty"),
    )
    expect(screen.queryByTestId("coverage-asset-row")).not.toBeInTheDocument()
    expect(screen.getByTestId("coverage-empty").textContent).not.toMatch(
      /históric|historical|órdenes históricas/i,
    )
  })

  it("M: inactive plans still display coverage rows", async () => {
    getPlanCoverageMock.mockResolvedValue({
      ...populatedCoverageJson,
      isActive: false,
      autoGenerateEnabled: true,
      wouldBeConsideredByGenerator: false,
    })

    renderCoverage()

    expect(await screen.findByTestId("coverage-inactive-note")).toHaveTextContent(
      i18n.t("pmoc.planDetail.coverage.inactive"),
    )
    expect(tableRows()).toHaveLength(3)
  })

  it("N: AutoGenerateEnabled=false does not hide coverage", async () => {
    getPlanCoverageMock.mockResolvedValue({
      ...populatedCoverageJson,
      autoGenerateEnabled: false,
      wouldBeConsideredByGenerator: false,
    })

    renderCoverage()

    await screen.findByTestId("coverage-summary")
    expect(tableRows()).toHaveLength(3)
  })

  it("P: browser clock is not used to recompute API due dates", async () => {
    renderCoverage()

    await screen.findByTestId("coverage-summary")
    expect(screen.queryByTestId("coverage-as-of-date")).not.toBeInTheDocument()
    expect(planCoverageSource).not.toMatch(/Date\.now/)
    expect(planCoverageSource).not.toMatch(/operationalStatus/)
    expect(planCoverageSource).not.toMatch(/frequency/)
    expect(planCoverageSource).not.toMatch(/getTimezoneOffset/)
    expect(planCoverageSource).not.toMatch(/PmocDueCalendar/)
    expect(planCoverageSource).not.toMatch(/new Date\(\)/)
  })
})
