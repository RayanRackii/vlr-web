import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LayoutGrid } from "lucide-react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ModuleGuide } from "./ModuleGuide"
import type { ModuleGuideConfig } from "./types"
import i18n from "@/lib/i18n"

const config: ModuleGuideConfig = {
  key: "overview",
  steps: [
    { id: "step-1", titleKey: "moduleGuide.steps.learn1.title", descriptionKey: "moduleIntro.modules.overview.how1", kind: "learn", points: 10, badgeId: "firstStep" },
    { id: "step-2", titleKey: "moduleGuide.steps.learn2.title", descriptionKey: "moduleIntro.modules.overview.how2", kind: "learn", points: 10, badgeId: "complete" },
  ],
  badges: [
    { id: "firstStep", labelKey: "moduleGuide.badges.firstStep", threshold: 1 },
    { id: "complete", labelKey: "moduleGuide.badges.complete", threshold: 2 },
  ],
}

function renderGuide(userId: string | null = "user-1", tenantId: string | null = "tenant-1") {
  return render(
    <MemoryRouter>
      <ModuleGuide
        config={config}
        titleKey="nav.sections.overview"
        summaryKey="moduleIntro.modules.overview.summary"
        icon={LayoutGrid}
        shortcuts={[]}
        related={[]}
        userId={userId}
        tenantId={tenantId}
      />
    </MemoryRouter>,
  )
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

beforeEach(async () => {
  localStorage.clear()
  setReducedMotion(false)
  await i18n.changeLanguage("pt-BR")
})
afterEach(() => localStorage.clear())

const firstBadgeLabel = i18n.t("moduleGuide.badges.firstStep")
const markDoneLabel = i18n.t("moduleGuide.markDone")
const resetLabel = i18n.t("moduleGuide.reset")
const roadmapLabel = i18n.t("moduleGuide.roadmapTitle")

describe("ModuleGuide", () => {
  it("marks the badge as locked until its threshold is reached", () => {
    renderGuide()
    const badge = screen.getByText(firstBadgeLabel)
    expect(badge.closest("span")).toHaveAttribute("data-earned", "false")
  })

  it("completing a step updates the roadmap, earns the badge, and persists after remount", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide()

    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const firstItem = within(roadmap).getAllByRole("listitem")[0]
    expect(firstItem).toHaveAttribute("aria-current", "step")

    await user.click(screen.getByRole("button", { name: markDoneLabel }))

    expect(firstItem).toHaveAttribute("data-state", "done")
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "true")

    unmount()
    renderGuide()
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "true")
  })

  it("reset clears progress", async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.click(screen.getByRole("button", { name: markDoneLabel }))
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "true")

    await user.click(screen.getByRole("button", { name: resetLabel }))
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "false")
  })

  it("renders the just-completed reward without an animation class when reduced motion is preferred", async () => {
    setReducedMotion(true)
    const user = userEvent.setup()
    renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const firstItem = within(roadmap).getAllByRole("listitem")[0]

    await user.click(screen.getByRole("button", { name: markDoneLabel }))

    expect(firstItem.className).not.toMatch(/scale-\[1\.02\]/)
  })

  it("keeps progress isolated per module+user storage key", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide("user-1")
    await user.click(screen.getByRole("button", { name: markDoneLabel }))
    unmount()

    renderGuide("user-2")
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "false")
  })

  it("keeps progress isolated per tenant, even for the same user id", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide("user-1", "tenant-1")
    await user.click(screen.getByRole("button", { name: markDoneLabel }))
    unmount()

    renderGuide("user-1", "tenant-2")
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "false")
  })

  it("falls back to a stable key when tenantId is missing, without crashing", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide("user-1", null)
    await user.click(screen.getByRole("button", { name: markDoneLabel }))
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "true")
    unmount()

    renderGuide("user-1", null)
    expect(screen.getByText(firstBadgeLabel).closest("span")).toHaveAttribute("data-earned", "true")
  })

  it("announces both the points and the badge when a step completion earns one", async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.click(screen.getByRole("button", { name: markDoneLabel }))

    const stepAnnouncement = i18n.t("moduleGuide.reward.stepAnnouncement", {
      step: i18n.t("moduleGuide.steps.learn1.title"),
      points: 10,
    })
    const badgeAnnouncement = i18n.t("moduleGuide.reward.badgeAnnouncement", { badge: firstBadgeLabel })
    expect(screen.getByText(`${stepAnnouncement} ${badgeAnnouncement}`)).toBeInTheDocument()
  })
})
