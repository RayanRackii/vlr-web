import { useId, type ReactNode } from "react"

type Option<T extends string> = { value: T; label: string; count?: number; icon?: ReactNode }
type Props<T extends string> = { label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void; disabled?: boolean }

export function SegmentedControl<T extends string>({ label, value, options, onChange, disabled }: Props<T>) {
  const id = useId()
  return (
    <div className="portal-segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button key={option.value} id={`${id}-${index}`} type="button" role="radio"
          aria-checked={option.value === value} disabled={disabled} tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            let next: number
            if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length
            else if (event.key === "Home") next = 0
            else if (event.key === "End") next = options.length - 1
            else return
            event.preventDefault()
            onChange(options[next].value)
            document.getElementById(`${id}-${next}`)?.focus()
          }}>
          {option.icon}{option.label}
          {option.count !== undefined && option.count > 0 ? <span className="portal-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
