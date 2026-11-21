import { render, screen } from "@testing-library/react"
import { Component, Suspense, type ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { reloadPage } from "@/lib/reloadPage"
import { lazyPage } from "@/routes/lazyPage"

vi.mock("@/lib/reloadPage", () => ({ reloadPage: vi.fn() }))

function Hello() {
  return <p>hello page</p>
}

describe("lazyPage", () => {
  it("resolves a named export and renders it after the fallback", async () => {
    const Lazy = lazyPage(
      () => new Promise<{ Hello: typeof Hello }>((resolve) => setTimeout(() => resolve({ Hello }), 10)),
      "Hello",
    )

    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Suspense fallback={<p>loading fallback</p>}>
          <Routes>
            <Route path="/x" element={<Lazy />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )

    expect(screen.getByText("loading fallback")).toBeInTheDocument()
    expect(await screen.findByText("hello page")).toBeInTheDocument()
    expect(screen.queryByText("loading fallback")).not.toBeInTheDocument()
  })

  describe("stale chunk after a deploy", () => {
    const staleChunk = () =>
      Promise.reject<{ Hello: typeof Hello }>(
        new TypeError("Failed to fetch dynamically imported module: /a.js"),
      )

    beforeEach(() => {
      window.sessionStorage.clear()
      vi.mocked(reloadPage).mockClear()
    })

    it("reloads the page once for a chunk-load error and keeps the fallback", async () => {
      const Lazy = lazyPage(staleChunk, "Hello")
      render(
        <MemoryRouter>
          <Suspense fallback={<p>loading fallback</p>}>
            <Lazy />
          </Suspense>
        </MemoryRouter>,
      )

      await vi.waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1))
      expect(screen.getByText("loading fallback")).toBeInTheDocument()
    })

    it("does not reload again when a reload just happened", async () => {
      window.sessionStorage.setItem("rolvix.chunkReloadAt", String(Date.now()))
      vi.spyOn(console, "error").mockImplementation(() => undefined)
      class Catcher extends Component<{ children: ReactNode }, { failed: boolean }> {
        state = { failed: false }
        static getDerivedStateFromError() {
          return { failed: true }
        }
        render() {
          return this.state.failed ? <p>boundary hit</p> : this.props.children
        }
      }
      const Lazy = lazyPage(staleChunk, "Hello")
      render(
        <MemoryRouter>
          <Catcher>
            <Suspense fallback={<p>loading fallback</p>}>
              <Lazy />
            </Suspense>
          </Catcher>
        </MemoryRouter>,
      )

      expect(await screen.findByText("boundary hit")).toBeInTheDocument()
      expect(reloadPage).not.toHaveBeenCalled()
    })

    it("clears the reload flag after a chunk loads", async () => {
      window.sessionStorage.setItem("rolvix.chunkReloadAt", String(Date.now()))
      const Lazy = lazyPage(() => Promise.resolve({ Hello }), "Hello")
      render(
        <MemoryRouter>
          <Suspense fallback={<p>loading fallback</p>}>
            <Lazy />
          </Suspense>
        </MemoryRouter>,
      )

      expect(await screen.findByText("hello page")).toBeInTheDocument()
      expect(window.sessionStorage.getItem("rolvix.chunkReloadAt")).toBeNull()
    })
  })
})
