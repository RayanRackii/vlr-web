import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { TrialBanner } from "@/components/layout/TrialBanner"
import { PlanLimitNotice } from "@/features/billing/components/PlanLimitNotice"
import { PAYMENT_POLL_INTERVAL_MS } from "@/features/billing/lib/usePaymentPolling"
import { BillingPlanPage } from "@/features/billing/pages/BillingPlanPage"
import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import {
  parseBillingPlans,
  tenantBillingSubscriptionSchema,
  type TenantBillingSubscription,
} from "@/features/billing/schemas/subscriptionSchemas"
import {
  cancelSubscription,
  changePlan,
  getBillingPlans,
  getMySubscription,
  startCheckout,
} from "@/features/billing/services/subscriptionService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

vi.mock("@/features/billing/services/subscriptionService", () => ({
  getMySubscription: vi.fn(),
  getBillingPlans: vi.fn(),
  startCheckout: vi.fn(),
  changePlan: vi.fn(),
  cancelSubscription: vi.fn(),
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

const getSubscription = vi.mocked(getMySubscription)
const getPlans = vi.mocked(getBillingPlans)
const checkout = vi.mocked(startCheckout)
const change = vi.mocked(changePlan)
const cancel = vi.mocked(cancelSubscription)

function plan(overrides: Partial<PublicPlan>): PublicPlan {
  return {
    id: "p-ess",
    packageKey: "reservas",
    planKey: "essencial",
    name: "Essencial",
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    currency: "BRL",
    modules: ["rentals"],
    limits: { rentableResources: 3, users: 3, units: 1, whatsappMessagesMonth: null },
    sortOrder: 1,
    ...overrides,
  }
}

const PLANS: PublicPlan[] = [
  plan({}),
  plan({ id: "p-pro", planKey: "profissional", name: "Profissional", monthlyPriceCents: 18900, annualPriceCents: 189000, sortOrder: 2 }),
]

function subscription(overrides: Record<string, unknown> = {}): TenantBillingSubscription {
  return tenantBillingSubscriptionSchema.parse({
    hasSubscription: true,
    subscriptionId: "s1",
    planCatalogId: "p-pro",
    packageKey: "reservas",
    planKey: "profissional",
    planName: "Profissional",
    billingCycle: "monthly",
    status: "active",
    billingMode: "provider",
    limitsUnlimited: false,
    currentPeriodEnd: "2026-12-21T00:00:00Z",
    nextChargeAt: "2026-12-21T00:00:00Z",
    effectiveDiscountPercent: 0,
    chargeCents: 18900,
    monthlyEquivalentCents: 18900,
    currency: "BRL",
    cancelAtPeriodEnd: false,
    planLimits: { assets: null, rentableResources: 8, users: 10, units: 1 },
    usage: { assets: 4, rentableResources: 8, users: 3, units: 1 },
    events: [
      { id: "e1", type: "payment_received", createdAt: "2026-11-21T10:00:00Z", valueCents: 18900, dueDate: "2026-11-20" },
    ],
    ...overrides,
  })
}

function setup(sub: TenantBillingSubscription, plans: PublicPlan[] = PLANS) {
  getSubscription.mockResolvedValue(sub)
  getPlans.mockResolvedValue({
    currentPlanCatalogId: sub.planCatalogId,
    currentPackageKey: sub.packageKey,
    currentBillingCycle: sub.billingCycle,
    plans,
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BillingPlanPage />
    </MemoryRouter>,
  )
}

function apiError(code: string, status = 409, extra: Record<string, unknown> = {}): AxiosError {
  return new AxiosError("fail", undefined, undefined, undefined, {
    status,
    statusText: "",
    data: { error: "x", code, ...extra },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BillingPlanPage states", () => {
  it.each([
    ["trialing", "Em teste", "Assinar"],
    ["active", "Ativa", "Trocar plano"],
    ["past_due", "Pagamento em atraso", "Trocar plano"],
    ["read_only", "Somente leitura", "Assinar"],
    ["canceled", "Cancelada", "Assinar"],
  ])("shows the %s chip and the right primary action", async (status, label, action) => {
    setup(subscription({ status }))
    renderPage()

    expect(await screen.findByText(label, { selector: "[data-status-tone]" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument()
    expect(screen.getByText("Profissional", { selector: "p" })).toBeInTheDocument()
  })

  it("offers cancel only while a paid plan runs and not after it was already canceled", async () => {
    setup(subscription({ cancelAtPeriodEnd: true }))
    renderPage()
    await screen.findByText("Plano atual")
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument()
    expect(screen.getByText(/Assinatura cancelada: o acesso completo continua até/)).toBeInTheDocument()
  })

  it("renders the pending plan notice, the discount and the payment history", async () => {
    setup(
      subscription({
        pendingPlanCatalogId: "p-ess",
        pendingBillingCycle: "monthly",
        effectiveDiscountPercent: 40,
        discountUntil: "2027-11-21T00:00:00Z",
      }),
    )
    renderPage()

    expect(await screen.findByText(/Troca de plano agendada: Essencial/)).toBeInTheDocument()
    expect(screen.getByText(/40% até/)).toBeInTheDocument()
    expect(screen.getByText("Pagamento recebido")).toBeInTheDocument()
  })

  it("shows usage bars against the limits and 'ilimitado' for null limits", async () => {
    setup(subscription())
    renderPage()
    await screen.findByText("Uso do plano")

    const resources = screen.getByTestId("usage-rentableResources")
    expect(within(resources).getByText("8 de 8")).toBeInTheDocument()
    expect(within(resources).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "8")
    const assets = screen.getByTestId("usage-assets")
    expect(within(assets).getByText("4 · ilimitado")).toBeInTheDocument()
    expect(within(assets).queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("treats limitsUnlimited as unlimited for every counter", async () => {
    setup(subscription({ limitsUnlimited: true }))
    renderPage()
    await screen.findByText("Uso do plano")
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0)
    expect(screen.getAllByText(/· ilimitado/)).toHaveLength(4)
  })

  it("explains a missing subscription and offers Assinar", async () => {
    setup(subscription({ hasSubscription: false, status: null, planCatalogId: null, events: [] }))
    renderPage()
    expect(await screen.findByText(/ainda não tem uma assinatura/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assinar" })).toBeInTheDocument()
  })

  it("cancels at period end after the confirm dialog", async () => {
    const user = userEvent.setup()
    setup(subscription())
    cancel.mockResolvedValue(subscription({ cancelAtPeriodEnd: true }))
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Cancelar assinatura" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(cancel).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Cancelar assinatura" }))

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Assinatura cancelada: o acesso completo/)).toBeInTheDocument()
  })

  it("maps billing error codes to friendly text", async () => {
    const user = userEvent.setup()
    setup(subscription())
    change.mockRejectedValueOnce(apiError("plan.usage_above_limit", 409, { limit: "users", current: 12, max: 10, planKey: "essencial" }))
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Trocar plano" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByTestId("checkout-plan-essencial"))
    await user.click(within(dialog).getByRole("button", { name: "Trocar plano" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/acima do limite do plano escolhido \(10\)/)
  })
})

describe("checkout dialog", () => {
  const trialing = () => subscription({ status: "trialing", planCatalogId: "p-pro" })

  async function openCheckout(user: ReturnType<typeof userEvent.setup>) {
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Assinar" }))
    return screen.findByRole("dialog")
  }

  it("renders the Pix QR and a copy button, and waits for payment", async () => {
    const user = userEvent.setup()
    setup(trialing())
    checkout.mockResolvedValue({ invoiceUrl: "https://pay.example/inv/1", pixQrCode: "QUJD", pixCopyPaste: "00020126pixcode" })

    const dialog = await openCheckout(user)
    await user.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }))

    const image = await within(dialog).findByRole("img", { name: "QR Code do Pix" })
    expect(image).toHaveAttribute("src", "data:image/png;base64,QUJD")
    expect(within(dialog).getByText(/Aguardando pagamento/)).toBeInTheDocument()
    expect(checkout).toHaveBeenCalledWith(
      { planCatalogId: "p-pro", billingCycle: "monthly", method: "pix" },
      expect.any(String),
    )

    await user.click(within(dialog).getByRole("button", { name: "Copiar" }))
    expect(await navigator.clipboard.readText()).toBe("00020126pixcode")
    expect(within(dialog).getByRole("link", { name: "Abrir fatura" })).toHaveAttribute("href", "https://pay.example/inv/1")
  })

  it.each([
    ["Cartão de crédito", "credit_card"],
    ["Boleto", "boleto"],
  ])("opens the invoice link for %s", async (label, method) => {
    const user = userEvent.setup()
    setup(trialing())
    checkout.mockResolvedValue({ invoiceUrl: "https://pay.example/inv/2", pixQrCode: null, pixCopyPaste: null })

    const dialog = await openCheckout(user)
    await user.click(within(dialog).getByRole("radio", { name: label }))
    await user.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }))

    const link = await within(dialog).findByRole("link", { name: "Abrir fatura" })
    expect(link).toHaveAttribute("href", "https://pay.example/inv/2")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(within(dialog).queryByRole("img", { name: "QR Code do Pix" })).not.toBeInTheDocument()
    expect(checkout.mock.calls[0]?.[0]).toMatchObject({ method })
  })

  it("does not render a non-http invoice url", async () => {
    const user = userEvent.setup()
    setup(trialing())
    checkout.mockResolvedValue({ invoiceUrl: "javascript:alert(1)", pixQrCode: null, pixCopyPaste: null })

    const dialog = await openCheckout(user)
    await user.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }))
    await within(dialog).findByText(/Aguardando pagamento/)
    expect(within(dialog).queryByRole("link", { name: "Abrir fatura" })).not.toBeInTheDocument()
  })

  it("reuses the Idempotency-Key when the same request is retried and uses a new one when it changes", async () => {
    const user = userEvent.setup()
    setup(trialing())
    checkout
      .mockRejectedValueOnce(apiError("billing.provider_error", 502))
      .mockRejectedValueOnce(apiError("billing.provider_error", 502))
      .mockResolvedValue({ invoiceUrl: "https://pay.example/i", pixQrCode: null, pixCopyPaste: null })

    const dialog = await openCheckout(user)
    const submit = within(dialog).getByRole("button", { name: "Continuar para o pagamento" })
    await user.click(submit)
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/provedor de pagamento não respondeu/)
    await user.click(submit)
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))
    expect(checkout.mock.calls[1]?.[1]).toBe(checkout.mock.calls[0]?.[1])

    await user.click(within(dialog).getByRole("radio", { name: "Boleto" }))
    await user.click(submit)
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(3))
    expect(checkout.mock.calls[2]?.[1]).not.toBe(checkout.mock.calls[0]?.[1])
  })

  it("shows the friendly text for billing.not_configured", async () => {
    const user = userEvent.setup()
    setup(trialing())
    checkout.mockRejectedValue(apiError("billing.not_configured", 503))

    const dialog = await openCheckout(user)
    await user.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Cobrança online ainda não disponível — fale com a Rolvix",
    )
  })

  it("polls the subscription while the dialog is open and stops once it is active", async () => {
    // Only the polling interval is faked; findBy*/userEvent keep their real timeouts.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    const user = userEvent.setup()
    setup(trialing())
    checkout.mockResolvedValue({ invoiceUrl: null, pixQrCode: "QUJD", pixCopyPaste: "code" })

    const dialog = await openCheckout(user)
    await user.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }))
    await within(dialog).findByRole("img", { name: "QR Code do Pix" })

    const callsBefore = getSubscription.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS * 2)
    })
    expect(getSubscription.mock.calls.length).toBe(callsBefore + 2)

    getSubscription.mockResolvedValue(subscription({ status: "active" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS)
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    const callsAfterPaid = getSubscription.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS * 4)
    })
    expect(getSubscription.mock.calls.length).toBe(callsAfterPaid)
  })
})

