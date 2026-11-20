import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect, it } from "vitest"
import { CalendarDays, ShoppingCart } from "lucide-react"
import i18n from "@/lib/i18n"
import { CustomerSidebar } from "./CustomerSidebar"

const items = [
  { id: "customer-home", label: "Início", to: "/t/club/app", icon: CalendarDays, end: true },
  { id: "customer-cart", label: "Carrinho", to: "/t/club/app/carrinho", icon: ShoppingCart },
]

it("renders brand, nav with the active item, cart count and the user chip", () => {
  render(
    <MemoryRouter initialEntries={["/t/club/app"]}>
      <CustomerSidebar brandLabel="Club" items={items} cartQuantity={3} userLabel="Ana Souza" />
    </MemoryRouter>,
  )
  expect(screen.getByTitle("Club")).toBeInTheDocument()
  expect(screen.getByText(i18n.t("tenantPortal.redesign.customerPortal"))).toBeInTheDocument()
  const nav = screen.getByRole("navigation", { name: i18n.t("nav.menu") })
  expect(within(nav).getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page")
  const cart = within(nav).getByRole("link", { name: "Carrinho (3)" })
  expect(cart).not.toHaveAttribute("aria-current")
  expect(cart).toHaveTextContent("3")
  expect(screen.getByTitle("Ana Souza")).toBeInTheDocument()
  expect(screen.getByText("AS")).toBeInTheDocument()
  expect(screen.getByText(i18n.t("tenantPortal.redesign.customer"))).toBeInTheDocument()
})
