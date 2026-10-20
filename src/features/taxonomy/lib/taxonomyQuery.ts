export type TaxonomyQuery = {
  category?: string | null
  tags?: readonly string[] | null
}

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function normalizeTaxonomyQuery(query: TaxonomyQuery): TaxonomyQuery {
  const category = query.category?.trim()
  const tags = [...new Set((query.tags ?? []).map((tag) => tag.trim()).filter(validId))]
  return {
    ...(category && validId(category) ? { category } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  }
}

/** API expects a CSV; never allow Axios to render tags[] brackets. */
export function taxonomyQueryParams(query: TaxonomyQuery): Record<string, string> {
  const normalized = normalizeTaxonomyQuery(query)
  return {
    ...(normalized.category ? { category: normalized.category } : {}),
    ...(normalized.tags?.length ? { tags: normalized.tags.join(",") } : {}),
  }
}

export function taxonomyQueryFromSearch(search: URLSearchParams): TaxonomyQuery {
  const category = search.get("category")
  const rawTags = search.get("tags")
  return normalizeTaxonomyQuery({
    category,
    tags: rawTags ? rawTags.split(",") : [],
  })
}

export function setTaxonomySearchParams(
  current: URLSearchParams,
  query: TaxonomyQuery,
): URLSearchParams {
  const next = new URLSearchParams(current)
  const normalized = normalizeTaxonomyQuery(query)
  if (normalized.category) next.set("category", normalized.category)
  else next.delete("category")
  if (normalized.tags?.length) next.set("tags", normalized.tags.join(","))
  else next.delete("tags")
  return next
}
