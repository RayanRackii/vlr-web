import { useState } from "react"

import { Input } from "@/components/ui/input"
import { HH_MM, normalizeTime24 } from "@/lib/time24"

type Time24InputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: string
  onValueChange: (value: string) => void
}

/** 24h "HH:mm" time field, independent of the browser/OS 12h/24h setting. */
export function Time24Input({ value, onValueChange, onBlur, ...props }: Time24InputProps) {
  const [draft, setDraft] = useState(value.slice(0, 5))
  const [syncedValue, setSyncedValue] = useState(value)
  if (syncedValue !== value) {
    setSyncedValue(value)
    setDraft(value.slice(0, 5))
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:mm"
      maxLength={5}
      value={draft}
      aria-invalid={draft !== "" && normalizeTime24(draft) === null ? true : props["aria-invalid"]}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (HH_MM.test(next)) {
          onValueChange(next)
        }
      }}
      onBlur={(event) => {
        const normalized = normalizeTime24(draft)
        if (normalized) {
          setDraft(normalized)
          if (normalized !== value.slice(0, 5)) {
            onValueChange(normalized)
          }
        }
        onBlur?.(event)
      }}
    />
  )
}
