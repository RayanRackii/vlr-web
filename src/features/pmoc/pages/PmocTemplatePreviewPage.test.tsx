import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PmocTemplatePreviewPage } from "@/features/pmoc/pages/PmocTemplatePreviewPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import {
  basePlanJson,
  baseTemplateJson,
  CATEGORY_ID,
  TEMPLATE_ID,
  UNIT_ID,
} from "@/features/pmoc/test/pmocFixtures"

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

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({
  listPlanAssetCategories: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getTemplateById: vi.fn(),
  createFromTemplate: vi.fn(),
}))

import { getUnits } from "@/features/assets/services/unitsService"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import {
  createFromTemplate,
  getTemplateById,
} from "@/features/pmoc/services/pmocService"

const getTemplateByIdMock = vi.mocked(getTemplateById)
const createFromTemplateMock = vi.mocked(createFromTemplate)
const getUnitsMock = vi.mocked(getUnits)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)

const WRITE_PERMS = ["pmoc.templates.read", "pmoc.plans.write"] as const

function renderPreview(permissions: readonly string[] = WRITE_PERMS) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/biblioteca/${TEMPLATE_ID}`]}>
      <TestPermissionProvider permissions={permissions} activeModules={["pmoc"]}>
        <Routes>
          <Route
            path="/pmoc/biblioteca/:templateId"
            element={<PmocTemplatePreviewPage />}
          />
          <Route path="/pmoc/:id" element={<div>cloned-plan</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PmocTemplatePreviewPage", () => {
  beforeEach(() => {
    getTemplateByIdMock.mockReset()
    createFromTemplateMock.mockReset()
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()

    getTemplateByIdMock.mockResolvedValue({ ...baseTemplateJson })
    createFromTemplateMock.mockResolvedValue({
      ...basePlanJson,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
    })
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
    ])
    listCategoriesMock.mockResolvedValue([{ id: CATEGORY_ID, name: "Split" }])
  })

  it("hides Usar modelo without plans.write", async () => {
    renderPreview(["pmoc.templates.read"])

    expect(await screen.findByText(baseTemplateJson.name)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("pmoc.preview.useModel"),
      }),
    ).not.toBeInTheDocument()
  })

  it("requires unit and category before cloning, then navigates to the new plan", async () => {
    renderPreview()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("pmoc.preview.useModel"),
      }),
    )

    const confirm = screen.getByRole("button", {
      name: i18n.t("pmoc.preview.confirmClone"),
    })
    expect(confirm).toBeDisabled()
    expect(createFromTemplateMock).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("pmoc.create.form.unit"),
      }),
    )
    await user.click(await screen.findByRole("option", { name: "Sede" }))

    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("pmoc.create.form.category"),
      }),
    )
    await user.click(await screen.findByRole("option", { name: "Split" }))

    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => {
      expect(createFromTemplateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: TEMPLATE_ID,
          unitId: UNIT_ID,
          assetCategoryId: CATEGORY_ID,
        }),
      )
    })
    const payload = createFromTemplateMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(payload.autoGenerateEnabled).not.toBe(true)
    expect(await screen.findByText("cloned-plan")).toBeInTheDocument()
  })
})
