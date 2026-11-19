import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  isAbsentAttribute,
  numericAttribute,
  toSafeHttpUrl,
} from "@/features/assets/lib/assetAttributeSummary"
import { formatAttributeValue, toFormValue } from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"
import type { AssetAttributeValue } from "@/features/assets/schemas/assetSchemas"

type AssetAttributesSummaryProps = {
  fields: readonly AssetFamilyField[]
  attributes: Readonly<Record<string, AssetAttributeValue>>
  className?: string
}

type Block = { group: string | null; fields: AssetFamilyField[] }

const LONGTEXT_CLAMP_THRESHOLD = 160

/** Drops archived fields and fields without a value; consecutive fields with the same group form one block. */
function toBlocks(
  fields: readonly AssetFamilyField[],
  attributes: Readonly<Record<string, AssetAttributeValue>>,
): Block[] {
  const blocks: Block[] = []
  for (const field of fields) {
    if (field.archived || isAbsentAttribute(attributes[field.key])) continue
    const group = field.group?.trim() || null
    const last = blocks[blocks.length - 1]
    if (group && last?.group === group) last.fields.push(field)
    else blocks.push({ group, fields: [field] })
  }
  return blocks
}

function LongText({ text }: { text: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const canClamp = text.length > LONGTEXT_CLAMP_THRESHOLD || text.split("\n").length > 3
  return (
    <div className="min-w-0">
      <p
        className={`whitespace-pre-line [overflow-wrap:anywhere] ${canClamp && !expanded ? "line-clamp-3" : ""}`}
      >
        {text}
      </p>
      {canClamp ? (
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-11 p-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t("assets.attributes.showLess") : t("assets.attributes.showMore")}
        </Button>
      ) : null}
    </div>
  )
}

function ValueView({
  field,
  stored,
  locale,
}: {
  field: AssetFamilyField
  stored: AssetAttributeValue
  locale: string
}) {
  const { t } = useTranslation()

  if (field.type === "select" || field.type === "multiselect") {
    const items = field.type === "multiselect" ? (toFormValue(field, stored) as string[]) : [String(stored)]
    return (
      <span className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]">
            {item}
          </Badge>
        ))}
      </span>
    )
  }

  if (field.type === "boolean") {
    const on = toFormValue(field, stored) === true
    return <span>{on ? t("common.yes") : t("common.no")}</span>
  }

  if (field.type === "url") {
    const raw = String(stored)
    const url = toSafeHttpUrl(raw)
    if (url === null) return <span className="[overflow-wrap:anywhere]">{raw}</span>
    return (
      <a
        href={url.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
      >
        {url.host}
      </a>
    )
  }

  if (field.type === "longtext") return <LongText text={String(stored)} />

  if (field.type === "date" && typeof stored === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stored)
    if (match) {
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
      return <span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)}</span>
    }
  }

  return <span className="[overflow-wrap:anywhere]">{formatAttributeValue(field, stored, locale)}</span>
}

/** `256 × 256 × 256 mm` when every field of the group is a number with the same unit; otherwise null. */
function joinedNumbers(
  block: Block,
  attributes: Readonly<Record<string, AssetAttributeValue>>,
  locale: string,
): string | null {
  if (block.fields.length < 2) return null
  const unit = block.fields[0]?.unit?.trim() || ""
  const parts: string[] = []
  for (const field of block.fields) {
    if (field.type !== "number" || (field.unit?.trim() || "") !== unit) return null
    const value = numericAttribute(attributes[field.key])
    if (value === null) return null
    parts.push(formatAttributeValue({ type: "number", unit: null }, value, locale))
  }
  return `${parts.join(" × ")}${unit ? ` ${unit}` : ""}`
}

/** Read-only view of an asset's family attributes (details sheet). */
export function AssetAttributesSummary({ fields, attributes, className }: AssetAttributesSummaryProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const blocks = toBlocks(fields, attributes)

  const labelOf = (field: AssetFamilyField) =>
    t(`assets.wizard.familyFields.${field.key}`, { defaultValue: field.label ?? field.key })

  const renderPair = (field: AssetFamilyField) => {
    const stored = attributes[field.key]
    if (stored == null) return null
    return (
      <div key={field.key} className="min-w-0 space-y-0.5">
        <dt className="text-xs text-muted-foreground">{labelOf(field)}</dt>
        <dd className="text-sm">
          <ValueView field={field} stored={stored} locale={locale} />
        </dd>
      </div>
    )
  }

  if (blocks.length === 0) {
    return <p className={`text-sm text-muted-foreground ${className ?? ""}`}>{t("assets.attributes.empty")}</p>
  }

  return (
    <div className={`min-w-0 space-y-3 ${className ?? ""}`}>
      {blocks.map((block) => {
        const [first] = block.fields
        if (!first) return null
        if (!block.group) return <dl key={first.key}>{renderPair(first)}</dl>
        const joined = joinedNumbers(block, attributes, locale)
        return (
          <div key={`${block.group}:${first.key}`} role="group" aria-label={block.group} className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{block.group}</p>
            {joined !== null ? (
              <p className="text-sm [overflow-wrap:anywhere]">{joined}</p>
            ) : (
              <dl className="grid min-w-0 gap-2 sm:grid-cols-2">{block.fields.map(renderPair)}</dl>
            )}
          </div>
        )
      })}
    </div>
  )
}
