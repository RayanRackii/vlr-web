import { describe, expect, it } from "vitest"

import {
  getRoleEditorPolicy,
  listAssignableRoles,
  listVisibleRoles,
} from "@/features/users/permissions/rolePolicy"

describe("role editor policy", () => {
  it("makes system Admin fully readonly with Sistema treatment", () => {
    const policy = getRoleEditorPolicy({
      name: "Admin",
      isSystemRole: true,
    })

    expect(policy.kind).toBe("admin")
    expect(policy.isFullyReadonly).toBe(true)
    expect(policy.canRename).toBe(false)
    expect(policy.canDelete).toBe(false)
    expect(policy.canEditPermissions).toBe(false)
    expect(policy.visibleInList).toBe(true)
    expect(policy.offeredInPicker).toBe(true)
  })

  it("locks User name and delete but allows editing permissions", () => {
    const policy = getRoleEditorPolicy({
      name: "User",
      isSystemRole: true,
    })

    expect(policy.kind).toBe("user")
    expect(policy.canRename).toBe(false)
    expect(policy.canDelete).toBe(false)
    expect(policy.canEditPermissions).toBe(true)
    expect(policy.isFullyReadonly).toBe(false)
  })

  it("hides SuperAdmin from the list and picker", () => {
    const roles = [
      { id: "1", name: "SuperAdmin", isSystemRole: true },
      { id: "2", name: "Admin", isSystemRole: true },
      { id: "3", name: "Atendente", isSystemRole: false },
    ]

    expect(listVisibleRoles(roles).map((role) => role.name)).toEqual([
      "Admin",
      "Atendente",
    ])
    expect(listAssignableRoles(roles).map((role) => role.name)).toEqual([
      "Admin",
      "Atendente",
    ])
  })

  it("allows rename, permissions, and delete for custom roles", () => {
    const policy = getRoleEditorPolicy({
      name: "Atendente",
      isSystemRole: false,
    })

    expect(policy.kind).toBe("custom")
    expect(policy.canRename).toBe(true)
    expect(policy.canDelete).toBe(true)
    expect(policy.canEditPermissions).toBe(true)
  })
})
