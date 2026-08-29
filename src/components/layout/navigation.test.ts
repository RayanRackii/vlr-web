import { LayoutDashboard } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  filterNavigationItemsByAccess,
  appNavigationItems,
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
})
