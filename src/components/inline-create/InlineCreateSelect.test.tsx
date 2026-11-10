import { useRef, useState } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { InlineCreateSelect, type InlineCreateOption } from "@/components/inline-create/InlineCreateSelect"
import i18n from "@/lib/i18n"

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
    await user.click(await screen.findByRole("option", { name: "+ create type" }))
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
    await user.click(await screen.findByRole("option", { name: "+ create type" }))
    await user.click(await screen.findByRole("button", { name: "Save type" }))

    expect(drawerSubmit).toHaveBeenCalledOnce()
    expect(parentSubmit).not.toHaveBeenCalled()
  })

  it("does not rerender forever when the dirty callback changes identity", async () => {
    const user = userEvent.setup()
    function Host() {
      const [, setFlags] = useState({ dirty: false })
      const renders = useRef(0)
      renders.current += 1
      if (renders.current > 30) {
        throw new Error(`render loop ${renders.current}`)
      }
      return (
        <InlineCreateSelect
          value=""
          onValueChange={vi.fn()}
          options={[{ value: "existing", label: "Existing type" }]}
          onRefreshOptions={async () => []}
          placeholder="Choose a type"
          createLabel="+ create type"
          drawerTitle="Create type"
          onDirtyChange={(dirty) => {
            setFlags((current) => current.dirty === dirty ? current : { dirty })
          }}
          renderCreateForm={({ reportDirty }) => (
            <Button type="button" onClick={() => reportDirty(true)}>Mark dirty</Button>
          )}
        />
      )
    }
    render(<Host />)
    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "+ create type" }))
    await user.click(screen.getByRole("button", { name: "Mark dirty" }))
    expect(screen.getByRole("heading", { name: "Create type" })).toBeInTheDocument()
  })

  it("asks before replacing a dirty create form and keeps it when cancel is chosen", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <InlineCreateSelect
        value=""
        onValueChange={onValueChange}
        options={[{ value: "existing", label: "Existing type" }]}
        onRefreshOptions={async () => []}
        placeholder="Choose a type"
        createLabel="+ create type"
        drawerTitle="Create type"
        renderCreateForm={({ reportDirty, close }) => (
          <>
            <Button type="button" onClick={() => reportDirty(true)}>Mark dirty</Button>
            <Button type="button" onClick={close}>Cancel create</Button>
          </>
        )}
      />,
    )

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "+ create type" }))
    await user.click(screen.getByRole("button", { name: "Mark dirty" }))
    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Existing type" }))

    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Create type" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cancel create" }))
    expect(screen.queryByRole("heading", { name: "Create type" })).not.toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
