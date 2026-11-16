import { Folder, Tag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaxonomyCategory, TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"

export type TaxonomyFiltersProps = {
  options: TaxonomyOptions
  categoryId?: string | null
  tagIds: readonly string[]
  loading?: boolean
  disabled?: boolean
  onChange: (next: { categoryId: string | null; tagIds: string[] }) => void
}

function categoryDepth(category: TaxonomyCategory, all: TaxonomyCategory[]): number {
  let depth = 0
  let current = category
  while (current.parentId) {
    const parent = all.find((candidate) => candidate.id === current.parentId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

const CATEGORY_ALL = "__all__"

export function TaxonomyFilters({ options, categoryId = null, tagIds, loading = false, disabled = false, onChange }: TaxonomyFiltersProps) {
  const tagSet = new Set(tagIds)
  const categories = [...options.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  const changeTags = (id: string) => onChange({ categoryId, tagIds: tagSet.has(id) ? tagIds.filter((item) => item !== id) : [...tagIds, id] })
  const isDisabled = loading || disabled
  const categoryItems = [
    { value: CATEGORY_ALL, label: "Todas as categorias" },
    ...categories.map((category) => ({ value: category.id, label: `${"— ".repeat(categoryDepth(category, categories))}${category.name}` })),
  ]
  return (
    <fieldset className="space-y-3" disabled={isDisabled} aria-busy={loading}>
      <div className="space-y-1">
        <Label id="taxonomy-category-filter-label"><Folder data-icon="inline-start" /> Categoria</Label>
        <Select modal={false} value={categoryId ?? CATEGORY_ALL} items={categoryItems} onValueChange={(value) => onChange({ categoryId: value === null || value === CATEGORY_ALL ? null : value, tagIds: [...tagIds] })}>
          <SelectTrigger id="taxonomy-category-filter" aria-labelledby="taxonomy-category-filter-label" icon={Folder}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium"><Tag data-icon="inline-start" /> Tags</p>
        <p className="text-xs text-muted-foreground">Corresponde a todas as tags selecionadas.</p>
        {options.tags.map((tag) => <label key={tag.id} className="flex items-center gap-2 text-sm"><Checkbox checked={tagSet.has(tag.id)} onChange={() => changeTags(tag.id)} />{tag.name}</label>)}
      </div>
      {(categoryId || tagIds.length > 0) ? <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ categoryId: null, tagIds: [] })}>Limpar filtros</Button> : null}
    </fieldset>
  )
}
