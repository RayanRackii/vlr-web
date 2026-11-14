import { useEffect, useRef, type ReactNode } from "react"

import { ErrorState } from "@/components/ErrorState"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DataListColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: "start" | "end"
  className?: string
  /** Column is hidden under this breakpoint. */
  hideBelow?: "lg"
}

/** Optional row selection. Omit it and no checkbox is rendered. */
export type DataListSelection<T> = {
  selectedIds: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** Accessible name of a row checkbox, e.g. the row title. */
  rowLabel: (row: T) => string
  /** Accessible name of the header checkbox that selects every visible row. */
  selectAllLabel: string
}

type DataListBaseProps<T> = {
  /** Accessible name for the table, the card list and the frame. */
  label: string
  columns: DataListColumn<T>[]
  rows: readonly T[]
  getRowId: (row: T) => string
  /** Card body used below `md`. */
  renderCard: (row: T) => ReactNode
  rowAttributes?: (row: T) => Record<`data-${string}`, string>
  /** Small line above the list (count, ordering). */
  heading?: ReactNode
  /** Usually a FilterBar, rendered above the frame. */
  toolbar?: ReactNode
  /** Props for the EmptyState shown when ready and rows is empty. */
  empty: EmptyStateProps
  loadingRows?: number
  /** Accessible name of the loading status (defaults to `label`). */
  loadingLabel?: string
  className?: string
  selection?: DataListSelection<T>
}

export type DataListProps<T> = DataListBaseProps<T> &
  (
    | { state?: "ready" | "loading"; error?: undefined; onRetry?: undefined }
    | { state: "error"; error: string; onRetry: () => void }
  )

const HIDE_BELOW = { lg: "hidden lg:table-cell" } as const

function cellClass<T>(column: DataListColumn<T>) {
  return cn(
    column.align === "end" && "text-right",
    column.hideBelow && HIDE_BELOW[column.hideBelow],
    column.className,
  )
}

function SelectAllCheckbox<T>({ selection, rows, getRowId }: {
  selection: DataListSelection<T>
  rows: readonly T[]
  getRowId: (row: T) => string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const selectedCount = rows.filter((row) => selection.selectedIds.has(getRowId(row))).length
  const all = rows.length > 0 && selectedCount === rows.length
  const partial = selectedCount > 0 && !all
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial
  }, [partial])
  return (
    <Checkbox
      ref={ref}
      aria-label={selection.selectAllLabel}
      checked={all}
      onChange={() => {
        const next = new Set(selection.selectedIds)
        for (const row of rows) {
          if (all) next.delete(getRowId(row))
          else next.add(getRowId(row))
        }
        selection.onChange(next)
      }}
    />
  )
}

function RowCheckbox<T>({ selection, row, id }: { selection: DataListSelection<T>; row: T; id: string }) {
  return (
    <Checkbox
      aria-label={selection.rowLabel(row)}
      checked={selection.selectedIds.has(id)}
      onChange={() => {
        const next = new Set(selection.selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        selection.onChange(next)
      }}
    />
  )
}

/** Shared list: a real table from `md`, cards below, with loading/empty/error in the same frame. */
export function DataList<T>(props: DataListProps<T>) {
  const {
    label,
    columns,
    rows,
    getRowId,
    renderCard,
    rowAttributes,
    heading,
    toolbar,
    empty,
    loadingRows = 3,
    loadingLabel,
    className,
    selection,
  } = props

  const ready = props.state !== "loading" && props.state !== "error"
  let body: ReactNode
  if (props.state === "loading") {
    body = (
      <div role="status" aria-label={loadingLabel ?? label} className="divide-y divide-border">
        {Array.from({ length: loadingRows }, (_, index) => (
          <div key={index} aria-hidden="true" className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-1/5" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
        ))}
      </div>
    )
  } else if (props.state === "error") {
    body = (
      <ErrorState
        className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        message={props.error}
        onRetry={props.onRetry}
      />
    )
  } else if (rows.length === 0) {
    body = <EmptyState {...empty} className={cn("rounded-none border-0", empty.className)} />
  } else {
    body = (
      <>
        <div className="hidden md:block">
          <Table aria-label={label}>
            <TableHeader>
              <TableRow>
                {selection ? (
                  <TableHead scope="col" className="w-11">
                    <SelectAllCheckbox selection={selection} rows={rows} getRowId={getRowId} />
                  </TableHead>
                ) : null}
                {columns.map((column) => (
                  <TableHead key={column.id} scope="col" className={cellClass(column)}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowId(row)} {...rowAttributes?.(row)}>
                  {selection ? (
                    <TableCell className="w-11">
                      <RowCheckbox selection={selection} row={row} id={getRowId(row)} />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn("whitespace-normal", cellClass(column))}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul role="list" aria-label={label} className="grid grid-cols-1 gap-3 p-3 md:hidden">
          {rows.map((row) => (
            <li
              key={getRowId(row)}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4"
              {...rowAttributes?.(row)}
            >
              {selection ? (
                <div className="flex min-h-11 min-w-11 items-center">
                  <RowCheckbox selection={selection} row={row} id={getRowId(row)} />
                </div>
              ) : null}
              {renderCard(row)}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      {toolbar}
      <section className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground" aria-busy={props.state === "loading"}>
        {heading && ready && rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
            {heading}
          </div>
        ) : null}
        {body}
      </section>
    </div>
  )
}
