import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProductFilesManager } from "@/features/catalog/components/ProductFilesManager"
import type { CatalogProductFile } from "@/features/catalog/schemas/catalogSchemas"
import {
  deleteCatalogProductFile,
  getCatalogProductFileUrl,
  uploadCatalogProductFile,
} from "@/features/catalog/services/catalogService"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  deleteCatalogProductFile: vi.fn(),
  getCatalogProductFileUrl: vi.fn(),
  uploadCatalogProductFile: vi.fn(),
}))

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options)
const doc = { id: "d1", fileName: "manual.pdf", mimeType: "application/pdf", sizeBytes: 100, visibility: "InternalB2B", status: "Ready", url: null } as CatalogProductFile
const photo = { id: "p1", fileName: "foto.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", status: "Ready", url: "https://example.test/foto.png" } as CatalogProductFile

function setup(files: CatalogProductFile[] = [], canManage = true) {
  const onReload = vi.fn().mockResolvedValue(undefined)
  render(<ProductFilesManager productId="prod-1" productName="Quadra" files={files} canManage={canManage} onReload={onReload} />)
  return { onReload }
}

beforeEach(() => vi.clearAllMocks())

describe("ProductFilesManager", () => {
  it("offers the plain visibility labels", () => {
    setup()
    expect(screen.getByText("Aparece no portal (fotos)")).toBeInTheDocument()
    expect(screen.getByText("Uso interno (documentos)")).toBeInTheDocument()
    expect(screen.getByText(t("catalog.products.files.empty"))).toBeInTheDocument()
  })

  it("rejects a file that breaks the size or type rule without calling the API", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { onReload } = setup()
    const input = screen.getByLabelText(t("catalog.products.files.select"))
    await user.upload(input, new File(["x"], "contrato.pdf", { type: "application/pdf" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(t("catalog.products.files.typeCustomer", { name: "contrato.pdf" }))
    const big = new File(["x"], "grande.png", { type: "image/png" })
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 })
    await user.upload(input, big)
    expect(await screen.findByRole("alert")).toHaveTextContent(t("catalog.products.files.tooLargeCustomer", { name: "grande.png" }))
    expect(uploadCatalogProductFile).not.toHaveBeenCalled()
    expect(onReload).not.toHaveBeenCalled()
  })

  it("uploads a valid photo with the chosen visibility and reloads", async () => {
    vi.mocked(uploadCatalogProductFile).mockResolvedValue(photo)
    const user = userEvent.setup()
    const { onReload } = setup()
    const file = new File(["x"], "foto.png", { type: "image/png" })
    await user.upload(screen.getByLabelText(t("catalog.products.files.select")), file)
    await waitFor(() => expect(uploadCatalogProductFile).toHaveBeenCalledWith("prod-1", file, "CustomerVisible"))
    await waitFor(() => expect(onReload).toHaveBeenCalled())
  })

  it("lists files with Pending/Failed states and opens a ready file through its signed URL", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    vi.mocked(getCatalogProductFileUrl).mockResolvedValue({ url: "https://example.test/signed", isPublic: false })
    const pending = { ...doc, id: "d2", fileName: "novo.pdf", status: "Pending" } as CatalogProductFile
    const failed = { ...doc, id: "d3", fileName: "falhou.pdf", status: "Failed" } as CatalogProductFile
    const user = userEvent.setup()
    setup([doc, pending, failed])
    expect(screen.getByText("manual.pdf")).toBeInTheDocument()
    expect(screen.getByText(t("catalog.products.files.pendingRecord"))).toBeInTheDocument()
    expect(screen.getByText(t("catalog.products.files.failedRecord"))).toBeInTheDocument()
    const openButtons = screen.getAllByRole("button", { name: t("catalog.products.files.open") })
    expect(openButtons).toHaveLength(1)
    await user.click(openButtons[0]!)
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://example.test/signed", "_blank", "noopener,noreferrer"))
  })

  it("asks for confirmation before deleting and keeps the file on cancel", async () => {
    vi.mocked(deleteCatalogProductFile).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    const { onReload } = setup([doc])
    await user.click(screen.getByRole("button", { name: t("common.delete") }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("manual.pdf")
    await user.click(within(dialog).getByRole("button", { name: t("common.cancel") }))
    expect(deleteCatalogProductFile).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: t("common.delete") }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: t("common.delete") }))
    await waitFor(() => expect(deleteCatalogProductFile).toHaveBeenCalledWith("prod-1", "d1"))
    await waitFor(() => expect(onReload).toHaveBeenCalled())
  })

  it("hides upload and delete for a read-only user", () => {
    setup([doc], false)
    expect(screen.queryByLabelText(t("catalog.products.files.select"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("common.delete") })).not.toBeInTheDocument()
  })

  it("wraps within the card at any width (no fixed widths, wrapping rows, truncated names)", () => {
    setup([doc, photo])
    const root = screen.getByTestId("product-files-manager")
    expect(root).toHaveClass("min-w-0", "w-full", "max-w-xl")
    const controls = screen.getByLabelText(t("catalog.products.files.select")).parentElement?.parentElement
    expect(controls).toHaveClass("min-w-0", "flex-wrap")
    expect(screen.getByText("manual.pdf").closest("li")).toHaveClass("flex-wrap", "min-w-0")
    expect(screen.getByText("manual.pdf").closest("span")).toHaveClass("truncate")
  })
})
