import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

export type ResourceTypeArticle = "um" | "uma"
export type ResourceTypeVisibility = "public" | "internal"
export type ResourceTypeResponseType = "text" | "list" | "number"

export type ResourceTypeCapabilities = {
  bookable: boolean
  deliverable: boolean
  maintenance: boolean
}

export type ResourceTypeField = {
  key: string
  name: string
  responseType: ResourceTypeResponseType
  options: string[]
  visibility: ResourceTypeVisibility
  required: boolean
  filterable: boolean
  askOnBooking: boolean
}

/** List and wizard shape. Additive on the asset-family catalog. */
export type ResourceTypeSource = {
  id: string
  key: string
  name: string
  singular?: string
  plural?: string
  article?: ResourceTypeArticle
  seeded?: boolean
  resourceCount?: number
  capabilities?: Partial<ResourceTypeCapabilities>
  bookable?: boolean
  deliverable?: boolean
  maintenance?: boolean
  fields: Array<AssetFamilyField & {
    name?: string
    visibility?: ResourceTypeVisibility
    filterable?: boolean
    askOnBooking?: boolean
    options?: string[]
    responseType?: string
  }>
}

export type ResourceTypeView = {
  id: string
  key: string
  name: string
  singular: string
  plural: string
  article: ResourceTypeArticle
  seeded: boolean
  resourceCount: number
  capabilities: ResourceTypeCapabilities
  fields: ResourceTypeField[]
  publicFieldCount: number
  internalFieldCount: number
  vocabularyKnown: boolean
}

const SEEDED_KEYS = new Set(["quadra", "cacamba"])

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function responseType(value: string | undefined): ResourceTypeResponseType {
  if (value === "number" || value === "numero" || value === "número") return "number"
  if (value === "list" || value === "lista") return "list"
  return "text"
}

export function isSeededResourceType(key: string, name: string, seeded?: boolean): boolean {
  if (seeded === true) return true
  const folded = fold(key || name)
  return SEEDED_KEYS.has(folded)
}

export function toResourceTypeView(record: ResourceTypeSource): ResourceTypeView {
  const singular = record.singular?.trim() || record.name.trim().toLocaleLowerCase()
  const plural = record.plural?.trim() || singular
  const capabilities: ResourceTypeCapabilities = {
    bookable: record.capabilities?.bookable ?? record.bookable ?? false,
    deliverable: record.capabilities?.deliverable ?? record.deliverable ?? false,
    maintenance: record.capabilities?.maintenance ?? record.maintenance ?? false,
  }
  const fields = record.fields.map((field) => {
    const visibility: ResourceTypeVisibility = field.visibility === "internal" ? "internal" : "public"
    return {
      key: field.key,
      name: field.name?.trim() || field.label?.trim() || field.key,
      responseType: responseType(field.responseType ?? field.type),
      options: field.options ?? [],
      visibility,
      required: field.required,
      filterable: visibility === "public" && field.filterable === true,
      askOnBooking: visibility === "public" && field.askOnBooking === true,
    }
  })
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    singular,
    plural,
    article: record.article === "uma" ? "uma" : "um",
    seeded: isSeededResourceType(record.key, record.name, record.seeded),
    resourceCount: record.resourceCount ?? 0,
    capabilities,
    fields,
    publicFieldCount: fields.filter((field) => field.visibility === "public").length,
    internalFieldCount: fields.filter((field) => field.visibility === "internal").length,
    vocabularyKnown: Boolean(record.singular?.trim()),
  }
}
