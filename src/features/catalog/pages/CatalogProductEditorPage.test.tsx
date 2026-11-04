import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createBrowserRouter, createMemoryRouter, RouterProvider, Route, Routes } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogProductEditorPage } from "@/features/catalog/pages/CatalogProductEditorPage"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/catalog/services/catalogService", () => ({
  getCatalogProduct: vi.fn(),
  updateCatalogProduct: vi.fn(),
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  deleteCatalogProductFile: vi.fn(),
  getCatalogProductFileUrl: vi.fn(),
  uploadCatalogProductFile: vi.fn(),
  getCatalogProductAccess: vi.fn().mockResolvedValue({ productId: "x", visibility: "Public", customerIds: [], groupIds: [], restrictedWithoutGrants: false }),
  getCatalogProductAccessHistory: vi.fn().mockResolvedValue([]),
  listCustomerGroups: vi.fn().mockResolvedValue([]),
  putCatalogProductAccess: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantCustomers: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
}))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  getCatalogTaxonomyOptions: vi.fn(),
}))

import {
  getCatalogProduct,
  getCatalogProductFileUrl,
  uploadCatalogProductFile,
  deleteCatalogProductFile,
  deactivateCatalogProduct,
  getCatalogProductAccess,
  getCatalogProductAccessHistory,
  listCustomerGroups,
  putCatalogProductAccess,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const getProductMock = vi.mocked(getCatalogProduct)
const updateProductMock = vi.mocked(updateCatalogProduct)
const getTaxonomyOptionsMock = vi.mocked(getCatalogTaxonomyOptions)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const PRODUCT: CatalogProduct = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Raquete",
  code: "RAQ",
  description: "Carbono",
  price: 10.5,
  currency: "BRL",
  isActive: true,
  createdAt: "2026-10-14T00:00:00.000Z",
  files: [],
  visibility: "Public",
  grantedCustomerCount: 0,
  grantedGroupCount: 0,
}

function renderPage(permissions: string[] = ["catalog.products.manage"], browser = false) {
  const routes = [{
    path: "*",
    element: (
      <TestPermissionProvider permissions={permissions}>
        <Routes>
          <Route path="/catalogo/produtos/:id" element={<CatalogProductEditorPage />} />
          <Route path="*" element={<div data-testid="destination" />} />
        </Routes>
      </TestPermissionProvider>
    ),
  }]
  const router = browser ? createBrowserRouter(routes) : createMemoryRouter(routes, {
    initialEntries: [`/catalogo/produtos/${PRODUCT.id}`],
  })
  return { ...render(<RouterProvider router={router} />), router }
}

function save() {
  return screen.getAllByRole("button", { name: i18n.t("catalog.products.save") })[0]!
}

