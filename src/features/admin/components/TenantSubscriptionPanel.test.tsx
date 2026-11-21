import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantSubscriptionPanel } from "@/features/admin/components/TenantSubscriptionPanel"
import { buildSubscriptionRequest, toFormState } from "@/features/admin/lib/subscriptionForm"
import {
  tenantSubscriptionSchema,
  type PublicPlan,
  type TenantSubscription,
} from "@/features/billing/schemas/billingSchemas"
import {
  getPublicPlans,
  getTenantSubscription,
  putTenantSubscription,
} from "@/features/billing/services/billingService"
import i18n from "@/lib/i18n"

vi.mock("@/features/billing/services/billingService", () => ({
  getPublicPlans: vi.fn(),
  getTenantSubscription: vi.fn(),
  putTenantSubscription: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TENANT_ID = "11111111-1111-4111-8111-111111111111"
const PLAN_ID = "22222222-2222-4222-8222-222222222222"

const plans: PublicPlan[] = [
  {
    id: PLAN_ID,
    packageKey: "reservas",
    planKey: "profissional",
    name: "Profissional",
    monthlyPriceCents: 18900,
    annualPriceCents: 189000,
    currency: "BRL",
    modules: ["rentals"],
    limits: {},
    sortOrder: 2,
  },
]

function subscription(overrides: Record<string, unknown> = {}): TenantSubscription {
  return tenantSubscriptionSchema.parse({
    tenantId: TENANT_ID,
    hasSubscription: true,
    subscriptionId: "33333333-3333-4333-8333-333333333333",
    planCatalogId: PLAN_ID,
    packageKey: "reservas",
    planKey: "profissional",
    planName: "Profissional",
    status: "trialing",
    billingCycle: "monthly",
    billingMode: "provider",
    limitsUnlimited: false,
    discountPercent: 0,
    effectiveDiscountPercent: 0,
    monthlyEquivalentCents: 18900,
    currentPeriodEnd: "2026-12-21T12:00:00Z",
    events: [{ id: "e1", type: "created", createdAt: "2026-11-21T12:00:00Z" }],
    ...overrides,
  })
}

describe("TenantSubscriptionPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    vi.mocked(getPublicPlans).mockReset().mockResolvedValue(plans)
    vi.mocked(getTenantSubscription).mockReset().mockResolvedValue(subscription())
    vi.mocked(putTenantSubscription).mockReset()
  })

  it("shows the current subscription: status, monthly equivalent, discount and events", async () => {
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)

    expect(await screen.findByRole("heading", { name: "Assinatura" })).toBeInTheDocument()
    expect(screen.getAllByText("Em teste").length).toBeGreaterThan(0)
    expect(screen.getByText("Equivalente mensal").nextElementSibling).toHaveTextContent(/R\$\s?189/)
    expect(screen.getByText("Assinatura criada")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar assinatura" })).toBeDisabled()
  })

  it("sends only the changed fields: cycle, discount and the fundador coupon", async () => {
    const user = userEvent.setup()
    vi.mocked(putTenantSubscription).mockResolvedValue(
      subscription({ billingCycle: "annual", discountPercent: 40, effectiveDiscountPercent: 40 }),
    )
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)
    await screen.findByRole("heading", { name: "Assinatura" })

    await user.click(screen.getByRole("radio", { name: "Anual" }))
    await user.type(screen.getByLabelText("Cupom"), "fundador")
    await user.click(screen.getByRole("button", { name: "Salvar assinatura" }))

    await waitFor(() => {
      expect(putTenantSubscription).toHaveBeenCalledWith(TENANT_ID, {
        billingCycle: "annual",
        coupon: "fundador",
      })
    })
    expect(await screen.findByText("40%")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar assinatura" })).toBeDisabled()
  })

  it("sets manual billing, unlimited limits and a discount", async () => {
    const user = userEvent.setup()
    vi.mocked(putTenantSubscription).mockResolvedValue(subscription({ billingMode: "manual" }))
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)
    await screen.findByRole("heading", { name: "Assinatura" })

    await user.click(screen.getByRole("radio", { name: "Manual (fora do app)" }))
    await user.click(screen.getByLabelText("Limites do plano desligados (sem bloqueio por limite)"))
    await user.clear(screen.getByLabelText("Desconto (%)"))
    await user.type(screen.getByLabelText("Desconto (%)"), "100")
    await user.click(screen.getByRole("button", { name: "Salvar assinatura" }))

    await waitFor(() => {
      expect(putTenantSubscription).toHaveBeenCalledWith(TENANT_ID, {
        billingMode: "manual",
        limitsUnlimited: true,
        discountPercent: 100,
      })
    })
  })

  it("shows the API error and keeps the form editable when saving fails", async () => {
    const user = userEvent.setup()
    vi.mocked(putTenantSubscription).mockRejectedValue(new Error("Unknown coupon."))
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)
    await screen.findByRole("heading", { name: "Assinatura" })

    await user.type(screen.getByLabelText("Cupom"), "xpto")
    await user.click(screen.getByRole("button", { name: "Salvar assinatura" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown coupon.")
    expect(screen.getByRole("button", { name: "Salvar assinatura" })).toBeEnabled()
  })

  it("explains when the tenant has no subscription yet", async () => {
    vi.mocked(getTenantSubscription).mockResolvedValue(
      subscription({ hasSubscription: false, planCatalogId: null, status: null, events: [] }),
    )
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)

    expect(await screen.findByText(/ainda não tem assinatura/)).toBeInTheDocument()
    expect(screen.getByText("Nenhum evento registrado.")).toBeInTheDocument()
  })

  it("retries after a load failure", async () => {
    const user = userEvent.setup()
    vi.mocked(getTenantSubscription).mockRejectedValueOnce(new Error("boom"))
    render(<TenantSubscriptionPanel tenantId={TENANT_ID} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a assinatura.")
    await user.click(screen.getByRole("button", { name: i18n.t("common.retry") }))

    expect(await screen.findByRole("heading", { name: "Assinatura" })).toBeInTheDocument()
  })
})

describe("buildSubscriptionRequest", () => {
  it("is empty when nothing changed and clamps the discount to 0-100", () => {
    const current = subscription()
    expect(buildSubscriptionRequest(current, toFormState(current))).toEqual({})
    expect(
      buildSubscriptionRequest(current, { ...toFormState(current), discountPercent: "250" }),
    ).toEqual({ discountPercent: 100 })
    expect(
      buildSubscriptionRequest(current, { ...toFormState(current), discountPercent: "" }),
    ).toEqual({ discountPercent: 0 })
  })

  it("sends discountUntil as a UTC midnight instant and the plan id only when changed", () => {
    const current = subscription()
    expect(
      buildSubscriptionRequest(current, {
        ...toFormState(current),
        discountUntil: "2027-11-21",
        planCatalogId: "44444444-4444-4444-8444-444444444444",
        status: "active",
      }),
    ).toEqual({
      discountUntil: "2027-11-21T00:00:00Z",
      planCatalogId: "44444444-4444-4444-8444-444444444444",
      status: "active",
    })
  })
})
