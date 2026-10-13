import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
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
      <Button type="submit" variant="outline" size="sm">
        {actionLabel}
      </Button>
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
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{summary}</p>
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
          {previousLabel}
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
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
