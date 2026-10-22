import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  saveVisualTemplate: vi.fn(),
  saveVisualRevision: vi.fn(),
  publishVisualRevision: vi.fn(),
}))

import { InlineCreateVisualTemplateForm } from "@/features/rentals/components/ResourceDependencyInlineCreateForms"
import * as visualService from "@/features/rentals/services/resourceVisualService"

describe("InlineCreateVisualTemplateForm", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resumes at revision creation after a retry instead of recreating the template", async () => {
    const user = userEvent.setup()
    const complete = vi.fn(async () => undefined)
    vi.mocked(visualService.saveVisualTemplate).mockResolvedValue({ id: "template-1" } as never)
    vi.mocked(visualService.saveVisualRevision)
      .mockRejectedValueOnce(new Error("revision unavailable"))
      .mockResolvedValueOnce({ metadata: { id: "revision-1" } } as never)
    vi.mocked(visualService.publishVisualRevision).mockResolvedValue({ id: "published-1" } as never)

    render(<InlineCreateVisualTemplateForm complete={complete} close={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do modelo"), "Modelo novo")
    const save = screen.getByRole("button", { name: "Criar modelo" })

    await user.click(save)
    await waitFor(() => expect(visualService.saveVisualRevision).toHaveBeenCalledTimes(1))
    await user.click(save)

    await waitFor(() => expect(complete).toHaveBeenCalledWith({ value: "published-1", label: "Modelo novo" }))
    expect(visualService.saveVisualTemplate).toHaveBeenCalledOnce()
    expect(visualService.saveVisualRevision).toHaveBeenCalledTimes(2)
    expect(visualService.publishVisualRevision).toHaveBeenCalledWith("template-1", "revision-1")
  })

  it("resumes at option refresh after publishing instead of repeating API mutations", async () => {
    const user = userEvent.setup()
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh unavailable"))
      .mockResolvedValueOnce(undefined)
    vi.mocked(visualService.saveVisualTemplate).mockResolvedValue({ id: "template-1" } as never)
    vi.mocked(visualService.saveVisualRevision).mockResolvedValue({ metadata: { id: "revision-1" } } as never)
    vi.mocked(visualService.publishVisualRevision).mockResolvedValue({ id: "published-1" } as never)

    render(<InlineCreateVisualTemplateForm complete={complete} close={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do modelo"), "Modelo novo")
    const save = screen.getByRole("button", { name: "Criar modelo" })

    await user.click(save)
    await waitFor(() => expect(complete).toHaveBeenCalledOnce())
    await user.click(save)

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(2))
    expect(visualService.saveVisualTemplate).toHaveBeenCalledOnce()
    expect(visualService.saveVisualRevision).toHaveBeenCalledOnce()
    expect(visualService.publishVisualRevision).toHaveBeenCalledOnce()
  })
})
