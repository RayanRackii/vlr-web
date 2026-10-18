import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Eye, Play, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  type WorkOrder,
  type WorkOrderStatus,
} from "@/features/workOrders/schemas/workOrderSchemas"
import { WorkOrderOfflineBanner } from "@/features/workOrders/components/WorkOrderOfflineBanner"
import { WorkOrderOrigin, formatWorkOrderOriginText } from "@/features/workOrders/components/WorkOrderOrigin"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { isAxiosError } from "@/lib/api"

type WorkOrderTableRow = WorkOrder & {
  assetLabel: string
  originLabel: string
}

const LIST_FILTERS = [
  "Open",
  "Pending",
  "InProgress",
  "Completed",
  "Canceled",
] as const

type WorkOrderListFilter = (typeof LIST_FILTERS)[number]

function isWorkOrderListFilter(value: string): value is WorkOrderListFilter {
  return (LIST_FILTERS as readonly string[]).includes(value)
}

function formatShortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

function formatScheduledDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function WorkOrdersTable({
  rows,
  isLoading,
  emptyLabel,
}: {
  rows: WorkOrderTableRow[]
  isLoading: boolean
  emptyLabel: string
}) {
  const { t, i18n } = useTranslation()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo<ColumnDef<WorkOrderTableRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("workOrders.columns.id")}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatShortId(row.original.id)}</span>
        ),
        filterFn: (row, _columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }

          return row.original.id
            .toLowerCase()
            .includes(filterValue.trim().toLowerCase())
        },
      },
      {
        accessorKey: "assetLabel",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("workOrders.columns.asset")}
          />
        ),
      },
      {
        accessorKey: "originLabel",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("workOrders.columns.origin")}
          />
        ),
        cell: ({ row }) => (
          <WorkOrderOrigin
            maintenancePlanId={row.original.maintenancePlanId}
            sourcePlanName={row.original.sourcePlanName}
          />
        ),
      },
      {
        accessorKey: "scheduledDate",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("workOrders.columns.scheduledDate")}
          />
        ),
        cell: ({ getValue }) =>
          formatScheduledDate(getValue<string>(), i18n.language),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("workOrders.columns.actions"),
        cell: ({ row }) => {
          const isClosed =
            row.original.status === "Completed" ||
            row.original.status === "Canceled"
          const label = isClosed
            ? t("workOrders.actions.view")
            : t("workOrders.actions.execute")
          const Icon = isClosed ? Eye : Play

          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link to={`/os/${row.original.id}`} />}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          )
        },
      },
    ],
    [i18n.language, t],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows

  return (
    <div className="rounded-xl border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRowsSkeleton columns={columns.length} />
          ) : null}

          {!isLoading && filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading
            ? filteredRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-normal">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  )
}

export function WorkOrdersPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { can } = usePermissions()
  const navigate = useNavigate()

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkOrderListFilter>("Open")
  const canCreateWorkOrder = can("os.work_orders.create")

  const loadWorkOrders = useCallback(async () => {
    if (!session) {
      setLoadError(t("workOrders.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getWorkOrders()
      setWorkOrders(data)
    } catch (error: unknown) {
      console.error("WorkOrdersPage loadWorkOrders failed", error)
      if (isAxiosError(error)) {
        console.error(
          "WorkOrdersPage loadWorkOrders response",
          error.response?.data,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : t("workOrders.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadWorkOrders()
  }, [loadWorkOrders])

  const tableRowsByStatus = useMemo(() => {
    const map: Record<WorkOrderStatus, WorkOrderTableRow[]> = {
      Pending: [],
      InProgress: [],
      Completed: [],
      Canceled: [],
    }

    for (const workOrder of workOrders) {
      map[workOrder.status].push({
        ...workOrder,
        assetLabel: `${workOrder.asset.tag} — ${workOrder.asset.name}`,
        originLabel: formatWorkOrderOriginText(
          workOrder.maintenancePlanId,
          workOrder.sourcePlanName,
          t,
        ),
      })
    }

    return map
  }, [t, workOrders])

  const rowsForFilter = useCallback(
    (filter: WorkOrderListFilter): WorkOrderTableRow[] => {
      if (filter === "Open") {
        return [...tableRowsByStatus.Pending, ...tableRowsByStatus.InProgress]
      }

      return tableRowsByStatus[filter]
    },
    [tableRowsByStatus],
  )

  return (
    <div className="space-y-6">
      <WorkOrderOfflineBanner />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("workOrders.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("workOrders.description")}
          </p>
        </div>
        {canCreateWorkOrder ? (
          <Button
            type="button"
            onClick={() => {
              void navigate("/os/nova")
            }}
          >
            <Plus data-icon="inline-start" />
            {t("workOrders.create.action")}
          </Button>
        ) : null}
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isWorkOrderListFilter(value)) {
            setActiveTab(value)
          }
        }}
      >
        <TabsList className="!h-auto flex-wrap justify-start">
          {LIST_FILTERS.map((filter) => {
            const count = rowsForFilter(filter).length
            const label = t(`workOrders.tabs.${filter}`)

            return (
              <TabsTrigger
                key={filter}
                value={filter}
                className="!h-auto min-h-8 px-2 py-1"
                aria-label={t("workOrders.tabs.withCount", { label, count })}
              >
                <span>{label}</span>
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {LIST_FILTERS.map((filter) => (
          <TabsContent key={filter} value={filter} className="mt-4">
            <WorkOrdersTable
              rows={rowsForFilter(filter)}
              isLoading={isLoading}
              emptyLabel={t(`workOrders.empty.${filter}`)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
