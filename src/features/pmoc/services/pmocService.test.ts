import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import {
  createFromTemplate,
  deletePlan,
  getPlan,
  getTemplateById,
  isPlanInUseError,
  replaceTasks,
  updatePlan,
} from "@/features/pmoc/services/pmocService"
import {
  basePlanJson,
  baseTemplateJson,
  PLAN_ID,
  TEMPLATE_ID,
} from "@/features/pmoc/test/pmocFixtures"

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)
const apiPut = vi.mocked(api.put)
const apiDelete = vi.mocked(api.delete)

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    data,
    statusText: status === 409 ? "Conflict" : "Error",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  } as AxiosResponse
  return error
}

describe("pmocService Phase 1 methods", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiPut.mockReset()
    apiDelete.mockReset()
  })

  it("gets a plan by id", async () => {
    apiGet.mockResolvedValue({ data: basePlanJson })

    const plan = await getPlan(PLAN_ID)

    expect(apiGet).toHaveBeenCalledWith(`/api/maintenance-plans/${PLAN_ID}`)
    expect(plan.id).toBe(PLAN_ID)
    expect(plan.autoGenerateEnabled).toBe(false)
  })

  it("gets a template by id including Deprecated", async () => {
    apiGet.mockResolvedValue({
      data: { ...baseTemplateJson, status: "Deprecated" },
    })

    const template = await getTemplateById(TEMPLATE_ID)

    expect(apiGet).toHaveBeenCalledWith(`/api/global-templates/${TEMPLATE_ID}`)
    expect(template.status).toBe("Deprecated")
  })

  it("updates plan header fields including required isActive and autoGenerateEnabled", async () => {
    apiPut.mockResolvedValue({ data: { ...basePlanJson, autoGenerateEnabled: true } })

    await updatePlan(PLAN_ID, {
      unitId: basePlanJson.unitId,
      name: basePlanJson.name,
      description: basePlanJson.description,
      frequency: "Monthly",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      autoGenerateEnabled: true,
    })

    expect(apiPut).toHaveBeenCalledWith(`/api/maintenance-plans/${PLAN_ID}`, {
      unitId: basePlanJson.unitId,
      name: basePlanJson.name,
      description: basePlanJson.description,
      frequency: "Monthly",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      autoGenerateEnabled: true,
    })
  })

  it("replaces tasks as a set", async () => {
    apiPut.mockResolvedValue({ data: basePlanJson })

    await replaceTasks(PLAN_ID, {
      tasks: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          title: "Existing",
          inputType: "Checkbox",
          isMandatory: true,
          order: 1,
          configuration: null,
        },
      ],
    })

    expect(apiPut).toHaveBeenCalledWith(
      `/api/maintenance-plans/${PLAN_ID}/tasks`,
      {
        tasks: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "Existing",
            inputType: "Checkbox",
            isMandatory: true,
            order: 1,
            configuration: null,
          },
        ],
      },
    )
  })

  it("clones from template without sending autoGenerateEnabled true", async () => {
    apiPost.mockResolvedValue({
      data: {
        ...basePlanJson,
        originKind: "RolvixTemplate",
        sourceTemplateId: TEMPLATE_ID,
        sourceTemplateVersion: 1,
      },
    })

    await createFromTemplate({
      templateId: TEMPLATE_ID,
      unitId: basePlanJson.unitId,
      assetCategoryId: basePlanJson.assetCategoryId,
      name: "Clone",
    })

    const payload = apiPost.mock.calls[0]?.[1] as Record<string, unknown>
    expect(apiPost).toHaveBeenCalledWith(
      "/api/maintenance-plans/from-template",
      expect.objectContaining({
        templateId: TEMPLATE_ID,
        unitId: basePlanJson.unitId,
        assetCategoryId: basePlanJson.assetCategoryId,
        name: "Clone",
      }),
    )
    expect(payload.autoGenerateEnabled).not.toBe(true)
  })

  it("maps DELETE 409 PLAN_IN_USE without inventing a used-count", async () => {
    apiDelete.mockRejectedValue(
      axiosError(409, {
        error: "This maintenance plan is in use by one or more work orders.",
        code: "PLAN_IN_USE",
      }),
    )

    try {
      await deletePlan(PLAN_ID)
      throw new Error("expected PLAN_IN_USE")
    } catch (error: unknown) {
      expect(isPlanInUseError(error)).toBe(true)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(i18n.t("pmoc.plans.errors.planInUse"))
      expect((error as Error).message).not.toMatch(/\d+\s*(OS|work orders|ordens)/i)
    }

    expect(apiDelete).toHaveBeenCalledWith(`/api/maintenance-plans/${PLAN_ID}`)
  })

  it("resolves unused DELETE 204", async () => {
    apiDelete.mockResolvedValue({ status: 204, data: "" })

    await expect(deletePlan(PLAN_ID)).resolves.toBeUndefined()
  })
})
