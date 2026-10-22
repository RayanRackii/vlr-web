import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { InlineCreateSelect, type InlineCreateOption } from "@/components/inline-create/InlineCreateSelect"

const NEW_OPTION: InlineCreateOption = { value: "new", label: "New type" }

describe("InlineCreateSelect", () => {
  it("creates, refreshes and selects the new option without leaving the form", async () => {
    const user = userEvent.setup()
    const refresh = vi.fn(async () => [
      { value: "existing", label: "Existing type" },
      NEW_OPTION,
    ])
    const onValueChange = vi.fn()

    render(
      <InlineCreateSelect
        value=""
        onValueChange={onValueChange}
        options={[{ value: "existing", label: "Existing type" }]}
        onRefreshOptions={refresh}
        placeholder="Choose a type"
        createLabel="+ create type"
        drawerTitle="Create type"
        renderCreateForm={({ complete }) => (
          <Button type="button" onClick={() => void complete(NEW_OPTION)}>
            Save type
          </Button>
        )}
      />,
    )

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "+ create type" }))
    expect(await screen.findByRole("heading", { name: "Create type" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Save type" }))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(onValueChange).toHaveBeenCalledWith("new")
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Create type" })).not.toBeInTheDocument())
  })

  it("contains drawer form submission instead of submitting its React parent", async () => {
    const user = userEvent.setup()
    const parentSubmit = vi.fn()
    const drawerSubmit = vi.fn()

    render(
      <form onSubmit={(event) => { event.preventDefault(); parentSubmit() }}>
        <InlineCreateSelect
          value=""
          onValueChange={vi.fn()}
          options={[]}
          onRefreshOptions={async () => []}
          placeholder="Choose a type"
          createLabel="+ create type"
          drawerTitle="Create type"
          renderCreateForm={() => (
            <form onSubmit={(event) => { event.preventDefault(); drawerSubmit() }}>
              <Button type="submit">Save type</Button>
            </form>
          )}
        />
      </form>,
    )

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "+ create type" }))
    await user.click(await screen.findByRole("button", { name: "Save type" }))

    expect(drawerSubmit).toHaveBeenCalledOnce()
    expect(parentSubmit).not.toHaveBeenCalled()
  })
})
