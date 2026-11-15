import { useId } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

type ProductUsesScheduleFieldProps = {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/** "Como este produto é vendido?" Two selectable cards (with / without scheduling). Shared by the cadastro steps and the product editor. */
export function ProductUsesScheduleField({ value, onChange, disabled }: ProductUsesScheduleFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const options = [
    { value: true, key: "With" },
    { value: false, key: "Without" },
  ] as const

  return (
    <div className="space-y-2">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium">
          {t("cadastro.product.salesMode.label")}
        </p>
        <p className="text-sm text-muted-foreground">{t("cadastro.product.salesMode.description")}</p>
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => {
          const selected = option.value === value
          return (
            <button
              key={option.key}
              id={`${id}-${index}`}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-labelledby={`${id}-${index}-title`}
              aria-describedby={`${id}-${index}-desc`}
              disabled={disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                let next: number
                if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length
                else return
                event.preventDefault()
                onChange(options[next].value)
                document.getElementById(`${id}-${next}`)?.focus()
              }}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary" : "border-border",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span id={`${id}-${index}-title`} className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
                  {t(`cadastro.product.salesMode.title${option.key}`)}
                </span>
              </span>
              <span id={`${id}-${index}-desc`} className="text-sm text-muted-foreground">
                {t(`cadastro.product.salesMode.desc${option.key}`)}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t(value ? "cadastro.product.salesMode.helperWith" : "cadastro.product.salesMode.helperWithout")}
      </p>
    </div>
  )
}
