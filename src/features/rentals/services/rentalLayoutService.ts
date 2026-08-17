import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const layoutItemSchema = z.object({
  id: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  assetName: z.string(),
  xPercent: z.coerce.number(),
  yPercent: z.coerce.number(),
  widthPercent: z.coerce.number(),
  heightPercent: z.coerce.number(),
  zIndex: z.coerce.number(),
})

const layoutSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  name: z.string(),
  isActive: z.boolean(),
  aspectRatio: z.coerce.number().optional().default(1.6),
  widthPercent: z.coerce.number().optional().default(100),
  items: z.array(layoutItemSchema),
})

export type RentalLayoutItem = z.infer<typeof layoutItemSchema>
export type RentalLayout = z.infer<typeof layoutSchema>

export type UpsertRentalLayoutItemInput = {
  rentalAssetId: string
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  zIndex: number
}

export type UpsertRentalLayoutInput = {
  unitId?: string | null
  name: string
  isActive: boolean
  aspectRatio: number
  widthPercent: number
  items: readonly UpsertRentalLayoutItemInput[]
}

function throwLayoutError(error: unknown, fallbackKey: string): never {
  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

export async function listRentalLayouts(): Promise<RentalLayout[]> {
  try {
    const response = await api.get("/api/rental-layouts")
    const parsed = z.array(layoutSchema).safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwLayoutError(error, "apiErrors.loadLayouts")
  }
}

export async function createRentalLayout(
  body: UpsertRentalLayoutInput,
): Promise<RentalLayout> {
  try {
    const response = await api.post("/api/rental-layouts", body)
    const parsed = layoutSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwLayoutError(error, "apiErrors.saveLayout")
  }
}

export async function updateRentalLayout(
  id: string,
  body: UpsertRentalLayoutInput,
): Promise<RentalLayout> {
  try {
    const response = await api.put(`/api/rental-layouts/${id}`, body)
    const parsed = layoutSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwLayoutError(error, "apiErrors.saveLayout")
  }
}

export async function deleteRentalLayout(id: string): Promise<void> {
  try {
    await api.delete(`/api/rental-layouts/${id}`)
  } catch (error) {
    throwLayoutError(error, "apiErrors.deleteLayout")
  }
}

export async function fetchPublicRentalLayouts(
  subdomain: string,
): Promise<RentalLayout[]> {
  try {
    const response = await api.get(
      `/api/public/tenants/${subdomain}/rental-layouts`,
    )
    const parsed = z.array(layoutSchema).safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwLayoutError(error, "apiErrors.loadLayouts")
  }
}
