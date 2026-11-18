import { useEffect, useId, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Folder, Plus, Search, Tag as TagIcon, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorState } from "@/components/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CategoryCreateDialog } from "@/features/assistant/CategoryCreateDialog"
import { slugify } from "@/features/assistant/taxonomySlug"
import { useStepSubmit } from "@/features/assistant/stepSubmit"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { updateCatalogProduct } from "@/features/catalog/services/catalogService"
import { taxonomyMutationSchema, taxonomyTagMutationSchema, type TaxonomyCategory, type TaxonomyTag, type TaxonomyMutationValues, type TaxonomyTagMutationValues } from "@/features/taxonomy/schemas/taxonomySchemas"
import { listTaxonomyCategories, listTaxonomyTags, createTaxonomyCategory, createTaxonomyTag } from "@/features/taxonomy/services/taxonomyService"

const TAXONOMY_ASSIGNMENT_LIMIT = 20
const matches = (name: string, query: string) => name.toLowerCase().includes(query.trim().toLowerCase())

export function CadastroTaxonomyStep({ product, canAssign = false, onSaved, onDirtyChange, onSavingChange }: { product?: CatalogProduct; canAssign?: boolean; onSaved?: () => void | Promise<void>; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void }) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canManage = can("core.taxonomy.manage") && !isTrialReadOnly
  const canRead = can("core.taxonomy.read") || can("core.taxonomy.manage")
  const assign = Boolean(product) && canAssign && !isTrialReadOnly
  const [categories, setCategories] = useState<TaxonomyCategory[]>([])
  const [tags, setTags] = useState<TaxonomyTag[]>([])
  const [categoryIds, setCategoryIds] = useState(product?.taxonomy?.categories.map((item) => item.id) ?? [])
  const [tagIds, setTagIds] = useState(product?.taxonomy?.tags.map((item) => item.id) ?? [])
  const [creating, setCreating] = useState<"category" | "tag" | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [categoryCreated, setCategoryCreated] = useState(false)
  const [loading, setLoading] = useState(canRead)
  const [attempt, setAttempt] = useState(0)

  const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id) => right.includes(id))
  const overLimit = categoryIds.length > TAXONOMY_ASSIGNMENT_LIMIT || tagIds.length > TAXONOMY_ASSIGNMENT_LIMIT
  const assignmentChanged = assign && (!sameIds(categoryIds, product?.taxonomy?.categories.map((item) => item.id) ?? []) || !sameIds(tagIds, product?.taxonomy?.tags.map((item) => item.id) ?? []))
  const dirty = assignmentChanged || creating !== null
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onSavingChange?.(busy || inlineSaving) }, [busy, inlineSaving, onSavingChange])
  useEffect(() => () => { onDirtyChange?.(false); onSavingChange?.(false) }, [onDirtyChange, onSavingChange])

  useEffect(() => {
    if (!canRead) return
    let active = true
    void Promise.all([listTaxonomyCategories(), listTaxonomyTags()]).then(([nextCategories, nextTags]) => {
      if (!active) return
      setCategories(nextCategories)
      setTags(nextTags)
      setError(null)
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : t("apiErrors.loadTaxonomy")) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canRead, attempt, t])

  async function save(): Promise<boolean> {
    if (!product || !assign || busy || overLimit) return false
    setBusy(true)
    setSaveError(null)
    try {
      await updateCatalogProduct(product.id, { name: product.name, code: product.code, description: product.description, price: product.price, currency: product.currency, taxonomy: { categoryIds, tagIds } })
      toast.success(t("taxonomy.saved"))
      await onSaved?.()
      return true
    } catch (caught) {
      const message = caught instanceof Error && caught.message ? caught.message : t("apiErrors.saveCatalogProduct")
      setSaveError(message)
      toast.error(message)
      return false
    } finally { setBusy(false) }
  }

  // Inside the cadastro shell the footer saves; the step's own Save button is hidden.
  const shellDrivesSave = useStepSubmit(async () => {
    if (!product || !assign || !assignmentChanged) return true
    if (overLimit) return false
    return save()
  })

  if (!canRead) return <p className="text-sm text-muted-foreground">{t("cadastro.taxonomyNoRead")}</p>
  if (loading) return <Skeleton className="h-48 w-full" role="status" aria-label={t("common.loading")} />
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />

  if (!product) {
    return <ResourceTaxonomyCreate categories={categories} tags={tags} canManage={canManage} creating={creating} setCreating={setCreating} busy={busy || inlineSaving} setInlineSaving={setInlineSaving} setCategories={setCategories} setTags={setTags} />
  }

  const categoryById = new Map<string, { id: string; name: string }>([...(product.taxonomy?.categories ?? []), ...categories].map((item) => [item.id, item]))
  const tagById = new Map<string, { id: string; name: string }>([...(product.taxonomy?.tags ?? []), ...tags].map((item) => [item.id, item]))
  const locked = !assign || busy || inlineSaving
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
  const changed = () => { setSaveError(null); setCategoryCreated(false) }
  return <div className="space-y-6">
    {shellDrivesSave ? null : <p className="text-sm text-muted-foreground">{t("cadastro.taxonomyHelp")}</p>}
    <section className="space-y-3" aria-label={t("taxonomy.categories")}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("taxonomy.categories")}</h2>
          {canManage ? <Button type="button" variant="outline" className="min-h-11" disabled={busy || inlineSaving} onClick={() => setCreating("category")}><Plus className="size-4" aria-hidden="true" />{t("cadastro.createCategoryButton")}</Button> : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("cadastro.categoriesHelp")}</p>
      </div>
      <CategoryCombobox categories={categories} selected={categoryIds} disabled={locked} canCreate={canManage} onToggle={(id) => { changed(); setCategoryIds((current) => toggle(current, id)) }} onCreate={() => setCreating("category")} />
      {categoryIds.length === 0
        ? <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
          <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div><p className="text-sm font-medium">{t("cadastro.noCategorySelected")}</p><p className="text-xs text-muted-foreground">{t("cadastro.noCategorySelectedHint")}</p></div>
        </div>
        : <ChipList ids={categoryIds} lookup={categoryById} disabled={locked} icon={<Folder className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />} onRemove={(id) => { changed(); setCategoryIds((current) => current.filter((value) => value !== id)) }} />}
      <p aria-live="polite" className="text-sm text-primary">{categoryCreated ? `✓ ${t("cadastro.categoryCreatedSelected")}` : null}</p>
      {canManage ? <CategoryCreateDialog open={creating === "category"} categories={categories} onOpenChange={(open) => setCreating(open ? "category" : null)} onSavingChange={setInlineSaving} onCreated={(item) => {
        setCategories((current) => [...current, item])
        setCreating(null)
        if (assign) { setSaveError(null); setCategoryIds((current) => current.includes(item.id) ? current : [...current, item.id]); setCategoryCreated(true) }
      }} /> : null}
    </section>
    <section className="space-y-3" aria-label={t("taxonomy.tags")}>
      <div>
        <h2 className="text-sm font-semibold">{t("taxonomy.tags")}</h2>
        <p className="text-sm text-muted-foreground">{t("cadastro.tagsHelp")}</p>
      </div>
      <TagInput tags={tags} selected={tagIds} disabled={locked} canCreate={canManage} onSelect={(id) => { changed(); setTagIds((current) => current.includes(id) ? current : [...current, id]) }} onCreated={(item) => { changed(); setTags((current) => [...current, item]); setTagIds((current) => [...current, item.id]) }} onBusyChange={setInlineSaving} />
      <ChipList ids={tagIds} lookup={tagById} disabled={locked} onRemove={(id) => { changed(); setTagIds((current) => current.filter((value) => value !== id)) }} />
    </section>
    <div className="rounded-lg bg-muted px-4 py-4">
      <p className="text-sm font-medium">{t("cadastro.differenceTitle")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("cadastro.differenceBody")}</p>
    </div>
    {overLimit ? <p role="alert">{t("cadastro.taxonomyLimit")}</p> : null}
    {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
    {assign && !shellDrivesSave ? <Button type="button" variant="outline" className="min-h-11" disabled={busy || creating !== null || overLimit} onClick={() => void save()}>{t("assistant.saveStep")}</Button> : null}
  </div>
}

