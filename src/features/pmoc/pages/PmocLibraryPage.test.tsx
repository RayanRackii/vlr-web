import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PmocLibraryPage } from "@/features/pmoc/pages/PmocLibraryPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import { baseTemplateJson } from "@/features/pmoc/test/pmocFixtures"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getGlobalTemplates: vi.fn(),
}))

import { getGlobalTemplates } from "@/features/pmoc/services/pmocService"

const getGlobalTemplatesMock = vi.mocked(getGlobalTemplates)

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={["/pmoc/biblioteca"]}>
      <TestPermissionProvider
        permissions={["pmoc.templates.read"]}
        activeModules={["pmoc"]}
      >
        <Routes>
          <Route path="/pmoc/biblioteca" element={<PmocLibraryPage />} />
          <Route
            path="/pmoc/biblioteca/:templateId"
            element={<div>preview-page</div>}
          />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PmocLibraryPage", () => {
  beforeEach(() => {
    getGlobalTemplatesMock.mockReset()
  })

  it("shows a loading state before templates arrive", () => {
    getGlobalTemplatesMock.mockReturnValue(new Promise(() => undefined))

    renderLibrary()

    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("shows an empty state when there are no published templates", async () => {
    getGlobalTemplatesMock.mockResolvedValue([])

    renderLibrary()

    expect(
      await screen.findByText(i18n.t("pmoc.library.empty")),
    ).toBeInTheDocument()
  })

  it("shows an error when the library fails to load", async () => {
    getGlobalTemplatesMock.mockRejectedValue(new Error("boom"))

    renderLibrary()

    expect(await screen.findByRole("alert")).toHaveTextContent("boom")
  })

  it("lists published templates in columns and opens the preview from the name link", async () => {
    getGlobalTemplatesMock.mockResolvedValue([
      {
        ...baseTemplateJson,
        status: "Published",
      },
      {
        ...baseTemplateJson,
        id: "22222222-2222-4222-8222-222222222222",
        name: "Old edition",
        status: "Deprecated",
      },
    ])

    renderLibrary()
    const user = userEvent.setup()

    const table = await screen.findByRole("table")
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Modelo",
      "Versão",
      "Categoria",
      "Tarefas",
      "Ações",
    ])
    expect(within(table).getByText(baseTemplateJson.name)).toBeInTheDocument()
    expect(within(table).getByText(i18n.t("pmoc.library.version", { version: baseTemplateJson.version }))).toBeInTheDocument()
    expect(within(table).getByText(i18n.t("pmoc.library.tasksCount", { count: baseTemplateJson.tasks.length }))).toBeInTheDocument()
    expect(screen.queryByText("Old edition")).not.toBeInTheDocument()

    await user.click(within(table).getByRole("link", { name: baseTemplateJson.name }))
    expect(await screen.findByText("preview-page")).toBeInTheDocument()
  })

  it("opens the preview from the use-template action", async () => {
    getGlobalTemplatesMock.mockResolvedValue([{ ...baseTemplateJson, status: "Published" }])

    renderLibrary()
    const user = userEvent.setup()

    const table = await screen.findByRole("table")
    const action = within(table).getByRole("link", { name: "Usar modelo" })
    expect(action).toHaveAttribute("href", `/pmoc/biblioteca/${baseTemplateJson.id}`)
    await user.click(action)
    expect(await screen.findByText("preview-page")).toBeInTheDocument()
  })

  it("renders cards below md", async () => {
    getGlobalTemplatesMock.mockResolvedValue([{ ...baseTemplateJson, status: "Published" }])

    renderLibrary()

    const list = await screen.findByRole("list", { name: i18n.t("pmoc.library.title") })
    const items = within(list).getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText(baseTemplateJson.name)).toBeInTheDocument()
    expect(within(items[0]).getByRole("link", { name: "Usar modelo" })).toBeInTheDocument()
  })

  it("retries loading from the error state", async () => {
    getGlobalTemplatesMock.mockRejectedValueOnce(new Error("boom"))
    getGlobalTemplatesMock.mockResolvedValue([{ ...baseTemplateJson, status: "Published" }])

    renderLibrary()
    const user = userEvent.setup()

    expect(await screen.findByRole("alert")).toHaveTextContent("boom")
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findByRole("table")).toBeInTheDocument()
  })
})
