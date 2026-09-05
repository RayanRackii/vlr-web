import type { Page } from "@playwright/test"

const PERMISSION_PROVIDER_ERROR =
  "usePermissions must be used within a PermissionProvider"

export type PageErrorGuard = {
  assertNoCrash: () => void
  unexpected4xx: () => Array<{ status: number; url: string }>
}

export function attachPageGuards(page: Page): PageErrorGuard {
  const pageErrors: string[] = []
  const serverErrors: Array<{ status: number; url: string }> = []
  const client4xx: Array<{ status: number; url: string }> = []

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  page.on("console", (message) => {
    if (message.type() === "error") {
      pageErrors.push(message.text())
    }
  })

  page.on("response", (response) => {
    const status = response.status()
    const url = response.url()
    if (status >= 500) {
      serverErrors.push({ status, url })
    } else if (status >= 400) {
      client4xx.push({ status, url })
    }
  })

  return {
    assertNoCrash() {
      const permissionCrash = pageErrors.find((entry) =>
        entry.includes(PERMISSION_PROVIDER_ERROR),
      )
      if (permissionCrash) {
        throw new Error(permissionCrash)
      }

      const renderCrash = pageErrors.find((entry) =>
        /minified react error|uncaught|not wrapped in act/i.test(entry),
      )
      if (renderCrash) {
        throw new Error(`Unexpected page error: ${renderCrash}`)
      }

      if (serverErrors.length > 0) {
        const first = serverErrors[0]
        throw new Error(`HTTP ${first.status} from ${first.url}`)
      }
    },
    unexpected4xx() {
      return client4xx
    },
  }
}
