import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PortalAddToCartButton } from "./PortalAddToCartButton"
import { PortalCartCount } from "./PortalCartCount"

describe("purchase tactile feedback", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("keeps the add label and action stable while its ripple expires", () => {
    vi.useFakeTimers()
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })))
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { vibrate }))
    const onAdd = vi.fn()
    const { container, unmount } = render(<PortalAddToCartButton onClick={onAdd}>Adicionar ao carrinho</PortalAddToCartButton>)
    const button = screen.getByRole("button", { name: "Adicionar ao carrinho" })
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(2, 6, 100, 44))
    fireEvent.pointerDown(button, { clientX: 12, clientY: 16, button: 0 })
    expect(container.querySelector(".portal-cart-ripple")).toBeInTheDocument()
    expect(container.querySelector(".portal-cart-ripple")).toHaveStyle({ left: "10px", top: "10px" })
    expect(button).toHaveAttribute("data-pressing", "true")
    fireEvent.pointerUp(button)
    expect(button).not.toHaveAttribute("data-pressing")
    fireEvent.click(button)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(8)
    expect(button).toHaveAccessibleName("Adicionar ao carrinho")
    expect(button).not.toHaveAttribute("aria-pressed")
    act(() => { vi.advanceTimersByTime(600) })
    expect(container.querySelector(".portal-cart-ripple")).not.toBeInTheDocument()
    fireEvent.pointerDown(button, { button: 0 })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("allows adding with reduced motion without a ripple or requiring vibration support", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
    const onAdd = vi.fn()
    const { container } = render(<PortalAddToCartButton onClick={onAdd}>Adicionar ao carrinho</PortalAddToCartButton>)
    const button = screen.getByRole("button")
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.click(button)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(container.querySelector(".portal-cart-ripple")).not.toBeInTheDocument()
  })

  it("pulses the cart count only when it increases", () => {
    const { rerender } = render(<PortalCartCount count={2} />)
    expect(screen.getByText("2")).not.toHaveClass("portal-cart-count-pulse")
    rerender(<PortalCartCount count={3} />)
    expect(screen.getByText("3")).toHaveClass("portal-cart-count-pulse")
    rerender(<PortalCartCount count={1} />)
    expect(screen.getByText("1")).not.toHaveClass("portal-cart-count-pulse")
  })

  it("pulses the first item and replays the pulse on consecutive increases", () => {
    const { rerender } = render(<PortalCartCount count={0} />)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    rerender(<PortalCartCount count={1} />)
    const first = screen.getByText("1")
    expect(first).toHaveClass("portal-cart-count-pulse")
    rerender(<PortalCartCount count={2} />)
    expect(screen.getByText("2")).toHaveClass("portal-cart-count-pulse")
    expect(screen.getByText("2")).not.toBe(first)
  })

  it("supports keyboard addition and respects disabled controls", async () => {
    const onAdd = vi.fn()
    const { container, rerender } = render(<PortalAddToCartButton onClick={onAdd}>Adicionar ao carrinho</PortalAddToCartButton>)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter}")
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(container.querySelector(".portal-cart-ripple")).not.toBeInTheDocument()
    rerender(<PortalAddToCartButton disabled onClick={onAdd}>Adicionar ao carrinho</PortalAddToCartButton>)
    fireEvent.pointerDown(screen.getByRole("button"), { button: 0 })
    await user.click(screen.getByRole("button"))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(container.querySelector(".portal-cart-ripple")).not.toBeInTheDocument()
  })
})
