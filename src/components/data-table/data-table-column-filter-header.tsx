import type { Column } from "@tanstack/react-table"
import { Filter } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type DataTableColumnFilterHeaderProps<TData> = {
  column: Column<TData, unknown>
  title: string
}

export function DataTableColumnFilterHeader<TData>({
  column,
  title,
}: DataTableColumnFilterHeaderProps<TData>) {
  const { t } = useTranslation()
  const isFiltered = column.getIsFiltered()
  const filterValue = column.getFilterValue()

  return (
    <div className="flex items-center justify-between gap-2">
      <span>{title}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={t("common.filter")}
            />
          }
        >
          <Filter
            className={isFiltered ? "text-primary" : "text-muted-foreground"}
            aria-hidden="true"
          />
        </PopoverTrigger>
        <PopoverContent className="w-60" align="start">
          <div className="space-y-2">
            <h4 className="leading-none font-medium">{t("common.filter")}</h4>
            <Input
              autoComplete="off"
              placeholder={t("common.searchPlaceholder")}
              value={typeof filterValue === "string" ? filterValue : ""}
              onChange={(event) => {
                column.setFilterValue(event.target.value)
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
