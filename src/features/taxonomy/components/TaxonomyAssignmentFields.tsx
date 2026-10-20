import type { Control, FieldValues } from "react-hook-form"
import { useController } from "react-hook-form"

import { TaxonomyFilters } from "@/features/taxonomy/components/TaxonomyFilters"
import type { TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"

type TaxonomyFormValues = FieldValues & { taxonomy?: { categoryIds: string[]; tagIds: string[] } }

export function TaxonomyAssignmentFields<T extends TaxonomyFormValues>({ control, options, disabled = false }: { control: Control<T>; options: TaxonomyOptions; disabled?: boolean }) {
  const { field } = useController<T>({ control, name: "taxonomy" as never })
  const value = (field.value ?? { categoryIds: [], tagIds: [] }) as { categoryIds: string[]; tagIds: string[] }
  return <TaxonomyFilters options={options} disabled={disabled} categoryId={value.categoryIds[0] ?? null} tagIds={value.tagIds} onChange={({ categoryId, tagIds }) => field.onChange({ categoryIds: categoryId ? [categoryId] : [], tagIds })} />
}
