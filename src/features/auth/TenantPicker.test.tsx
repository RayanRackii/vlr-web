import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TenantPicker } from "@/features/auth/TenantPicker"
import type { StaffTenantMembership } from "@/features/users/schemas/staffTenantSchemas"
import i18n from "@/lib/i18n"

const memberships: StaffTenantMembership[] = [
  { tenantId: "1", tradeName: "Espaço Aurora", legalName: "Aurora Serviços", subdomain: "aurora" },
  { tenantId: "2", tradeName: "Estúdio Horizonte", legalName: "Horizonte Serviços", subdomain: "studio-centro" },
  ...Array.from({ length: 5 }, (_, index) => ({
    tenantId: String(index + 3),
    tradeName: `Ambiente ${index + 3}`,
    legalName: `Serviços ${index + 3}`,
    subdomain: `ambiente-${index + 3}`,
  })),
]

describe("TenantPicker", () => {
  it("filters loaded tenants by name and subdomain and lets the keyboard select and confirm", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<TenantPicker memberships={memberships} initialTenantId="1" onConfirm={onConfirm} />)

    await user.tab()
    const search = screen.getByRole("searchbox", { name: i18n.t("auth.invite.pickerSearch") })
    expect(search).toHaveFocus()
    await user.type(search, "HORIZONTE")
    expect(screen.getAllByRole("radio")).toHaveLength(1)
    expect(screen.getByText("studio-centro")).toBeInTheDocument()
    expect(screen.queryByText("Espaço Aurora")).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "studio-centro")
    await user.tab()
    const tenant = screen.getByRole("radio", { name: /Estúdio Horizonte/ })
    expect(tenant).toHaveFocus()
    await user.keyboard(" ")
    expect(tenant).toBeChecked()
    await user.tab()
    expect(screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("2")
  })

  it("shows an empty search state and cannot confirm a filtered-out selection", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<TenantPicker memberships={memberships} initialTenantId="1" onConfirm={onConfirm} />)
    const search = screen.getByRole("searchbox")
    await user.type(search, "inexistente")
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("auth.invite.pickerNoResults"))
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") })).toBeDisabled()
    await user.clear(search)
    await user.type(search, "  espaco  ")
    expect(screen.getByRole("radio", { name: /Espaço Aurora/ })).toBeChecked()
    expect(screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") })).toBeEnabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("uses native arrow-key navigation without search for six or fewer tenants", async () => {
    const user = userEvent.setup()
    render(<TenantPicker memberships={memberships.slice(0, 6)} initialTenantId="1" onConfirm={vi.fn()} />)
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole("radio", { name: /Espaço Aurora/ })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("radio", { name: /Estúdio Horizonte/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /Estúdio Horizonte/ })).toHaveFocus()
  })

  it("shows an empty list state without enabling confirmation", () => {
    render(<TenantPicker memberships={[]} initialTenantId="" onConfirm={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("auth.invite.pickerEmpty"))
    expect(screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") })).toBeDisabled()
  })
})
