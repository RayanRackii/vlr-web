import { describe, expect, it } from "vitest"

import {
  isTaskAnswerFilled,
  listMissingMandatoryTaskTitles,
  mergeMissingMandatoryTitles,
  type MandatoryTaskRef,
} from "@/features/workOrders/lib/missingMandatoryTasks"

const FILE_ID = "3f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e"

function task(
  overrides: Partial<MandatoryTaskRef> & Pick<MandatoryTaskRef, "title">,
): MandatoryTaskRef {
  return {
    id: overrides.id ?? overrides.title,
    title: overrides.title,
    inputType: overrides.inputType ?? "Text",
    isMandatory: overrides.isMandatory ?? true,
    order: overrides.order ?? 1,
  }
}

describe("missing mandatory tasks", () => {
  it("treats a blank required photo as incomplete and a file id as filled", () => {
    expect(isTaskAnswerFilled({ inputType: "Image" }, null)).toBe(false)
    expect(isTaskAnswerFilled({ inputType: "Image" }, "   ")).toBe(false)
    expect(isTaskAnswerFilled({ inputType: "Image" }, FILE_ID)).toBe(true)
  })

  it("lists required tasks that are still empty, in order", () => {
    const photo = task({
      title: "Foto",
      inputType: "Image",
      order: 2,
    })
    const check = task({
      title: "Verificar filtros",
      inputType: "Checkbox",
      order: 1,
    })
    const note = task({
      title: "Nota",
      inputType: "Text",
      isMandatory: false,
      order: 3,
    })
    const values = new Map<string, string | null>([
      [check.id, "false"],
      [photo.id, null],
      [note.id, null],
    ])

    expect(
      listMissingMandatoryTaskTitles([photo, note, check], (item) =>
        values.get(item.id) ?? null,
      ),
    ).toEqual(["Verificar filtros", "Foto"])
  })

  it("keeps server-reported titles that are still empty and drops filled ones", () => {
    const photo = task({ title: "Foto", inputType: "Image" })
    const pressure = task({
      title: "Pressão",
      inputType: "Number",
      order: 2,
    })
    const values = new Map<string, string | null>([
      [photo.id, FILE_ID],
      [pressure.id, null],
    ])

    expect(
      mergeMissingMandatoryTitles(
        ["Pressão"],
        ["Foto", "Pressão", "Leitura extra", "  "],
        [photo, pressure],
        (item) => values.get(item.id) ?? null,
      ),
    ).toEqual(["Pressão", "Leitura extra"])
  })
})
