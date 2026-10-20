import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CatalogPolicyPage } from "./CatalogPolicyPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCatalogPolicy, saveCatalogPolicy } from "@/features/catalog/services/catalogService"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({ getCatalogPolicy: vi.fn(), saveCatalogPolicy: vi.fn() }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const policy = { customerCanCancelOrders: true, orderCancelableUpToStatus: "Requested" as const, customerCanCancelRequests: false, requestCancelableUpToStatus: "Submitted" as const, cancellationPolicyText: null }
function renderPage(permissions = ["catalog.products.manage"]) {
  return render(<TestPermissionProvider permissions={permissions}><CatalogPolicyPage /></TestPermissionProvider>)
}
describe("CatalogPolicyPage", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getCatalogPolicy).mockResolvedValue(policy); vi.mocked(saveCatalogPolicy).mockImplementation(async (data) => data) })
  it("loads and saves the complete tenant policy, including toggles and optional text", async () => {
    const user = userEvent.setup()
    renderPage()
    const text = await screen.findByRole("textbox", { name: i18n.t("catalog.policy.text") })
    expect(text).toHaveAttribute("maxlength", "2000")
    await user.type(text, "Sem reembolso.")
    await user.click(screen.getByRole("switch", { name: i18n.t("catalog.policy.requestsEnabled") }))
    await user.click(screen.getByRole("combobox", { name: i18n.t("catalog.policy.ordersUpTo") }))
    await user.click(await screen.findByRole("option", { name: i18n.t("catalog.status.Ready") }))
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(saveCatalogPolicy).toHaveBeenCalledWith({ ...policy, customerCanCancelRequests: true, orderCancelableUpToStatus: "Ready", cancellationPolicyText: "Sem reembolso." }))
  })
  it("sends null to clear optional text", async () => {
    vi.mocked(getCatalogPolicy).mockResolvedValue({ ...policy, cancellationPolicyText: "Old policy" })
    const user = userEvent.setup(); renderPage()
    await user.clear(await screen.findByRole("textbox", { name: i18n.t("catalog.policy.text") }))
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(saveCatalogPolicy).toHaveBeenCalledWith(policy))
  })
  it("retains edits and server message after save failure", async () => {
    const { toast } = await import("sonner")
    vi.mocked(saveCatalogPolicy).mockRejectedValue(new Error("Policy rejected"))
    const user = userEvent.setup(); renderPage()
    const text = await screen.findByRole("textbox", { name: i18n.t("catalog.policy.text") })
    await user.type(text, "Policy text")
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Policy rejected"))
    expect(text).toHaveValue("Policy text")
    expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeEnabled()
  })
  it("does not fetch or save without the manage permission", () => {
    renderPage([])
    expect(getCatalogPolicy).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: i18n.t("common.save") })).not.toBeInTheDocument()
  })
  it("shows load failures with retry and no editable defaults", async () => {
    vi.mocked(getCatalogPolicy).mockRejectedValueOnce(new Error("Policy unavailable"))
    const user = userEvent.setup(); renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent("Policy unavailable")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
    expect(await screen.findByRole("textbox")).toBeInTheDocument()
  })
})
