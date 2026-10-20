import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { TaxonomyAssignmentFields } from "@/features/taxonomy/components/TaxonomyAssignmentFields"

const categoryA = "11111111-1111-4111-8111-111111111111"
const categoryB = "22222222-2222-4222-8222-222222222222"
const tag = "33333333-3333-4333-8333-333333333333"

function AssignmentFixture({ onSubmit }: { onSubmit: (value: unknown) => void }) {
  const form = useForm({
    defaultValues: { taxonomy: { categoryIds: [categoryA, categoryB], tagIds: [] } },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <TaxonomyAssignmentFields
        control={form.control}
        options={{
          categories: [
            { id: categoryA, name: "Furniture", slug: "furniture", parentId: null, icon: "folder", sortOrder: 0 },
            { id: categoryB, name: "Chairs", slug: "chairs", parentId: null, icon: "folder", sortOrder: 1 },
          ],
          tags: [{ id: tag, name: "Featured", slug: "featured" }],
        }}
      />
      <button type="submit">Save</button>
    </form>
  )
}

describe("TaxonomyAssignmentFields", () => {
  it("keeps every selected category when a tag changes", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AssignmentFixture onSubmit={onSubmit} />)

    await user.click(screen.getByRole("checkbox", { name: "Featured" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledWith(
      { taxonomy: { categoryIds: [categoryA, categoryB], tagIds: [tag] } },
      expect.anything(),
    )
  })
})
