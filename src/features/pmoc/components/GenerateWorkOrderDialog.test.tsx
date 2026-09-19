import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GenerateWorkOrderDialog } from "@/features/pmoc/components/GenerateWorkOrderDialog"
import { PLAN_ID, UNIT_ID, CATEGORY_ID } from "@/features/pmoc/test/pmocFixtures"
import {
  inactiveRegistryAsset,
  matchingRegistryAsset,
  otherUnitRegistryAsset,
  makeWorkOrder,
} from "@/features/workOrders/test/workOrderFixtures"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/users/services/usersService", () => ({
  getTechnicians: vi.fn(),
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => {
  class DuplicateWorkOrderError extends Error {
    readonly code = "DUPLICATE_WORK_ORDER" as const
  }

  return {
    listWorkOrderAssets: vi.fn(),
    generateWorkOrderFromPlan: vi.fn(),
    DuplicateWorkOrderError,
    isDuplicateWorkOrderError: (error: unknown) =>
      error instanceof DuplicateWorkOrderError,
  }
})

import { toast } from "sonner"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  DuplicateWorkOrderError,
  generateWorkOrderFromPlan,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

const listAssetsMock = vi.mocked(listWorkOrderAssets)
const getTechniciansMock = vi.mocked(getTechnicians)
const generateMock = vi.mocked(generateWorkOrderFromPlan)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

function renderDialog(onGenerated = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/${PLAN_ID}`]}>
      <Routes>
        <Route
          path="/pmoc/:id"
          element={
            <GenerateWorkOrderDialog
              open
              onOpenChange={vi.fn()}
              planId={PLAN_ID}
              unitId={UNIT_ID}
              assetCategoryId={CATEGORY_ID}
              onGenerated={onGenerated}
            />
          }
        />
        <Route path="/os/:id" element={<div>os-detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function selectMatchingAsset(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("combobox", {
      name: i18n.t("workOrders.create.form.asset"),
    }),
  )
  await user.click(
    await screen.findByRole("option", { name: "AC-01 — Split sala 1" }),
  )
}

describe("GenerateWorkOrderDialog", () => {
  beforeEach(() => {
    listAssetsMock.mockReset()
    getTechniciansMock.mockReset()
    generateMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()

    listAssetsMock.mockResolvedValue([
      matchingRegistryAsset,
      otherUnitRegistryAsset,
      inactiveRegistryAsset,
    ])
    getTechniciansMock.mockResolvedValue([])
    generateMock.mockResolvedValue(makeWorkOrder())
  })

  it("C: posts POST /from-plan with planId, assetId, assignedUserId and scheduledDate", async () => {
    const onGenerated = vi.fn()
    renderDialog(onGenerated)
    const user = userEvent.setup()

    await selectMatchingAsset(user)

    expect(
      screen.queryByRole("option", { name: /AC-99/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: /AC-00/ }),
    ).not.toBeInTheDocument()

    const dateInput = screen.getByLabelText(
      i18n.t("workOrders.create.form.scheduledDate"),
    ) as HTMLInputElement

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.generate.submit"),
      }),
    )

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalledWith({
        planId: PLAN_ID,
        assetId: matchingRegistryAsset.id,
        assignedUserId: null,
        scheduledDate: dateInput.value,
      })
    })
    expect(onGenerated).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("pmoc.plans.generate.success"),
      expect.objectContaining({
        action: expect.objectContaining({
          label: i18n.t("pmoc.plans.generate.viewWorkOrder"),
        }),
      }),
    )
  })

  it("E: duplicate 409 shows dedicated copy and keeps the dialog open", async () => {
    generateMock.mockRejectedValue(
      new DuplicateWorkOrderError(i18n.t("pmoc.plans.generate.errors.duplicate")),
    )

    renderDialog()
    const user = userEvent.setup()
    await selectMatchingAsset(user)

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.generate.submit"),
      }),
    )

    expect(
      await screen.findByText(i18n.t("pmoc.plans.generate.errors.duplicate")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: i18n.t("pmoc.plans.generate.dialogTitle"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.plans.generate.errors.duplicate")).textContent,
    ).not.toMatch(/^Erro$/i)
    expect(toastError).not.toHaveBeenCalledWith(
      expect.stringMatching(/^Erro$/i),
    )
  })

  it("M: does not double-submit while generation is pending", async () => {
    let resolveGenerate: ((value: ReturnType<typeof makeWorkOrder>) => void) | undefined
    generateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve
        }),
    )

    renderDialog()
    const user = userEvent.setup()
    await selectMatchingAsset(user)

    const submit = await screen.findByRole("button", {
      name: i18n.t("pmoc.plans.generate.submit"),
    })
    await user.click(submit)

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalledTimes(1)
    })
    expect(submit).toBeDisabled()

    await user.click(submit).catch(() => undefined)
    expect(generateMock).toHaveBeenCalledTimes(1)

    resolveGenerate?.(makeWorkOrder())
  })
})
