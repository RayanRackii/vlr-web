import { render, screen, waitFor, within } from "@testing-library/react"
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
  it("saves the sentence rows with the same payload, opening the optional text on demand", async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByTestId("rule-orders")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.policy.addText") }))
    const text = await screen.findByRole("textbox", { name: i18n.t("catalog.policy.text") })
    expect(text).toHaveAttribute("maxlength", "2000")
    expect(screen.queryByText(/2000/)).not.toBeInTheDocument()
    await user.click(text)
    expect(screen.getByText(/0 \/ 2000/)).toBeInTheDocument()
    await user.type(text, "Sem reembolso.")
    await user.click(within(screen.getByTestId("rule-requests")).getByRole("checkbox"))
    await user.click(screen.getByRole("combobox", { name: i18n.t("catalog.policy.ordersUpTo") }))
    await user.click(await screen.findByRole("option", { name: i18n.t("catalog.status.Ready") }))
    expect(screen.getAllByRole("button", { name: i18n.t("common.save") })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(saveCatalogPolicy).toHaveBeenCalledWith({ ...policy, customerCanCancelRequests: true, orderCancelableUpToStatus: "Ready", cancellationPolicyText: "Sem reembolso." }))
    expect(saveCatalogPolicy).toHaveBeenCalledTimes(1)
  })
  it("hides the status select when cancellation is not allowed and saves the flag", async () => {
    const user = userEvent.setup(); renderPage()
    await screen.findByTestId("rule-orders")
    expect(screen.getByRole("combobox", { name: i18n.t("catalog.policy.ordersUpTo") })).toBeInTheDocument()
    await user.click(within(screen.getByTestId("rule-orders")).getByRole("checkbox"))
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(screen.getByTestId("rule-requests")).getByRole("checkbox")).toBeChecked()
    expect(within(screen.getByTestId("rule-requests")).queryByRole("combobox")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(saveCatalogPolicy).toHaveBeenCalledWith({ ...policy, customerCanCancelOrders: false }))
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
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.policy.addText") }))
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
    expect(await screen.findByTestId("rule-orders")).toBeInTheDocument()
  })
})
