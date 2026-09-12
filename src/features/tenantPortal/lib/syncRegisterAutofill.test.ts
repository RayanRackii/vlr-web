import { afterEach, describe, expect, it, vi } from "vitest"

import {
  attachAutofillSync,
  isWebkitAutofillAnimation,
  readAutofilledTextInput,
  WEBKIT_AUTOFILL_ANIMATION,
} from "@/features/tenantPortal/lib/syncRegisterAutofill"

function webkitAutofillEvent(animationName: string) {
  const event = new Event("animationstart", { bubbles: true })
  Object.defineProperty(event, "animationName", { value: animationName })
  return event
}

describe("syncRegisterAutofill", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("identifies the webkit autofill animation", () => {
    expect(isWebkitAutofillAnimation(WEBKIT_AUTOFILL_ANIMATION)).toBe(true)
    expect(isWebkitAutofillAnimation("skeleton-shimmer")).toBe(false)
  })

  it("reads named text inputs and skips non-text controls", () => {
    const text = document.createElement("input")
    text.name = "email"
    text.value = "ana@club.test"
    expect(readAutofilledTextInput(text)).toEqual({
      name: "email",
      value: "ana@club.test",
    })

    const unnamed = document.createElement("input")
    unnamed.value = "ignored"
    expect(readAutofilledTextInput(unnamed)).toBeNull()

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.name = "terms"
    expect(readAutofilledTextInput(checkbox)).toBeNull()
  })

  it("forwards autofill-equivalent input, change, and animation events", () => {
    const form = document.createElement("form")
    const email = document.createElement("input")
    email.name = "email"
    form.append(email)
    document.body.append(form)

    const onField = vi.fn()
    const detach = attachAutofillSync(form, onField)

    email.value = "ana@club.test"
    email.dispatchEvent(new Event("input", { bubbles: true }))
    expect(onField).toHaveBeenCalledWith("email", "ana@club.test")

    onField.mockClear()
    email.value = "other@club.test"
    email.dispatchEvent(new Event("change", { bubbles: true }))
    expect(onField).toHaveBeenCalledWith("email", "other@club.test")

    onField.mockClear()
    email.value = "autofill@club.test"
    email.dispatchEvent(webkitAutofillEvent(WEBKIT_AUTOFILL_ANIMATION))
    expect(onField).toHaveBeenCalledWith("email", "autofill@club.test")

    onField.mockClear()
    email.dispatchEvent(webkitAutofillEvent("skeleton-shimmer"))
    expect(onField).not.toHaveBeenCalled()

    detach()
    onField.mockClear()
    email.value = "after-detach@club.test"
    email.dispatchEvent(new Event("input", { bubbles: true }))
    expect(onField).not.toHaveBeenCalled()
  })
})
