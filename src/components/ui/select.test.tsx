import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Folder } from "lucide-react"
import { describe, expect, it } from "vitest"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const items = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
]

function Harness({ icon }: { icon?: typeof Folder }) {
  return (
    <Select modal={false} defaultValue="a" items={items}>
      <SelectTrigger aria-label="Letter" icon={icon}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} icon={Folder}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

describe("Select", () => {
  it("renders a decorative leading icon and the chevron on the trigger", () => {
    render(<Harness icon={Folder} />)
    const trigger = screen.getByRole("combobox", { name: "Letter" })
    const icons = trigger.querySelectorAll("svg")
    expect(icons).toHaveLength(2)
    expect(icons[0]).toHaveAttribute("aria-hidden", "true")
    expect(icons[0]).toHaveClass("size-4", "text-muted-foreground")
    expect(trigger.firstElementChild).toBe(icons[0])
    expect(trigger).toHaveClass("data-[size=default]:h-11")
  })

  it("renders only the chevron without an icon", () => {
    render(<Harness />)
    expect(screen.getByRole("combobox", { name: "Letter" }).querySelectorAll("svg")).toHaveLength(1)
  })

  it("marks the selected item with a primary check and shows item icons", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("combobox", { name: "Letter" }))
    const selected = await screen.findByRole("option", { name: "Alpha" })
    expect(selected).toHaveAttribute("aria-selected", "true")
    expect(selected.querySelector("svg.text-primary")).not.toBeNull()
    expect(selected.querySelectorAll("svg")).toHaveLength(2)
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("option", { name: "Beta" }).querySelector("svg.text-primary")).toBeNull()
  })
})
