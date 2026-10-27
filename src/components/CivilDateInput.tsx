import { useRef, type ComponentProps } from "react"
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

/** Complete dates become ISO; incomplete text stays in the form for localized validation. */
export function CivilDateInput({ value, locale, onChange, min, max, disabled, className, ...props }: CivilDateInputProps) {
  const { t } = useTranslation()
  const picker = useRef<HTMLInputElement>(null)

  function change(text: string) {
    const parsed = parseLocaleCivilDate(text, locale) ?? (isCivilDate(text) ? text : null)
    const outsideRange = parsed && ((min && parsed < min) || (max && parsed > max))
    onChange(parsed ? (outsideRange ? formatLocaleCivilDate(parsed, locale) : parsed) : text)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        lang={locale}
        placeholder={t("common.datePicker.format", { lng: locale })}
        className={className ? `${className} pr-12` : "pr-12"}
        disabled={disabled}
        value={isCivilDate(value) ? formatLocaleCivilDate(value, locale) : value}
        onChange={(event) => change(event.target.value)}
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
