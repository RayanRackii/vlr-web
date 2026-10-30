import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { TaxonomyFiltersProps } from "@/features/taxonomy/components/TaxonomyFilters"

/** Portal presentation of the existing category and tag filter contract. */
export function PortalCatalogFilters({ options, categoryId = null, tagIds, disabled, onChange }: TaxonomyFiltersProps) {
  const { t } = useTranslation()
  const categories = [...options.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))

  return (
    <fieldset className="min-w-0 space-y-3" disabled={disabled}>
      <legend className="sr-only">{t("tenantPortal.catalog.filtersLabel")}</legend>
      {categories.length > 0 ? (
        <div className="portal-catalog-chips" role="group" aria-label={t("tenantPortal.catalog.categoryLabel")}>
          <button type="button" className="portal-catalog-chip" aria-pressed={!categoryId} onClick={() => onChange({ categoryId: null, tagIds: [...tagIds] })}>
            {t("tenantPortal.catalog.allCategories")}
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" className="portal-catalog-chip" aria-pressed={categoryId === category.id} onClick={() => onChange({ categoryId: category.id, tagIds: [...tagIds] })}>
              {category.name}
            </button>
          ))}
        </div>
      ) : null}
      {options.tags.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("tenantPortal.catalog.tagsHint")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label={t("tenantPortal.catalog.tagsLabel")}>
            {options.tags.map((tag) => (
              <label key={tag.id} className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={tagIds.includes(tag.id)}
                  onChange={() => onChange({ categoryId, tagIds: tagIds.includes(tag.id) ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id] })}
                />
                {tag.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {categoryId || tagIds.length > 0 ? (
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => onChange({ categoryId: null, tagIds: [] })}>
          {t("tenantPortal.catalog.clearFilters")}
        </Button>
      ) : null}
    </fieldset>
  )
}
