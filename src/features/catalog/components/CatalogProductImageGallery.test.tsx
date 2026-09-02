import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
import type { CatalogProductGalleryImage } from "@/features/catalog/lib/selectCatalogProductImages"

function image(
  id: string,
  url: string,
  fileName = `${id}.jpg`,
): CatalogProductGalleryImage {
  return { id, url, fileName }
}

const first = image("img-1", "https://cdn.example/one.jpg", "one.jpg")
const second = image("img-2", "https://cdn.example/two.jpg", "two.jpg")

describe("CatalogProductImageGallery", () => {
  it("renders nothing when there are no images", () => {
    const { container } = render(
      <CatalogProductImageGallery images={[]} alt="Cadeira" />,
    )

    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a single image without next or previous controls", () => {
    render(<CatalogProductImageGallery images={[first]} alt="Cadeira" />)

    expect(screen.getByRole("img", { name: "Cadeira" })).toHaveAttribute(
      "src",
      first.url,
    )
    expect(
      screen.queryByRole("button", { name: "Imagem anterior" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Próxima imagem" }),
    ).not.toBeInTheDocument()
  })

  it("shows next when there are two images and next changes the visible image", async () => {
    const user = userEvent.setup()
    render(
      <CatalogProductImageGallery images={[first, second]} alt="Cadeira" />,
    )

    expect(screen.getByRole("img")).toHaveAttribute("src", first.url)

    await user.click(screen.getByRole("button", { name: "Próxima imagem" }))

    expect(screen.getByRole("img")).toHaveAttribute("src", second.url)
  })

  it("goes to the previous image", async () => {
    const user = userEvent.setup()
    render(
      <CatalogProductImageGallery images={[first, second]} alt="Cadeira" />,
    )

    await user.click(screen.getByRole("button", { name: "Próxima imagem" }))
    await user.click(screen.getByRole("button", { name: "Imagem anterior" }))

    expect(screen.getByRole("img")).toHaveAttribute("src", first.url)
  })

  it("loops from last to first and from first to last", async () => {
    const user = userEvent.setup()
    render(
      <CatalogProductImageGallery images={[first, second]} alt="Cadeira" />,
    )

    await user.click(screen.getByRole("button", { name: "Próxima imagem" }))
    await user.click(screen.getByRole("button", { name: "Próxima imagem" }))
    expect(screen.getByRole("img")).toHaveAttribute("src", first.url)

    await user.click(screen.getByRole("button", { name: "Imagem anterior" }))
    expect(screen.getByRole("img")).toHaveAttribute("src", second.url)
  })

  it("marks the current image in the indicator", () => {
    render(
      <CatalogProductImageGallery images={[first, second]} alt="Cadeira" />,
    )

    expect(screen.getByRole("button", { name: "1 / 2" })).toHaveAttribute(
      "aria-current",
      "true",
    )
    expect(screen.getByRole("button", { name: "2 / 2" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("shows a broken fallback on image error without hiding other slides", async () => {
    const user = userEvent.setup()
    render(
      <CatalogProductImageGallery images={[first, second]} alt="Cadeira" />,
    )

    fireEvent.error(screen.getByRole("img"))

    expect(
      screen.getByText("Não foi possível carregar a imagem"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Próxima imagem" }))

    expect(screen.getByRole("img")).toHaveAttribute("src", second.url)
    expect(
      screen.queryByText("Não foi possível carregar a imagem"),
    ).not.toBeInTheDocument()
  })
})
