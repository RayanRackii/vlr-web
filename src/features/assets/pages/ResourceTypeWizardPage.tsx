import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
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

  function missingNow(): string[] {
    const gaps: string[] = []
    if (step === 0) {
      if (!draft.name.trim()) gaps.push("name")
      if (!draft.singular.trim()) gaps.push("singular")
      if (!draft.plural.trim()) gaps.push("plural")
    }
    if (step === 2 && draft.fields.some((field) => !field.name.trim())) gaps.push("fieldName")
    return gaps
  }

  function advance() {
    const gaps = missingNow()
    setMissing(gaps)
    if (gaps.length > 0) {
      queueMicrotask(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus())
      return
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  async function save() {
    const gaps = [
      !draft.name.trim() ? "name" : "",
      !draft.singular.trim() ? "singular" : "",
      !draft.plural.trim() ? "plural" : "",
      draft.fields.some((field) => !field.name.trim()) ? "fieldName" : "",
    ].filter(Boolean)
    setMissing(gaps)
    if (gaps.length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const body = writeFromDraft(draft)
      if (typeId) await updateResourceType(typeId, body)
      else await createResourceType(body)
      void navigate("/ativos/tipos")
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : t("assets.resourceTypes.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p role="status">{t("common.loading")}</p>
  if (loadError) return <p role="alert">{loadError}</p>

  const stepId = STEPS[step] ?? "name"
  return (
    <form
      className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={(event) => {
        event.preventDefault()
        if (stepId === "review") void save()
        else advance()
      }}
    >
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{draft.name.trim() || t("assets.resourceTypes.wizard.untitled")}</h1>
        </header>
        <ol aria-label={t("assets.resourceTypes.wizard.steps")} className="flex flex-wrap gap-3">
          {STEPS.map((id, index) => (
            <li key={id}>
              <button
                type="button"
                className="flex items-center gap-2 text-sm"
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                <span className="grid size-7 place-items-center rounded-full border">{index + 1}</span>
                {" "}
                <span className={index === step ? undefined : "max-sm:sr-only"}>{t(STEP_LABEL[id])}</span>
              </button>
            </li>
          ))}
        </ol>

        {missing.length > 0 ? (
          <div role="alert">
            <p>{t("assets.resourceTypes.wizard.missingTitle")}</p>
            <ul>
              {missing.map((gap) => (
                <li key={gap}>{t(`assets.resourceTypes.wizard.missing${gap[0]?.toUpperCase()}${gap.slice(1)}`)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {stepId === "name" ? (
          <fieldset className="grid gap-4">
            <label className="grid gap-1 text-sm">
              {t("assets.resourceTypes.wizard.name")}
              <Input aria-invalid={!draft.name.trim() && missing.includes("name")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              {t("assets.resourceTypes.wizard.singular")}
              <Input aria-invalid={!draft.singular.trim() && missing.includes("singular")} value={draft.singular} onChange={(event) => setDraft({ ...draft, singular: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              {t("assets.resourceTypes.wizard.plural")}
              <Input aria-invalid={!draft.plural.trim() && missing.includes("plural")} value={draft.plural} onChange={(event) => setDraft({ ...draft, plural: event.target.value })} />
            </label>
            <div role="radiogroup" aria-label={t("assets.resourceTypes.wizard.article")} className="flex gap-4">
              {(["um", "uma"] as const).map((article) => (
                <label key={article} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="article"
                    value={article}
                    checked={draft.article === article}
                    onChange={() => setDraft({ ...draft, article })}
                  />
                  {t(article === "um" ? "assets.resourceTypes.wizard.articleUm" : "assets.resourceTypes.wizard.articleUma")}
                </label>
              ))}
            </div>
            <p>{t("assets.resourceTypes.wizard.choose", { article: draft.article, singular: draft.singular || "…" })}</p>
            <p>{t("assets.resourceTypes.wizard.available", { count: 3, plural: draft.plural || "…" })}</p>
          </fieldset>
        ) : null}

        {stepId === "capabilities" ? (
          <fieldset className="grid gap-3">
            {(["bookable", "deliverable", "maintenance"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.capabilities[key]} onChange={(event) => setDraft({ ...draft, capabilities: { ...draft.capabilities, [key]: event.target.checked } })} />
                {t(`assets.resourceTypes.wizard.${key}`)}
              </label>
            ))}
            <p className="text-sm text-muted-foreground">{t("assets.resourceTypes.wizard.capabilityHelp")}</p>
          </fieldset>
        ) : null}

        {stepId === "fields" ? (
          <div className="grid gap-4">
            {draft.fields.map((field) => (
              <fieldset key={field.localId} className="grid gap-3 rounded-lg border p-3">
                <label className="grid gap-1 text-sm">
                  {t("assets.resourceTypes.wizard.fieldName")}
                  <Input aria-invalid={!field.name.trim() && missing.includes("fieldName")} value={field.name} onChange={(event) => updateField(field.localId, { name: event.target.value })} />
                </label>
                <div role="group" aria-label={t("assets.resourceTypes.wizard.responseType")} className="flex flex-wrap gap-2">
                  {(["text", "list", "number"] as const).map((responseType) => (
                    <Button key={responseType} type="button" variant={field.responseType === responseType ? "default" : "outline"} onClick={() => updateField(field.localId, { responseType })}>
                      {t(`assets.resourceTypes.wizard.${responseType}`)}
                    </Button>
                  ))}
                </div>
                {field.responseType === "list" ? (
                  <label className="grid gap-1 text-sm">
                    {t("assets.resourceTypes.wizard.options")}
                    <Input value={field.options} onChange={(event) => updateField(field.localId, { options: event.target.value })} />
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {(["public", "internal"] as const).map((visibility) => (
                    <Button key={visibility} type="button" variant={field.visibility === visibility ? "default" : "outline"} onClick={() => updateField(field.localId, { visibility, filterable: visibility === "public" && field.filterable, askOnBooking: visibility === "public" && field.askOnBooking })}>
                      {t(`assets.resourceTypes.wizard.${visibility}`)}
                    </Button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.required} onChange={(event) => updateField(field.localId, { required: event.target.checked })} />
                  {t("assets.resourceTypes.wizard.required")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.filterable} disabled={field.visibility === "internal"} onChange={(event) => updateField(field.localId, { filterable: event.target.checked })} />
                  {t("assets.resourceTypes.wizard.filter")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.askOnBooking} disabled={field.visibility === "internal"} onChange={(event) => updateField(field.localId, { askOnBooking: event.target.checked })} />
                  {t("assets.resourceTypes.wizard.ask")}
                </label>
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
        ) : null}

        {stepId === "review" ? (
          <div className="grid gap-4 text-sm">
            <section>
              <h2 className="font-medium">{draft.name}</h2>
              <p>{draft.singular} / {draft.plural}</p>
              <Button type="button" variant="ghost" aria-label={`${t("assets.resourceTypes.wizard.edit")} ${t("assets.resourceTypes.wizard.stepName")}`} onClick={() => setStep(0)}>{t("assets.resourceTypes.wizard.edit")}</Button>
            </section>
            <ul>
              {(["bookable", "deliverable", "maintenance"] as const).map((key) => (
                <li key={key}>{t(`assets.resourceTypes.wizard.${key}`)} · {draft.capabilities[key] ? t("assets.resourceTypes.wizard.on") : t("assets.resourceTypes.wizard.off")}</li>
              ))}
            </ul>
            <Button type="button" variant="ghost" aria-label={`${t("assets.resourceTypes.wizard.edit")} ${t("assets.resourceTypes.wizard.stepCapabilities")}`} onClick={() => setStep(1)}>{t("assets.resourceTypes.wizard.edit")}</Button>
            {draft.fields.length === 0 ? <p>{t("assets.resourceTypes.wizard.noFields")}</p> : (
              <ul>
                {draft.fields.map((field) => <li key={field.localId}>{field.name.trim() || t("assets.resourceTypes.wizard.unnamed")} · {t(`assets.resourceTypes.wizard.${field.visibility}`)}</li>)}
              </ul>
            )}
            <Button type="button" variant="ghost" aria-label={`${t("assets.resourceTypes.wizard.edit")} ${t("assets.resourceTypes.wizard.stepFields")}`} onClick={() => setStep(2)}>{t("assets.resourceTypes.wizard.edit")}</Button>
          </div>
        ) : null}

        {saveError ? <p role="alert">{saveError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline" })} to="/ativos/tipos">{t("assets.resourceTypes.wizard.cancel")}</Link>
          {step > 0 ? <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>{t("assets.resourceTypes.wizard.back")}</Button> : null}
          {stepId === "review"
            ? <Button type="submit" disabled={saving}>{t("assets.resourceTypes.wizard.save")}</Button>
            : <Button type="submit">{t("assets.resourceTypes.wizard.continue")}</Button>}
        </div>
      </div>

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
    </form>
  )
}
