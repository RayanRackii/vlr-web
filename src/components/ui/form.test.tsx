import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LiveFieldMessage } from "@/features/pmoc/components/FormValidationSummary"
import { useVisibleFormIssues } from "@/lib/useVisibleFormIssues"

const schema = z.object({ name: z.string().min(1, "Enter a name") })

function ExampleForm({ live = true, description = false, message = true }: { live?: boolean; description?: boolean; message?: boolean }) {
  const form = useForm({ resolver: zodResolver(schema), mode: "onSubmit", defaultValues: { name: "" } })
  const values = useWatch({ control: form.control })
  const validation = schema.safeParse(values)
  const issues = useVisibleFormIssues(validation.success ? undefined : validation.error, form)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            {description && <FormDescription>Use your full name</FormDescription>}
            {live && <LiveFieldMessage message={issues?.issues[0]?.message} />}
            {message && <FormMessage />}
          </FormItem>
        )} />
        <button type="submit">Save</button>
      </form>
    </Form>
  )
}

describe("form error descriptions", () => {
  it("describes the visible blur error before submit, keeps one message after submit, and clears its id when corrected", async () => {
    const user = userEvent.setup()
    render(<ExampleForm />)
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "false")

    await user.click(input)
    await user.tab()
    expect(screen.getAllByText("Enter a name")).toHaveLength(1)
    expect(input).toHaveAccessibleDescription("Enter a name")
    expect(input).toHaveAttribute("aria-invalid", "true")
    for (const id of input.getAttribute("aria-describedby")!.split(" ")) {
      expect(document.getElementById(id)).toHaveTextContent("Enter a name")
    }

    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(screen.getAllByText("Enter a name")).toHaveLength(1)
    await user.type(input, "Ana")
    await waitFor(() => expect(screen.queryByText("Enter a name")).not.toBeInTheDocument())
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "false")
  })

  it("describes RHF submit errors and removes only the error reference when corrected", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ExampleForm live={false} description />)
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).toHaveAccessibleDescription("Use your full name")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(input).toHaveAccessibleDescription("Use your full name Enter a name")
    expect(input).toHaveAttribute("aria-invalid", "true")
    for (const id of input.getAttribute("aria-describedby")!.split(" ")) {
      expect(document.getElementById(id)).toBeInTheDocument()
    }
    await user.type(input, "Ana")
    await waitFor(() => expect(input).toHaveAccessibleDescription("Use your full name"))
    expect(input).toHaveAttribute("aria-invalid", "false")
    rerender(<ExampleForm live={false} />)
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("keeps an RHF error invalid without describing a message that is not rendered", async () => {
    const user = userEvent.setup()
    render(<ExampleForm live={false} message={false} />)
    const input = screen.getByRole("textbox", { name: "Name" })
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