function ChipList({ ids, lookup, disabled, icon, onRemove }: { ids: string[]; lookup: Map<string, { id: string; name: string }>; disabled: boolean; icon?: React.ReactNode; onRemove: (id: string) => void }) {
  const { t } = useTranslation()
  if (ids.length === 0) return null
  return <ul className="flex flex-wrap gap-2">
    {ids.map((id) => {
      const name = lookup.get(id)?.name ?? id
      return <li key={id} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-muted px-3 text-xs font-medium">
        {icon}
        <span className="min-w-0 break-words">{name}</span>
        {disabled ? null : <button type="button" aria-label={t("cadastro.removeItem", { name })} className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground after:absolute after:-inset-3 after:content-['']" onClick={() => onRemove(id)}><X className="size-3" aria-hidden="true" /></button>}
      </li>
    })}
  </ul>
}

function CategoryCombobox({ categories, selected, disabled, canCreate, onToggle, onCreate }: { categories: TaxonomyCategory[]; selected: string[]; disabled: boolean; canCreate: boolean; onToggle: (id: string) => void; onCreate: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const label = (category: TaxonomyCategory) => {
    const parent = categories.find((item) => item.id === category.parentId)
    return parent ? `${parent.name} › ${category.name}` : category.name
  }
  const results = categories.filter((category) => matches(label(category), query))
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery("") }}>
    <PopoverTrigger render={<Button type="button" role="combobox" aria-label={t("cadastro.categorySearchPlaceholder")} aria-expanded={open} aria-controls={`${id}-list`} variant="outline" disabled={disabled} className="min-h-11 w-full justify-between font-normal text-muted-foreground" />}>
      <span className="flex items-center gap-2"><Search className="size-4" aria-hidden="true" />{t("cadastro.categorySearchPlaceholder")}</span>
      <ChevronDown className="size-4" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent align="start" className="w-(--anchor-width) min-w-64 space-y-2">
      <Input aria-label={t("cadastro.categorySearchLabel")} className="min-h-11" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div id={`${id}-list`} role="listbox" aria-multiselectable="true" aria-label={t("taxonomy.categories")} className="max-h-60 overflow-y-auto">
        {results.map((category) => <button type="button" role="option" aria-selected={selected.includes(category.id)} key={category.id} className="flex min-h-11 w-full items-center justify-between rounded px-3 text-left text-sm hover:bg-muted aria-selected:font-medium" onClick={() => onToggle(category.id)}>{label(category)}{selected.includes(category.id) ? <span aria-hidden="true">✓</span> : null}</button>)}
      </div>
      {results.length === 0 ? <div className="space-y-1 px-1 text-sm text-muted-foreground">
        <p>{t(categories.length === 0 ? "taxonomy.emptyCategories" : "cadastro.noCategoryMatch")}</p>
        {canCreate ? <Button type="button" variant="link" className="min-h-11 px-0" onClick={() => { setOpen(false); onCreate() }}>{t("cadastro.createNewCategory")}</Button> : null}
      </div> : null}
    </PopoverContent>
  </Popover>
}

