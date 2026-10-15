import { Input } from "@/components/ui/input"
import { formatLocaleCivilDate } from "@/lib/localeFormat"
import { cn } from "@/lib/utils"

type LocaleDateInputProps = {
  id?: string
  value: string
  locale: string
  min?: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Keeps an ISO `YYYY-MM-DD` value for the picker and shows that day in the
 * active locale (DD/MM for pt-BR and es, MM/DD for en).
 */
export function LocaleDateInput({
  id,
  value,
  locale,
  min,
  onChange,
  className,
}: LocaleDateInputProps) {
  const formatted = formatLocaleCivilDate(value, locale)

  return (
    <div
      className={cn(
        "relative h-8 rounded-lg focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-8 items-center rounded-lg border border-input px-2.5 text-sm text-foreground"
      >
        {formatted}
      </span>
      <Input
        id={id}
        type="date"
        lang={locale}
        min={min}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="absolute inset-0 h-8 cursor-pointer opacity-0"
      />
    </div>
  )
}
