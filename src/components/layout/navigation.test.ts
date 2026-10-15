import { LayoutDashboard } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  declaredPermissionKeys,
  filterNavigationItemsByAccess,
  firstPermittedProductPath,
  appNavigationItems,
  getPageTitleKey,
  RENTAL_RESOURCES_PERMISSIONS,
  type AppNavigationItem,
} from "@/components/layout/navigation"

const icon = LayoutDashboard

describe("filterNavigationItemsByAccess", () => {
  it("hides a nav item when the module is on but the permission is missing", () => {
    const items: AppNavigationItem[] = [
      {
        labelKey: "nav.peopleAccess",
        to: "/pessoas-e-acesso",
        icon,
        permission: "core.users.read",
      },
      {
        labelKey: "nav.moduleMenu",
        to: "/configuracoes/menu",
        icon,
        modules: ["rentals"],
        permission: "core.module_menu.read",
      },
    ]

    const visible = filterNavigationItemsByAccess(
      items,
      ["rentals"],
      ["core.users.read"],
    )

    expect(visible.map((item) => item.to)).toEqual(["/pessoas-e-acesso"])
  })

  it("filters children by permission independently", () => {
    const items: AppNavigationItem[] = [
      {
        labelKey: "nav.assets",
        to: "/ativos",
        icon,
        modules: ["inventory"],
        children: [
          {
            labelKey: "nav.assetsInventory",
            to: "/ativos",
            permission: "inventory.assets.read",
          },
          {
            labelKey: "nav.assetsCategories",
            to: "/ativos/categorias",
            permission: "inventory.categories.read",
          },
        ],
      },
    ]

    const visible = filterNavigationItemsByAccess(
      items,
      ["inventory"],
      ["inventory.categories.read"],
    )

    expect(visible).toHaveLength(1)
    expect(visible[0]?.children?.map((child) => child.to)).toEqual([
      "/ativos/categorias",
    ])
  })

  it("hides Catalogo & Pedidos when the catalog module is off", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      [
        "catalog.products.read",
        "catalog.orders.read",
        "catalog.notifications.read",
      ],
    )

    expect(
      visible.some(
        (item) =>
          item.labelKey === "nav.catalog" ||
          item.to.startsWith("/catalogo"),
      ),
    ).toBe(false)
  })

  it("shows catalog children when the catalog module is on and permissions match", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["catalog"],
      ["catalog.products.read", "catalog.orders.read"],
    )

    const catalog = visible.find((item) => item.labelKey === "nav.catalog")
    expect(catalog).toBeDefined()
    expect(catalog?.children?.map((child) => child.to)).toEqual([
      "/catalogo/produtos",
      "/catalogo/pedidos",
    ])
  })

  it("shows Recursos and hides Ativos when rentals is on and inventory is off", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      [
        "rentals.assets.read",
        "core.units.read",
        "rentals.schedule.read",
        "rentals.layouts.read",
        "rentals.reservations.read",
        "inventory.assets.read",
        "inventory.categories.read",
      ],
    )

    expect(visible.map((item) => item.to)).toContain("/configuracoes/recursos")
    expect(visible.some((item) => item.to === "/ativos")).toBe(false)
    expect(visible.some((item) => item.labelKey === "nav.rentalsResources")).toBe(
      true,
    )
  })

  it("shows Ativos and hides Recursos when inventory is on and rentals is off", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["inventory"],
      ["inventory.assets.read", "inventory.categories.read", "rentals.assets.read"],
    )

    expect(visible.some((item) => item.to === "/ativos")).toBe(true)
    expect(visible.map((item) => item.to)).not.toContain("/configuracoes/recursos")
  })

  it("shows notifications when catalog is on and the permission matches", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["catalog"],
      ["core.notifications.read"],
    )

    expect(visible.map((item) => item.to)).toContain("/configuracoes/notificacoes")
  })

  it("shows notifications when rentals is on and the permission matches", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      ["core.notifications.read"],
    )

    expect(visible.map((item) => item.to)).toContain("/configuracoes/notificacoes")
  })

  it("hides notifications when the permission is missing", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["catalog", "rentals"],
      ["core.users.read"],
    )

    expect(visible.map((item) => item.to)).not.toContain(
      "/configuracoes/notificacoes",
    )
  })

  it("hides notifications when neither catalog nor rentals is on", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["inventory"],
      ["core.notifications.read"],
    )

    expect(visible.map((item) => item.to)).not.toContain(
      "/configuracoes/notificacoes",
    )
  })

  it("shows booking policy when rentals is on and the read permission matches", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      ["rentals.booking_policy.read"],
    )

    expect(visible.map((item) => item.to)).toContain(
      "/configuracoes/politica-reservas",
    )
  })

  it("hides booking policy without the read permission", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      ["rentals.reservations.read"],
    )

    expect(visible.map((item) => item.to)).not.toContain(
      "/configuracoes/politica-reservas",
    )
  })
})

