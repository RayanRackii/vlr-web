import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WorkOrderTaskImageField } from "@/features/workOrders/components/WorkOrderTaskImageField"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import { resetConnectivityForTests } from "@/lib/connectivity"
import i18n from "@/lib/i18n"

const uploadWorkOrderTaskFile = vi.hoisted(() => vi.fn())
const getWorkOrderTaskFileUrl = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  uploadWorkOrderTaskFile,
  getWorkOrderTaskFileUrl,
}))

const FILE_ID = "3f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e"
const WORK_ORDER_ID = makeWorkOrder().id
const TASK_ID = "16161616-1616-4161-8161-161616161616"

function imageTask(value: string | null) {
  const task = makeWorkOrder().tasks[0]
  if (!task) {
    throw new Error("missing task")
  }

  return {
    ...task,
    id: TASK_ID,
    title: "Foto da quadra",
    inputType: "Image" as const,
    isMandatory: true,
    value,
  }
}

function photo(name = "court.jpg", type = "image/jpeg", size = 32): File {
  return new File([new Uint8Array(size)], name, { type })
}

function renderField(
  value: string | null,
  onUploaded = vi.fn(),
  disabled = false,
) {
  const view = render(
    <WorkOrderTaskImageField
      workOrderId={WORK_ORDER_ID}
      task={imageTask(value)}
      disabled={disabled}
      onUploaded={onUploaded}
    />,
  )
  return { ...view, onUploaded }
}

function silenceImageLoad() {
  vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (
    this: HTMLImageElement,
    value: string,
  ) {
    this.setAttribute("src", value)
  })
}

describe("WorkOrderTaskImageField", () => {
  beforeEach(() => {
    silenceImageLoad()
    uploadWorkOrderTaskFile.mockReset()
    getWorkOrderTaskFileUrl.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    resetConnectivityForTests()
    getWorkOrderTaskFileUrl.mockResolvedValue({
      url: "https://files.example/photo?exp=9999999999",
      isPublic: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetConnectivityForTests()
  })

  it("offers a camera file picker and does not upload an invalid photo", async () => {
    const user = userEvent.setup()
    renderField(null)

    expect(
      screen.getByText(i18n.t("workOrders.execution.imageEmpty")),
    ).toBeInTheDocument()
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    expect(input).toHaveAttribute("capture", "environment")
    expect(input).toHaveAttribute("accept", expect.stringContaining("image/webp"))

    await user.upload(
      input as HTMLInputElement,
      photo("huge.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("workOrders.execution.imageTooLarge"),
    )
    expect(uploadWorkOrderTaskFile).not.toHaveBeenCalled()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("uploads with progress and previews the signed URL without a task PATCH", async () => {
    const user = userEvent.setup()
    let release: (value: { value: string }) => void = () => undefined
    uploadWorkOrderTaskFile.mockImplementation(
      (
        _workOrderId: string,
        _taskId: string,
        _file: File,
        onProgress?: (percent: number | null) => void,
      ) => {
        onProgress?.(40)
        return new Promise((resolve) => {
          release = resolve
        })
      },
    )
    const { onUploaded } = renderField(null)
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("missing file input")
    }

    await user.upload(input, photo())

    const progress = await screen.findByRole("progressbar")
    expect(progress).toHaveAttribute("aria-valuenow", "40")
    expect(uploadWorkOrderTaskFile).toHaveBeenCalledWith(
      WORK_ORDER_ID,
      TASK_ID,
      expect.any(File),
      expect.any(Function),
    )
    const sent = uploadWorkOrderTaskFile.mock.calls[0]?.[2]
    expect(sent).toBeInstanceOf(File)
    expect(String(sent)).not.toContain("data:")

    await act(async () => {
      release({ value: FILE_ID })
    })

    expect(onUploaded).toHaveBeenCalledWith(FILE_ID)
    expect(onUploaded).not.toHaveBeenCalledWith(expect.stringContaining("data:"))
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("workOrders.execution.imageUploaded"),
    )
  })

  it("shows the signed preview and requests a new URL when the image expires", async () => {
    vi.useFakeTimers()
    const exp = Math.floor(Date.now() / 1000) + 30
    getWorkOrderTaskFileUrl
      .mockResolvedValueOnce({
        url: `https://files.example/a?exp=${exp}`,
        isPublic: false,
      })
      .mockResolvedValueOnce({
        url: `https://files.example/b?exp=${exp + 900}`,
        isPublic: false,
      })

    renderField(FILE_ID)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(
      screen.getByRole("img", {
        name: i18n.t("workOrders.execution.imagePreviewAlt", {
          title: "Foto da quadra",
        }),
      }),
    ).toHaveAttribute("src", `https://files.example/a?exp=${exp}`)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(getWorkOrderTaskFileUrl).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      `https://files.example/b?exp=${exp + 900}`,
    )
  })

  it("requests a new signed URL when the current preview fails to load", async () => {
    getWorkOrderTaskFileUrl
      .mockResolvedValueOnce({
        url: "https://files.example/expired",
        isPublic: false,
      })
      .mockResolvedValueOnce({
        url: "https://files.example/fresh?exp=9999999999",
        isPublic: false,
      })

    renderField(FILE_ID)
    const image = await screen.findByRole("img")
    fireEvent.error(image)

    await waitFor(() => {
      expect(getWorkOrderTaskFileUrl).toHaveBeenCalledTimes(2)
    })
    expect(getWorkOrderTaskFileUrl).toHaveBeenLastCalledWith(
      WORK_ORDER_ID,
      TASK_ID,
      FILE_ID,
    )
    expect(await screen.findByRole("img")).toHaveAttribute(
      "src",
      "https://files.example/fresh?exp=9999999999",
    )
  })

  it("replaces the photo with another upload of the same file id", async () => {
    const user = userEvent.setup()
    uploadWorkOrderTaskFile.mockResolvedValue({ value: FILE_ID })
    const { onUploaded, rerender } = renderField(FILE_ID)
    await screen.findByRole("img")
    expect(getWorkOrderTaskFileUrl).toHaveBeenCalledTimes(1)

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      photo("next.png", "image/png"),
    )

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(FILE_ID)
    })
    rerender(
      <WorkOrderTaskImageField
        workOrderId={WORK_ORDER_ID}
        task={imageTask(FILE_ID)}
        disabled={false}
        onUploaded={onUploaded}
      />,
    )
    await waitFor(() => {
      expect(getWorkOrderTaskFileUrl).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole("button", {
      name: i18n.t("workOrders.execution.imageReplace"),
    })).toBeInTheDocument()
  })

  it("disables upload offline and does not queue a blob", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    resetConnectivityForTests()
    renderField(null)

    expect(
      screen.getByText(i18n.t("workOrders.execution.imageOffline")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.imageChoose"),
      }),
    ).toBeDisabled()

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [photo()] },
    })

    expect(uploadWorkOrderTaskFile).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })
})
