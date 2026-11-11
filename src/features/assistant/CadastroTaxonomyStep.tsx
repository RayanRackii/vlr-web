import { useEffect, useId, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorState } from "@/components/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { updateCatalogProduct } from "@/features/catalog/services/catalogService"
import { taxonomyMutationSchema, taxonomyTagMutationSchema, type TaxonomyCategory, type TaxonomyTag, type TaxonomyMutationValues, type TaxonomyTagMutationValues } from "@/features/taxonomy/schemas/taxonomySchemas"
import { listTaxonomyCategories, listTaxonomyTags, createTaxonomyCategory, createTaxonomyTag } from "@/features/taxonomy/services/taxonomyService"

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80).replace(/-$/, "")

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
  const [loading, setLoading] = useState(canRead)
  const [attempt, setAttempt] = useState(0)

  const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id) => right.includes(id))
  const dirty = (assign && (!sameIds(categoryIds, product?.taxonomy?.categories.map((item) => item.id) ?? []) || !sameIds(tagIds, product?.taxonomy?.tags.map((item) => item.id) ?? []))) || creating !== null
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

  async function save() {
    if (!product || !assign || busy) return
    setBusy(true)
    try {
      await updateCatalogProduct(product.id, { name: product.name, code: product.code, description: product.description, price: product.price, currency: product.currency, taxonomy: { categoryIds, tagIds } })
      toast.success(t("taxonomy.saved"))
      await onSaved?.()
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : t("apiErrors.saveCatalogProduct")) }
    finally { setBusy(false) }
  }

  if (!canRead) return <p className="text-sm text-muted-foreground">{t("cadastro.taxonomyNoRead")}</p>
  if (loading) return <Skeleton className="h-48 w-full" role="status" aria-label={t("common.loading")} />
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />

  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{t(product ? "cadastro.taxonomyHelp" : "cadastro.resourceTaxonomyHelp")}</p>
    {(["category", "tag"] as const).map((kind) => {
      const items = kind === "category" ? categories : tags
      const selected = kind === "category" ? categoryIds : tagIds
      return <section key={kind} className="space-y-3" aria-label={t(kind === "category" ? "taxonomy.categories" : "taxonomy.tags")}>
        <h2 className="text-base font-semibold">{t(kind === "category" ? "taxonomy.categories" : "taxonomy.tags")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => product ? <Button key={item.id} type="button" variant={selected.includes(item.id) ? "secondary" : "outline"} className="min-h-11 w-fit max-w-full whitespace-normal rounded-full" aria-pressed={selected.includes(item.id)} disabled={!assign || busy || inlineSaving} onClick={() => kind === "category" ? setCategoryIds(toggle(categoryIds, item.id)) : setTagIds(toggle(tagIds, item.id))}>{item.name}</Button> : <span key={item.id} className="inline-flex w-fit max-w-full rounded-full border px-3 py-1 text-sm">{item.name}</span>)}
          {canManage ? <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={busy || inlineSaving} aria-expanded={creating === kind} onClick={() => setCreating(creating === kind ? null : kind)}>{t(kind === "category" ? "cadastro.addCategory" : "cadastro.addTag")}</Button> : null}
          {items.length === 0 ? <p className="text-sm text-muted-foreground">{t(kind === "category" ? "taxonomy.emptyCategories" : "taxonomy.emptyTags")}</p> : null}
        </div>
        {creating === kind && canManage ? <InlineTaxonomyCreate key={kind} kind={kind} categories={categories} onSavingChange={setInlineSaving} onClose={() => setCreating(null)} onCreated={(item) => {
          if (kind === "category") {
            setCategories((current) => [...current, item as TaxonomyCategory])
            if (assign) setCategoryIds((current) => [...current, item.id])
          } else {
            setTags((current) => [...current, item])
            if (assign) setTagIds((current) => [...current, item.id])
          }
          setCreating(null)
        }} /> : null}
      </section>
    })}
    {product && assign ? <Button type="button" variant="outline" className="min-h-11" disabled={busy || creating !== null} onClick={() => void save()}>{t("assistant.saveStep")}</Button> : null}
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
