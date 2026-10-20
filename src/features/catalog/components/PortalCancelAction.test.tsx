import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PortalCancelAction } from "./PortalCancelAction"
import { getPortalCatalogPolicy } from "@/features/catalog/services/catalogPortalService"
import type { PortalCatalogPolicy } from "@/features/catalog/schemas/catalogPolicySchemas"
import i18n from "@/lib/i18n"
vi.mock("@/features/catalog/services/catalogPortalService", () => ({ getPortalCatalogPolicy: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const policy: PortalCatalogPolicy = { canCancelOrders: true, canCancelRequests: true, upToStatus: { orders: "Approved", requests: "Submitted" }, policyText: "No refunds.\nContact support." }
const cancelName = () => i18n.t("tenantPortal.catalog.cancelOrder")

describe("PortalCancelAction", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getPortalCatalogPolicy).mockResolvedValue(policy) })
  it("shows policy as plain text and keeps the confirmation open on a server error", async () => {
    const user = userEvent.setup()
    const cancel = vi.fn().mockRejectedValue(new Error("The order changed. Reload and try again."))
    render(<PortalCancelAction kind="orders" status="Approved" cancel={cancel} />)
    await user.click(await screen.findByRole("button", { name: cancelName() }))
    expect(await screen.findByText("No refunds. Contact support.")).toHaveClass("whitespace-pre-wrap")
    await user.click(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.cancelConfirmAction") }))
    expect(await screen.findByRole("alert")).toHaveTextContent("The order changed. Reload and try again.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.cancelConfirmAction") })).toBeEnabled()
  })
  it.each(["Preparing", "Ready", "Completed", "Rejected", "Cancelled", "Unknown"])("hides cancellation at disallowed status %s", async (status) => {
    render(<PortalCancelAction kind="orders" status={status} cancel={vi.fn()} />)
    await act(async () => {})
    expect(screen.queryByRole("button", { name: cancelName() })).not.toBeInTheDocument()
  })
  it.each(["orders", "requests"] as const)("hides cancellation when %s are disabled", async (kind) => {
    vi.mocked(getPortalCatalogPolicy).mockResolvedValue({ ...policy, canCancelOrders: false, canCancelRequests: false })
    render(<PortalCancelAction kind={kind} status={kind === "orders" ? "Requested" : "Submitted"} cancel={vi.fn()} />)
    await act(async () => {})
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
  it("waits for policy and allows retry after failure without falling back", async () => {
    vi.mocked(getPortalCatalogPolicy).mockRejectedValueOnce(new Error("Policy unavailable"))
    const user = userEvent.setup()
    render(<PortalCancelAction kind="orders" status="Requested" cancel={vi.fn()} />)
    expect(screen.queryByRole("button", { name: cancelName() })).not.toBeInTheDocument()
    expect(await screen.findByRole("alert")).toHaveTextContent("Policy unavailable")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
    expect(await screen.findByRole("button", { name: cancelName() })).toBeInTheDocument()
  })
  it("prevents repeated confirmation for requests", async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    const cancel = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<PortalCancelAction kind="requests" status="Submitted" cancel={cancel} />)
    await user.click(await screen.findByRole("button", { name: i18n.t("tenantPortal.catalog.cancelRequest") }))
    const confirm = screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.cancelConfirmAction") })
    fireEvent.click(confirm); fireEvent.click(confirm)
    expect(cancel).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })
})
