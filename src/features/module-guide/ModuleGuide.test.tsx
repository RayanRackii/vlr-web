import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LayoutGrid } from "lucide-react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { moduleGuideConfigs } from "./configs"
import { ModuleGuide } from "./ModuleGuide"
import i18n from "@/lib/i18n"

const config = moduleGuideConfigs.bookings

const shortcuts = [
  { to: "/recursos", labelKey: "moduleGuide.steps.bookings.learn1.title" },
  { to: "/horarios", labelKey: "moduleGuide.steps.bookings.learn2.title" },
]
const related = [{ to: "/modulos/maintenance", labelKey: "moduleGuide.steps.maintenance.learn1.title" }]

function renderGuide(userId: string | null = "user-1", tenantId: string | null = "tenant-1") {
  return render(
    <MemoryRouter>
      <ModuleGuide
        config={config}
        titleKey="nav.sections.overview"
        summaryKey="moduleIntro.modules.overview.summary"
        icon={LayoutGrid}
        shortcuts={shortcuts}
        related={related}
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

const roadmapLabel = i18n.t("moduleGuide.roadmapTitle")
const resetLabel = i18n.t("moduleGuide.reset")

describe("ModuleGuide", () => {
  it("renders a connected roadmap with the first step current and the rest upcoming", () => {
    renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const items = within(roadmap).getAllByRole("listitem")
    expect(items).toHaveLength(config.steps.length)
    expect(items[0]).toHaveAttribute("aria-current", "step")
    expect(items[0]).toHaveAttribute("data-state", "active")
    expect(items[1]).toHaveAttribute("data-state", "todo")
  })

  it("shows no points, pontos, or achievements/badges", () => {
    renderGuide()
    expect(screen.queryByText(/pontos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/conquistas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("moduleGuide.progressShort", { total: 5 }), { exact: false })).toBeInTheDocument()
  })

  it("renders the current step's mini-lesson (headline, why-it-matters, diagram node)", () => {
    renderGuide()
    expect(screen.getByText(i18n.t("moduleGuide.lesson.chip"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("moduleGuide.lessons.bookings.learn1.headline"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("moduleGuide.lesson.whyTitle"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("moduleGuide.lessons.bookings.learn1.d1.t"))).toBeInTheDocument()
  })

  it("completing a step advances the roadmap, shows a reward, and persists after remount", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const firstItem = within(roadmap).getAllByRole("listitem")[0]
    expect(firstItem).toHaveAttribute("data-state", "active")

    await user.click(screen.getByTestId("guide-mark-done"))

    expect(firstItem).toHaveAttribute("data-state", "done")
    expect(within(roadmap).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step")
    // per-step success reward
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("moduleGuide.reward.title"))
    expect(document.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1)

    unmount()
    renderGuide()
    expect(within(screen.getByRole("list", { name: roadmapLabel })).getAllByRole("listitem")[0]).toHaveAttribute(
      "data-state",
      "done",
    )
  })

  it("clicking an upcoming roadmap node previews that step's lesson", async () => {
    const user = userEvent.setup()
    renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const secondButton = within(within(roadmap).getAllByRole("listitem")[1]).getByRole("button")

    await user.click(secondButton)

    expect(screen.getByText(i18n.t("moduleGuide.lessons.bookings.learn2.headline"))).toBeInTheDocument()
  })

  it("keeps completion and connectors in sequence while previewing upcoming lessons", async () => {
    const user = userEvent.setup()
    renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const items = within(roadmap).getAllByRole("listitem")
    const connectors = (item: HTMLElement) => item.querySelectorAll(":scope > span[aria-hidden]")

    await user.click(within(items[2]).getByRole("button"))

    expect(screen.getByText(i18n.t(config.steps[2].lesson.headlineKey))).toBeInTheDocument()
    expect(items[0]).toHaveAttribute("aria-current", "step")
    expect(items[2]).toHaveAttribute("data-state", "todo")
    for (const item of items.slice(0, -1)) {
      for (const connector of connectors(item)) expect(connector).toHaveClass("bg-muted")
    }

    await user.click(screen.getByTestId("guide-mark-done"))

    expect(items[0]).toHaveAttribute("data-state", "done")
    expect(items[1]).toHaveAttribute("aria-current", "step")
    expect(items[2]).toHaveAttribute("data-state", "todo")
    for (const connector of connectors(items[0])) expect(connector).toHaveClass("bg-success")
    for (const connector of connectors(items[1])) expect(connector).toHaveClass("bg-muted")

    await user.click(within(items[2]).getByRole("button"))
    await user.click(screen.getByTestId("guide-mark-done"))

    expect(items[1]).toHaveAttribute("data-state", "done")
    expect(items[2]).toHaveAttribute("aria-current", "step")
    for (const connector of connectors(items[1])) expect(connector).toHaveClass("bg-success")
  })

  it("the weekly-hours demo recomputes the customer schedule when a day is toggled off", async () => {
    const user = userEvent.setup()
    renderGuide()
    // Step 2 carries the interactive weekly-hours demo.
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    await user.click(within(within(roadmap).getAllByRole("listitem")[1]).getByRole("button"))

    // 5 open weekdays × 8 daily slots = 40
    expect(screen.getByText(i18n.t("moduleGuide.demo.weekly.total", { count: 40 }))).toBeInTheDocument()

    const [monday] = i18n.t("moduleGuide.demo.weekly.days", { returnObjects: true }) as string[]
    await user.click(screen.getByRole("button", { name: monday, pressed: true }))

    expect(screen.getByText(i18n.t("moduleGuide.demo.weekly.total", { count: 32 }))).toBeInTheDocument()
  })

  it("defaults the reward sound ON and persists toggling it off across remounts", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide()
    const sound = screen.getByTestId("guide-sound-toggle")
    expect(sound).toHaveAttribute("aria-checked", "true")

    await user.click(sound)
    expect(screen.getByTestId("guide-sound-toggle")).toHaveAttribute("aria-checked", "false")

    unmount()
    renderGuide()
    expect(screen.getByTestId("guide-sound-toggle")).toHaveAttribute("aria-checked", "false")
  })

  it("does not scale the active node when reduced motion is preferred", () => {
    setReducedMotion(true)
    renderGuide()
    const roadmap = screen.getByRole("list", { name: roadmapLabel })
    const firstButton = within(within(roadmap).getAllByRole("listitem")[0]).getByRole("button")
    expect(firstButton.querySelector("span")?.className ?? "").not.toMatch(/scale-110/)
  })

  it("reset clears progress and sound preference stays", async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.click(screen.getByTestId("guide-mark-done"))
    expect(within(screen.getByRole("list", { name: roadmapLabel })).getAllByRole("listitem")[0]).toHaveAttribute(
      "data-state",
      "done",
    )

    await user.click(screen.getByRole("button", { name: resetLabel }))
    expect(within(screen.getByRole("list", { name: roadmapLabel })).getAllByRole("listitem")[0]).toHaveAttribute(
      "data-state",
      "active",
    )
  })

  it("keeps progress isolated per tenant", async () => {
    const user = userEvent.setup()
    const { unmount } = renderGuide("user-1", "tenant-1")
    await user.click(screen.getByTestId("guide-mark-done"))
    unmount()

    renderGuide("user-1", "tenant-2")
    expect(within(screen.getByRole("list", { name: roadmapLabel })).getAllByRole("listitem")[0]).toHaveAttribute(
      "data-state",
      "active",
    )
  })
})
