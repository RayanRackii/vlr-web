import { ArmchairIcon, CircleDotIcon, LayoutTemplateIcon, PackageIcon, SofaIcon, Table2Icon, TableIcon, type LucideIcon } from "lucide-react"

/** Generic fallback icon per `defaultIcon` key, shared by the booking map and the admin layout editor. */
export const VISUAL_ICON_MAP: Record<string, LucideIcon> = {
  "circle-dot": CircleDotIcon,
  "layout-template": LayoutTemplateIcon,
  table: TableIcon,
  "table-2": Table2Icon,
  armchair: ArmchairIcon,
  sofa: SofaIcon,
  package: PackageIcon,
}
