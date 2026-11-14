import { ChevronLeft, ChevronRight } from "lucide-react"
import { FilterBar } from "@/components/data-table/FilterBar"
import { Button } from "@/components/ui/button"

export const DIRECTORY_PAGE_SIZE = 20

type PeopleSearchFormProps = {
  id: string
  label: string
  placeholder: string
  actionLabel: string
  value: string
  error: string | null
  onValueChange: (value: string) => void
  onSubmit: () => void
}

/** One search input in the shared FilterBar; submitting applies the server-side query. */
export function PeopleSearchForm({
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
      id={id}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FilterBar
        label={actionLabel}
        search={{ value, onChange: onValueChange, placeholder, label }}
        actions={<Button type="submit" variant="outline" className="min-h-11">{actionLabel}</Button>}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
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
    <div className="flex flex-wrap items-center justify-end gap-3">
      <p className="min-w-0 text-xs tabular-nums text-muted-foreground">{summary}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
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
          size="icon"
          className="size-11"
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
