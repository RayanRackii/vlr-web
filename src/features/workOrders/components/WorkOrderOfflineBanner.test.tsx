import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WorkOrderOfflineBanner } from "@/features/workOrders/components/WorkOrderOfflineBanner"
import {
  noteTransportFailure,
  noteTransportSuccess,
  resetConnectivityForTests,
} from "@/lib/connectivity"
import i18n from "@/lib/i18n"

function mockOnLine(online: boolean): void {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online)
}

describe("WorkOrderOfflineBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockOnLine(true)
    resetConnectivityForTests()
  })

  it("stays visible after a spurious online event until a request succeeds", () => {
    mockOnLine(false)
    resetConnectivityForTests()
    window.dispatchEvent(new Event("offline"))
    render(<WorkOrderOfflineBanner />)

    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()

    mockOnLine(true)
    act(() => {
      window.dispatchEvent(new Event("online"))
    })

    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()

    act(() => {
      noteTransportSuccess()
    })

    expect(
      screen.queryByText(i18n.t("workOrders.offline.title")),
    ).not.toBeInTheDocument()
  })

  it("appears after a failed request even when the browser still says online", () => {
    mockOnLine(true)
    resetConnectivityForTests()
    render(<WorkOrderOfflineBanner />)

    expect(
      screen.queryByText(i18n.t("workOrders.offline.title")),
    ).not.toBeInTheDocument()

    act(() => {
      noteTransportFailure()
    })

    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
  })

  it("keeps the banner when a response arrives while the browser is offline", () => {
    mockOnLine(false)
    resetConnectivityForTests()
    window.dispatchEvent(new Event("offline"))
    render(<WorkOrderOfflineBanner />)

    act(() => {
      noteTransportSuccess()
    })

    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
  })
})
