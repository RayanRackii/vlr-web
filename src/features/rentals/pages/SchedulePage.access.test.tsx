import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SchedulePage } from "@/features/rentals/pages/SchedulePage"

const permissionState = vi.hoisted(() => ({ can: vi.fn<(permission: string) => boolean>() }))

vi.mock("@/features/users/permissions/PermissionContext", () => ({
  usePermissions: () => ({ can: permissionState.can }),
}))

vi.mock("@/features/rentals/pages/TeacherLessonsPage", () => ({
  TeacherLessonsPage: () => <main data-testid="teacher-lessons-only">date-only teacher controls</main>,
}))

describe("SchedulePage access routing", () => {
  beforeEach(() => permissionState.can.mockReset())

  it("routes a fine-grained teacher permission to the restricted date-only UI", () => {
    permissionState.can.mockImplementation((permission) => permission === "rentals.schedule.lessons.write")

    render(<SchedulePage />)

    expect(screen.getByTestId("teacher-lessons-only")).toHaveTextContent("date-only teacher controls")
    expect(screen.queryByText("Configuração semanal")).not.toBeInTheDocument()
  })
})