describe("CatalogProductEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCatalogProductAccess).mockResolvedValue({ productId: PRODUCT.id, visibility: "Public", customerIds: [], groupIds: [], restrictedWithoutGrants: false })
    vi.mocked(getCatalogProductAccessHistory).mockResolvedValue([])
    vi.mocked(listCustomerGroups).mockResolvedValue([])
    vi.mocked(putCatalogProductAccess).mockReset()
    vi.mocked(getCatalogProductFileUrl).mockReset()
    vi.mocked(uploadCatalogProductFile).mockReset()
    vi.mocked(deleteCatalogProductFile).mockReset()
    vi.mocked(deactivateCatalogProduct).mockReset()
    getProductMock.mockReset()
    updateProductMock.mockReset()
    getTaxonomyOptionsMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    getProductMock.mockResolvedValue(PRODUCT)
    getTaxonomyOptionsMock.mockResolvedValue({ categories: [], tags: [] })
  })

  it.each([
    { status: "Pending" as const, key: "pendingRecord", url: null },
    { status: "Failed" as const, key: "failedRecord", url: "https://example.test/failed.png" },
    { status: "Pending" as const, key: "pendingRecord", url: "https://example.test/pending.png" },
    { status: "Failed" as const, key: "failedRecord", url: null },
  ])("labels and removes $status files without preview (url: $url)", async ({ status, key, url }) => {
    const file = { id: "f1", fileName: "unfinished.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, status, url }
    getProductMock.mockResolvedValueOnce({ ...PRODUCT, hasFiles: true, files: [file] }).mockResolvedValue({ ...PRODUCT, hasFiles: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    expect(screen.getByText("unfinished.png")).toBeVisible()
    expect(screen.getByText(i18n.t(`catalog.products.files.${key}`))).toBeVisible()
    expect(screen.queryByRole("img", { name: PRODUCT.name })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.products.files.open") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.products.files.retry") })).not.toBeInTheDocument()
    expect(getCatalogProductFileUrl).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: i18n.t("common.delete") }))
    await waitFor(() => expect(screen.queryByText("unfinished.png")).not.toBeInTheDocument())
    expect(deleteCatalogProductFile).toHaveBeenCalledWith(PRODUCT.id, "f1")
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled()
  })

  it.each([
    { language: "pt-BR", pending: "Envio pendente — remova para liberar a troca de visibilidade", failed: "Envio falhou — remova para liberar a troca de visibilidade" },
    { language: "en", pending: "Upload pending — remove to allow visibility changes", failed: "Upload failed — remove to allow visibility changes" },
    { language: "es", pending: "Envío pendiente — elimina el archivo para permitir cambios de visibilidad", failed: "El envío falló — elimina el archivo para permitir cambios de visibilidad" },
  ])("localizes unfinished file labels in $language", async ({ language, pending, failed }) => {
    const previousLanguage = i18n.language
    await i18n.changeLanguage(language)
    try {
      getProductMock.mockResolvedValue({ ...PRODUCT, files: [
        { id: "pending", fileName: "pending.pdf", mimeType: "application/pdf", sizeBytes: 100, visibility: "InternalB2B", status: "Pending", url: null },
        { id: "failed", fileName: "failed.pdf", mimeType: "application/pdf", sizeBytes: 100, visibility: "InternalB2B", status: "Failed", url: null },
      ] })
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
      expect(screen.getByText(pending)).toBeVisible()
      expect(screen.getByText(failed)).toBeVisible()
      expect(screen.getAllByRole("button", { name: i18n.t("common.delete") })).toHaveLength(2)
      expect(getCatalogProductFileUrl).not.toHaveBeenCalled()
    } finally {
      await i18n.changeLanguage(previousLanguage)
    }
  })

  it("reloads retained files after a failed upload without discarding unsaved fields", async () => {
    const file = { id: "f1", fileName: "pending.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, status: "Pending" as const, url: null }
    getProductMock.mockResolvedValueOnce(PRODUCT).mockResolvedValue({ ...PRODUCT, hasFiles: true, files: [file] })
    vi.mocked(uploadCatalogProductFile).mockRejectedValue(new Error("Upload failed"))
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    await user.type(name, "Unsaved product")
    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    await user.upload(screen.getByLabelText(i18n.t("catalog.products.files.select")), new File(["photo"], "pending.png", { type: "image/png" }))
    expect(await screen.findByText("pending.png")).toBeVisible()
    expect(screen.getByText(i18n.t("catalog.products.files.pendingRecord"))).toBeVisible()
    expect(screen.getByRole("button", { name: i18n.t("common.delete") })).toBeEnabled()
    expect(screen.getByText("Upload failed")).toBeVisible()
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled()
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.dados") }))
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Unsaved product")
  })

  it("keeps the upload controls within the files card", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    const input = screen.getByLabelText(i18n.t("catalog.products.files.select"))
    expect(input).toHaveClass("min-w-0", "w-full")
    expect(input.parentElement?.parentElement).not.toHaveClass("md:flex-row")
    expect(input.parentElement?.parentElement).toHaveClass("min-w-0", "flex-wrap")
  })

  it("renders a signed preview for a restricted product image without a URL", async () => {
    getProductMock.mockResolvedValue({ ...PRODUCT, visibility: "Restricted", files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url: null },
    ] })
    vi.mocked(getCatalogProductFileUrl).mockResolvedValue({ url: "https://example.test/signed.png", isPublic: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    expect(await screen.findByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/signed.png")
    expect(getCatalogProductFileUrl).toHaveBeenCalledWith(PRODUCT.id, "f1")
  })

  it.each(["transient", "empty", "permanent"])("retries initial %s signing failures and offers manual recovery", async (failure) => {
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url: null },
    ] })
    const signing = vi.mocked(getCatalogProductFileUrl)
    let failInitial!: () => void
    signing.mockImplementationOnce(() => new Promise((resolve, reject) => {
      failInitial = () => failure === "empty"
        ? resolve({ url: " ", isPublic: false })
        : reject(new Error("Unavailable"))
    }))
    if (failure === "permanent") signing.mockRejectedValue(new Error("Unavailable"))
    else signing.mockResolvedValue({ url: "https://example.test/recovered", isPublic: false })
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    vi.useFakeTimers()
    try {
      await act(async () => { failInitial() })
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(signing).toHaveBeenCalledTimes(2)
      if (failure === "permanent") {
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        expect(signing).toHaveBeenCalledTimes(3)
        await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
        expect(signing).toHaveBeenCalledTimes(3)
        signing.mockResolvedValue({ url: "https://example.test/recovered", isPublic: false })
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: i18n.t("catalog.products.files.retry") })) })
        expect(signing).toHaveBeenCalledTimes(4)
      }
      expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/recovered")
      if (failure === "permanent") {
        expect(screen.getByRole("button", { name: i18n.t("catalog.products.files.retry") })).toBeVisible()
      }
      fireEvent.load(screen.getByRole("img", { name: PRODUCT.name }))
      expect(screen.queryByRole("button", { name: i18n.t("catalog.products.files.retry") })).not.toBeInTheDocument()
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it("keeps both private previews after a second upload and removes deleted images", async () => {
    const first = { id: "f1", status: "Ready" as const, fileName: "first.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, url: null }
    const second = { ...first, id: "f2", status: "Ready" as const, fileName: "second.webp", mimeType: "image/webp", visibility: "InternalB2B" as const }
    getProductMock.mockResolvedValue({ ...PRODUCT, visibility: "Restricted", files: [] })
    vi.mocked(getCatalogProductFileUrl).mockImplementation(async (_productId, fileId) => ({ url: `https://example.test/${fileId}`, isPublic: false }))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    getProductMock.mockResolvedValue({ ...PRODUCT, visibility: "Restricted", files: [first] })
    vi.mocked(uploadCatalogProductFile).mockResolvedValue(first)
    await user.upload(screen.getByLabelText(i18n.t("catalog.products.files.select")), new File(["first"], "first.png", { type: "image/png" }))
    expect(await screen.findByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/f1")
    getProductMock.mockResolvedValue({ ...PRODUCT, visibility: "Restricted", files: [first, second] })
    vi.mocked(uploadCatalogProductFile).mockResolvedValue(second)
    await waitFor(() => expect(screen.getByLabelText(i18n.t("catalog.products.files.select"))).toBeEnabled())
    await user.upload(screen.getByLabelText(i18n.t("catalog.products.files.select")), new File(["second"], "second.webp", { type: "image/webp" }))
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.products.gallery.next") }))
    expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/f2")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.gallery.previous") }))
    expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/f1")
    expect(getCatalogProductFileUrl).toHaveBeenCalledTimes(2)
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [first] })
    await user.click(screen.getAllByRole("button", { name: i18n.t("common.delete") })[1]!)
    await waitFor(() => expect(screen.queryByRole("button", { name: i18n.t("catalog.products.gallery.next") })).not.toBeInTheDocument())
    expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/f1")
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [first, second] })
    await user.upload(screen.getByLabelText(i18n.t("catalog.products.files.select")), new File(["second"], "second.webp", { type: "image/webp" }))
    await waitFor(() => expect(getCatalogProductFileUrl).toHaveBeenCalledTimes(3))
  })

  it("ignores signed preview failures and skips non-renderable files", async () => {
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "InternalB2B", url: null },
      { id: "f2", status: "Ready" as const, fileName: "doc.pdf", mimeType: "application/pdf", sizeBytes: 100, visibility: "InternalB2B", url: null },
    ] })
    vi.mocked(getCatalogProductFileUrl).mockRejectedValue(new Error("unavailable"))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    await waitFor(() => expect(getCatalogProductFileUrl).toHaveBeenCalledWith(PRODUCT.id, "f1"))
    expect(getCatalogProductFileUrl).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("img", { name: PRODUCT.name })).not.toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("guards breadcrumb and unload even while changed fields are invalid", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await user.clear(await screen.findByLabelText(i18n.t("catalog.products.form.name")))
    const unload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await user.click(screen.getByRole("link", { name: i18n.t("catalog.products.title") }))
    expect(confirm).toHaveBeenCalledWith(i18n.t("fullPage.leaveConfirm"))
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toBeInTheDocument()
    confirm.mockRestore()
  })

  it.each([-2, -1, 1, "/programmatic"])("guards navigation %s and preserves the browser URL on cancel", async (target) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const originalUrl = window.location.href
    window.history.replaceState(null, "", "/catalogo/produtos")
    const user = userEvent.setup()
    const { router, unmount } = renderPage(undefined, true)
    try {
      await act(async () => { await router.navigate("/middle") })
      await act(async () => { await router.navigate(`/catalogo/produtos/${PRODUCT.id}`) })
      await screen.findByLabelText(i18n.t("catalog.products.form.name"))
      await act(async () => { await router.navigate("/forward") })
      await act(async () => { await router.navigate(-1) })
      const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
      await user.type(name, " pro")
      const navigateAway = () => typeof target === "number" ? router.navigate(target) : router.navigate(target)
      await act(async () => { await navigateAway() })
      await waitFor(() => expect(confirm).toHaveBeenCalledWith(i18n.t("fullPage.leaveConfirm")))
      await waitFor(() => expect(window.location.pathname).toBe(`/catalogo/produtos/${PRODUCT.id}`))
      expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Raquete pro")
      confirm.mockReturnValue(true)
      await act(async () => { await navigateAway() })
      await screen.findByTestId("destination")
      expect(window.location.pathname).toBe(typeof target === "string" ? target : target === 1 ? "/forward" : target === -1 ? "/middle" : "/catalogo/produtos")
    } finally {
      unmount()
      router.dispose()
      window.history.replaceState(null, "", originalUrl)
      confirm.mockRestore()
    }
  })

  it("keeps the discard bar reachable while a field is invalid", async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    const discard = screen.getByRole("button", { name: i18n.t("fullPage.discard") })
    expect(discard).toBeInTheDocument()
    expect(save()).toBeDisabled()
    await user.click(discard)
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Raquete")
    expect(updateProductMock).not.toHaveBeenCalled()
  })

  it("keeps unsaved fields when a file is deleted and status is changed", async () => {
    const file = { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, url: "https://example.test/photo.png" }
    getProductMock.mockResolvedValueOnce({ ...PRODUCT, files: [file] }).mockResolvedValue({ ...PRODUCT, files: [] })
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(i18n.t("catalog.products.form.name")), " draft")
    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    await user.click(screen.getByRole("button", { name: i18n.t("common.delete") }))
    await waitFor(() => expect(deleteCatalogProductFile).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText("photo.png")).not.toBeInTheDocument())
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.dados") }))
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Raquete draft")
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    getProductMock.mockResolvedValue({ ...PRODUCT, isActive: false, files: [] })
    vi.mocked(deactivateCatalogProduct).mockResolvedValue({ ...PRODUCT, isActive: false })
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    await waitFor(() => expect(screen.getByRole("radio", { name: i18n.t("catalog.products.inactive") })).toBeChecked())
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Raquete draft")
    confirm.mockRestore()
    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    vi.mocked(uploadCatalogProductFile).mockResolvedValue(file)
    getProductMock.mockResolvedValue({ ...PRODUCT, isActive: false, files: [file] })
    await user.upload(screen.getByLabelText(i18n.t("catalog.products.files.select")), new File(["photo"], "photo.png", { type: "image/png" }))
    await screen.findByText("photo.png")
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.dados") }))
    expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("Raquete draft")
  })

  it("discards visibility and grant changes across tabs", async () => {
    vi.mocked(listCustomerGroups).mockResolvedValue([{
      id: "group-1", name: "Revenda", description: null, memberCustomerIds: [], createdAt: PRODUCT.createdAt, updatedAt: null,
    }])
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    const restricted = await screen.findByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.restricted")) })
    await waitFor(() => expect(restricted).toBeEnabled())
    await user.click(restricted)
    await user.click(await screen.findByRole("checkbox", { name: "Revenda" }))
    await user.click(screen.getByRole("button", { name: i18n.t("fullPage.discard") }))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.dados") }))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    expect(screen.getByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.public")) })).toBeChecked()
    expect(save()).toBeDisabled()
    expect(putCatalogProductAccess).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.restricted")) }))
    expect(screen.getByRole("checkbox", { name: "Revenda" })).not.toBeChecked()
  })

  it("retries an unchanged public preview URL and keeps manual recovery until the image loads", async () => {
    const url = "https://example.test/public.png"
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready", fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url },
    ] })
    const signing = vi.mocked(getCatalogProductFileUrl).mockResolvedValue({ url, isPublic: true })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    const original = screen.getByRole("img", { name: PRODUCT.name })
    await act(async () => { fireEvent.error(original) })
    const refreshed = screen.getByRole("img", { name: PRODUCT.name })
    expect(refreshed).not.toBe(original)
    expect(refreshed).toHaveAttribute("src", url)
    await act(async () => { fireEvent.error(refreshed) })
    expect(screen.getByRole("button", { name: i18n.t("catalog.products.files.retry") })).toBeVisible()
    await act(async () => { fireEvent.error(screen.getByRole("img", { name: PRODUCT.name })) })
    expect(signing).toHaveBeenCalledTimes(2)
    const retry = screen.getByRole("button", { name: i18n.t("catalog.products.files.retry") })
    expect(retry).toBeVisible()
    await user.click(retry)
    expect(signing).toHaveBeenCalledTimes(3)
    const recovered = screen.getByRole("img", { name: PRODUCT.name })
    fireEvent.load(recovered)
    expect(screen.queryByRole("button", { name: i18n.t("catalog.products.files.retry") })).not.toBeInTheDocument()
  })

  it("refreshes the signed image again when a later URL expires", async () => {
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url: null },
    ] })
    vi.mocked(getCatalogProductFileUrl).mockResolvedValueOnce({ url: "https://example.test/expired", isPublic: false })
      .mockResolvedValueOnce({ url: "https://example.test/fresh-1", isPublic: false })
      .mockResolvedValue({ url: "https://example.test/fresh-2", isPublic: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    // The initially-signed URL expired → refresh to fresh-1.
    fireEvent.error(await screen.findByRole("img", { name: PRODUCT.name }))
    await waitFor(() => expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/fresh-1"))
    // fresh-1 later expires → refresh again (not blocked by once-per-file).
    fireEvent.error(screen.getByRole("img", { name: PRODUCT.name }))
    await waitFor(() => expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/fresh-2"))
    expect(getCatalogProductFileUrl).toHaveBeenCalledTimes(3)
  })

  it.each(["transient", "permanent", "empty"])("retries a %s signing failure with bounded backoff", async (failure) => {
    const expired = "https://example.test/expired"
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url: expired },
    ] })
    const signing = vi.mocked(getCatalogProductFileUrl)
    if (failure === "empty") signing.mockResolvedValueOnce({ url: "", isPublic: false })
    else signing.mockRejectedValueOnce(new Error("Signing failed"))
    if (failure === "permanent") signing.mockRejectedValue(new Error("Still unavailable"))
    else signing.mockResolvedValue({ url: "https://example.test/fresh", isPublic: false })
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    const image = screen.getByRole("img", { name: PRODUCT.name })
    vi.useFakeTimers()
    try {
      await act(async () => { fireEvent.error(image) })
      expect(signing).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(499) })
      expect(signing).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(signing).toHaveBeenCalledTimes(2)
      if (failure !== "permanent") expect(screen.getByRole("img", { name: PRODUCT.name })).toHaveAttribute("src", "https://example.test/fresh")
      else fireEvent.error(image)
      await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
      expect(signing).toHaveBeenCalledTimes(2)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it.each([
    ["inflight", null], ["backoff", null],
    ["inflight", "https://example.test/expired"], ["backoff", "https://example.test/expired"],
  ])("cancels preview retries on unmount during %s for URL %s", async (phase, url) => {
    getProductMock.mockResolvedValue({ ...PRODUCT, files: [
      { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible", url },
    ] })
    let rejectSigning!: (error: Error) => void
    vi.mocked(getCatalogProductFileUrl).mockImplementation(() => new Promise((_resolve, reject) => { rejectSigning = reject }))
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.click(await screen.findByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    vi.useFakeTimers()
    try {
      if (url) fireEvent.error(screen.getByRole("img", { name: PRODUCT.name }))
      if (phase === "backoff") await act(async () => { rejectSigning(new Error("Signing failed")) })
      unmount()
      if (phase === "inflight") await act(async () => { rejectSigning(new Error("Signing failed")) })
      await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
      expect(getCatalogProductFileUrl).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("loads the product into the form", async () => {
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(name).toHaveValue("Raquete")
    expect(screen.getByLabelText(i18n.t("catalog.products.form.code"))).toHaveValue("RAQ")
    expect(getProductMock).toHaveBeenCalledWith(PRODUCT.id)
  })

  it("keeps Salvar disabled until a valid change is made", async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(save()).toBeDisabled()

    await user.type(name, " pro")
    expect(save()).toBeEnabled()

    await user.clear(name)
    expect(save()).toBeDisabled()
    expect(updateProductMock).not.toHaveBeenCalled()
  })

  it("sends the same update payload as the dialog edit path", async () => {
    updateProductMock.mockResolvedValue({ ...PRODUCT, name: "Raquete pro" })
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    await user.type(name, "Raquete pro")
    await user.click(save())

    await waitFor(() => {
      expect(updateProductMock).toHaveBeenCalledWith(PRODUCT.id, {
        name: "Raquete pro",
        code: "RAQ",
        description: "Carbono",
        price: 10.5,
        currency: "BRL",
      })
    })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastUpdated"))
    })
    expect(putCatalogProductAccess).not.toHaveBeenCalled()
  })

  it("keeps the entered values when the server rejects the save", async () => {
    updateProductMock.mockRejectedValue(new Error("Nome já cadastrado."))
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    await user.type(name, "Raquete pro")
    await user.click(save())

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Nome já cadastrado.")
    })
    expect(name).toHaveValue("Raquete pro")
    expect(save()).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("renders the files and access tabs", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(i18n.t("catalog.products.form.name"))

    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    expect(screen.getByLabelText(i18n.t("catalog.products.files.select"))).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    expect(
      await screen.findByText(i18n.t("catalog.products.access.history.title")),
    ).toBeInTheDocument()
  })

  it("shows the standalone history tab without saving product or access", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.history") }))
    expect(await within(screen.getByRole("tabpanel")).findByText(i18n.t("catalog.products.access.history.empty"))).toBeVisible()
    expect(screen.getByRole("tabpanel")).toHaveTextContent(i18n.t("catalog.products.access.history.title"))
    expect(getCatalogProductAccessHistory).toHaveBeenCalledWith(PRODUCT.id)
    expect(listCustomerGroups).toHaveBeenCalled()
    expect(updateProductMock).not.toHaveBeenCalled()
    expect(putCatalogProductAccess).not.toHaveBeenCalled()
  })

  it("saves the product before restricted grants and refreshes history afterward", async () => {
    vi.mocked(getCatalogProductAccess).mockResolvedValue({ productId: PRODUCT.id, visibility: "Public", customerIds: ["customer-1"], groupIds: [], restrictedWithoutGrants: false })
    vi.mocked(listCustomerGroups).mockResolvedValue([{
      id: "group-1", name: "Revenda", description: null, memberCustomerIds: [], createdAt: PRODUCT.createdAt, updatedAt: null,
    }])
    vi.mocked(putCatalogProductAccess).mockResolvedValue({ productId: PRODUCT.id, visibility: "Restricted", customerIds: ["customer-1"], groupIds: ["group-1"], restrictedWithoutGrants: false })
    updateProductMock.mockResolvedValue(PRODUCT)
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    const restricted = await screen.findByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.restricted")) })
    await waitFor(() => expect(restricted).toBeEnabled())
    await user.click(restricted)
    await user.click(await screen.findByRole("checkbox", { name: "Revenda" }))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.dados") }))
    const historyCalls = vi.mocked(getCatalogProductAccessHistory).mock.calls.length
    await user.click(save())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastUpdated")))
    expect(updateProductMock).toHaveBeenCalledExactlyOnceWith(PRODUCT.id, {
      name: "Raquete", code: "RAQ", description: "Carbono", price: 10.5, currency: "BRL",
    })
    expect(putCatalogProductAccess).toHaveBeenCalledExactlyOnceWith(PRODUCT.id, {
      visibility: "Restricted", customerIds: ["customer-1"], groupIds: ["group-1"],
    })
    const putOrder = vi.mocked(putCatalogProductAccess).mock.invocationCallOrder[0]!
    expect(updateProductMock.mock.invocationCallOrder[0]).toBeLessThan(putOrder)
    expect(vi.mocked(getCatalogProductAccessHistory).mock.invocationCallOrder[historyCalls]).toBeGreaterThan(putOrder)
  })

  it.each([
    { label: "DTO flag", hasFiles: true, files: [] },
    { label: "internal file fallback", files: [{ id: "f1", status: "Ready" as const, fileName: "model.stl", mimeType: "application/octet-stream", sizeBytes: 100, visibility: "InternalB2B" as const, url: null }] },
    { label: "image fallback", files: [{ id: "f2", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, url: "https://example.test/photo.png" }] },
  ])("allows visibility changes for $label", async (fileState) => {
    getProductMock.mockResolvedValue({ ...PRODUCT, ...fileState })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    await waitFor(() => expect(getCatalogProductAccess).toHaveBeenCalled())
    await waitFor(() => {
      for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled()
    })
    const restricted = screen.getByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.restricted")) })
    await user.click(restricted)
    expect(restricted).toBeChecked()
    expect(screen.queryByText(i18n.t("catalog.products.access.filesPresent"))).not.toBeInTheDocument()
  })

  it("keeps visibility editable before and after deleting the last file", async () => {
    const file = { id: "f1", status: "Ready" as const, fileName: "photo.png", mimeType: "image/png", sizeBytes: 100, visibility: "CustomerVisible" as const, url: "https://example.test/photo.png" }
    getProductMock.mockResolvedValueOnce({ ...PRODUCT, hasFiles: true, files: [file] }).mockResolvedValue({ ...PRODUCT, hasFiles: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    await waitFor(() => {
      for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled()
    })
    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    await user.click(screen.getByRole("button", { name: i18n.t("common.delete") }))
    await waitFor(() => expect(screen.queryByText("photo.png")).not.toBeInTheDocument())
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled()
    expect(screen.queryByText(i18n.t("catalog.products.access.filesPresent"))).not.toBeInTheDocument()
  })

  it("shows the localized file conflict when access save fails", async () => {
    const message = i18n.t("catalog.products.access.filesPresent")
    vi.mocked(putCatalogProductAccess).mockRejectedValue(new Error(message))
    updateProductMock.mockResolvedValue(PRODUCT)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    const restricted = await screen.findByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.restricted")) })
    await waitFor(() => expect(restricted).toBeEnabled())
    await user.click(restricted)
    await user.click(save())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message))
    expect(restricted).toBeChecked()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("preserves grants when saving public visibility", async () => {
    vi.mocked(getCatalogProductAccess).mockResolvedValue({ productId: PRODUCT.id, visibility: "Restricted", customerIds: ["customer-1"], groupIds: ["group-1"], restrictedWithoutGrants: false })
    vi.mocked(putCatalogProductAccess).mockResolvedValue({ productId: PRODUCT.id, visibility: "Public", customerIds: ["customer-1"], groupIds: ["group-1"], restrictedWithoutGrants: false })
    updateProductMock.mockResolvedValue(PRODUCT)
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    const publicOption = await screen.findByRole("radio", { name: new RegExp(i18n.t("catalog.products.access.public")) })
    await waitFor(() => expect(publicOption).toBeEnabled())
    await user.click(publicOption)
    await user.click(save())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastUpdated")))
    expect(putCatalogProductAccess).toHaveBeenCalledExactlyOnceWith(PRODUCT.id, { visibility: "Public", customerIds: ["customer-1"], groupIds: ["group-1"] })
    expect(updateProductMock.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(putCatalogProductAccess).mock.invocationCallOrder[0]!)
  })

  it("is read-only without the manage permission", async () => {
    renderPage(["catalog.products.read"])
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(name).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.products.save") }),
    ).not.toBeInTheDocument()
  })
})
