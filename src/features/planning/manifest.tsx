import { lazyPage } from "@/routes/lazyPage"
import type { AppNavigationChildItem } from "@/components/layout/navigation"

const PlanningAgendaPage = lazyPage(() => import("./components/PlanningAgendaPage"), "PlanningAgendaPage")

/** Resource planning stands on its own: no rentals, catalog or inventory module is required. */
const modules = ["resource-planning"] as const
const permission = "resource-planning.agenda.read"

export const planningManifest = {
  modules,
  permission,
  /** Child of the Agendas group; the agenda manifest mounts it. */
  navigationChild: { labelKey: "nav.agendasPlanning", to: "/agendas/planejamento", modules, permission } satisfies AppNavigationChildItem,
  routes: {
    staff: [
      { path: "/agendas/planejamento", element: <PlanningAgendaPage />, modules, anyOf: [permission] },
    ],
  },
} as const
