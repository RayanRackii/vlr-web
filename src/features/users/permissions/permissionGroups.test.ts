import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import {
  groupPermissionsByModule,
  resolvePermissionRouteAccess,
} from "@/features/users/permissions/permissionGroups"
import {
  isRbacErrorCode,
  mapRbacErrorMessage,
} from "@/features/users/permissions/rbacErrors"

describe("permission grouping", () => {
  it("groups by module/resource and marks inactive tenant modules", () => {
    const groups = groupPermissionsByModule(
      [
        {
          key: "core.dashboard.read",
          name: "Read dashboard",
          moduleKey: null,
          resource: "dashboard",
        },
        {
          key: "inventory.assets.read",
          name: "Read assets",
          moduleKey: "inventory",
          resource: "assets",
        },
        {
          key: "pmoc.plans.read",
          name: "Read plans",
          moduleKey: "pmoc",
          resource: "plans",
        },
      ],
      ["inventory"],
    )

    expect(groups.map((group) => group.moduleKey)).toEqual([
      null,
      "inventory",
      "pmoc",
    ])
    expect(groups[0]?.moduleInactive).toBe(false)
    expect(groups[1]?.moduleInactive).toBe(false)
    expect(groups[2]?.moduleInactive).toBe(true)
  })
})

describe("permission route access", () => {
  it("denies after load when the permission is missing", () => {
    expect(
      resolvePermissionRouteAccess({
        isLoading: false,
        hasPermission: false,
        isPlatformAdminOutsideTenant: false,
        permission: "core.users.read",
      }),
    ).toBe("deny")
  })

  it("allows dashboard for PlatformAdmin outside a tenant", () => {
    expect(
      resolvePermissionRouteAccess({
        isLoading: false,
        hasPermission: false,
        isPlatformAdminOutsideTenant: true,
        permission: "core.dashboard.read",
      }),
    ).toBe("allow")
  })
})

describe("RBAC error mapping", () => {
  it("maps known codes to i18n instead of the raw code", () => {
    expect(isRbacErrorCode("ROLE_IN_USE")).toBe(true)
    const message = mapRbacErrorMessage("ROLE_IN_USE", "fallback")
    expect(message).not.toBe("ROLE_IN_USE")
    expect(message).toBe(
      "Esta função está em uso e não pode ser excluída.",
    )
    expect(message).toBe(i18n.t("rbac.errors.ROLE_IN_USE"))
  })
})