const professorPermissions = [
  "rentals.assets.read",
  "rentals.occupancy_kinds.read",
  "rentals.schedule.read",
  "rentals.schedule.lessons.write",
]

const receptionistPermissions = ["rentals.reservations.read"]

const resourceManagerPermissions = [...RENTAL_RESOURCES_PERMISSIONS]

const clubAdminPermissions = [
  "core.dashboard.read",
  "core.users.read",
  "core.units.read",
  "rentals.assets.read",
  "rentals.schedule.read",
  "rentals.layouts.read",
  "rentals.reservations.read",
  "rentals.booking_policy.read",
]

describe("staff menu permissions by role", () => {
  it("requires every product leaf to declare the permission it needs", () => {
    for (const item of appNavigationItems) {
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          expect(declaredPermissionKeys(child).length).toBeGreaterThan(0)
        }
        continue
      }

      expect(declaredPermissionKeys(item).length).toBeGreaterThan(0)
    }

    expect(declaredPermissionKeys({
      permissions: RENTAL_RESOURCES_PERMISSIONS,
    })).toEqual(["rentals.assets.read", "core.units.read"])
  })

  it("hides a leaf or child that does not declare a permission", () => {
    const ungatedLeaf: AppNavigationItem = {
      labelKey: "nav.schedule",
      to: "/configuracoes/agenda",
      icon,
      modules: ["rentals"],
    }
    expect(
      filterNavigationItemsByAccess(
        [ungatedLeaf],
        ["rentals"],
        ["rentals.schedule.read"],
      ),
    ).toEqual([])

    const parent: AppNavigationItem = {
      labelKey: "nav.assets",
      to: "/ativos",
      icon,
      modules: ["inventory"],
      children: [
        {
          labelKey: "nav.assetsInventory",
          to: "/ativos",
          permission: "inventory.assets.read",
        },
        {
          labelKey: "nav.assetsCategories",
          to: "/ativos/categorias",
        },
      ],
    }
    const visible = filterNavigationItemsByAccess(
      [parent],
      ["inventory"],
      ["inventory.assets.read", "inventory.categories.read"],
    )
    expect(visible[0]?.children?.map((child) => child.to)).toEqual(["/ativos"])
  })

  it("hides Recursos from a professor and opens the agenda first", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      professorPermissions,
    )

    expect(visible.map((item) => item.to)).not.toContain("/configuracoes/recursos")
    expect(visible.some((item) => item.labelKey === "nav.rentalsResources")).toBe(
      false,
    )
    expect(visible.map((item) => item.to)).toContain("/configuracoes/agenda")
    expect(
      firstPermittedProductPath(["rentals"], professorPermissions),
    ).toBe("/configuracoes/agenda")
  })

  it("shows Recursos to a resource manager who can read assets and units", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      resourceManagerPermissions,
    )

    expect(visible.map((item) => item.to)).toContain("/configuracoes/recursos")
    expect(visible.map((item) => item.to)).not.toContain("/configuracoes/agenda")
    expect(
      firstPermittedProductPath(["rentals"], resourceManagerPermissions),
    ).toBe("/configuracoes/recursos")
  })

  it("keeps the dashboard as the first route for a club admin", () => {
    expect(
      firstPermittedProductPath(["rentals"], clubAdminPermissions),
    ).toBe("/dashboard")
    expect(
      filterNavigationItemsByAccess(
        appNavigationItems,
        ["rentals"],
        clubAdminPermissions,
      ).map((item) => item.to),
    ).toContain("/configuracoes/recursos")
  })

  it("opens reservations for a receptionist and hides Recursos", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["rentals"],
      receptionistPermissions,
    )

    expect(visible.map((item) => item.to)).toEqual(["/configuracoes/reservas"])
    expect(
      firstPermittedProductPath(["rentals"], receptionistPermissions),
    ).toBe("/configuracoes/reservas")
  })
})

