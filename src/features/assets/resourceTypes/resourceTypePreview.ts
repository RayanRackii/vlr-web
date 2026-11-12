import type { ResourceTypeField, ResourceTypeView } from "@/features/assets/resourceTypes/resourceTypeModel"

export const previewPeople = [
  { initials: "ML", name: "Marina Lopes" },
  { initials: "CD", name: "Caio Duarte" },
  { initials: "BN", name: "Bia Nunes" },
] as const

export type ResourceTypePreview = {
  filters: { name: string; options: string[] }[]
  people: { initials: string; name: string; tag: string | null; unavailable: boolean }[]
  showHours: boolean
  showDelivery: boolean
  questions: Pick<ResourceTypeField, "name" | "required" | "responseType" | "options">[]
  action: "book" | "request"
  hiddenCount: number
}

export function buildResourceTypePreview(view: Pick<ResourceTypeView, "capabilities" | "fields">): ResourceTypePreview {
  const publicFields = view.fields.filter((field) => field.visibility === "public" && field.name.trim())
  const filters = publicFields
    .filter((field) => field.filterable)
    .map((field) => ({ name: field.name, options: field.options }))
  const tags = filters[0]?.options ?? []
  return {
    filters,
    people: previewPeople.map((person, index) => ({
      initials: person.initials,
      name: person.name,
      tag: tags.length > 0 ? tags[index % tags.length] ?? null : null,
      unavailable: view.capabilities.maintenance && index === 2,
    })),
    showHours: view.capabilities.bookable,
    showDelivery: view.capabilities.deliverable,
    questions: publicFields
      .filter((field) => field.askOnBooking)
      .map((field) => ({
        name: field.name,
        required: field.required,
        responseType: field.responseType,
        options: field.options,
      })),
    action: view.capabilities.bookable ? "book" : "request",
    hiddenCount: view.fields.filter((field) => field.visibility === "internal").length,
  }
}
