import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const DIRECTORY_PAGE_SIZE = 20

type PeopleSearchFormProps = {
  actions?: ReactNode
  id: string
  label: string
  placeholder: string
  actionLabel: string
  value: string
  error: string | null
  onValueChange: (value: string) => void
  onSubmit: () => void
}

export function PeopleSearchForm({
  actions,
  id,
  label,
  placeholder,
  actionLabel,
  value,
  error,
  onValueChange,
  onSubmit,
}: PeopleSearchFormProps) {
  return (
    <form
      className="people-search-card"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="people-search-input">
        <Label className="sr-only" htmlFor={id}>{label}</Label>
        <Search aria-hidden strokeWidth={1.75} className="people-search-icon" />
        <Input
          className="touch-target"
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onValueChange(event.target.value)
          }}
        />
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Button className="people-search-submit" type="submit" variant="outline" size="sm">
        {actionLabel}
      </Button>
      {actions}
    </form>
  )
}

type PeoplePagerProps = {
  page: number
  pageSize: number
  total: number
  summary: string
  previousLabel: string
  nextLabel: string
  onPageChange: (page: number) => void
}

export function PeoplePager({
  page,
  pageSize,
  total,
  summary,
  previousLabel,
  nextLabel,
  onPageChange,
}: PeoplePagerProps) {
  if (total <= 0) {
    return null
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="people-pager">
      <p className="min-w-0 text-xs tabular-nums text-muted-foreground">{summary}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1)
          }}
        >
          <ChevronLeft aria-hidden strokeWidth={1.75} />
          <span className="sr-only">{previousLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => {
            onPageChange(page + 1)
          }}
        >
          <ChevronRight aria-hidden strokeWidth={1.75} />
          <span className="sr-only">{nextLabel}</span>
        </Button>
      </div>
    </div>
  )
}
