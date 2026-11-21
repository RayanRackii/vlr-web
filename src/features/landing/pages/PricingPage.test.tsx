import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import { getPublicPlans } from "@/features/billing/services/billingService"
import { ArenasPage, PmocPage } from "@/features/landing/pages/VerticalLandingPage"
import { PricingPage } from "@/features/landing/pages/PricingPage"
import { landingManifest } from "@/features/landing/manifest"
import i18n from "@/lib/i18n"

vi.mock("@/features/billing/services/billingService", () => ({
  getPublicPlans: vi.fn(),
}))

function plan(overrides: Partial<PublicPlan>): PublicPlan {
  return {
    id: "id",
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
  plan({ id: "r1", planKey: "essencial", name: "Essencial", sortOrder: 1 }),
  plan({
    id: "r2",
    planKey: "profissional",
    name: "Profissional",
    monthlyPriceCents: 18900,
    annualPriceCents: 189000,
    limits: { rentableResources: 8, users: 10, units: 1, whatsappMessagesMonth: 500 },
    sortOrder: 2,
  }),
  plan({
    id: "r3",
    planKey: "completo",
    name: "Completo",
    monthlyPriceCents: 29900,
    annualPriceCents: 299000,
    limits: { rentableResources: 25, users: 30, units: 3, whatsappMessagesMonth: 2000 },
    sortOrder: 3,
  }),
  plan({
    id: "m1",
    packageKey: "manutencao",
    planKey: "essencial",
    name: "Essencial",
    modules: ["inventory", "pmoc", "os"],
    limits: { assets: 150, users: 2, units: 1, whatsappMessagesMonth: null },
    sortOrder: 1,
  }),
  plan({
    id: "m2",
    packageKey: "manutencao",
    planKey: "profissional",
    name: "Profissional",
    monthlyPriceCents: 18900,
    annualPriceCents: 189000,
    modules: ["inventory", "pmoc", "os"],
    limits: { assets: 800, users: 6, units: 1, whatsappMessagesMonth: 500 },
    sortOrder: 2,
  }),
]

function renderAt(url: string, element = <PricingPage />) {
  return render(<MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>)
}

function cardLink(planKey: string): string | null {
  const card = screen.getByTestId(`plan-card-${planKey}`)
  return within(card).getByRole("link", { name: "Começar teste grátis" }).getAttribute("href")
}

describe("PricingPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    window.sessionStorage.clear()
    vi.mocked(getPublicPlans).mockReset().mockResolvedValue(PLANS)
  })

  it("renders the three plans of the first package from the API with prices and limits", async () => {
    renderAt("/precos")

    const cards = await screen.findAllByTestId(/^plan-card-/)
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "plan-card-essencial",
      "plan-card-profissional",
      "plan-card-completo",
    ])
    const essencial = screen.getByTestId("plan-card-essencial")
    expect(essencial).toHaveTextContent(/R\$\s?99/)
    expect(essencial).toHaveTextContent("Recursos reserváveis: até 3")
    expect(essencial).toHaveTextContent("Usuários: até 3")
    expect(screen.getByTestId("plan-card-profissional")).toHaveTextContent(/R\$\s?189/)
    expect(screen.getByTestId("plan-card-profissional")).toHaveTextContent("Mais escolhido")
    expect(screen.getByTestId("plan-card-completo")).toHaveTextContent(
      "WhatsApp (em breve): 2000 mensagens/mês",
    )
  })

  it("shows no WhatsApp quota as not included, and sets the tab title", async () => {
    vi.mocked(getPublicPlans).mockResolvedValue([
      plan({ planKey: "essencial", limits: { rentableResources: 3, whatsappMessagesMonth: 0 } }),
    ])
    renderAt("/precos")

    const card = await screen.findByTestId("plan-card-essencial")
    expect(card).toHaveTextContent("WhatsApp não incluso")
    expect(card).not.toHaveTextContent("0 mensagens")
    expect(document.title).toBe("Preços · Rolvix")
  })

  it("switches package and shows that package's plans and limits", async () => {
    const user = userEvent.setup()
    renderAt("/precos")
    await screen.findByTestId("plan-card-essencial")

    await user.click(screen.getByRole("radio", { name: "Manutenção e PMOC" }))

    expect(screen.queryByTestId("plan-card-completo")).not.toBeInTheDocument()
    expect(screen.getByTestId("plan-card-essencial")).toHaveTextContent("Equipamentos e itens: até 150")
    expect(cardLink("essencial")).toBe("/onboarding?package=manutencao&plan=essencial")
  })

  it("preselects the package from the query", async () => {
    renderAt("/precos?package=manutencao")
    await screen.findByTestId("plan-card-profissional")

    expect(screen.getByRole("radio", { name: "Manutenção e PMOC" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("plan-card-essencial")).toHaveTextContent("Equipamentos e itens: até 150")
  })

  it("toggles to annual: monthly equivalent, yearly total and the 2 free months", async () => {
    const user = userEvent.setup()
    renderAt("/precos")
    await screen.findByTestId("plan-card-essencial")

    expect(screen.getByTestId("plan-card-essencial")).toHaveTextContent("cobrado mensalmente")
    await user.click(screen.getByRole("radio", { name: "Anual" }))

    const essencial = screen.getByTestId("plan-card-essencial")
    expect(essencial).toHaveTextContent(/R\$\s?83/)
    expect(essencial).toHaveTextContent(/cobrado R\$\s?990 por ano/)
    expect(essencial).toHaveTextContent("2 meses grátis")
    expect(screen.getByText("2 meses grátis")).toBeInTheDocument()
  })

  it("carries package, plan and utm/ref into the onboarding link", async () => {
    renderAt("/precos?package=reservas&utm_source=google&utm_campaign=arenas&ref=ana&other=1")
    await screen.findByTestId("plan-card-profissional")

    expect(cardLink("profissional")).toBe(
      "/onboarding?package=reservas&plan=profissional&utm_source=google&utm_campaign=arenas&ref=ana",
    )
  })

  it("lists the add-ons and the FAQ with no lock-in, no setup fee, Pix/card/boleto and 30 days", async () => {
    renderAt("/precos")
    await screen.findByTestId("plan-card-essencial")

    const addOns = screen.getByRole("region", { name: "Complementos" })
    expect(addOns).toHaveTextContent("Módulo extra")
    expect(addOns).toHaveTextContent(/R\$\s?69\/mês/)
    expect(addOns).toHaveTextContent(/R\$\s?49\/mês/)
    expect(addOns).toHaveTextContent(/R\$\s?59 por pacote/)

    const faq = screen.getByRole("region", { name: "Perguntas frequentes" })
    expect(within(faq).getByText("Existe fidelidade?")).toBeInTheDocument()
    expect(within(faq).getByText("Tem taxa de adesão?")).toBeInTheDocument()
    expect(within(faq).getByText("Por Pix, cartão de crédito ou boleto.")).toBeInTheDocument()
    expect(faq).toHaveTextContent("30 dias de uso")
  })

  it("shows an error with retry when the API fails and recovers", async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicPlans).mockRejectedValueOnce(new Error("down"))
    renderAt("/precos")

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os planos agora.")
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }))

    expect(await screen.findByTestId("plan-card-essencial")).toBeInTheDocument()
  })

  it("renders in English and Spanish", async () => {
    await i18n.changeLanguage("en")
    renderAt("/precos")
    expect(await screen.findByRole("heading", { level: 1, name: "Clear pricing, by package" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Start free trial" })).toHaveLength(3)
    await i18n.changeLanguage("pt-BR")
  })

  it("is registered as a public route next to the vertical landings", () => {
    const paths = landingManifest.routes.public.map((route) => route.path)
    expect(paths).toEqual(expect.arrayContaining(["/precos", "/arenas", "/pmoc"]))
  })
})

describe("vertical landings", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    window.sessionStorage.clear()
    vi.mocked(getPublicPlans).mockReset().mockResolvedValue(PLANS)
  })

  it("renders the arenas landing with the reservas package teaser and CTA", async () => {
    renderAt("/arenas?utm_source=instagram", <ArenasPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Sua quadra reservada online, sem caderno e sem horário duplicado.",
      }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Para arenas, quadras e clubes · Rolvix")
    expect(screen.getByText("Agenda e mapa de reservas")).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/Pix|paga pelo cliente/)
    expect(screen.getByText("Fila de espera para horário cheio")).toBeInTheDocument()
    expect(await screen.findByText(/a partir de R\$\s?99\/mês/)).toBeInTheDocument()

    const cta = screen.getAllByRole("link", { name: "Começar teste grátis" })[0]
    expect(cta).toHaveAttribute("href", "/onboarding?package=reservas&utm_source=instagram")
    expect(screen.getByRole("link", { name: "Ver todos os planos" })).toHaveAttribute(
      "href",
      "/precos?package=reservas&utm_source=instagram",
    )
  })

  it("renders the PMOC landing from the same generic component with its own data", async () => {
    renderAt("/pmoc", <PmocPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "PMOC em dia e relatório pronto no fim da visita, mesmo sem internet.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Ordem de serviço no celular, offline")).toBeInTheDocument()
    expect(document.title).toBe("Para empresas de climatização e refrigeração · Rolvix")
    expect(await screen.findByText(/a partir de R\$\s?99\/mês/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Começar teste grátis" })[0]).toHaveAttribute(
      "href",
      "/onboarding?package=manutencao",
    )
  })

  it("still shows the CTA when the plans API is down", async () => {
    vi.mocked(getPublicPlans).mockRejectedValue(new Error("down"))
    renderAt("/arenas", <ArenasPage />)

    await waitFor(() => {
      expect(screen.getByText("Veja os planos e preços atualizados.")).toBeInTheDocument()
    })
    expect(screen.getAllByRole("link", { name: "Começar teste grátis" }).length).toBeGreaterThan(0)
  })
})