function TagInput({ tags, selected, disabled, canCreate, onSelect, onCreated, onBusyChange }: { tags: TaxonomyTag[]; selected: string[]; disabled: boolean; canCreate: boolean; onSelect: (id: string) => void; onCreated: (tag: TaxonomyTag) => void; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [creatingTag, setCreatingTag] = useState(false)
  const text = query.trim()
  const suggestions = text ? tags.filter((tag) => !selected.includes(tag.id) && matches(tag.name, text)) : []
  const exact = tags.find((tag) => tag.name.toLowerCase() === text.toLowerCase() || (slugify(text) !== "" && tag.slug === slugify(text)))
  async function add() {
    if (!text || creatingTag) return
    setMessage(null)
    if (exact) { onSelect(exact.id); setQuery(""); return }
    if (!canCreate) { if (suggestions[0]) { onSelect(suggestions[0].id); setQuery("") } else setMessage(t("cadastro.noTagMatch")); return }
    const parsed = taxonomyTagMutationSchema.safeParse({ name: text, slug: slugify(text) })
    if (!parsed.success) { setMessage(t("cadastro.tagInvalid")); return }
    setCreatingTag(true)
    onBusyChange(true)
    try {
      const item = await createTaxonomyTag(parsed.data)
      onCreated(item)
      setQuery("")
    } catch (caught) { setMessage(caught instanceof Error && caught.message ? caught.message : t("apiErrors.saveTaxonomy")) }
    finally { setCreatingTag(false); onBusyChange(false) }
  }
  return <div className="space-y-2">
    <div className="relative">
      <TagIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input aria-label={t("taxonomy.tags")} aria-describedby={message ? `${id}-message` : undefined} aria-invalid={message ? true : undefined} className="min-h-11 pl-9" placeholder={t(canCreate ? "cadastro.tagInputPlaceholder" : "cadastro.tagSearchPlaceholder")} value={query} disabled={disabled || creatingTag} onChange={(event) => { setQuery(event.target.value); setMessage(null) }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add() } }} />
    </div>
    {suggestions.length > 0 ? <div role="listbox" aria-label={t("taxonomy.tags")} className="rounded-md border p-1">
      {suggestions.slice(0, 6).map((tag) => <button type="button" role="option" aria-selected={false} key={tag.id} className="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-muted" onClick={() => { onSelect(tag.id); setQuery("") }}>{tag.name}</button>)}
    </div> : null}
    {!canCreate && text && suggestions.length === 0 && !exact ? <p className="text-sm text-muted-foreground">{t("cadastro.noTagMatch")}</p> : null}
    {message ? <p id={`${id}-message`} role="alert" className="text-sm text-destructive">{message}</p> : null}
  </div>
}

