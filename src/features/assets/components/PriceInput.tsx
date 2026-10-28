import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { formatPriceForInput, MAX_PRICE, parseLocalePrice } from "@/lib/parseLocalePrice"

type PriceInputProps = {
  id?: string
  value: number
  invalid?: boolean
  /** Blank is allowed and emitted as 0 (e.g. a day without a price in the per-day editor). */
  allowEmpty?: boolean
  onChange: (value: number) => void
}

/** Text price field that accepts pt-BR decimals ("12,5") and shows inline errors. Emits NaN when invalid. */
export function PriceInput({ id, value, invalid, allowEmpty = false, onChange }: PriceInputProps) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState(() => formatPriceForInput(value))
  const [touched, setTouched] = useState(false)

  const [syncedValue, setSyncedValue] = useState(value)

  // Resync the text only when the value changes from outside (e.g. pattern switch, load).
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value)
    const current = parseLocalePrice(text)
    const externalChange = current.ok ? current.value !== value : Number.isFinite(value) && value !== 0
    if (externalChange) setText(formatPriceForInput(value))
  }

  const parsed = parseLocalePrice(text)
  const blankAllowed = allowEmpty && !parsed.ok && parsed.error === "required"
  const showError = !parsed.ok && !blankAllowed && (touched || Boolean(invalid))
  const errorId = id ? `${id}-error` : undefined

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={text}
        aria-required={!allowEmpty || undefined}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : undefined}
        onBlur={() => {
          setTouched(true)
        }}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const result = parseLocalePrice(next)
          if (result.ok) onChange(result.value)
          else onChange(allowEmpty && result.error === "required" ? 0 : Number.NaN)
        }}
      />
      {showError ? (
        <p id={errorId} className="text-xs text-destructive">
          {t(`assets.wizard.pricing.priceErrors.${parsed.error}`, {
            max: MAX_PRICE.toLocaleString(i18n.language),
          })}
        </p>
      ) : null}
    </div>
  )
}
