import { LayoutDashboard } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  buildProductSections,
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

  it("hides Sales when the catalog module is off", () => {
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

    expect(visible.map((item) => item.to)).toEqual([
      "/catalogo/produtos",
      "/catalogo/pedidos",
      "/catalogo/solicitacoes",
    ])
  })

  it("shows the portal menu and registration fields for a catalog-only tenant", () => {
    const visible = filterNavigationItemsByAccess(
      appNavigationItems,
      ["catalog"],
      ["core.module_menu.read", "core.registration_fields.read"],
    )

    expect(visible.map((item) => item.to)).toEqual([
      "/configuracoes/cadastro",
      "/configuracoes/menu",
    ])
  })

  it.each(["catalog.products.manage"])("shows catalog settings with %s", (permission) => {
    const visible = filterNavigationItemsByAccess(appNavigationItems, ["catalog"], [permission])
    expect(visible.some((item) => item.to === "/catalogo/configuracoes")).toBe(true)
    const disabled = filterNavigationItemsByAccess(appNavigationItems, [], [permission])
    expect(disabled.some((item) => item.labelKey === "nav.catalog")).toBe(false)
  })

  it("shows Resources and hides Equipment when rentals is on and inventory is off", () => {
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

  it("shows Equipment and hides Resources when inventory is on and rentals is off", () => {
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
          if (child.tabs) {
            for (const tab of child.tabs) expect(declaredPermissionKeys(tab).length).toBeGreaterThan(0)
          } else {
            expect(declaredPermissionKeys(child).length).toBeGreaterThan(0)
          }
        }
        continue
      }

      if (item.tabs) {
        for (const tab of item.tabs) expect(declaredPermissionKeys(tab).length).toBeGreaterThan(0)
      } else {
        expect(declaredPermissionKeys(item).length).toBeGreaterThan(0)
      }
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

  it("skips the dashboard and uses the first bookings route", () => {
    expect(
      firstPermittedProductPath(
        ["rentals"],
        ["rentals.schedule.read", "core.users.read"],
      ),
    ).toBe("/configuracoes/agenda")
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
  it.each([
    ["overview", "nav.sections.overview"],
    ["bookings", "nav.sections.bookings"],
    ["maintenance", "nav.sections.maintenance"],
    ["sales", "nav.sections.sales"],
    ["peoplePortal", "nav.sections.peoplePortal"],
    ["pmoc", "nav.pmoc"],
    ["platform", "nav.sections.platform"],
  ])("resolves the %s module intro title", (key, titleKey) => {
    expect(getPageTitleKey(`/modulos/${key}`)).toBe(titleKey)
  })

  it.each(["unknown", "bookings/unknown"])("keeps the fallback for an unknown intro: %s", (key) => {
    expect(getPageTitleKey(`/modulos/${key}`)).toBe("app.name")
  })

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

  it("resolves the staff profile page", () => {
    expect(getPageTitleKey("/perfil")).toBe("account.profile")
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
  it("keeps only My plans and New plan as sidebar children", () => {
    const withLibrary = filterNavigationItemsByAccess(
      appNavigationItems,
      ["pmoc"],
      ["pmoc.plans.read", "pmoc.templates.read", "pmoc.plans.write"],
    )
    const pmocWithLibrary = withLibrary.find((item) => item.labelKey === "nav.pmoc")
    expect(pmocWithLibrary?.children?.map((child) => child.to)).toEqual([
      "/pmoc",
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


describe("staff sidebar groups", () => {
  const modules = ["rentals", "inventory", "pmoc", "os", "catalog"]
  const permissions = [
    "core.dashboard.read", "core.users.read", "core.registration_fields.read",
    "core.module_menu.read", "core.taxonomy.read", "core.notifications.read",
    "core.units.read", "rentals.assets.read", "rentals.layouts.read",
    "rentals.schedule.read", "rentals.reservations.read", "rentals.booking_policy.read",
    "inventory.assets.read", "inventory.categories.read", "pmoc.plans.read",
    "pmoc.plans.write", "pmoc.templates.read", "os.work_orders.read",
    "catalog.products.read", "catalog.orders.read", "catalog.products.manage", "catalog.notifications.read",
  ]

  it("composes the five groups in the approved order", () => {
    const sections = buildProductSections(modules, permissions)
    expect(sections.map((section) => section.titleKey)).toEqual([
      "nav.sections.overview", "nav.sections.bookings", "nav.sections.maintenance",
      "nav.sections.sales", "nav.sections.peoplePortal",
    ])
    expect(sections[1]?.items.map((item) => item.labelKey)).toEqual([
      "nav.rentalsResources", "nav.layout", "nav.schedule", "nav.reservations",
    ])
    expect(sections[2]?.items.map((item) => item.labelKey)).toEqual([
      "nav.assets", "nav.pmoc", "nav.workOrders",
    ])
    expect(sections[3]?.items.map((item) => item.labelKey)).toEqual([
      "nav.catalogProducts", "nav.catalogOrders", "nav.catalogRequests", "nav.catalogSettings", "nav.catalogNotifications",
    ])
    expect(sections[4]?.items.map((item) => item.labelKey)).toEqual([
      "nav.peopleAccess", "nav.moduleMenu", "nav.taxonomy", "nav.notifications",
    ])
    const sidebarLabels = sections.flatMap((section) => section.items.flatMap((item) =>
      [item.labelKey, ...(item.children?.map((child) => child.labelKey) ?? [])],
    ))
    for (const hidden of ["nav.registrationFields", "nav.bookingPolicy", "nav.assetsCategories", "nav.pmocLibrary"]) {
      expect(sidebarLabels).not.toContain(hidden)
    }
  })

  it("hides empty groups and disabled modules even with stale grants", () => {
    expect(buildProductSections([], permissions).map((section) => section.titleKey))
      .toEqual(["nav.sections.overview", "nav.sections.peoplePortal"])
    expect(buildProductSections(modules, [])).toEqual([])
  })

  it.each([
    ["inventory", "inventory.categories.read", "nav.assets", "/ativos/categorias"],
    ["rentals", "rentals.booking_policy.read", "nav.reservations", "/configuracoes/politica-reservas"],
    ["catalog", "core.registration_fields.read", "nav.peopleAccess", "/configuracoes/cadastro"],
  ])("keeps %s alternate-tab access without granting the main tab", (module, permission, label, path) => {
    const visible = filterNavigationItemsByAccess(appNavigationItems, [module], [permission])
    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({ labelKey: label, to: path })
    expect(firstPermittedProductPath([module], [permission])).toBe(path)
    expect(filterNavigationItemsByAccess(appNavigationItems, [], [permission])).toEqual([])
  })

  it("keeps library-only users under New plan without granting custom-plan creation", () => {
    const visible = filterNavigationItemsByAccess(appNavigationItems, ["pmoc"], ["pmoc.templates.read"])
    expect(visible[0]?.children).toMatchObject([
      { labelKey: "nav.pmocNew", to: "/pmoc/biblioteca" },
    ])
    expect(firstPermittedProductPath(["pmoc"], ["pmoc.templates.read"])).toBe("/pmoc/biblioteca")
  })
})