/** Resource cadastro: shared categories and tags can be created, but are not assigned to the resource. */
function ResourceTaxonomyCreate({ categories, tags, canManage, creating, setCreating, busy, setInlineSaving, setCategories, setTags }: { categories: TaxonomyCategory[]; tags: TaxonomyTag[]; canManage: boolean; creating: "category" | "tag" | null; setCreating: (kind: "category" | "tag" | null) => void; busy: boolean; setInlineSaving: (saving: boolean) => void; setCategories: React.Dispatch<React.SetStateAction<TaxonomyCategory[]>>; setTags: React.Dispatch<React.SetStateAction<TaxonomyTag[]>> }) {
  const { t } = useTranslation()
  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{t("cadastro.resourceTaxonomyHelp")}</p>
    {(["category", "tag"] as const).map((kind) => {
      const items = kind === "category" ? categories : tags
      return <section key={kind} className="space-y-3" aria-label={t(kind === "category" ? "taxonomy.categories" : "taxonomy.tags")}>
        <h2 className="text-base font-semibold">{t(kind === "category" ? "taxonomy.categories" : "taxonomy.tags")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => <span key={item.id} className="inline-flex w-fit max-w-full rounded-full border px-3 py-1 text-sm">{item.name}</span>)}
          {canManage ? <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={busy} aria-expanded={creating === kind} onClick={() => setCreating(creating === kind ? null : kind)}>{t(kind === "category" ? "cadastro.addCategory" : "cadastro.addTag")}</Button> : null}
          {items.length === 0 ? <p className="text-sm text-muted-foreground">{t(kind === "category" ? "taxonomy.emptyCategories" : "taxonomy.emptyTags")}</p> : null}
        </div>
        {creating === kind && canManage ? <InlineTaxonomyCreate key={kind} kind={kind} categories={categories} onSavingChange={setInlineSaving} onClose={() => setCreating(null)} onCreated={(item) => {
          if (kind === "category") setCategories((current) => [...current, item as TaxonomyCategory])
          else setTags((current) => [...current, item])
          setCreating(null)
        }} /> : null}
      </section>
    })}
  </div>
}

