import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PeopleCustomersTab } from "@/features/users/components/PeopleCustomersTab"
import type {
  DirectoryQuery,
  TenantCustomer,
  TenantCustomerPage,
} from "@/features/users/schemas/userSchemas"
import { listTenantCustomers } from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/usersService", () => ({
  listTenantCustomers: vi.fn(),
}))

const listTenantCustomersMock = vi.mocked(listTenantCustomers)

const CUSTOMER: TenantCustomer = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Cliente Portal",
  email: "cliente@example.com",
  emailVerified: true,
  createdAt: "2026-10-13T15:00:00.000Z",
}

const OTHER_CUSTOMER: TenantCustomer = {
  ...CUSTOMER,
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "Outro Cliente",
  email: "outro@example.com",
}

function customerPage(items: TenantCustomer[]): TenantCustomerPage {
  return { items, page: 1, pageSize: 20, total: items.length }
}

type PendingCall = {
  query: DirectoryQuery | undefined
  signal: AbortSignal | undefined
  resolve: (value: TenantCustomerPage) => void
  reject: (reason?: unknown) => void
}

function installPendingCalls() {
  const calls: PendingCall[] = []
  listTenantCustomersMock.mockImplementation((query, signal) => {
    return new Promise<TenantCustomerPage>((resolve, reject) => {
      calls.push({ query, signal, resolve, reject })
    })
  })
  return calls
}

async function resolveCall(call: PendingCall, page: TenantCustomerPage) {
  await act(async () => {
    call.resolve(page)
  })
}

const environmentEmpty = i18n.t("peopleAccess.customers.empty")
const environmentEmptyDescription = i18n.t(
  "peopleAccess.customers.emptyDescription",
)
const searchEmpty = i18n.t("peopleAccess.customers.emptySearch")
const searchEmptyDescription = i18n.t(
  "peopleAccess.customers.emptySearchDescription",
)

describe("PeopleCustomersTab", () => {
  beforeEach(() => {
    listTenantCustomersMock.mockReset()
  })

  it("shows the environment empty state when there are no customers and no search", async () => {
    listTenantCustomersMock.mockResolvedValue(customerPage([]))
    render(<PeopleCustomersTab />)

    expect(await screen.findByText(environmentEmpty)).toBeInTheDocument()
    expect(screen.getByText(environmentEmptyDescription)).toBeInTheDocument()
    expect(screen.queryByText(searchEmpty)).not.toBeInTheDocument()
  })

  it("shows a distinct empty state when a search returns nothing", async () => {
    const user = userEvent.setup()
    listTenantCustomersMock.mockResolvedValue(customerPage([]))
    render(<PeopleCustomersTab />)

    expect(await screen.findByText(environmentEmpty)).toBeInTheDocument()

    await user.type(
      screen.getByLabelText(i18n.t("peopleAccess.customers.searchLabel")),
      "zz",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.customers.searchAction"),
      }),
    )

    expect(await screen.findByText(searchEmpty)).toBeInTheDocument()
    expect(screen.getByText(searchEmptyDescription)).toBeInTheDocument()
    expect(screen.queryByText(environmentEmpty)).not.toBeInTheDocument()
    expect(
      screen.queryByText(environmentEmptyDescription),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(listTenantCustomersMock).toHaveBeenLastCalledWith(
        { q: "zz", page: 1, pageSize: 20 },
        expect.any(AbortSignal),
      )
    })
  })

  it("keeps the latest list when an older empty search resolves afterwards", async () => {
    const user = userEvent.setup()
    const calls = installPendingCalls()
    render(<PeopleCustomersTab />)

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    await resolveCall(calls[0], customerPage([CUSTOMER]))
    expect(await screen.findByText(CUSTOMER.name)).toBeInTheDocument()

    const search = screen.getByLabelText(
      i18n.t("peopleAccess.customers.searchLabel"),
    )
    await user.type(search, "zz")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.customers.searchAction"),
      }),
    )
    await waitFor(() => {
      expect(calls).toHaveLength(2)
    })
    expect(calls[0]?.signal?.aborted).toBe(true)
    expect(calls[1]?.signal?.aborted).toBe(false)

    await user.clear(search)
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.customers.searchAction"),
      }),
    )
    await waitFor(() => {
      expect(calls).toHaveLength(3)
    })
    expect(calls[1]?.query).toEqual({ q: "zz", page: 1, pageSize: 20 })
    expect(calls[1]?.signal?.aborted).toBe(true)
    expect(calls[2]?.query).toEqual({
      q: undefined,
      page: 1,
      pageSize: 20,
    })
    expect(calls[2]?.signal?.aborted).toBe(false)

    await resolveCall(calls[2], customerPage([CUSTOMER, OTHER_CUSTOMER]))
    expect(await screen.findByText(OTHER_CUSTOMER.name)).toBeInTheDocument()

    await resolveCall(calls[1], customerPage([]))

    expect(screen.getByText(CUSTOMER.name)).toBeInTheDocument()
    expect(screen.getByText(OTHER_CUSTOMER.name)).toBeInTheDocument()
    expect(screen.queryByText(searchEmpty)).not.toBeInTheDocument()
    expect(screen.queryByText(environmentEmpty)).not.toBeInTheDocument()
  })

  it("ignores a canceled older search and still shows the latest list", async () => {
    const user = userEvent.setup()
    const calls = installPendingCalls()
    render(<PeopleCustomersTab />)

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    await resolveCall(calls[0], customerPage([CUSTOMER]))
    expect(await screen.findByText(CUSTOMER.name)).toBeInTheDocument()

    await user.type(
      screen.getByLabelText(i18n.t("peopleAccess.customers.searchLabel")),
      "zz",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.customers.searchAction"),
      }),
    )
    await waitFor(() => {
      expect(calls).toHaveLength(2)
    })

    await user.clear(
      screen.getByLabelText(i18n.t("peopleAccess.customers.searchLabel")),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.customers.searchAction"),
      }),
    )
    await waitFor(() => {
      expect(calls).toHaveLength(3)
    })

    await resolveCall(calls[2], customerPage([CUSTOMER]))
    expect(await screen.findByText(CUSTOMER.name)).toBeInTheDocument()

    const canceled = Object.assign(new Error("canceled"), {
      name: "CanceledError",
      code: "ERR_CANCELED",
    })
    await act(async () => {
      calls[1]?.reject(canceled)
    })

    expect(screen.getByText(CUSTOMER.name)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText(searchEmpty)).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("peopleAccess.errors.loadCustomers")),
    ).not.toBeInTheDocument()
  })
})
