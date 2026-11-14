import { render, screen } from "@testing-library/react"
import { Suspense } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { lazyPage } from "@/routes/lazyPage"

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
})
