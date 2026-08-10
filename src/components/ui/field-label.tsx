import { CircleHelp } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function FieldHelp({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={text}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-64 p-3 text-xs leading-relaxed"
      >
        <PopoverDescription className="text-xs text-muted-foreground">
          {text}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}

type FieldLabelProps = {
  label: string
  help: string
  required?: boolean
  htmlFor?: string
  className?: string
}

export function FieldLabel({
  label,
  help,
  required = false,
  htmlFor,
  className,
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium leading-none",
        className,
      )}
    >
      <span>{label}</span>
      {required ? (
        <span className="text-destructive" aria-hidden>
          *
        </span>
      ) : null}
      <FieldHelp text={help} />
    </label>
  )
}
