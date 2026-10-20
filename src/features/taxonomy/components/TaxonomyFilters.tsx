import { Folder, Tag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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

export function TaxonomyFilters({ options, categoryId = null, tagIds, loading = false, disabled = false, onChange }: TaxonomyFiltersProps) {
  const tagSet = new Set(tagIds)
  const categories = [...options.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  const changeTags = (id: string) => onChange({ categoryId, tagIds: tagSet.has(id) ? tagIds.filter((item) => item !== id) : [...tagIds, id] })
  const isDisabled = loading || disabled
  return (
    <fieldset className="space-y-3" disabled={isDisabled} aria-busy={loading}>
      <div className="space-y-1">
        <Label htmlFor="taxonomy-category-filter"><Folder data-icon="inline-start" /> Categoria</Label>
        <select id="taxonomy-category-filter" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={categoryId ?? ""} onChange={(event) => onChange({ categoryId: event.target.value || null, tagIds: [...tagIds] })}>
          <option value="">Todas as categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{"— ".repeat(categoryDepth(category, categories))}{category.name}</option>)}
        </select>
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
