/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { archiveVisualTemplate, deleteVisualTag, getTenantSegments, listAdminVisualTemplates, listVisualRevisions, listVisualTags, publishVisualRevision, replaceTenantSegments, saveVisualRevision, saveVisualTag, saveVisualTemplate, type VisualTag, type VisualTemplate } from "@/features/rentals/services/resourceVisualService"

const blankRevision = { floorSvg: "<rect width=\"100\" height=\"60\" fill=\"#D1D5DB\"/>", linesSvg: "", netSvg: "", viewBox: "0 0 100 60", aspectRatio: "1.6667", defaultColor: "#4D6A92", defaultIcon: "layout-template", suggestedSlotMinutes: "60", suggestedCapacityPeople: "" }
const localized = (value: Record<string, string | null> | undefined, language: string) => value?.[language] ?? value?.["pt-BR"] ?? ""

export function ResourceVisualCatalogPage() {
  const { t, i18n } = useTranslation()
  const { id: tenantId } = useParams<{ id?: string }>()
  const [templates, setTemplates] = useState<VisualTemplate[]>([])
  const [tags, setTags] = useState<VisualTag[]>([])
  const [segments, setSegments] = useState<string[]>([])
  const segmentsDirty = useRef(false)
  const currentTenantId = useRef(tenantId)
  useEffect(() => { currentTenantId.current = tenantId }, [tenantId])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<VisualTemplate | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagName, setTagName] = useState("")
  const [tagSlug, setTagSlug] = useState("")
  const [tagToDelete, setTagToDelete] = useState<VisualTag | null>(null)
  const [revision, setRevision] = useState(blankRevision)
  const [draftRevision, setDraftRevision] = useState<{ id: string; version: number } | null>(null)
  const language = i18n.resolvedLanguage ?? "pt-BR"

  useEffect(() => {
    segmentsDirty.current = false
    setSegments([])
  }, [tenantId])

  const load = useCallback(async () => {
    const requestedTenantId = tenantId
    setLoading(true)
    try {
      const [page, tagList, tenantSegments] = await Promise.all([listAdminVisualTemplates(search, true), listVisualTags(), tenantId ? getTenantSegments(tenantId) : Promise.resolve([])])
      setTemplates(page.items); setTags(tagList)
      if (requestedTenantId === currentTenantId.current && !segmentsDirty.current) setSegments(tenantSegments.map((tag) => tag.id))
    } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) }
    finally { setLoading(false) }
  }, [search, t, tenantId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    void listVisualRevisions(editing.id).then((revisions) => {
      const draft = revisions.find((entry) => entry.publishedAt === null)
      if (cancelled || !draft) return
      setDraftRevision({ id: draft.metadata.id, version: draft.metadata.version })
      setRevision({ floorSvg: draft.floorSvg, linesSvg: draft.linesSvg ?? "", netSvg: draft.netSvg ?? "", viewBox: draft.metadata.viewBox, aspectRatio: String(draft.metadata.aspectRatio), defaultColor: draft.metadata.defaultColor, defaultIcon: draft.metadata.defaultIcon, suggestedSlotMinutes: String(draft.metadata.suggestedSlotMinutes ?? ""), suggestedCapacityPeople: String(draft.metadata.suggestedCapacityPeople ?? "") })
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [editing])
  const segmentTags = useMemo(() => tags.filter((tag) => tag.kind === "Segment"), [tags])
  const enabledTemplates = useMemo(() => templates.filter((template) => template.tags.some((tag) => segments.includes(tag.id))), [segments, templates])
  const toggleTag = (id: string) => setSelectedTags((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  function openTemplate(template: VisualTemplate | null) { setEditing(template); setName(template ? localized(template.nameI18n, language) : ""); setSlug(template?.slug ?? ""); setDescription(template ? localized(template.descriptionI18n, language) : ""); setSelectedTags(template?.tags.map((tag) => tag.id) ?? []); setRevision(blankRevision); setDraftRevision(null) }
  async function saveTemplate() { if (!name.trim() || !slug.trim()) return; setBusy(true); try { const saved = await saveVisualTemplate({ slug: slug.trim(), nameI18n: { ...(editing?.nameI18n ?? {}), [language]: name.trim() }, descriptionI18n: { ...(editing?.descriptionI18n ?? {}), [language]: description.trim() || null }, tagIds: selectedTags, isActive: editing?.isActive ?? true, sortOrder: editing?.sortOrder ?? 0, expectedVersion: editing?.version }, editing?.id); openTemplate(saved); await load(); toast.success(t("resourceVisual.saved")) } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  async function saveDraft() { if (!editing) return; setBusy(true); try { const draft = await saveVisualRevision(editing.id, { ...revision, linesSvg: revision.linesSvg || null, netSvg: revision.netSvg || null, aspectRatio: Number(revision.aspectRatio), suggestedSlotMinutes: Number(revision.suggestedSlotMinutes) || null, suggestedCapacityPeople: Number(revision.suggestedCapacityPeople) || null, ...(draftRevision ? { expectedVersion: draftRevision.version } : {}) }, draftRevision?.id); setDraftRevision({ id: draft.metadata.id, version: draft.metadata.version }); toast.success(t("resourceVisual.saved")) } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  async function publishDraft() { if (!editing || !draftRevision) return; setBusy(true); try { await publishVisualRevision(editing.id, draftRevision.id); setDraftRevision(null); await load(); toast.success(t("resourceVisual.published")) } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  async function saveTag() { if (!tagName.trim() || !tagSlug.trim()) { toast.error(t("resourceVisual.validation")); return }; setBusy(true); try { await saveVisualTag({ slug: tagSlug.trim(), kind: "Segment", facet: "segment", nameI18n: { "pt-BR": tagName.trim(), en: tagName.trim(), es: tagName.trim() }, isActive: true, sortOrder: 0 }); setTagName(""); setTagSlug(""); toast.success(t("resourceVisual.saved")); await load() } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  async function confirmDeleteTag() { if (!tagToDelete) return; setBusy(true); try { await deleteVisualTag(tagToDelete.id); setTagToDelete(null); toast.success(t("resourceVisual.saved")); await load() } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  async function saveSegments() { if (!tenantId) return; setBusy(true); try { const saved = await replaceTenantSegments(tenantId, segments); segmentsDirty.current = false; setSegments(saved.map((tag) => tag.id)); toast.success(t("resourceVisual.saved")) } catch (error) { toast.error(error instanceof Error ? error.message : t("resourceVisual.error")) } finally { setBusy(false) } }
  if (loading) return <PageContentSkeleton rows={6} />
  if (tenantId) return <section className="mx-auto max-w-3xl space-y-5 p-6"><div><h1 className="text-2xl font-semibold">{t("resourceVisual.segmentsTitle")}</h1><p className="text-muted-foreground">{t("resourceVisual.segmentsHelp")}</p></div><div className="grid gap-2 sm:grid-cols-2">{segmentTags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center gap-2 rounded border p-3"><input type="checkbox" checked={segments.includes(tag.id)} onChange={() => { segmentsDirty.current = true; setSegments((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id]) }} />{localized(tag.nameI18n, language)}</label>)}</div><Button type="button" disabled={busy} onClick={() => void saveSegments()}>{t("common.save")}</Button><div className="space-y-2"><h2 className="font-medium">{t("resourceVisual.enabledTemplates")}</h2>{enabledTemplates.length === 0 ? <p className="text-sm text-muted-foreground">{t("resourceVisual.noEnabledTemplates")}</p> : <ul className="space-y-2">{enabledTemplates.map((template) => <li key={template.id} className="rounded border p-3"><strong>{localized(template.nameI18n, language)}</strong><div className="mt-2 flex flex-wrap gap-1">{template.tags.map((tag) => <Badge key={tag.id} variant="secondary">{localized(tag.nameI18n, language)}</Badge>)}</div></li>)}</ul>}</div></section>
  return <section className="mx-auto max-w-6xl space-y-6 p-6"><div><h1 className="text-2xl font-semibold">{t("resourceVisual.title")}</h1><p className="text-muted-foreground">{t("resourceVisual.help")}</p></div><div className="grid gap-6 lg:grid-cols-[1fr_24rem]"><div className="space-y-3"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("common.searchPlaceholder")} aria-label={t("common.searchPlaceholder")} /><div className="space-y-2">{templates.map((template) => <button type="button" key={template.id} className="w-full rounded border p-3 text-left hover:bg-muted" onClick={() => openTemplate(template)}><strong>{localized(template.nameI18n, language)}</strong><span className="ml-2 text-sm text-muted-foreground">{template.slug}</span><div className="mt-2 flex flex-wrap gap-1">{template.tags.map((tag) => <Badge key={tag.id} variant="secondary">{localized(tag.nameI18n, language)}</Badge>)}</div></button>)}</div><Button type="button" variant="outline" onClick={() => openTemplate(null)}>{t("resourceVisual.newTemplate")}</Button></div><div className="space-y-3 rounded-lg border p-4"><h2 className="font-medium">{editing ? t("resourceVisual.editTemplate") : t("resourceVisual.newTemplate")}</h2>{editing ? <p className="text-sm text-muted-foreground">{draftRevision ? t("resourceVisual.draft") : editing.publishedRevision ? t("resourceVisual.publishedStatus") : t("resourceVisual.noRevision")}</p> : null}<label className="block text-sm">{t("resourceVisual.name")}<Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm">{t("resourceVisual.slug")}<Input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label className="block text-sm">{t("resourceVisual.description")}<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="space-y-1">{tags.map((tag) => <label key={tag.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => toggleTag(tag.id)}/>{localized(tag.nameI18n, language)}</label>)}</div><Button type="button" disabled={busy} onClick={() => void saveTemplate()}>{t("common.save")}</Button>{editing ? <><Button type="button" variant="outline" disabled={busy} onClick={() => openTemplate(null)}>{t("resourceVisual.cancelEdit")}</Button><details><summary>{t("resourceVisual.revision")}</summary><div className="space-y-2 pt-2"><label className="block text-sm">{t("resourceVisual.floor")}<Textarea value={revision.floorSvg} onChange={(event) => setRevision({ ...revision, floorSvg: event.target.value })}/></label><label className="block text-sm">{t("resourceVisual.lines")}<Textarea value={revision.linesSvg} onChange={(event) => setRevision({ ...revision, linesSvg: event.target.value })}/></label><label className="block text-sm">ViewBox<Input value={revision.viewBox} onChange={(event) => setRevision({ ...revision, viewBox: event.target.value })}/></label><label className="block text-sm">Aspect ratio<Input value={revision.aspectRatio} onChange={(event) => setRevision({ ...revision, aspectRatio: event.target.value })}/></label><label className="block text-sm">Color<Input value={revision.defaultColor} onChange={(event) => setRevision({ ...revision, defaultColor: event.target.value })}/></label><Button type="button" disabled={busy} onClick={() => void saveDraft()}>{t("common.save")}</Button>{draftRevision ? <Button type="button" disabled={busy} onClick={() => void publishDraft()}>{t("resourceVisual.publish")}</Button> : null}</div></details><Button type="button" variant="destructive" disabled={busy} onClick={() => void archiveVisualTemplate(editing.id).then(load)}>{t("common.delete")}</Button></> : null}</div></div><div className="rounded-lg border p-4"><h2 className="font-medium">{t("resourceVisual.tags")}</h2><div className="mt-2 flex gap-2"><Input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder={t("resourceVisual.name")} aria-label={t("resourceVisual.name")}/><Input value={tagSlug} onChange={(event) => setTagSlug(event.target.value)} placeholder={t("resourceVisual.slug")} aria-label={t("resourceVisual.slug")}/><Button type="button" disabled={busy} onClick={() => void saveTag()}>{t("common.add")}</Button></div><ul className="mt-3 space-y-1">{tags.map((tag) => <li className="flex justify-between" key={tag.id}><span>{localized(tag.nameI18n, language)}</span><Button type="button" variant="ghost" size="sm" onClick={() => setTagToDelete(tag)}>{t("common.delete")}</Button></li>)}</ul></div><AlertDialog open={tagToDelete !== null} onOpenChange={(open) => { if (!open && !busy) setTagToDelete(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("resourceVisual.deleteTagTitle")}</AlertDialogTitle><AlertDialogDescription>{t("resourceVisual.deleteTagDescription")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy} /><AlertDialogAction disabled={busy} onClick={() => void confirmDeleteTag()}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>
}
