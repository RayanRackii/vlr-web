import { describe, expect, it } from "vitest"

import { setTaxonomySearchParams, taxonomyQueryFromSearch, taxonomyQueryParams } from "@/features/taxonomy/lib/taxonomyQuery"

const category = "11111111-1111-4111-8111-111111111111"
const tagA = "22222222-2222-4222-8222-222222222222"
const tagB = "33333333-3333-4333-8333-333333333333"

describe("taxonomy query serialization", () => {
  it("serializes tags as CSV and deduplicates IDs", () => {
    expect(taxonomyQueryParams({ category, tags: [tagA, tagA, tagB] })).toEqual({ category, tags: `${tagA},${tagB}` })
  })

  it("restores taxonomy parameters without dropping unrelated URL state", () => {
    const next = setTaxonomySearchParams(new URLSearchParams("search=chair&page=2"), { category, tags: [tagA, tagB] })
    expect(next.toString()).toBe(`search=chair&page=2&category=${category}&tags=${tagA}%2C${tagB}`)
    expect(taxonomyQueryFromSearch(next)).toEqual({ category, tags: [tagA, tagB] })
  })
})
