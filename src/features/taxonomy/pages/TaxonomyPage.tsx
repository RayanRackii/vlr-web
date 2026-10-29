import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { taxonomyIconKeys, taxonomyMutationSchema, taxonomyTagMutationSchema, type TaxonomyCategory, type TaxonomyMutationValues, type TaxonomyTag, type TaxonomyTagMutationValues } from "@/features/taxonomy/schemas/taxonomySchemas"
import { createTaxonomyCategory, createTaxonomyTag, deleteTaxonomyCategory, deleteTaxonomyTag, listTaxonomyCategories, listTaxonomyTags, updateTaxonomyCategory, updateTaxonomyTag } from "@/features/taxonomy/services/taxonomyService"

const emptyCategory = (): TaxonomyMutationValues => ({ name: "", slug: "", parentId: null, icon: null, sortOrder: 0 })
const emptyTag = (): TaxonomyTagMutationValues => ({ name: "", slug: "" })
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

export function TaxonomyPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("core.taxonomy.manage")
  const [categories, setCategories] = useState<TaxonomyCategory[]>([])
  const [tags, setTags] = useState<TaxonomyTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<TaxonomyCategory | null>(null)
  const [editingTag, setEditingTag] = useState<TaxonomyTag | null>(null)
  const categoryForm = useForm<TaxonomyMutationValues>({ resolver: zodResolver(taxonomyMutationSchema), defaultValues: emptyCategory() })
  const tagForm = useForm<TaxonomyTagMutationValues>({ resolver: zodResolver(taxonomyTagMutationSchema), defaultValues: emptyTag() })
  const categoryValid = taxonomyMutationSchema.safeParse(useWatch({ control: categoryForm.control })).success
  const tagValid = taxonomyTagMutationSchema.safeParse(useWatch({ control: tagForm.control })).success

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [nextCategories, nextTags] = await Promise.all([listTaxonomyCategories(), listTaxonomyTags()]); setCategories(nextCategories); setTags(nextTags) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("apiErrors.loadTaxonomy")) }
    finally { setLoading(false) }
  }, [t])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request lifecycle owns taxonomy loading state
    void reload()
  }, [reload])

  const orderedCategories = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [categories])
  const orderedTags = useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags])
  const openCategory = (value: TaxonomyCategory | null) => { setEditingCategory(value); categoryForm.reset(value ? { name: value.name, slug: value.slug, parentId: value.parentId, icon: value.icon, sortOrder: value.sortOrder } : emptyCategory()) }
  const openTag = (value: TaxonomyTag | null) => { setEditingTag(value); tagForm.reset(value ? { name: value.name, slug: value.slug } : emptyTag()) }
  const remove = async (kind: "category" | "tag", id: string, name: string) => {
    if (!window.confirm(t("taxonomy.deleteConfirm", { name }))) return
    try { if (kind === "category") await deleteTaxonomyCategory(id); else await deleteTaxonomyTag(id); await reload(); toast.success(t("taxonomy.deleted")) }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : t("apiErrors.deleteTaxonomy")) }
  }

  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
    <PageHeader title={t("taxonomy.title")} description={t("taxonomy.sharedHint")} className="mb-0 sm:mb-0" />
    {error ? <div className="flex min-w-0 flex-wrap items-center gap-2 text-destructive"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void reload()}>{t("catalog.retry")}</Button></div> : null}
    <section className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
      <Section isEmpty={orderedCategories.length === 0 && !error} emptyTitle={t("taxonomy.emptyCategories")} emptyDescription={t("taxonomy.emptyCategoriesHint")} title={t("taxonomy.categories")} addLabel={t("taxonomy.newCategory")} canManage={canManage} loading={loading} onAdd={() => openCategory(null)}>
        <ul className="space-y-2">{orderedCategories.map((item) => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><span className="min-w-0 flex-1 break-words font-medium">{item.name}<small className="block break-all text-xs font-normal text-muted-foreground">{item.slug}</small></span>{canManage ? <Actions onEdit={() => openCategory(item)} onDelete={() => void remove("category", item.id, item.name)} /> : null}</li>)}</ul>
        {canManage ? <Form {...categoryForm}><form className="space-y-3 border-t pt-3" onSubmit={categoryForm.handleSubmit(async (values) => { try { if (editingCategory) await updateTaxonomyCategory(editingCategory.id, { name: values.name, parentId: values.parentId, icon: values.icon, sortOrder: values.sortOrder }); else await createTaxonomyCategory(values); openCategory(null); await reload(); toast.success(t("taxonomy.saved")) } catch (caught) { toast.error(caught instanceof Error ? caught.message : t("apiErrors.saveTaxonomy")) } })}>
          <CategoryFields form={categoryForm} ordered={orderedCategories} editing={editingCategory} t={t} />
          <FormPrimaryButton className="w-full sm:w-auto" type="submit" isValid={categoryValid} loading={categoryForm.formState.isSubmitting}>{t("catalog.products.save")}</FormPrimaryButton>
        </form></Form> : null}
      </Section>
      <Section isEmpty={orderedTags.length === 0 && !error} emptyTitle={t("taxonomy.emptyTags")} emptyDescription={t("taxonomy.emptyTagsHint")} title={t("taxonomy.tags")} addLabel={t("taxonomy.newTag")} canManage={canManage} loading={loading} onAdd={() => openTag(null)}>
        <ul className="space-y-2">{orderedTags.map((item) => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><span className="min-w-0 flex-1 break-words font-medium">{item.name}<small className="block break-all text-xs font-normal text-muted-foreground">{item.slug}</small></span>{canManage ? <Actions onEdit={() => openTag(item)} onDelete={() => void remove("tag", item.id, item.name)} /> : null}</li>)}</ul>
        {canManage ? <Form {...tagForm}><form className="space-y-3 border-t pt-3" onSubmit={tagForm.handleSubmit(async (values) => { try { if (editingTag) await updateTaxonomyTag(editingTag.id, { name: values.name }); else await createTaxonomyTag(values); openTag(null); await reload(); toast.success(t("taxonomy.saved")) } catch (caught) { toast.error(caught instanceof Error ? caught.message : t("apiErrors.saveTaxonomy")) } })}>
          <TagFields form={tagForm} editing={editingTag} t={t} />
          <FormPrimaryButton className="w-full sm:w-auto" type="submit" isValid={tagValid} loading={tagForm.formState.isSubmitting}>{t("catalog.products.save")}</FormPrimaryButton>
        </form></Form> : null}
      </Section>
    </section>
  </div>
}

