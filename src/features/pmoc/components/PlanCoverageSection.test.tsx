import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanCoverageSection } from "@/features/pmoc/components/PlanCoverageSection"
import { formatCivilDateOnly } from "@/features/pmoc/lib/formatCivilDate"
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

describe("PlanCoverageSection", () => {
  beforeEach(() => {
    getPlanCoverageMock.mockReset()
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)
  })

  it("P-W: separates history from due and renders API counters", async () => {
    renderCoverage()

    expect(
      await screen.findByText(i18n.t("pmoc.plans.coverage.question")),
    ).toBeInTheDocument()
    expect(screen.getByTestId("coverage-summary-eligible")).toHaveTextContent("3")
    expect(screen.getByTestId("coverage-summary-attention")).toHaveTextContent("2")
    expect(screen.getByTestId("coverage-summary-dueToday")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-overdue")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-never")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-open")).toHaveTextContent("1")

    const rows = screen.getAllByTestId("coverage-asset-row")
    expect(rows.map((row) => row.getAttribute("data-due-status"))).toEqual([
      "Overdue",
      "DueToday",
      "NotDue",
    ])
    expect(rows[0]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.Overdue"))
    expect(rows[1]).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.history.NeverExecuted"),
    )
    expect(rows[1]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.DueToday"))
    expect(rows[1]).toHaveAttribute("data-needs-attention", "true")
    expect(rows[2]).toHaveTextContent(i18n.t("pmoc.plans.coverage.due.NotDue"))
    expect(rows[2]).toHaveAttribute("data-needs-attention", "false")
  })

  it("G: lastMaintenance null is shown as never executed, not a dash", async () => {
    renderCoverage()

    const neverRow = (await screen.findAllByTestId("coverage-asset-row"))[1]!
    const last = within(neverRow).getByTestId("coverage-last-maintenance")
    expect(last).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.history.NeverExecuted"),
    )
    expect(last.textContent).not.toBe("—")
    expect(last.textContent).not.toBe("-")
  })

  it("X/Y: effectiveNextDueDate is rendered from the API and not recomputed", async () => {
    renderCoverage()

    const overdue = formatCivilDateOnly("2026-09-01", i18n.language)
    const today = formatCivilDateOnly(COVERAGE_AS_OF_DATE, i18n.language)
    const future = formatCivilDateOnly(COVERAGE_NEXT_DUE_DATE, i18n.language)
    const nextDues = await screen.findAllByTestId("coverage-next-due")
    expect(nextDues.map((cell) => cell.textContent)).toEqual([
      overdue,
      today,
      future,
    ])
    expect(planCoverageSource).not.toMatch(/AddDays|intervalDays\s*\+/)
    expect(planCoverageSource).not.toMatch(/new Date\(\)/)
  })

  it("I/J: open WorkOrder is rendered and links when OS read is allowed", async () => {
    renderCoverage(OS_READ, ["pmoc", "os"])

    const rows = await screen.findAllByTestId("coverage-asset-row")
    const open = within(rows[1]!).getByTestId("coverage-open-work-order")
    expect(open).toHaveTextContent(i18n.t("workOrders.status.InProgress"))
    expect(within(open).getByTestId("coverage-open-work-order-link")).toHaveAttribute(
      "href",
      `/os/${OPEN_WORK_ORDER_ID}`,
    )
    const overdueRow = screen.getAllByTestId("coverage-asset-row")[0]!
    expect(
      within(overdueRow).getByTestId("coverage-last-maintenance"),
    ).toHaveTextContent("03/08/2026")
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

    expect(await screen.findByTestId("coverage-inactive-note")).toBeInTheDocument()
    expect(screen.getAllByTestId("coverage-asset-row")).toHaveLength(3)
    expect(screen.getByTestId("coverage-considered")).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.planInactive"),
    )
  })

  it("N: AutoGenerateEnabled=false does not hide coverage", async () => {
    getPlanCoverageMock.mockResolvedValue({
      ...populatedCoverageJson,
      autoGenerateEnabled: false,
      wouldBeConsideredByGenerator: false,
    })

    renderCoverage()

    expect(await screen.findAllByTestId("coverage-asset-row")).toHaveLength(3)
    expect(screen.getByTestId("coverage-considered")).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.automationDisabled"),
    )
  })

  it("O: wouldBeConsideredByGenerator uses non-promissory wording", async () => {
    renderCoverage()

    const considered = await screen.findByTestId("coverage-considered")
    expect(considered).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.consideredPossible"),
    )
    expect(considered.textContent).not.toMatch(
      /será gerada|will generate|OS será|WO will|elegív/i,
    )
  })

  it("P: browser clock is not used to recompute API due dates", async () => {
    renderCoverage()

    expect(await screen.findByTestId("coverage-as-of-date")).toHaveTextContent(
      formatCivilDateOnly(COVERAGE_AS_OF_DATE, i18n.language),
    )
    expect(planCoverageSource).not.toMatch(/Date\.now/)
    expect(planCoverageSource).not.toMatch(/operationalStatus/)
    expect(planCoverageSource).not.toMatch(/frequency/)
    expect(planCoverageSource).not.toMatch(/getTimezoneOffset/)
    expect(planCoverageSource).not.toMatch(/PmocDueCalendar/)
    expect(planCoverageSource).not.toMatch(/new Date\(\)/)
  })
})
