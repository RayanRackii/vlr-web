import type { MaintenancePlanCoverage } from "@/features/pmoc/schemas/coverageSchemas"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"

export const OVERDUE_ASSET_ID = "16161616-1616-4161-8161-161616161616"
export const NEVER_ASSET_ID = "17171717-1717-4171-8171-171717171717"
export const ONTRACK_ASSET_ID = "18181818-1818-4181-8181-181818181818"
export const OPEN_WORK_ORDER_ID = "19191919-1919-4191-8191-191919191919"
export const LAST_WORK_ORDER_ID = "20202020-2020-4202-8202-202020202020"

export const COVERAGE_AS_OF_DATE = "2026-09-19"
export const COVERAGE_FIRST_DUE_DATE = "2026-09-01"
export const COVERAGE_NEXT_DUE_DATE = "2026-10-02"

const emptySummary = {
  eligibleAssets: 0,
  assetsNeverExecuted: 0,
  assetsExecuted: 0,
  assetsNotDue: 0,
  assetsDueToday: 0,
  assetsOverdue: 0,
  assetsNeedingAttention: 0,
  assetsWithOpenWorkOrder: 0,
}

export const emptyCoverageJson: MaintenancePlanCoverage = {
  planId: PLAN_ID,
  asOfDate: COVERAGE_AS_OF_DATE,
  intervalDays: 30,
  firstDueDate: COVERAGE_FIRST_DUE_DATE,
  isActive: true,
  autoGenerateEnabled: false,
  wouldBeConsideredByGenerator: false,
  eligibleAssetCount: 0,
  summary: emptySummary,
  assets: [],
}

export const populatedCoverageJson: MaintenancePlanCoverage = {
  planId: PLAN_ID,
  asOfDate: COVERAGE_AS_OF_DATE,
  intervalDays: 30,
  firstDueDate: COVERAGE_FIRST_DUE_DATE,
  isActive: true,
  autoGenerateEnabled: true,
  wouldBeConsideredByGenerator: true,
  eligibleAssetCount: 3,
  summary: {
    eligibleAssets: 3,
    assetsNeverExecuted: 1,
    assetsExecuted: 2,
    assetsNotDue: 1,
    assetsDueToday: 1,
    assetsOverdue: 1,
    assetsNeedingAttention: 2,
    assetsWithOpenWorkOrder: 1,
  },
  assets: [
    {
      assetId: OVERDUE_ASSET_ID,
      name: "Split recepção",
      tag: "AC-02",
      historyStatus: "Executed",
      lastMaintenance: {
        workOrderId: LAST_WORK_ORDER_ID,
        scheduledDate: "2026-08-01",
        completedDate: "2026-08-03T18:00:00-03:00",
      },
      effectiveNextDueDate: "2026-09-01",
      dueStatus: "Overdue",
      needsAttention: true,
      openWorkOrder: null,
    },
    {
      assetId: NEVER_ASSET_ID,
      name: "Split sala 2",
      tag: "AC-03",
      historyStatus: "NeverExecuted",
      lastMaintenance: null,
      effectiveNextDueDate: COVERAGE_AS_OF_DATE,
      dueStatus: "DueToday",
      needsAttention: true,
      openWorkOrder: {
        workOrderId: OPEN_WORK_ORDER_ID,
        status: "InProgress",
        scheduledDate: COVERAGE_AS_OF_DATE,
      },
    },
    {
      assetId: ONTRACK_ASSET_ID,
      name: "Split sala 1",
      tag: "AC-01",
      historyStatus: "Executed",
      lastMaintenance: {
        workOrderId: "21212121-2121-4212-8212-212121212121",
        scheduledDate: "2026-09-01",
        completedDate: "2026-09-02T11:00:00-03:00",
      },
      effectiveNextDueDate: COVERAGE_NEXT_DUE_DATE,
      dueStatus: "NotDue",
      needsAttention: false,
      openWorkOrder: null,
    },
  ],
}
