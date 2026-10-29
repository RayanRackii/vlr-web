import { renderHook } from "@testing-library/react"
import { type ReactNode } from "react"
import { expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { ModuleIntroLinksProvider, useModuleIntroLink } from "./ModuleIntroLinksContext"

it("only offers module links supplied by the layout, defaulting to no links", () => {
  const withoutProvider = renderHook(() => useModuleIntroLink("bookings"))
  expect(withoutProvider.result.current).toBeUndefined()
  withoutProvider.unmount()

  const { result, rerender } = renderHook(
    ({ moduleKey }: { moduleKey: "bookings" | "maintenance" }) => useModuleIntroLink(moduleKey),
    {
      initialProps: { moduleKey: "bookings" },
      wrapper: ({ children }: { children: ReactNode }) => (
        <ModuleIntroLinksProvider keys={["bookings"]}>{children}</ModuleIntroLinksProvider>
      ),
    },
  )
  expect(result.current).toEqual({ to: "/modulos/bookings", label: i18n.t("emptyStates.learnMore") })
  rerender({ moduleKey: "maintenance" })
  expect(result.current).toBeUndefined()
})
