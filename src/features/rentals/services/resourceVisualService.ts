import { z } from "zod"
import { api, getAxiosErrorPayload, parseApiError, publicApi } from "@/lib/api"
import i18n from "@/lib/i18n"
import { bookingMapSettingsSchema, dailyAvailabilitySchema, mapCompositionSchema, publicMapListSchema, publicMapSchema, visualPageSchema, visualRevisionSchema, visualTagSchema, visualTemplateSchema, type BookingMapSettings, type DailyAvailability, type MapComposition, type PublicMap, type VisualTag, type VisualTemplate } from "@/features/rentals/schemas/resourceVisualSchemas"

function error(error: unknown): Error { return new Error(parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.invalidPayload")), { cause: error }) }
async function request<T>(call: () => Promise<{ data: unknown }>, schema: z.ZodType<T>): Promise<T> { try { const result = schema.safeParse((await call()).data); if (!result.success) throw result.error; return result.data } catch (cause) { throw error(cause) } }
const query = (values: Record<string, string | boolean | readonly string[] | undefined>) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values)) { if (Array.isArray(value)) value.forEach((id) => params.append(`${key}[]`, id)); else if (value !== undefined) params.set(key, String(value)); } return params.toString() }

export const visualArtUrl = (revisionId: string, hash?: string) => `${import.meta.env.VITE_API_URL ?? "http://localhost:5298"}/api/public/resource-visual-revisions/${revisionId}/art.svg${hash ? `?v=${hash}` : ""}`
export const listVisualTags = () => request(() => api.get("/api/admin/resource-visual-tags"), z.array(visualTagSchema))
export const saveVisualTag = (body: unknown, id?: string) => request(() => id ? api.put(`/api/admin/resource-visual-tags/${id}`, body) : api.post("/api/admin/resource-visual-tags", body), visualTagSchema)
export const deleteVisualTag = async (id: string) => { try { await api.delete(`/api/admin/resource-visual-tags/${id}`) } catch (cause) { throw error(cause) } }
export const listAdminVisualTemplates = (search = "", includeArchived = false) => request(() => api.get(`/api/admin/resource-visual-templates?${query({ search, includeArchived })}`), visualPageSchema)
export const getAdminVisualTemplate = (id: string) => request(() => api.get(`/api/admin/resource-visual-templates/${id}`), visualTemplateSchema)
export const saveVisualTemplate = (body: unknown, id?: string) => request(() => id ? api.put(`/api/admin/resource-visual-templates/${id}`, body) : api.post("/api/admin/resource-visual-templates", body), visualTemplateSchema)
export const archiveVisualTemplate = async (id: string) => { try { await api.delete(`/api/admin/resource-visual-templates/${id}`) } catch (cause) { throw error(cause) } }
export const listVisualRevisions = (id: string) => request(() => api.get(`/api/admin/resource-visual-templates/${id}/revisions`), z.array(z.object({ metadata: visualRevisionSchema, floorSvg: z.string(), linesSvg: z.string().nullable(), netSvg: z.string().nullable(), publishedAt: z.string().nullable() })))
export const saveVisualRevision = (templateId: string, body: unknown, revisionId?: string) => request(() => revisionId ? api.put(`/api/admin/resource-visual-templates/${templateId}/revisions/${revisionId}`, body) : api.post(`/api/admin/resource-visual-templates/${templateId}/revisions`, body), z.object({ metadata: visualRevisionSchema, floorSvg: z.string(), linesSvg: z.string().nullable(), netSvg: z.string().nullable(), publishedAt: z.string().nullable() }))
export const publishVisualRevision = (templateId: string, revisionId: string) => request(() => api.post(`/api/admin/resource-visual-templates/${templateId}/revisions/${revisionId}/publish`), visualRevisionSchema)
export const getTenantSegments = (tenantId: string) => request(() => api.get(`/api/admin/tenants/${tenantId}/resource-segments`), z.array(visualTagSchema))
export const replaceTenantSegments = (tenantId: string, segmentIds: string[]) => request(() => api.put(`/api/admin/tenants/${tenantId}/resource-segments`, { segmentIds }), z.array(visualTagSchema))
export const listVisualTemplates = (filters: { search?: string; segmentIds?: string[]; tagIds?: string[]; allSegments?: boolean } = {}) => request(() => api.get(`/api/rental-assets/visual-templates?${query(filters)}`), visualPageSchema)
export const listPickerTags = () => request(() => api.get("/api/rental-assets/visual-template-tags"), z.array(visualTagSchema))
export const getComposition = (id: string) => request(() => api.get(`/api/rental-layouts/${id}/composition`), mapCompositionSchema)
export const saveComposition = (id: string, body: unknown) => request(() => api.put(`/api/rental-layouts/${id}/composition`, body), mapCompositionSchema)
export const getBookingMapSettings = () => request(() => api.get("/api/rentals/booking-map-settings"), bookingMapSettingsSchema)
export const saveBookingMapSettings = (body: unknown) => request(() => api.put("/api/rentals/booking-map-settings", body), bookingMapSettingsSchema)
export const fetchPublicBookingMaps = (subdomain: string) => request(() => publicApi.get(`/api/public/tenants/${subdomain}/booking-maps`), publicMapListSchema)
export const fetchPublicBookingMap = (subdomain: string, id: string) => request(() => publicApi.get(`/api/public/tenants/${subdomain}/booking-maps/${id}`), publicMapSchema)
export const fetchDailyAvailability = (subdomain: string, date: string, rentalAssetIds: string[]) => request(() => publicApi.get(`/api/public/tenants/${subdomain}/availability/days/${date}?${query({ rentalAssetIds })}`), dailyAvailabilitySchema)

export type { BookingMapSettings, DailyAvailability, MapComposition, PublicMap, VisualTag, VisualTemplate }
