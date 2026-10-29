import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, expect, it } from "vitest"
import { clearCustomerSession, persistCustomerSession } from "@/features/tenantPortal/services/tenantPortalService"
import { CustomerSidebar } from "../CustomerSidebar"
import { PortalBookingHeader } from "./PortalBookingHeader"

afterEach(() => clearCustomerSession())

it.each([
  ["ana.silva@example.com", "ana", "ana silva", "AS"],
  ["Ana Silva", "Ana", "Ana Silva", "AS"],
])("derives the greeting and avatar from the display name for %s", (label, greeting, displayName, initials) => {
  persistCustomerSession("customer-token", "ficc", label)
  render(<MemoryRouter><PortalBookingHeader /><CustomerSidebar brandLabel="Club" items={[]} userLabel={label} /></MemoryRouter>)
  expect(screen.getByText(`Olá, ${greeting}`)).toBeInTheDocument()
  expect(screen.getByTitle(displayName)).toHaveTextContent(displayName)
  expect(document.querySelector(".portal-avatar")).toHaveTextContent(initials)
})
