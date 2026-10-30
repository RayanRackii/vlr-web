import { useLayoutEffect, useRef, type ComponentProps } from "react"
import { CalendarDays } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { isCivilDate, parseLocaleCivilDate } from "@/lib/civilDate"
import { formatLocaleCivilDate } from "@/lib/localeFormat"

type CivilDateInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value: string
  locale: string
  onChange: (value: string) => void
}

/** Insert locale date separators while leaving partial groups editable. */
function maskDateText(text: string): string {
  return text.replace(/[^\d/]/g, "").replace(/\/+/g, "/")
    .replace(/^(\d{2})(?=\d)/, "$1/")
    .replace(/^(\d{1,2}\/\d{2})(?=\d)/, "$1/")
    .split("/").slice(0, 3).map((part, index) => part.slice(0, index === 2 ? 4 : 2)).join("/")
}

/** Complete dates become ISO; incomplete text stays in the form for localized validation. */
export function CivilDateInput({ value, locale, onChange, min, max, disabled, className, ...props }: CivilDateInputProps) {
  const { t } = useTranslation()
  const picker = useRef<HTMLInputElement>(null)
  const caret = useRef<{ input: HTMLInputElement; position: number } | null>(null)
  useLayoutEffect(() => {
    if (caret.current) {
      const { input, position } = caret.current
      input.setSelectionRange(position, position)
      caret.current = null
    }
  })

  function change(text: string) {
    const parsed = parseLocaleCivilDate(text, locale) ?? (isCivilDate(text) ? text : null)
    onChange(parsed ?? text)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        lang={locale}
        placeholder={t("common.datePicker.format", { lng: locale })}
        className={className ? `${className} pr-12` : "pr-12"}
        disabled={disabled}
        value={isCivilDate(value) ? formatLocaleCivilDate(value, locale) : value}
        onChange={(event) => {
          const input = event.currentTarget
          const raw = input.value
          const text = isCivilDate(raw) ? formatLocaleCivilDate(raw, locale) : maskDateText(raw)
          caret.current = {
            input,
            position: isCivilDate(raw) ? text.length : maskDateText(raw.slice(0, input.selectionStart ?? raw.length)).length,
          }
          change(text)
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t("common.datePicker.open", { lng: locale })}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={() => picker.current?.showPicker?.()}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={picker}
        type="date"
        lang={locale}
        min={min}
        max={max}
        value={isCivilDate(value) ? value : ""}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          change(formatLocaleCivilDate(event.target.value, locale))
        }}
      />
    </div>
  )
}
