import type { Control, FieldValues } from "react-hook-form"
import { useController } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"

type TaxonomyFormValues = FieldValues & { taxonomy?: { categoryIds: string[]; tagIds: string[] } }

export function TaxonomyAssignmentFields<T extends TaxonomyFormValues>({ control, options, disabled = false }: { control: Control<T>; options: TaxonomyOptions; disabled?: boolean }) {
  const { t } = useTranslation()
  const { field } = useController<T>({ control, name: "taxonomy" as never })
  const value = (field.value ?? { categoryIds: [], tagIds: [] }) as { categoryIds: string[]; tagIds: string[] }
  const categoryIds = new Set(value.categoryIds)
  const tagIds = new Set(value.tagIds)

  function toggleCategory(id: string) {
    const nextCategoryIds = categoryIds.has(id)
      ? value.categoryIds.filter((categoryId) => categoryId !== id)
      : [...value.categoryIds, id]
    field.onChange({ categoryIds: nextCategoryIds, tagIds: value.tagIds })
  }

  function toggleTag(id: string) {
    const nextTagIds = tagIds.has(id)
      ? value.tagIds.filter((tagId) => tagId !== id)
      : [...value.tagIds, id]
    field.onChange({ categoryIds: value.categoryIds, tagIds: nextTagIds })
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("taxonomy.categories")}</p>
        {options.categories.map((category) => (
          <Label key={category.id} className="flex items-center gap-2 text-sm font-normal">
            <Checkbox checked={categoryIds.has(category.id)} onChange={() => toggleCategory(category.id)} />
            {category.name}
          </Label>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("taxonomy.tags")}</p>
        {options.tags.map((tag) => (
          <Label key={tag.id} className="flex items-center gap-2 text-sm font-normal">
            <Checkbox checked={tagIds.has(tag.id)} onChange={() => toggleTag(tag.id)} />
            {tag.name}
          </Label>
        ))}
      </div>
    </fieldset>
  )
}
