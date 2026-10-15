import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import i18n from "@/lib/i18n"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import type { CustomerProfile } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchCustomerProfile: vi.fn(),
    updateCustomerProfile: vi.fn(),
  }
})

import { toast } from "sonner"
import { TenantPortalProfilePage } from "@/features/tenantPortal/pages/TenantPortalProfilePage"
import {
  fetchCustomerProfile,
  updateCustomerProfile,
} from "@/features/tenantPortal/services/tenantPortalService"

const fetchProfile = vi.mocked(fetchCustomerProfile)
const updateProfile = vi.mocked(updateCustomerProfile)
const toastError = vi.mocked(toast.error)

const outletContext: CustomerAppOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

const profile: CustomerProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  name: "Ana Silva",
  email: "ana@club.test",
  phone: "11988880001",
  customerType: "Individual",
  document: "52998224725",
  cpf: "52998224725",
  postalCode: null,
  addressStreet: null,
  addressNeighborhood: null,
  addressCity: null,
  addressState: null,
  photoUrl: null,
  createdAt: "2026-09-11T12:00:00.000Z",
  phoneVerified: true,
  emailVerified: true,
  extraAttributes: null,
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/t/ficc/app/perfil"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/t/:subdomain/app/perfil" element={<TenantPortalProfilePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("TenantPortalProfilePage validity gate", () => {
  beforeEach(() => {
    fetchProfile.mockReset()
    updateProfile.mockReset()
    toastError.mockReset()
    fetchProfile.mockResolvedValue(profile)
  })

  it("keeps Salvar disabled until the name passes the schema", async () => {
    const user = userEvent.setup()
    renderProfile()

    const name = await screen.findByLabelText(i18n.t("tenantPortal.fields.name"))
    const save = screen.getByRole("button", {
      name: i18n.t("tenantPortal.profile.save"),
    })
    const changePhoto = screen.getByRole("button", {
      name: i18n.t("tenantPortal.profile.photoChange"),
    })
    expect(name).toHaveValue("Ana Silva")
    expect(await screen.findByText("(11) *****-0001")).toBeInTheDocument()
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument()
    expect(screen.queryByText("(11) 98888-0001")).not.toBeInTheDocument()
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument()
    expect(screen.queryByText("11988880001")).not.toBeInTheDocument()
    expect(screen.queryByText("52998224725")).not.toBeInTheDocument()
    expect(save).toBeEnabled()
    expect(changePhoto).toBeEnabled()

    await user.clear(name)
    expect(save).toBeDisabled()
    expect(changePhoto).toBeEnabled()
    expect(updateProfile).not.toHaveBeenCalled()

    await user.type(name, "A")
    expect(save).toBeDisabled()

    await user.type(name, "na Souza")
    expect(save).toBeEnabled()
  })

  it("keeps the name and re-enables Salvar after a server error", async () => {
    const user = userEvent.setup()
    updateProfile.mockRejectedValue(new Error("Não foi possível salvar o perfil."))
    renderProfile()

    const name = await screen.findByLabelText(i18n.t("tenantPortal.fields.name"))
    await user.clear(name)
    await user.type(name, "Ana Souza")
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.profile.save") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Não foi possível salvar o perfil.")
    })
    expect(name).toHaveValue("Ana Souza")
    expect(
      screen.getByRole("button", { name: i18n.t("tenantPortal.profile.save") }),
    ).toBeEnabled()
    expect(
      screen.getByRole("heading", { name: i18n.t("tenantPortal.profile.title") }),
    ).toBeInTheDocument()
  })

  it("reveals CPF and phone only after the visitor asks", async () => {
    const user = userEvent.setup()
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    renderProfile()

    expect(await screen.findByText("***.982.247-**")).toBeInTheDocument()
    expect(screen.getByText("(11) *****-0001")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.profile.showSensitive", {
          label: i18n.t("tenantPortal.fields.cpf"),
        }),
      }),
    )
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument()
    expect(screen.queryByText("***.982.247-**")).not.toBeInTheDocument()
    expect(screen.queryByText("(11) 98888-0001")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.profile.showSensitive", {
          label: i18n.t("tenantPortal.fields.phone"),
        }),
      }),
    )
    expect(screen.getByText("(11) 98888-0001")).toBeInTheDocument()
    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    log.mockRestore()
    info.mockRestore()
  })

  it("shows the signup photo stored on extraAttributes.fotoDePerfil", async () => {
    const signupPhoto = `data:image/jpeg;base64,${"a".repeat(48)}`
    const OriginalImage = window.Image
    class LoadedImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      complete = false
      naturalWidth = 0
      set src(_value: string) {
        this.complete = true
        this.naturalWidth = 1
        this.onload?.()
      }
    }
    vi.stubGlobal("Image", LoadedImage)

    fetchProfile.mockResolvedValue({
      ...profile,
      photoUrl: null,
      extraAttributes: {
        cep: "85851000",
        fotoDePerfil: signupPhoto,
      },
    })
    try {
      renderProfile()

      await waitFor(() => {
        const image = document.querySelector("img")
        expect(image).toHaveAttribute("src", signupPhoto)
      })
      expect(
        screen.queryByText(i18n.t("tenantPortal.profile.photoNone")),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.profile.photoRemove"),
        }),
      ).toBeInTheDocument()
    } finally {
      vi.stubGlobal("Image", OriginalImage)
    }
  })
})
