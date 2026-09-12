export const WEBKIT_AUTOFILL_ANIMATION = "on-webkit-autofill"

const SKIP_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "file",
  "hidden",
  "image",
  "radio",
  "reset",
  "submit",
])

export function isWebkitAutofillAnimation(animationName: string): boolean {
  return animationName === WEBKIT_AUTOFILL_ANIMATION
}

export function readAutofilledTextInput(
  target: EventTarget | null,
): { name: string; value: string } | null {
  if (!(target instanceof HTMLInputElement)) {
    return null
  }
  if (SKIP_INPUT_TYPES.has(target.type)) {
    return null
  }
  const name = target.name
  if (!name) {
    return null
  }
  return { name, value: target.value }
}

export function attachAutofillSync(
  formElement: HTMLFormElement,
  onField: (name: string, value: string) => void,
): () => void {
  const handle = (event: Event) => {
    if (event.type === "animationstart") {
      const animationName =
        "animationName" in event && typeof event.animationName === "string"
          ? event.animationName
          : ""
      if (!isWebkitAutofillAnimation(animationName)) {
        return
      }
    }

    const read = readAutofilledTextInput(event.target)
    if (!read) {
      return
    }
    onField(read.name, read.value)
  }

  formElement.addEventListener("input", handle, true)
  formElement.addEventListener("change", handle, true)
  formElement.addEventListener("animationstart", handle, true)

  return () => {
    formElement.removeEventListener("input", handle, true)
    formElement.removeEventListener("change", handle, true)
    formElement.removeEventListener("animationstart", handle, true)
  }
}