describe("tolerant readers", () => {
  it("reads a minimal subscription and a plans response with missing fields", () => {
    expect(tenantBillingSubscriptionSchema.parse({ hasSubscription: false })).toMatchObject({
      status: null,
      events: [],
      usage: { assets: 0, users: 0 },
      planLimits: {},
      cancelAtPeriodEnd: false,
    })
    expect(parseBillingPlans(null)).toMatchObject({ plans: [], currentPlanCatalogId: null })
  })
})

const baseUser: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: [],
  activeAssetFamilies: [],
  isTrial: true,
  isTrialReadOnly: false,
  trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.settings.billing"],
}

describe("links to the plan page", () => {
  it.each([
    ["active trial", { isTrialReadOnly: false }],
    ["read-only trial", { isTrialReadOnly: true, trialPurgeAt: new Date(Date.now() + 86400000 * 30).toISOString() }],
  ])("links the %s banner to /configuracoes/plano when the user may manage billing", (_name, extra) => {
    render(
      <MemoryRouter>
        <TestPermissionProvider currentUser={{ ...baseUser, ...extra }} permissions={["core.settings.billing"]}>
          <TrialBanner />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole("link", { name: "Ver plano e assinar" })).toHaveAttribute("href", "/configuracoes/plano")
  })

  it("shows no plan link in the banner without core.settings.billing", () => {
    render(
      <MemoryRouter>
        <TestPermissionProvider currentUser={{ ...baseUser, permissions: [] }}>
          <TrialBanner />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("sends plan.limit_reached 'ver planos' to the plan page with the permission and to /precos without", () => {
    const { unmount } = render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["core.settings.billing"]}>
          <PlanLimitNotice />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole("link", { name: "ver planos" })).toHaveAttribute("href", "/configuracoes/plano")
    unmount()

    render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["core.users.read"]}>
          <PlanLimitNotice />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole("link", { name: "ver planos" })).toHaveAttribute("href", "/precos")
  })
})

describe("permission gating", () => {
  function renderRoute(permissions: string[]) {
    return render(
      <MemoryRouter initialEntries={["/configuracoes/plano"]}>
        <TestPermissionProvider permissions={permissions}>
          <Routes>
            <Route element={<PermissionRoute permission="core.settings.billing" />}>
              <Route path="/configuracoes/plano" element={<h1>Plano e cobrança</h1>} />
            </Route>
          </Routes>
        </TestPermissionProvider>
      </MemoryRouter>,
    )
  }

  it("opens the route with core.settings.billing", () => {
    renderRoute(["core.settings.billing"])
    expect(screen.getByRole("heading", { name: "Plano e cobrança" })).toBeInTheDocument()
  })

  it("denies the route without core.settings.billing", () => {
    renderRoute(["core.users.read"])
    expect(screen.queryByRole("heading", { name: "Plano e cobrança" })).not.toBeInTheDocument()
  })
})
