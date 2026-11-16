import { useEffect, useId, useRef, useState } from "react"
import { Folder } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { slugify } from "@/features/assistant/taxonomySlug"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taxonomyMutationSchema, type TaxonomyCategory } from "@/features/taxonomy/schemas/taxonomySchemas"
import { createTaxonomyCategory } from "@/features/taxonomy/services/taxonomyService"

const NO_PARENT = "__none__"

type Props = { open: boolean; categories: TaxonomyCategory[]; onOpenChange: (open: boolean) => void; onSavingChange: (saving: boolean) => void; onCreated: (category: TaxonomyCategory) => void }

/** Create a shared category without leaving the product cadastro; the caller selects it for the product. */
export function CategoryCreateDialog({ open, categories, onOpenChange, onSavingChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false)
  return <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
    <DialogContent className="sm:max-w-md">
      <CategoryCreateForm categories={categories} onCancel={() => onOpenChange(false)} onSubmittingChange={(value) => { setSubmitting(value); onSavingChange(value) }} onCreated={onCreated} />
    </DialogContent>
  </Dialog>
}

function CategoryCreateForm({ categories, onCancel, onSubmittingChange, onCreated }: { categories: TaxonomyCategory[]; onCancel: () => void; onSubmittingChange: (submitting: boolean) => void; onCreated: (category: TaxonomyCategory) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string | null>(null)
  const [editingSlug, setEditingSlug] = useState(false)
  const [customSlug, setCustomSlug] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  useEffect(() => () => onSubmittingChange(false), [onSubmittingChange])

  // The taxonomy permits three levels. Only roots and their children can be parents.
  const parents = categories.filter((category) => category.parentId === null || categories.some((parent) => parent.id === category.parentId && parent.parentId === null))
  const parent = categories.find((item) => item.id === parentId)
  const slug = editingSlug ? customSlug : slugify(name)
  const parsed = taxonomyMutationSchema.safeParse({ name, slug, parentId, icon: null, sortOrder: 0 })
  const slugInvalid = editingSlug && customSlug !== "" && !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === "slug")
  const parentItems = [{ value: NO_PARENT, label: t("cadastro.noParent") }, ...parents.map((item) => ({ value: item.id, label: item.name }))]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (guard.current || !parsed.success) return
    guard.current = true
    setSubmitting(true)
    onSubmittingChange(true)
    setError(null)
    try {
      onCreated(await createTaxonomyCategory(parsed.data))
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t("apiErrors.saveTaxonomy"))
      guard.current = false
      setSubmitting(false)
      onSubmittingChange(false)
    }
  }

  return <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
    <DialogHeader>
      <DialogTitle>{t("cadastro.categoryDialogTitle")}</DialogTitle>
      <DialogDescription>{t("cadastro.categoryDialogDescription")}</DialogDescription>
    </DialogHeader>
    <div className="space-y-1">
      <Label htmlFor={`${id}-name`}>{t("cadastro.categoryNameLabel")}</Label>
      <Input id={`${id}-name`} autoFocus required aria-required="true" className="min-h-11" maxLength={100} value={name} disabled={submitting} aria-invalid={error ? true : undefined} aria-describedby={`${id}-name-help${error ? ` ${id}-error` : ""}`} onChange={(event) => { setName(event.target.value); setError(null) }} />
      <p id={`${id}-name-help`} className="text-xs text-muted-foreground">{t("cadastro.categoryNameHelp")}</p>
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
    <div className="space-y-1">
      <span id={`${id}-parent`} className="text-sm font-medium">{t("cadastro.categoryParentLabel")}</span>
      <Select modal={false} value={parentId ?? NO_PARENT} items={parentItems} disabled={submitting} onValueChange={(value) => setParentId(value === NO_PARENT ? null : value)}>
        <SelectTrigger aria-labelledby={`${id}-parent`} icon={Folder} className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {parentItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {parent && name.trim() ? <p className="text-xs text-muted-foreground">{t("cadastro.categorySubOf", { name: name.trim(), parent: parent.name })}</p> : null}
    </div>
    <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-normal text-muted-foreground" htmlFor={`${id}-slug`}>{t("cadastro.categorySlugLabel")}</Label>
        {editingSlug ? null : <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={submitting} onClick={() => { setCustomSlug(slugify(name)); setEditingSlug(true) }}>{t("cadastro.categorySlugEdit")}</Button>}
      </div>
      {editingSlug
        ? <Input id={`${id}-slug`} className="min-h-9 bg-background" maxLength={80} value={customSlug} disabled={submitting} aria-invalid={slugInvalid ? true : undefined} onChange={(event) => setCustomSlug(event.target.value)} />
        : <output id={`${id}-slug`} className="block min-h-6 text-sm">{slug}</output>}
      {slugInvalid ? <p role="alert" className="text-xs text-destructive">{t("cadastro.categorySlugInvalid")}</p> : null}
    </div>
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p>{t("cadastro.categoryScopeNote")}</p>
      <p>{t("cadastro.categoryAutoSelectNote")}</p>
    </div>
    <DialogFooter>
      <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onCancel}>{t("common.cancel")}</Button>
      <LoadingButton type="submit" className="min-h-11" loading={submitting} disabled={!parsed.success}>{t("cadastro.createAndSelect")}</LoadingButton>
    </DialogFooter>
  </form>
}
