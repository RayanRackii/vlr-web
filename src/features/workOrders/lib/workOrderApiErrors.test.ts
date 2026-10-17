import { describe, expect, it } from "vitest"

import { localizeWorkOrderApiError } from "@/features/workOrders/lib/workOrderApiErrors"
import i18n from "@/lib/i18n"

describe("localizeWorkOrderApiError", () => {
  it("translates incomplete mandatory tasks without the server sentence", () => {
    expect(
      localizeWorkOrderApiError(
        { error: "Mandatory tasks are incomplete: Foto", code: "MANDATORY_TASKS_INCOMPLETE" },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.mandatoryTasksIncomplete"))
  })

  it("translates an ineligible asset from the sentence, without a code", () => {
    expect(
      localizeWorkOrderApiError(
        {
          error:
            "Asset '12121212-1212-4121-8121-121212121212' is not eligible for this maintenance plan.",
        },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.assetNotEligible"))
    expect(i18n.t("workOrders.errors.assetNotEligible")).not.toMatch(
      /12121212/,
    )
  })

  it("ignores an invented ASSET_NOT_ELIGIBLE code", () => {
    expect(
      localizeWorkOrderApiError(
        { code: "ASSET_NOT_ELIGIBLE", error: "nope" },
        "fallback",
      ),
    ).toBe("nope")
  })

  it.each([
    ["NOT_A_NUMBER", "workOrders.errors.taskValue.notANumber"],
    ["OUT_OF_RANGE", "workOrders.errors.taskValue.outOfRange"],
    ["NOT_AN_OPTION", "workOrders.errors.taskValue.notAnOption"],
    ["INVALID_CHECKBOX", "workOrders.errors.taskValue.invalidCheckbox"],
    ["TEXT_TOO_LONG", "workOrders.errors.taskValue.textTooLong"],
    ["INVALID_CONFIGURATION", "workOrders.errors.taskValue.invalidConfiguration"],
  ] as const)("translates INVALID_TASK_VALUE reason %s", (reason, key) => {
    expect(
      localizeWorkOrderApiError(
        {
          error: "Number values must be a decimal number.",
          code: "INVALID_TASK_VALUE",
          reason,
        },
        "fallback",
      ),
    ).toBe(i18n.t(key))
  })

  it("translates a closed work order and a blocked reopen", () => {
    expect(
      localizeWorkOrderApiError(
        {
          error: "Work order is completed or canceled and cannot be changed.",
          code: "WORK_ORDER_CLOSED",
        },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.workOrderClosed"))
    expect(
      localizeWorkOrderApiError(
        {
          error: "A completed work order cannot be reopened.",
          code: "WORK_ORDER_REOPEN_NOT_ALLOWED",
        },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.reopenNotAllowed"))
    expect(
      localizeWorkOrderApiError(
        {
          error: "Assigned user '12121212-1212-4121-8121-121212121212' cannot execute work orders.",
          code: "ASSIGNEE_CANNOT_EXECUTE",
        },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.assigneeCannotExecute"))
    expect(i18n.t("workOrders.errors.assigneeCannotExecute")).not.toMatch(
      /12121212/,
    )
  })
})
