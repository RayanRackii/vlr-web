import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanCoverageSection } from "@/features/pmoc/components/PlanCoverageSection"
import { formatCivilDateOnly } from "@/features/pmoc/lib/formatCivilDate"
import {
  COVERAGE_AS_OF_DATE,
  COVERAGE_LAST_DUE_DATE,
  COVERAGE_NEXT_DUE_DATE,
  emptyCoverageJson,
  LAST_WORK_ORDER_ID,
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

  it("C/D/E/F: renders overdue, never executed, on track, and summary counts", async () => {
    renderCoverage()

    expect(
      await screen.findByText(i18n.t("pmoc.plans.coverage.question")),
    ).toBeInTheDocument()
    expect(screen.getByTestId("coverage-summary-eligible")).toHaveTextContent("3")
    expect(screen.getByTestId("coverage-summary-never")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-overdue")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-onTrack")).toHaveTextContent("1")
    expect(screen.getByTestId("coverage-summary-open")).toHaveTextContent("1")

    const rows = screen.getAllByTestId("coverage-asset-row")
    expect(rows.map((row) => row.getAttribute("data-operational-status"))).toEqual(
      ["Overdue", "NeverExecuted", "OnTrack"],
    )
    expect(rows[0]).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.status.Overdue"),
    )
    expect(rows[1]).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.status.NeverExecuted"),
    )
    expect(rows[2]).toHaveTextContent(
      i18n.t("pmoc.plans.coverage.status.OnTrack"),
    )
  })

  it("G: lastMaintenance null is shown as never executed, not a dash", async () => {
    renderCoverage()

    const neverRow = (await screen.findAllByTestId("coverage-asset-row"))[1]!
    const last = within(neverRow).getByTestId("coverage-last-maintenance")
    expect(last).toHaveTextContent(i18n.t("pmoc.plans.coverage.neverExecuted"))
    expect(last.textContent).not.toBe("—")
    expect(last.textContent).not.toBe("-")
  })

  it("H: nextDueDate is rendered from the API civil date", async () => {
    renderCoverage()

    const expected = formatCivilDateOnly(COVERAGE_NEXT_DUE_DATE, i18n.language)
    const nextDues = await screen.findAllByTestId("coverage-next-due")
    for (const cell of nextDues) {
      expect(cell).toHaveTextContent(expected)
    }
    expect(screen.getByTestId("coverage-plan-next-due")).toHaveTextContent(
      expected,
    )
  })

  it("I/J: open WorkOrder is rendered and links when OS read is allowed", async () => {
    renderCoverage(OS_READ, ["pmoc", "os"])

    expect(await screen.findByTestId("coverage-open-work-order")).toHaveTextContent(
      i18n.t("workOrders.status.InProgress"),
    )
    expect(screen.getByTestId("coverage-open-work-order-link")).toHaveAttribute(
      "href",
      `/os/${OPEN_WORK_ORDER_ID}`,
    )
    const overdueRow = screen.getAllByTestId("coverage-asset-row")[0]!
    expect(
      within(overdueRow).getByTestId("coverage-last-maintenance-link"),
    ).toHaveAttribute("href", `/os/${LAST_WORK_ORDER_ID}`)
  })

  it("K: last OS and open WorkOrder are not actionable links without OS read", async () => {
    renderCoverage(PMOC_READ, ["pmoc", "os"])

    expect(await screen.findByTestId("coverage-open-work-order")).toBeInTheDocument()
    expect(
      screen.queryByTestId("coverage-open-work-order-link"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("coverage-last-maintenance-link"),
    ).not.toBeInTheDocument()
  })

  it("K: open WorkOrder link is absent when the OS module is inactive", async () => {
    renderCoverage(OS_READ, ["pmoc"])

    expect(await screen.findByTestId("coverage-open-work-order")).toBeInTheDocument()
    expect(
      screen.queryByTestId("coverage-open-work-order-link"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("coverage-last-maintenance-link"),
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
      isDueToday: true,
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
      isDueToday: true,
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
      i18n.t("pmoc.plans.coverage.consideredToday"),
    )
    expect(considered.textContent).not.toMatch(
      /será gerada|will generate|OS será|WO will|elegív/i,
    )
  })

  it("P: browser clock is not used to recompute API due dates", async () => {
    renderCoverage()

    const calendar = await screen.findByTestId("coverage-calendar")
    expect(calendar).toHaveAttribute("data-as-of-date", COVERAGE_AS_OF_DATE)
    expect(calendar).toHaveAttribute("data-last-due-date", COVERAGE_LAST_DUE_DATE)
    expect(calendar).toHaveAttribute("data-next-due-date", COVERAGE_NEXT_DUE_DATE)
    expect(calendar).toHaveAttribute("data-is-due-today", "true")
    expect(calendar).toHaveAttribute("data-would-be-considered", "true")
    expect(screen.getByTestId("coverage-as-of-date")).toHaveTextContent(
      formatCivilDateOnly(COVERAGE_AS_OF_DATE, i18n.language),
    )
    expect(screen.getByTestId("coverage-last-due-date")).toHaveTextContent(
      formatCivilDateOnly(COVERAGE_LAST_DUE_DATE, i18n.language),
    )

    expect(planCoverageSource).not.toMatch(/Date\.now/)
    expect(planCoverageSource).not.toMatch(/getTimezoneOffset/)
    expect(planCoverageSource).not.toMatch(/PmocDueCalendar/)
    expect(planCoverageSource).not.toMatch(/new Date\(\)/)
  })
})
