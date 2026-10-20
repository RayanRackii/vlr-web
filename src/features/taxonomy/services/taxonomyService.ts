import i18n from "@/lib/i18n"
import { api, customerApi } from "@/lib/api"
import {
  taxonomyCategorySchema,
  taxonomyOptionsSchema,
  taxonomyTagSchema,
  type TaxonomyCategory,
  type TaxonomyOptions,
  type TaxonomyTag,
} from "@/features/taxonomy/schemas/taxonomySchemas"

function parse<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new Error(i18n.t("apiErrors.invalidPayload"))
  return result.data
}

function message(error: unknown, fallback: string): Error {
  const payload = error as { response?: { data?: { code?: string; error?: string } } }
  const code = payload.response?.data?.code
  if (code === "TAXONOMY_DUPLICATE") return new Error(i18n.t("taxonomy.errors.duplicate"))
  if (code === "TAXONOMY_IN_USE") return new Error(i18n.t("taxonomy.errors.inUse"))
  return new Error(payload.response?.data?.error ?? fallback)
}

export async function listTaxonomyCategories(): Promise<TaxonomyCategory[]> {
  try {
    const response = await api.get("/api/taxonomy/categories")
    return parse(taxonomyCategorySchema.array().safeParse(response.data))
  } catch (error) { throw message(error, i18n.t("apiErrors.loadTaxonomy")) }
}

export async function listTaxonomyTags(): Promise<TaxonomyTag[]> {
  try {
    const response = await api.get("/api/taxonomy/tags")
    return parse(taxonomyTagSchema.array().safeParse(response.data))
  } catch (error) { throw message(error, i18n.t("apiErrors.loadTaxonomy")) }
}

export async function createTaxonomyCategory(body: Omit<TaxonomyCategory, "id">): Promise<TaxonomyCategory> {
  try { return parse(taxonomyCategorySchema.safeParse((await api.post("/api/taxonomy/categories", body)).data)) }
  catch (error) { throw message(error, i18n.t("apiErrors.saveTaxonomy")) }
}

export async function updateTaxonomyCategory(id: string, body: Omit<TaxonomyCategory, "id" | "slug">): Promise<TaxonomyCategory> {
  try { return parse(taxonomyCategorySchema.safeParse((await api.put(`/api/taxonomy/categories/${id}`, body)).data)) }
  catch (error) { throw message(error, i18n.t("apiErrors.saveTaxonomy")) }
}

export async function deleteTaxonomyCategory(id: string): Promise<void> {
  try { await api.delete(`/api/taxonomy/categories/${id}`) }
  catch (error) { throw message(error, i18n.t("apiErrors.deleteTaxonomy")) }
}

export async function createTaxonomyTag(body: Omit<TaxonomyTag, "id">): Promise<TaxonomyTag> {
  try { return parse(taxonomyTagSchema.safeParse((await api.post("/api/taxonomy/tags", body)).data)) }
  catch (error) { throw message(error, i18n.t("apiErrors.saveTaxonomy")) }
}

export async function updateTaxonomyTag(id: string, body: Pick<TaxonomyTag, "name">): Promise<TaxonomyTag> {
  try { return parse(taxonomyTagSchema.safeParse((await api.put(`/api/taxonomy/tags/${id}`, body)).data)) }
  catch (error) { throw message(error, i18n.t("apiErrors.saveTaxonomy")) }
}

export async function deleteTaxonomyTag(id: string): Promise<void> {
  try { await api.delete(`/api/taxonomy/tags/${id}`) }
  catch (error) { throw message(error, i18n.t("apiErrors.deleteTaxonomy")) }
}

async function options(client: typeof api, path: string, signal?: AbortSignal): Promise<TaxonomyOptions> {
  try { return parse(taxonomyOptionsSchema.safeParse((await client.get(path, signal ? { signal } : undefined)).data)) }
  catch (error) { throw message(error, i18n.t("apiErrors.loadTaxonomy")) }
}

export function getCatalogTaxonomyOptions(signal?: AbortSignal) { return options(api, "/api/catalog/taxonomy-options", signal) }
export function getPortalCatalogTaxonomyOptions(signal?: AbortSignal) { return options(customerApi, "/api/catalog/portal/taxonomy-options", signal) }