function InlineTaxonomyCreate({ kind, categories, onClose, onCreated, onSavingChange }: { kind: "category" | "tag"; categories: TaxonomyCategory[]; onClose: () => void; onCreated: (item: TaxonomyCategory | TaxonomyTag) => void; onSavingChange: (saving: boolean) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [parentOpen, setParentOpen] = useState(false)
  const [search, setSearch] = useState("")
  const schema = kind === "category" ? taxonomyMutationSchema : taxonomyTagMutationSchema
  const form = useForm<TaxonomyMutationValues | TaxonomyTagMutationValues>({ resolver: zodResolver(schema), defaultValues: { name: "", slug: "", parentId: null, icon: null, sortOrder: 0 } })
  const values = useWatch({ control: form.control })
  useEffect(() => {
    onSavingChange(form.formState.isSubmitting)
    return () => onSavingChange(false)
  }, [form.formState.isSubmitting, onSavingChange])
  const parentId = "parentId" in values ? values.parentId : null
  // The taxonomy permits three levels. Only roots and their children can be parents.
  const parents = categories.filter((category) => category.parentId === null || categories.some((parent) => parent.id === category.parentId && parent.parentId === null))
  async function submit(data: TaxonomyMutationValues | TaxonomyTagMutationValues) {
    try {
      const item = kind === "category" ? await createTaxonomyCategory(taxonomyMutationSchema.parse(data)) : await createTaxonomyTag(taxonomyTagMutationSchema.parse(data))
      toast.success(t("taxonomy.saved"))
      onCreated(item)
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : t("apiErrors.saveTaxonomy")) }
  }
  return <form className="space-y-4 rounded-lg border bg-muted/30 p-4" onSubmit={form.handleSubmit(submit)}>
    <h3 className="font-medium">{t(kind === "category" ? "taxonomy.newCategory" : "taxonomy.newTag")}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium" htmlFor={`${id}-name`}>{t("taxonomy.name")}
        <Input id={`${id}-name`} className="min-h-11" maxLength={kind === "category" ? 100 : 50} {...form.register("name")} onChange={(event) => { form.setValue("name", event.target.value); form.setValue("slug", slugify(event.target.value), { shouldValidate: true }) }} />
      </label>
      <label className="space-y-1 text-sm font-medium" htmlFor={`${id}-slug`}>{t("taxonomy.slug")}<Input id={`${id}-slug`} className="min-h-11" {...form.register("slug")} /></label>
      {kind === "category" ? <div className="space-y-1">
        <span id={`${id}-parent`} className="text-sm font-medium">{t("taxonomy.parent")}</span>
        <Popover open={parentOpen} onOpenChange={setParentOpen}>
          <PopoverTrigger render={<Button type="button" role="combobox" aria-labelledby={`${id}-parent`} aria-expanded={parentOpen} variant="outline" className="min-h-11 w-full justify-between" />}>
            {categories.find((item) => item.id === parentId)?.name ?? t("cadastro.noParent")}<span aria-hidden="true">{parentOpen ? "−" : "+"}</span>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2">
            <Input aria-label={t("common.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <div role="listbox" aria-labelledby={`${id}-parent`} className="max-h-60 overflow-y-auto">
              {[{ id: "", name: t("cadastro.noParent") }, ...parents.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))].map((item) => <button type="button" role="option" aria-selected={(parentId ?? "") === item.id} key={item.id} className="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-muted" onClick={() => { form.setValue("parentId", item.id || null); setParentOpen(false) }}>{item.name}</button>)}
            </div>
          </PopoverContent>
        </Popover>
      </div> : null}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="outline" className="min-h-11" disabled={!schema.safeParse(values).success || form.formState.isSubmitting}>{t(kind === "category" ? "cadastro.createCategory" : "cadastro.createTag")}</Button>
      <Button type="button" variant="ghost" className="min-h-11" disabled={form.formState.isSubmitting} onClick={onClose}>{t("assistant.close")}</Button>
    </div>
  </form>
}