function Section({ title, addLabel, canManage, loading, isEmpty, emptyTitle, emptyDescription, onAdd, children }: { title: string; addLabel: string; canManage: boolean; loading: boolean; isEmpty: boolean; emptyTitle: string; emptyDescription: string; onAdd: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const addAction = <Button type="button" size="sm" onClick={onAdd}><Plus data-icon="inline-start" />{addLabel}</Button>
  return (
    <Card className="min-w-0 motion-reduce:transition-none">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {canManage && !isEmpty ? <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus data-icon="inline-start" />{addLabel}</Button> : null}
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : <>
          {isEmpty ? <EmptyState size="sm" title={emptyTitle} description={emptyDescription} action={canManage ? addAction : undefined} /> : null}
          {children}
        </>}
      </CardContent>
    </Card>
  )
}
function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <span className="flex shrink-0 flex-wrap gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label="Editar" onClick={onEdit}><Pencil /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label="Excluir" onClick={onDelete}><Trash2 /></Button></span> }
function CategoryFields({ form, ordered, editing, t }: { form: ReturnType<typeof useForm<TaxonomyMutationValues>>; ordered: TaxonomyCategory[]; editing: TaxonomyCategory | null; t: (key: string) => string }) { return <><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.name")}</FormLabel><FormControl><Input className="touch-target min-w-0" {...field} onChange={(event) => { field.onChange(event); if (!editing) form.setValue("slug", slugify(event.target.value), { shouldValidate: true }) }} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="slug" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.slug")}</FormLabel><FormControl><Input className="touch-target min-w-0" {...field} disabled={Boolean(editing)} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="parentId" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.parent")}</FormLabel><FormControl><select className="touch-target h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value || null)}><option value="">—</option>{ordered.filter((item) => item.id !== editing?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormControl></FormItem>} /><FormField control={form.control} name="sortOrder" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.order")}</FormLabel><FormControl><Input className="touch-target tabular-nums" type="number" min="0" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="icon" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.icon")}</FormLabel><FormControl><select className="touch-target h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value || null)}><option value="">—</option>{taxonomyIconKeys.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></FormControl></FormItem>} /></> }
function TagFields({ form, editing, t }: { form: ReturnType<typeof useForm<TaxonomyTagMutationValues>>; editing: TaxonomyTag | null; t: (key: string) => string }) { return <><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.name")}</FormLabel><FormControl><Input className="touch-target min-w-0" {...field} onChange={(event) => { field.onChange(event); if (!editing) form.setValue("slug", slugify(event.target.value), { shouldValidate: true }) }} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="slug" render={({ field }) => <FormItem><FormLabel>{t("taxonomy.slug")}</FormLabel><FormControl><Input className="touch-target min-w-0" {...field} disabled={Boolean(editing)} /></FormControl><FormMessage /></FormItem>} /></> }
