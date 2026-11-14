import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormGrid, FormRow, FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wizard, type WizardStep } from "@/components/wizard/Wizard"
import { buildResourceTypePreview } from "@/features/assets/resourceTypes/resourceTypePreview"
import {
  toResourceTypeView,
  type ResourceTypeArticle,
  type ResourceTypeResponseType,
  type ResourceTypeView,
  type ResourceTypeVisibility,
} from "@/features/assets/resourceTypes/resourceTypeModel"
import {
  createResourceType,
  getResourceType,
  updateResourceType,
  type ResourceTypeRecord,
  type ResourceTypeWrite,
} from "@/features/assets/resourceTypes/resourceTypesService"

const STEPS = ["name", "capabilities", "fields", "review"] as const
type StepId = (typeof STEPS)[number]
const STEP_LABEL = {
  name: "assets.resourceTypes.wizard.stepName",
  capabilities: "assets.resourceTypes.wizard.stepCapabilities",
  fields: "assets.resourceTypes.wizard.stepFields",
  review: "assets.resourceTypes.wizard.stepReview",
} as const

type DraftField = {
  localId: string
  key: string
  name: string
  responseType: ResourceTypeResponseType
  options: string
  visibility: ResourceTypeVisibility
  required: boolean
  filterable: boolean
  askOnBooking: boolean
}

type Draft = {
  key: string
  name: string
  singular: string
  plural: string
  article: ResourceTypeArticle
  capabilities: { bookable: boolean; deliverable: boolean; maintenance: boolean }
  fields: DraftField[]
}

const emptyDraft = (): Draft => ({
  key: "",
  name: "",
  singular: "",
  plural: "",
  article: "um",
  capabilities: { bookable: false, deliverable: false, maintenance: false },
  fields: [],
})

function slug(value: string, fallback: string) {
  const folded = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return folded || fallback
}

function splitOptions(value: string) {
  return value.split(",").map((option) => option.trim()).filter(Boolean)
}

function draftFromRecord(record: ResourceTypeRecord): Draft {
  const view = toResourceTypeView(record)
  return {
    key: view.key,
    name: view.name,
    singular: record.singular?.trim() || view.singular,
    plural: record.plural?.trim() || view.plural,
    article: view.article,
    capabilities: view.capabilities,
    fields: view.fields.map((field) => ({
      localId: field.key,
      key: field.key,
      name: field.name,
      responseType: field.responseType,
      options: field.options.join(", "),
      visibility: field.visibility,
      required: field.required,
      filterable: field.filterable,
      askOnBooking: field.askOnBooking,
    })),
  }
}

function viewFromDraft(draft: Draft): ResourceTypeView {
  return toResourceTypeView({
    id: "00000000-0000-4000-8000-000000000000",
    key: draft.key || "tipo",
    name: draft.name,
    singular: draft.singular,
    plural: draft.plural,
    article: draft.article,
    capabilities: draft.capabilities,
    fields: draft.fields.map((field, index) => ({
      key: field.key || `campo-${index + 1}`,
      type: field.responseType,
      required: field.required,
      label: field.name,
      name: field.name,
      visibility: field.visibility,
      filterable: field.visibility === "public" && field.filterable,
      askOnBooking: field.visibility === "public" && field.askOnBooking,
      options: splitOptions(field.options),
      responseType: field.responseType,
    })),
  })
}

function writeFromDraft(draft: Draft): ResourceTypeWrite {
  const used = new Set<string>()
  return {
    key: draft.key || slug(draft.name, "tipo"),
    name: draft.name.trim(),
    singular: draft.singular.trim(),
    plural: draft.plural.trim(),
    article: draft.article,
    capabilities: draft.capabilities,
    fields: draft.fields.map((field, index) => {
      let key = field.key || slug(field.name, `campo-${index + 1}`)
      while (used.has(key)) key = `${key}-${index + 1}`
      used.add(key)
      const options = field.responseType === "list" ? splitOptions(field.options) : []
      return {
        key,
        type: field.responseType,
        required: field.required,
        label: field.name.trim(),
        name: field.name.trim(),
        visibility: field.visibility,
        filterable: field.visibility === "public" && field.filterable,
        askOnBooking: field.visibility === "public" && field.askOnBooking,
        options,
        responseType: field.responseType,
      }
    }),
  }
}