describe("firstPermittedProductPath", () => {
  it("returns the dashboard when that is the first permitted route", () => {
    expect(firstPermittedProductPath([], ["core.dashboard.read"])).toBe(
      "/dashboard",
    )
  })

  it("skips the dashboard and uses the first people route", () => {
    expect(
      firstPermittedProductPath(
        ["rentals"],
        ["rentals.schedule.read", "core.users.read"],
      ),
    ).toBe("/pessoas-e-acesso")
  })

  it("uses the first allowed child when the parent path is not permitted", () => {
    expect(
      firstPermittedProductPath(["inventory"], ["inventory.categories.read"]),
    ).toBe("/ativos/categorias")
  })

  it("returns null when no module and permission pair is visible", () => {
    expect(firstPermittedProductPath([], ["rentals.schedule.read"])).toBeNull()
    expect(firstPermittedProductPath(["rentals"], [])).toBeNull()
  })
})

describe("getPageTitleKey", () => {
  it("resolves the rentals resources page", () => {
    expect(getPageTitleKey("/configuracoes/recursos")).toBe("nav.rentalsResources")
  })

  it("resolves the platform asset families page before the tenants title", () => {
    expect(getPageTitleKey("/admin/asset-families")).toBe(
      "nav.adminAssetFamilies",
    )
  })

  it("resolves the unified notifications settings page", () => {
    expect(getPageTitleKey("/configuracoes/notificacoes")).toBe(
      "nav.notifications",
    )
  })

  it("resolves the booking policy page", () => {
    expect(getPageTitleKey("/configuracoes/politica-reservas")).toBe(
      "nav.bookingPolicy",
    )
  })

  it("resolves PMOC library, preview, and plan detail titles", () => {
    expect(getPageTitleKey("/pmoc/biblioteca")).toBe("nav.pmocLibrary")
    expect(
      getPageTitleKey("/pmoc/biblioteca/6f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e"),
    ).toBe("nav.pmocTemplatePreview")
    expect(getPageTitleKey("/pmoc/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "nav.pmocPlanDetail",
    )
    expect(getPageTitleKey("/pmoc/novo")).toBe("nav.pmocNew")
    expect(getPageTitleKey("/pmoc")).toBe("nav.pmocPlans")
  })
})

describe("PMOC library nav", () => {
  it("places Biblioteca Rolvix between plans and new, and hides it without templates.read", () => {
    const withLibrary = filterNavigationItemsByAccess(
      appNavigationItems,
      ["pmoc"],
      ["pmoc.plans.read", "pmoc.templates.read", "pmoc.plans.write"],
    )
    const pmocWithLibrary = withLibrary.find((item) => item.labelKey === "nav.pmoc")
    expect(pmocWithLibrary?.children?.map((child) => child.to)).toEqual([
      "/pmoc",
      "/pmoc/biblioteca",
      "/pmoc/novo",
    ])

    const withoutLibrary = filterNavigationItemsByAccess(
      appNavigationItems,
      ["pmoc"],
      ["pmoc.plans.read", "pmoc.plans.write"],
    )
    const pmocWithoutLibrary = withoutLibrary.find(
      (item) => item.labelKey === "nav.pmoc",
    )
    expect(pmocWithoutLibrary?.children?.map((child) => child.to)).toEqual([
      "/pmoc",
      "/pmoc/novo",
    ])
  })
})
