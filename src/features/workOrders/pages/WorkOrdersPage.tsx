import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Eye, LoaderCircle, Play, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
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
import { getCurrentUser } from "@/features/users/services/usersService"
import {
  type WorkOrder,
  type WorkOrderStatus,
} from "@/features/workOrders/schemas/workOrderSchemas"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { isAxiosError } from "@/lib/api"

type WorkOrderTableRow = WorkOrder & {
  assetLabel: string
  originLabel: string
}

const LIST_TABS = [
  "Pending",
  "InProgress",
  "Completed",
] as const satisfies readonly WorkOrderStatus[]

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
  const navigate = useNavigate()
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
          const isCompleted = row.original.status === "Completed"
          const label = isCompleted
            ? t("workOrders.actions.view")
            : t("workOrders.actions.execute")
          const Icon = isCompleted ? Eye : Play

          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigate(`/os/${row.original.id}`)
              }}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          )
        },
      },
    ],
    [i18n.language, navigate, t],
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
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("workOrders.loading")}
                </span>
              </TableCell>
            </TableRow>
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
  const navigate = useNavigate()

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkOrderStatus>("Pending")
  const [canCreateWorkOrder, setCanCreateWorkOrder] = useState(false)

  useEffect(() => {
    if (!session) {
      setCanCreateWorkOrder(false)
      return
    }

    let isActive = true

    void getCurrentUser()
      .then((profile) => {
        if (isActive) {
          setCanCreateWorkOrder(profile.role === "ADMIN")
        }
      })
      .catch(() => {
        if (isActive) {
          setCanCreateWorkOrder(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [session])

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
        originLabel: workOrder.maintenancePlanId
          ? t("workOrders.origin.pmoc")
          : t("workOrders.origin.manual"),
      })
    }

    return map
  }, [t, workOrders])

  return (
    <div className="space-y-6">
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
          if (
            value === "Pending" ||
            value === "InProgress" ||
            value === "Completed"
          ) {
            setActiveTab(value)
          }
        }}
      >
        <TabsList>
          {LIST_TABS.map((status) => (
            <TabsTrigger key={status} value={status}>
              {t(`workOrders.tabs.${status}`)}
              <Badge variant="secondary" className="ml-1">
                {tableRowsByStatus[status].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {LIST_TABS.map((status) => (
          <TabsContent key={status} value={status} className="mt-4">
            <WorkOrdersTable
              rows={tableRowsByStatus[status]}
              isLoading={isLoading}
              emptyLabel={t(`workOrders.empty.${status}`)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
