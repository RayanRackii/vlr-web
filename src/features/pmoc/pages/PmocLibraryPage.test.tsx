import { render, screen } from "@testing-library/react"
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

  it("lists published templates and navigates to preview on click", async () => {
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

    expect(await screen.findByText(baseTemplateJson.name)).toBeInTheDocument()
    expect(screen.queryByText("Old edition")).not.toBeInTheDocument()

    await user.click(screen.getByText(baseTemplateJson.name))
    expect(await screen.findByText("preview-page")).toBeInTheDocument()
  })
})
