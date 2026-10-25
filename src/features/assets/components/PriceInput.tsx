import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { formatPriceForInput, MAX_PRICE, parseLocalePrice } from "@/lib/parseLocalePrice"

type PriceInputProps = {
  id?: string
  value: number
  invalid?: boolean
  onChange: (value: number) => void
}

/** Text price field that accepts pt-BR decimals ("12,5") and shows inline errors. Emits NaN when invalid. */
export function PriceInput({ id, value, invalid, onChange }: PriceInputProps) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState(() => formatPriceForInput(value))
  const [touched, setTouched] = useState(false)

  const [syncedValue, setSyncedValue] = useState(value)

  // Resync the text only when the value changes from outside (e.g. pattern switch, load).
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value)
    const current = parseLocalePrice(text)
    const externalChange = current.ok ? current.value !== value : Number.isFinite(value)
    if (externalChange) setText(formatPriceForInput(value))
  }

  const parsed = parseLocalePrice(text)
  const showError = !parsed.ok && (touched || Boolean(invalid))
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
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : undefined}
        onBlur={() => {
          setTouched(true)
        }}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const result = parseLocalePrice(next)
          onChange(result.ok ? result.value : Number.NaN)
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
