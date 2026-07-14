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
import { LoaderCircle, Plus } from "lucide-react"
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
import { useAuth } from "@/contexts/AuthContext"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import {
  type MaintenanceFrequency,
  type MaintenancePlan,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { getPlans } from "@/features/pmoc/services/pmocService"
import { isAxiosError } from "@/lib/api"

type PlanTableRow = MaintenancePlan & {
  categoryName: string
  statusLabel: string
}

export function MaintenancePlansPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const loadPageData = useCallback(async () => {
    if (!session) {
      setLoadError(t("pmoc.plans.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [plansData, categoriesData] = await Promise.all([
        getPlans(),
        getCategories(),
      ])
      setPlans(plansData)
      setCategories(categoriesData)
    } catch (error: unknown) {
      console.error("MaintenancePlansPage loadPageData failed", error)
      if (isAxiosError(error)) {
        console.error(
          "MaintenancePlansPage loadPageData response",
          error.response?.data,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.name)
    }
    return map
  }, [categories])

  const tableRows = useMemo<PlanTableRow[]>(
    () =>
      plans.map((plan) => ({
        ...plan,
        categoryName:
          categoryNameById.get(plan.assetCategoryId) ??
          t("pmoc.plans.emptyValue"),
        statusLabel: plan.isActive
          ? t("pmoc.plans.status.active")
          : t("pmoc.plans.status.inactive"),
      })),
    [categoryNameById, plans, t],
  )

  const columns = useMemo<ColumnDef<PlanTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("pmoc.plans.columns.name")}
          />
        ),
      },
      {
        accessorKey: "frequency",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("pmoc.plans.columns.frequency")}
          />
        ),
        cell: ({ getValue }) => {
          const frequency = getValue<MaintenanceFrequency>()
          return t(`pmoc.frequency.${frequency}`)
        },
        filterFn: (row, columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }

          const frequency = row.getValue<MaintenanceFrequency>(columnId)
          const label = t(`pmoc.frequency.${frequency}`).toLowerCase()
          return label.includes(filterValue.trim().toLowerCase())
        },
      },
      {
        accessorKey: "categoryName",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("pmoc.plans.columns.category")}
          />
        ),
      },
      {
        accessorKey: "statusLabel",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("pmoc.plans.columns.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "secondary"}>
            {row.original.statusLabel}
          </Badge>
        ),
      },
    ],
    [t],
  )

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pmoc.plans.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pmoc.plans.description")}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            void navigate("/pmoc/novo")
          }}
        >
          <Plus data-icon="inline-start" />
          {t("pmoc.plans.actions.new")}
        </Button>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

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
                    {t("pmoc.plans.loading")}
                  </span>
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t("pmoc.plans.empty")}
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
    </div>
  )
}
