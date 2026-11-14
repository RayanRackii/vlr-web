import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"
import { createQueryClient } from "@/lib/queryClient"

/** Fresh QueryClient per test with retries off, so a failing source fails at once. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, retry: false } })
  return client
}

export function renderWithQuery(ui: ReactElement, { client = createTestQueryClient(), ...options }: RenderOptions & { client?: QueryClient } = {}) {
  const wrap = (node: ReactElement) => <QueryClientProvider client={client}>{node}</QueryClientProvider>
  const result = render(wrap(ui), options)
  return { ...result, client, rerender: (next: ReactElement) => result.rerender(wrap(next)) }
}
