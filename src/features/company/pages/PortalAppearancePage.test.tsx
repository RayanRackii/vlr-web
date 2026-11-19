import { AxiosError } from "axios"
import { toast } from "sonner"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PortalAppearancePage } from "@/features/company/pages/PortalAppearancePage"
import {
  deletePortalLandingImage,
  getPortalAppearance,
  updatePortalAppearance,
  uploadPortalLandingImage,
} from "@/features/company/services/portalAppearanceService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const trial = vi.hoisted(() => ({ readOnly: false }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({ isLoading: false, isTrial: false, isTrialReadOnly: trial.readOnly, trialEndsAt: undefined, trialPurgeAt: undefined }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  getHostTenantSubdomain: () => null,
  fetchTenantBranding: vi.fn(),
}))
vi.mock("@/features/company/services/portalAppearanceService", () => ({
  getPortalAppearance: vi.fn(),
  updatePortalAppearance: vi.fn(),
  uploadPortalLandingImage: vi.fn(),
  deletePortalLandingImage: vi.fn(),
}))

const base = { landingImageUrl: null, landingKicker: "Bem-vindo", landingHeadline: "Clube do Bairro", landingSubtitle: "Reserve rapido", welcomeTagline: "Tagline" }
const withImage = { ...base, landingImageUrl: "https://cdn.test/landing.jpg" }

function renderPage(permissions: string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}><PortalAppearancePage /></TestPermissionProvider>
    </MemoryRouter>,
  )
}

function axiosFailure(status: number, error = "x") {
  return new Error("raw english text", { cause: new AxiosError("x", "ERR", undefined, undefined, { status, data: { error }, statusText: "", headers: {}, config: {} as never }) })
}

const png = () => new File(["a"], "a.png", { type: "image/png" })

