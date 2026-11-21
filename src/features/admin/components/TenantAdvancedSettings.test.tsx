import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantAdvancedSettings } from "@/features/admin/components/TenantAdvancedSettings"
import {
  getAdminTenantBooleanSetting,
  putAdminTenantBooleanSetting,
} from "@/features/admin/services/adminTenantSettingsService"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/admin/services/adminTenantSettingsService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/services/adminTenantSettingsService")
  >("@/features/admin/services/adminTenantSettingsService")
  return {
    ...actual,
    getAdminTenantBooleanSetting: vi.fn(),
    putAdminTenantBooleanSetting: vi.fn(),
  }
})

const getMock = vi.mocked(getAdminTenantBooleanSetting)
const putMock = vi.mocked(putAdminTenantBooleanSetting)

describe("TenantAdvancedSettings", () => {
  beforeEach(() => {
    getMock.mockReset()
    putMock.mockReset()
  })

  it("loads the switch state and saves a toggle", async () => {
    getMock.mockResolvedValue(false)
    putMock.mockResolvedValue(true)
    render(<TenantAdvancedSettings tenantId="t1" />)

    const toggle = await screen.findByRole("switch", {
      name: i18n.t("admin.edit.advanced.bookingUi.label"),
    })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).not.toBeChecked()

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
    expect(putMock).toHaveBeenCalledWith("t1", "rentals.booking_ui.enabled", true)
  })

  it("keeps the previous state when saving fails", async () => {
    getMock.mockResolvedValue(true)
    putMock.mockRejectedValue(new Error("nope"))
    render(<TenantAdvancedSettings tenantId="t1" />)

    const toggle = await screen.findByRole("switch")
    await waitFor(() => expect(toggle).toBeEnabled())
    await userEvent.click(toggle)

    await waitFor(() => expect(putMock).toHaveBeenCalled())
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).toBeChecked()
  })

  it("shows a retry when the load fails", async () => {
    getMock.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(true)
    render(<TenantAdvancedSettings tenantId="t1" />)

    await userEvent.click(
      await screen.findByRole("button", { name: i18n.t("common.retry") }),
    )

    const toggle = await screen.findByRole("switch")
    await waitFor(() => expect(toggle).toBeChecked())
  })
})
