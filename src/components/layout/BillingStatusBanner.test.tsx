import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BillingStatusBanner } from "@/components/layout/BillingStatusBanner"
import { getMySubscription } from "@/features/billing/services/subscriptionService"
import { tenantBillingSubscriptionSchema } from "@/features/billing/schemas/subscriptionSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { queryClient } from "@/lib/queryClient"

vi.mock("@/features/billing/services/subscriptionService", () => ({ getMySubscription: vi.fn() }))

const user: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: [],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.settings.billing"],
}

function subscription(status: string) {
  return tenantBillingSubscriptionSchema.parse({ hasSubscription: true, status })
}

function renderBanner(currentUser: CurrentUser) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider currentUser={currentUser}>
        <BillingStatusBanner />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("BillingStatusBanner", () => {
  beforeEach(() => {
    queryClient.clear()
    vi.mocked(getMySubscription).mockReset()
  })

  it("warns about overdue payment and links to the plan page", async () => {
    vi.mocked(getMySubscription).mockResolvedValue(subscription("past_due"))
    renderBanner(user)
    expect(await screen.findByText(/Pagamento em atraso/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Plano e cobrança" })).toHaveAttribute("href", "/configuracoes/plano")
  })

  it("warns about a read-only account from billing", async () => {
    vi.mocked(getMySubscription).mockResolvedValue(subscription("read_only"))
    renderBanner(user)
    expect(await screen.findByText(/somente leitura por falta de pagamento/)).toBeInTheDocument()
  })

  it("shows nothing for a healthy subscription", async () => {
    vi.mocked(getMySubscription).mockResolvedValue(subscription("active"))
    renderBanner(user)
    await vi.waitFor(() => expect(getMySubscription).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("makes no request without the billing permission", () => {
    renderBanner({ ...user, permissions: [] })
    expect(getMySubscription).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("leaves trial tenants to the trial banner", () => {
    renderBanner({ ...user, isTrial: true, isTrialReadOnly: true })
    expect(getMySubscription).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
