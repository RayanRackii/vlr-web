import type { MaintenancePlanCoverage } from "@/features/pmoc/schemas/coverageSchemas"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"

export const OVERDUE_ASSET_ID = "16161616-1616-4161-8161-161616161616"
export const NEVER_ASSET_ID = "17171717-1717-4171-8171-171717171717"
export const ONTRACK_ASSET_ID = "18181818-1818-4181-8181-181818181818"
export const OPEN_WORK_ORDER_ID = "19191919-1919-4191-8191-191919191919"
export const LAST_WORK_ORDER_ID = "20202020-2020-4202-8202-202020202020"

export const COVERAGE_AS_OF_DATE = "2026-09-19"
export const COVERAGE_LAST_DUE_DATE = "2026-09-01"
export const COVERAGE_NEXT_DUE_DATE = "2026-10-01"

export const emptyCoverageJson: MaintenancePlanCoverage = {
  planId: PLAN_ID,
  asOfDate: COVERAGE_AS_OF_DATE,
  frequency: "Monthly",
  lastDueDate: COVERAGE_LAST_DUE_DATE,
  nextDueDate: COVERAGE_NEXT_DUE_DATE,
  isActive: true,
  autoGenerateEnabled: false,
  isDueToday: false,
  wouldBeConsideredByGenerator: false,
  eligibleAssetCount: 0,
  summary: {
    eligibleAssets: 0,
    assetsWithPmocHistory: 0,
    assetsNeverExecuted: 0,
    assetsOverdue: 0,
    assetsOnTrack: 0,
    assetsWithOpenWorkOrder: 0,
  },
  assets: [],
}

export const populatedCoverageJson: MaintenancePlanCoverage = {
  planId: PLAN_ID,
  asOfDate: COVERAGE_AS_OF_DATE,
  frequency: "Monthly",
  lastDueDate: COVERAGE_LAST_DUE_DATE,
  nextDueDate: COVERAGE_NEXT_DUE_DATE,
  isActive: true,
  autoGenerateEnabled: true,
  isDueToday: true,
  wouldBeConsideredByGenerator: true,
  eligibleAssetCount: 3,
  summary: {
    eligibleAssets: 3,
    assetsWithPmocHistory: 2,
    assetsNeverExecuted: 1,
    assetsOverdue: 1,
    assetsOnTrack: 1,
    assetsWithOpenWorkOrder: 1,
  },
  assets: [
    {
      assetId: OVERDUE_ASSET_ID,
      name: "Split recepção",
      tag: "AC-02",
      lastMaintenance: {
        workOrderId: LAST_WORK_ORDER_ID,
        scheduledDate: "2026-08-01",
        completedDate: "2026-08-03T18:00:00-03:00",
      },
      nextDueDate: COVERAGE_NEXT_DUE_DATE,
      operationalStatus: "Overdue",
      openWorkOrder: null,
    },
    {
      assetId: NEVER_ASSET_ID,
      name: "Split sala 2",
      tag: "AC-03",
      lastMaintenance: null,
      nextDueDate: COVERAGE_NEXT_DUE_DATE,
      operationalStatus: "NeverExecuted",
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
      lastMaintenance: {
        workOrderId: "21212121-2121-4212-8212-212121212121",
        scheduledDate: COVERAGE_LAST_DUE_DATE,
        completedDate: "2026-09-02T11:00:00-03:00",
      },
      nextDueDate: COVERAGE_NEXT_DUE_DATE,
      operationalStatus: "OnTrack",
      openWorkOrder: null,
    },
  ],
}
