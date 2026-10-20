import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TaxonomyFilters } from "@/features/taxonomy/components/TaxonomyFilters"

const category = "11111111-1111-4111-8111-111111111111"
const tag = "22222222-2222-4222-8222-222222222222"

describe("TaxonomyFilters", () => {
  it("supports keyboard category and tag selection", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TaxonomyFilters options={{ categories: [{ id: category, name: "Furniture", slug: "furniture", parentId: null, icon: "folder", sortOrder: 0 }], tags: [{ id: tag, name: "Featured", slug: "featured" }] }} tagIds={[]} onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText("Categoria"), category)
    expect(onChange).toHaveBeenLastCalledWith({ categoryId: category, tagIds: [] })
    screen.getByRole("checkbox").focus()
    expect(screen.getByRole("checkbox")).toHaveFocus()
  })
})