describe("PortalAppearancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trial.readOnly = false
    vi.mocked(getPortalAppearance).mockResolvedValue(base as never)
    vi.mocked(updatePortalAppearance).mockResolvedValue(base as never)
  })

  it("loads the texts and counters and previews them", async () => {
    renderPage(["core.company.write"])
    expect(await screen.findByLabelText("Chamada")).toHaveValue("Bem-vindo")
    expect(screen.getByTestId("portal-counter-landingKicker")).toHaveTextContent("9/60")
    expect(screen.getByTestId("portal-counter-landingHeadline")).toHaveTextContent("15/120")
    expect(screen.getByTestId("portal-counter-landingSubtitle")).toHaveTextContent("14/240")
    expect(screen.getByTestId("portal-hero-preview-headline")).toHaveTextContent("Clube do Bairro")
    expect(screen.queryByTestId("portal-hero-preview-image")).not.toBeInTheDocument()
  })

  it("updates the preview as the user types, and falls back to defaults when blank", async () => {
    const user = userEvent.setup()
    renderPage(["core.company.write"])
    const headline = await screen.findByLabelText("Título")
    await user.clear(headline)
    await user.type(headline, "Novo titulo")
    expect(screen.getByTestId("portal-hero-preview-headline")).toHaveTextContent("Novo titulo")
    await user.clear(screen.getByLabelText("Subtítulo"))
    expect(screen.getByTestId("portal-hero-preview-subtitle")).toHaveTextContent("Tagline")
    await user.clear(screen.getByLabelText("Chamada"))
    expect(screen.queryByTestId("portal-hero-preview-kicker")).not.toBeInTheDocument()
  })

  it("saves all three texts, blank as null", async () => {
    const user = userEvent.setup()
    renderPage(["core.company.write"])
    await user.clear(await screen.findByLabelText("Chamada"))
    const save = screen.getByRole("button", { name: "Salvar" })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)
    await waitFor(() => expect(updatePortalAppearance).toHaveBeenCalledWith({
      landingKicker: null,
      landingHeadline: "Clube do Bairro",
      landingSubtitle: "Reserve rapido",
    }))
    expect(toast.success).toHaveBeenCalledWith(i18n.t("portalAppearance.saved"))
  })

  it("blocks text over the limit and keeps Salvar disabled", async () => {
    renderPage(["core.company.write"])
    const kicker = await screen.findByLabelText("Chamada")
    fireEvent.change(kicker, { target: { value: "x".repeat(61) } })
    expect(await screen.findByText(i18n.t("portalAppearance.validation.kickerTooLong", { max: 60 }))).toBeInTheDocument()
    expect(screen.getByTestId("portal-counter-landingKicker")).toHaveTextContent("61/60")
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
  })

  async function saveWithApiError(status: number, error: string) {
    const user = userEvent.setup()
    vi.mocked(updatePortalAppearance).mockRejectedValueOnce(axiosFailure(status, error))
    renderPage(["core.company.write"])
    await user.type(await screen.findByLabelText("Título"), " 2")
    const save = screen.getByRole("button", { name: "Salvar" })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)
    await waitFor(() => expect(updatePortalAppearance).toHaveBeenCalled())
  }

  it("maps a 400 about the headline to that field without raw API text", async () => {
    await saveWithApiError(400, "LandingHeadline is too long.")
    expect(await screen.findByText(i18n.t("portalAppearance.validation.headlineTooLong", { max: 120 }))).toBeInTheDocument()
    expect(screen.queryByText(/too long/)).not.toBeInTheDocument()
  })

  it("shows a localized toast for any other 400", async () => {
    await saveWithApiError(400, "Something odd.")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t("portalAppearance.saveInvalid")))
  })

  it("shows the localized trial message on a 409", async () => {
    await saveWithApiError(409, "Trial is read-only.")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t("portalAppearance.trialReadOnly")))
  })

  it("uploads a picked image, shows progress and the preview image, and keeps unsaved text", async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => undefined
    vi.mocked(uploadPortalLandingImage).mockImplementation((_file, onProgress) => {
      onProgress?.(40)
      return new Promise((resolve) => { finish = resolve }) as never
    })
    renderPage(["core.company.write"])
    await user.type(await screen.findByLabelText("Título"), "!")
    await user.upload(screen.getByTestId("portal-image-input"), png())
    expect(await screen.findByTestId("portal-image-progress")).toHaveTextContent("40%")
    expect(screen.getByTestId("portal-image-input")).toBeDisabled()
    finish(withImage)
    expect(await screen.findByTestId("portal-hero-preview-image")).toHaveAttribute("src", withImage.landingImageUrl)
    expect(screen.getByLabelText("Título")).toHaveValue("Clube do Bairro!")
    expect(screen.queryByTestId("portal-image-progress")).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(i18n.t("portalAppearance.image.uploaded"))
  })

  it("accepts a dropped image", async () => {
    vi.mocked(uploadPortalLandingImage).mockResolvedValue(withImage as never)
    renderPage(["core.company.write"])
    await screen.findByLabelText("Chamada")
    fireEvent.drop(screen.getByTestId("portal-image-dropzone"), { dataTransfer: { files: [png()] } })
    await waitFor(() => expect(uploadPortalLandingImage).toHaveBeenCalled())
  })

  it("rejects a wrong type or a file over 3 MB before uploading", async () => {
    renderPage(["core.company.write"])
    await screen.findByLabelText("Chamada")
    const zone = screen.getByTestId("portal-image-dropzone")
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["a"], "a.gif", { type: "image/gif" })] } })
    expect(toast.error).toHaveBeenLastCalledWith(i18n.t("portalAppearance.image.badType"))
    const big = new File(["a"], "a.png", { type: "image/png" })
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 + 1 })
    fireEvent.drop(zone, { dataTransfer: { files: [big] } })
    expect(toast.error).toHaveBeenLastCalledWith(i18n.t("portalAppearance.image.tooLarge"))
    expect(uploadPortalLandingImage).not.toHaveBeenCalled()
  })

  it("maps an upload 400 to a localized toast", async () => {
    const user = userEvent.setup()
    vi.mocked(uploadPortalLandingImage).mockRejectedValueOnce(axiosFailure(400, "Invalid image content."))
    renderPage(["core.company.write"])
    await screen.findByLabelText("Chamada")
    await user.upload(screen.getByTestId("portal-image-input"), png())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t("portalAppearance.image.rejected")))
  })

  it("removes the image only after confirming", async () => {
    const user = userEvent.setup()
    vi.mocked(getPortalAppearance).mockResolvedValue(withImage as never)
    vi.mocked(deletePortalLandingImage).mockResolvedValue(base as never)
    renderPage(["core.company.write"])
    expect(await screen.findByTestId("portal-hero-preview-image")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trocar imagem" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Remover imagem" }))
    await user.click(await screen.findByRole("button", { name: "Cancelar" }))
    expect(deletePortalLandingImage).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Remover imagem" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Remover imagem" }))
    await waitFor(() => expect(deletePortalLandingImage).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId("portal-hero-preview-image")).not.toBeInTheDocument())
  })

  it("is read-only without core.company.write", async () => {
    renderPage(["core.dashboard.read"])
    expect(await screen.findByLabelText("Chamada")).toBeDisabled()
    expect(screen.getByTestId("portal-appearance-read-only")).toHaveTextContent(i18n.t("portalAppearance.readOnly"))
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Escolher imagem" })).not.toBeInTheDocument()
    expect(screen.getByTestId("portal-image-input")).toBeDisabled()
    fireEvent.drop(screen.getByTestId("portal-image-dropzone"), { dataTransfer: { files: [png()] } })
    expect(uploadPortalLandingImage).not.toHaveBeenCalled()
  })

  it("is read-only while the trial is read-only", async () => {
    trial.readOnly = true
    renderPage(["core.company.write"])
    expect(await screen.findByLabelText("Chamada")).toBeDisabled()
    expect(screen.getByTestId("portal-appearance-read-only")).toHaveTextContent(i18n.t("portalAppearance.trialReadOnly"))
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  it("stacks on mobile without horizontal overflow (class contract)", async () => {
    renderPage(["core.company.write"])
    const kicker = await screen.findByLabelText("Chamada")
    expect(screen.getByTestId("portal-hero-preview").closest(".grid")).toHaveClass("min-w-0", "lg:grid-cols-2")
    expect(screen.getByTestId("portal-hero-preview")).toHaveClass("w-full", "overflow-hidden")
    expect(kicker).toHaveClass("w-full")
  })

  it("shows the load error", async () => {
    vi.mocked(getPortalAppearance).mockRejectedValueOnce(new Error("falhou"))
    renderPage(["core.company.write"])
    expect(await screen.findByText("falhou")).toBeInTheDocument()
  })
})