export function ResourceTypeWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { typeId } = useParams()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [step, setStep] = useState(0)
  const [missing, setMissing] = useState<string[]>([])
  const [stepError, setStepError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(typeId))
  const [saving, setSaving] = useState(false)
  const view = useMemo(() => viewFromDraft(draft), [draft])
  const preview = buildResourceTypePreview(view)

  useEffect(() => {
    if (!typeId) return
    const controller = new AbortController()
    getResourceType(typeId)
      .then((record) => {
        if (!controller.signal.aborted) setDraft(draftFromRecord(record))
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("assets.resourceTypes.errors.load"))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [t, typeId])

  function updateField(localId: string, patch: Partial<DraftField>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => field.localId === localId ? { ...field, ...patch } : field),
    }))
  }

  function gapsFor(stepId: StepId | "all"): string[] {
    const gaps: string[] = []
    if (stepId === "name" || stepId === "all") {
      if (!draft.name.trim()) gaps.push("name")
      if (!draft.singular.trim()) gaps.push("singular")
      if (!draft.plural.trim()) gaps.push("plural")
    }
    if ((stepId === "fields" || stepId === "all") && draft.fields.some((field) => !field.name.trim())) gaps.push("fieldName")
    return gaps
  }

  const gapLabel = (gap: string) => t(`assets.resourceTypes.wizard.missing${gap[0]?.toUpperCase()}${gap.slice(1)}`)

  function reportGaps(gaps: string[]): string | null {
    setMissing(gaps)
    if (gaps.length === 0) return null
    queueMicrotask(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus())
    return `${t("assets.resourceTypes.wizard.missingTitle")} ${gaps.map(gapLabel).join(", ")}`
  }

  async function save() {
    const message = reportGaps(gapsFor("all"))
    if (message) {
      setStepError(message)
      return
    }
    setStepError(null)
    setSaving(true)
    try {
      const body = writeFromDraft(draft)
      if (typeId) await updateResourceType(typeId, body)
      else await createResourceType(body)
      void navigate("/ativos/tipos")
    } catch (error: unknown) {
      setStepError(error instanceof Error ? error.message : t("assets.resourceTypes.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  const steps: WizardStep[] = STEPS.map((id) => ({
    id,
    label: t(STEP_LABEL[id]),
    validate: id === "name" || id === "fields" ? () => reportGaps(gapsFor(id)) : undefined,
  }))

  const header = {
    title: draft.name.trim() || t("assets.resourceTypes.wizard.untitled"),
    back: { to: "/ativos/tipos", label: t("assets.resourceTypes.wizard.cancel") },
  }

  if (loading) return <Page header={header} state="loading"><div /></Page>
  if (loadError) return <Page header={header} state="error" error={loadError} onRetry={() => void navigate(0)}><div /></Page>

  const edit = (index: number, label: string) => (
    <Button type="button" variant="ghost" aria-label={`${t("assets.resourceTypes.wizard.edit")} ${t(label)}`} onClick={() => setStep(index)}>{t("assets.resourceTypes.wizard.edit")}</Button>
  )

  const review = (
    <FormSection title={t(STEP_LABEL.review)}>
      <div className="grid gap-4 text-sm">
        <section>
          <h3 className="font-medium">{draft.name}</h3>
          <p>{draft.singular} / {draft.plural}</p>
          {edit(0, STEP_LABEL.name)}
        </section>
        <ul>
          {(["bookable", "deliverable", "maintenance"] as const).map((key) => (
            <li key={key}>{t(`assets.resourceTypes.wizard.${key}`)} · {draft.capabilities[key] ? t("assets.resourceTypes.wizard.on") : t("assets.resourceTypes.wizard.off")}</li>
          ))}
        </ul>
        {edit(1, STEP_LABEL.capabilities)}
        {draft.fields.length === 0 ? <p>{t("assets.resourceTypes.wizard.noFields")}</p> : (
          <ul>
            {draft.fields.map((field) => <li key={field.localId}>{field.name.trim() || t("assets.resourceTypes.wizard.unnamed")} · {t(`assets.resourceTypes.wizard.${field.visibility}`)}</li>)}
          </ul>
        )}
        {edit(2, STEP_LABEL.fields)}
      </div>
    </FormSection>
  )

  function body(index: number) {
    const stepId = STEPS[index] ?? "name"
    if (stepId === "name") {
      return (
        <FormSection title={t(STEP_LABEL.name)}>
          <FormGrid>
            <FormRow label={t("assets.resourceTypes.wizard.name")} htmlFor="rt-name">
              <Input aria-invalid={!draft.name.trim() && missing.includes("name")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </FormRow>
            <FormRow label={t("assets.resourceTypes.wizard.singular")} htmlFor="rt-singular">
              <Input aria-invalid={!draft.singular.trim() && missing.includes("singular")} value={draft.singular} onChange={(event) => setDraft({ ...draft, singular: event.target.value })} />
            </FormRow>
            <FormRow label={t("assets.resourceTypes.wizard.plural")} htmlFor="rt-plural">
              <Input aria-invalid={!draft.plural.trim() && missing.includes("plural")} value={draft.plural} onChange={(event) => setDraft({ ...draft, plural: event.target.value })} />
            </FormRow>
            <div role="radiogroup" aria-label={t("assets.resourceTypes.wizard.article")} className="flex gap-4">
              {(["um", "uma"] as const).map((article) => (
                <Label key={article} className="min-h-11 font-normal">
                  <input
                    type="radio"
                    name="article"
                    value={article}
                    checked={draft.article === article}
                    onChange={() => setDraft({ ...draft, article })}
                  />
                  {t(article === "um" ? "assets.resourceTypes.wizard.articleUm" : "assets.resourceTypes.wizard.articleUma")}
                </Label>
              ))}
            </div>
            <p>{t("assets.resourceTypes.wizard.choose", { article: draft.article, singular: draft.singular || "…" })}</p>
            <p>{t("assets.resourceTypes.wizard.available", { count: 3, plural: draft.plural || "…" })}</p>
          </FormGrid>
        </FormSection>
      )
    }
    if (stepId === "capabilities") {
      return (
        <FormSection title={t(STEP_LABEL.capabilities)} description={t("assets.resourceTypes.wizard.capabilityHelp")}>
          <div className="grid gap-1">
            {(["bookable", "deliverable", "maintenance"] as const).map((key) => (
              <Label key={key} className="min-h-11 font-normal">
                <Checkbox checked={draft.capabilities[key]} onChange={(event) => setDraft({ ...draft, capabilities: { ...draft.capabilities, [key]: event.target.checked } })} />
                {t(`assets.resourceTypes.wizard.${key}`)}
              </Label>
            ))}
          </div>
        </FormSection>
      )
    }
    return (
      <FormSection title={t(STEP_LABEL.fields)}>
        <div className="grid gap-4">
          {draft.fields.map((field) => (
            <fieldset key={field.localId} className="grid gap-3 rounded-lg border p-3">
              <FormGrid>
                <FormRow label={t("assets.resourceTypes.wizard.fieldName")} htmlFor={`rt-field-${field.localId}`}>
                  <Input aria-invalid={!field.name.trim() && missing.includes("fieldName")} value={field.name} onChange={(event) => updateField(field.localId, { name: event.target.value })} />
                </FormRow>
                {field.responseType === "list" ? (
                  <FormRow label={t("assets.resourceTypes.wizard.options")} htmlFor={`rt-options-${field.localId}`}>
                    <Input value={field.options} onChange={(event) => updateField(field.localId, { options: event.target.value })} />
                  </FormRow>
                ) : null}
              </FormGrid>
              <div role="group" aria-label={t("assets.resourceTypes.wizard.responseType")} className="flex flex-wrap gap-2">
                {(["text", "list", "number"] as const).map((responseType) => (
                  <Button key={responseType} type="button" variant={field.responseType === responseType ? "default" : "outline"} onClick={() => updateField(field.localId, { responseType })}>
                    {t(`assets.resourceTypes.wizard.${responseType}`)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["public", "internal"] as const).map((visibility) => (
                  <Button key={visibility} type="button" variant={field.visibility === visibility ? "default" : "outline"} onClick={() => updateField(field.localId, { visibility, filterable: visibility === "public" && field.filterable, askOnBooking: visibility === "public" && field.askOnBooking })}>
                    {t(`assets.resourceTypes.wizard.${visibility}`)}
                  </Button>
                ))}
              </div>
              <Label className="min-h-11 font-normal">
                <Checkbox checked={field.required} onChange={(event) => updateField(field.localId, { required: event.target.checked })} />
                {t("assets.resourceTypes.wizard.required")}
              </Label>
              <Label className="min-h-11 font-normal">
                <Checkbox checked={field.filterable} disabled={field.visibility === "internal"} onChange={(event) => updateField(field.localId, { filterable: event.target.checked })} />
                {t("assets.resourceTypes.wizard.filter")}
              </Label>
              <Label className="min-h-11 font-normal">
                <Checkbox checked={field.askOnBooking} disabled={field.visibility === "internal"} onChange={(event) => updateField(field.localId, { askOnBooking: event.target.checked })} />
                {t("assets.resourceTypes.wizard.ask")}
              </Label>
              <Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((item) => item.localId !== field.localId) })}>
                {t("assets.resourceTypes.wizard.removeField")}
              </Button>
            </fieldset>
          ))}
          <Button type="button" variant="outline" onClick={() => setDraft({
            ...draft,
            fields: [...draft.fields, { localId: crypto.randomUUID(), key: "", name: "", responseType: "text", options: "", visibility: "public", required: false, filterable: false, askOnBooking: false }],
          })}>
            {t("assets.resourceTypes.wizard.addField")}
          </Button>
        </div>
      </FormSection>
    )
  }

  return (
    <Page header={header}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Wizard
          steps={steps}
          stepIndex={step}
          onStepChange={(index) => { setStep(index); setStepError(null) }}
          ariaLabel={t("assets.resourceTypes.wizard.steps")}
          backLabel={t("assets.resourceTypes.wizard.back")}
          nextLabel={t("assets.resourceTypes.wizard.continue")}
          finishLabel={t("assets.resourceTypes.wizard.save")}
          onFinish={save}
          busy={saving}
          stepError={stepError}
          finalReview={review}
        >
          {body}
        </Wizard>

      <aside aria-label={t("assets.resourceTypes.wizard.previewTitle")} className="rounded-lg border p-4">
        <h2 className="font-medium">{t("assets.resourceTypes.wizard.previewTitle")}</h2>
        <p>{t("assets.resourceTypes.wizard.choose", { article: view.article, singular: view.singular || "…" })}</p>
        <p>{t("assets.resourceTypes.wizard.available", { count: 3, plural: view.plural || "…" })}</p>
        {preview.filters.map((filter) => (
          <div key={filter.name}>
            <p>{t("assets.resourceTypes.wizard.filterBy", { name: filter.name.toLocaleLowerCase() })}</p>
            <p>{t("assets.resourceTypes.wizard.all")} {filter.options.join(" ")}</p>
          </div>
        ))}
        <ul>
          {preview.people.map((person) => (
            <li key={person.initials}>
              {person.initials} {person.name} {person.tag ?? ""} {person.unavailable ? t("assets.resourceTypes.wizard.unavailable") : ""}
            </li>
          ))}
        </ul>
        <p>{preview.showHours ? t("assets.resourceTypes.wizard.chooseTime") : t("assets.resourceTypes.wizard.noTime")}</p>
        {preview.showHours ? null : <p>{t("assets.resourceTypes.wizard.requestHint")}</p>}
        {preview.showDelivery ? <p>{t("assets.resourceTypes.wizard.receive")} {t("assets.resourceTypes.wizard.onSite")} {t("assets.resourceTypes.wizard.delivery")}</p> : null}
        {preview.questions.map((question) => (
          <p key={question.name}>{question.name} {question.required ? "*" : t("common.optional")} {question.options.join(" ") || (question.responseType === "number" ? "0" : t("assets.resourceTypes.wizard.writeHere"))}</p>
        ))}
        <p>{preview.action === "book" ? t("assets.resourceTypes.wizard.book") : t("assets.resourceTypes.wizard.request")}</p>
        <p>{preview.hiddenCount > 0 ? t("assets.resourceTypes.wizard.hidden", { count: preview.hiddenCount }) : t("assets.resourceTypes.wizard.hiddenNone")}</p>
      </aside>
      </div>
    </Page>
  )
}
