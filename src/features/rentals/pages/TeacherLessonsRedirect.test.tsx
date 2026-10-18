import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { SchedulePage } from "@/features/rentals/pages/SchedulePage"
import {
  fetchAdminScheduleDay,
  listAdminRentalAssets,
} from "@/features/rentals/services/scheduleService"
import { PermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCurrentUser } from "@/features/users/services/usersService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-a", email: "teacher@example.com", app_metadata: {} },
    session: {},
    isLoading: false,
  }),
}))

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({
    isPlatformAdmin: false,
    isInTenantEnvironment: false,
    activeTenantId: null,
    activeTenantLabel: null,
    clearTenantLabel: () => undefined,
  }),
}))

vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()
  return {
    ...actual,
    createTeacherLesson: vi.fn(),
    fetchAdminScheduleDay: vi.fn(),
    listAdminRentalAssets: vi.fn(),
    removeTeacherLesson: vi.fn(),
  }
})

const getCurrentUserMock = vi.mocked(getCurrentUser)

const professor: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Professor",
  email: "teacher@example.com",
  role: "USER",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: [
    "rentals.assets.read",
    "rentals.occupancy_kinds.read",
    "rentals.schedule.read",
    "rentals.schedule.lessons.write",
  ],
}

const court = {
  id: "11111111-1111-1111-1111-111111111111",
  assetId: "21111111-1111-1111-1111-111111111111",
  name: "Quadra 1",
  isActive: true,
  requiresDeposit: true,
  schedulePolicy: "SlotGrid" as const,
  unitId: "31111111-1111-1111-1111-111111111111",
  type: "Location" as const,
  totalQuantity: 1,
  queueEnabled: false,
}

function renderAgenda(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PermissionProvider>
        <Routes>
          <Route element={<DashboardHomeRoute />}>
            <Route path="/dashboard" element={<h1>Painel</h1>} />
          </Route>
          <Route element={<PermissionRoute permission="rentals.schedule.read" />}>
            <Route path="/configuracoes/agenda" element={<SchedulePage />} />
          </Route>
        </Routes>
      </PermissionProvider>
    </MemoryRouter>,
  )
}

describe("teacher agenda after the dashboard redirect", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    getCurrentUserMock.mockResolvedValue(professor)
    vi.mocked(listAdminRentalAssets).mockResolvedValue([court])
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: [],
    }))
  })

  it("selects the first resource the same way as opening the agenda directly", async () => {
    const redirected = renderAgenda("/dashboard")

    const courtLabel = i18n.t("rentals.teacherLessons.court")
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: courtLabel })).toHaveTextContent(
        "Quadra 1",
      )
    })
    const fromDashboard = screen.getByRole("combobox", { name: courtLabel })
    expect(fromDashboard).toBeEnabled()
    expect(
      screen.queryByText(i18n.t("rentals.teacherLessons.loadingResources")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("rentals.teacherLessons.loading")),
    ).not.toBeInTheDocument()

    redirected.unmount()
    renderAgenda("/configuracoes/agenda")

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: courtLabel })).toHaveTextContent(
        "Quadra 1",
      )
    })
    const direct = screen.getByRole("combobox", { name: courtLabel })
    expect(direct).toBeEnabled()
  })
})
