import type { ApiClient } from "./api-client"

export type IdName = { id: string; name?: string; key?: string; label?: string }

export async function firstUnit(b2b: ApiClient): Promise<IdName> {
  const result = await b2b.get<IdName[]>("/api/units")
  if (result.status !== 200 || !result.body?.[0]) {
    throw new Error(`No units available (${result.status})`)
  }
  return result.body[0]
}

export async function rentalFamilies(b2b: ApiClient): Promise<IdName[]> {
  const result = await b2b.get<IdName[]>("/api/rental-assets/families")
  if (result.status !== 200 || !result.body) {
    throw new Error(`rental families ${result.status} ${result.text.slice(0, 200)}`)
  }
  return result.body
}

export async function rentalCategories(b2b: ApiClient): Promise<IdName[]> {
  const result = await b2b.get<IdName[]>("/api/rental-assets/categories")
  if (result.status !== 200 || !result.body) {
    throw new Error(`rental categories ${result.status} ${result.text.slice(0, 200)}`)
  }
  return result.body
}

export async function familyByKey(
  b2b: ApiClient,
  key: string,
): Promise<IdName> {
  const families = await rentalFamilies(b2b)
  const found = families.find((family) => family.key === key)
  if (!found) {
    throw new Error(`Family ${key} not found`)
  }
  return found
}

export async function categoryByName(
  b2b: ApiClient,
  name: string,
): Promise<IdName> {
  const categories = await rentalCategories(b2b)
  const found = categories.find((category) => category.name === name)
  if (!found) {
    throw new Error(`Category ${name} not found among ${categories.map((c) => c.name).join(", ")}`)
  }
  return found
}

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)
