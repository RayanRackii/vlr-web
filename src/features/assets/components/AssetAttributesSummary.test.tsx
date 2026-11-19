import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it } from "vitest"

import { AssetAttributesSummary } from "@/features/assets/components/AssetAttributesSummary"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"
import type { AssetAttributeValue } from "@/features/assets/schemas/assetSchemas"
import i18n from "@/lib/i18n"

const f = (partial: Partial<AssetFamilyField> & Pick<AssetFamilyField, "key" | "type">): AssetFamilyField => ({
  required: false,
  label: partial.key,
  ...partial,
})

function renderSummary(fields: AssetFamilyField[], attributes: Record<string, AssetAttributeValue>) {
  return render(<AssetAttributesSummary fields={fields} attributes={attributes} />)
}

describe("AssetAttributesSummary", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("shows label and value for text and legacy string values as they are", () => {
    renderSummary(
      [f({ key: "model", type: "text", label: "Modelo" }), f({ key: "capacity", type: "number", label: "Capacidade" })],
      { model: "CR-Scan", capacity: "abc" },
    )
    expect(screen.getByText("Modelo")).toBeInTheDocument()
    expect(screen.getByText("CR-Scan")).toBeInTheDocument()
    expect(screen.getByText("abc")).toBeInTheDocument()
  })

  it("renders numbers with their unit", () => {
    renderSummary([f({ key: "acc", type: "number", label: "Precisão", unit: "mm" })], { acc: 0.02 })
    expect(screen.getByText("0,02 mm")).toBeInTheDocument()
  })

  it("renders legacy numeric strings with the unit as well", () => {
    renderSummary([f({ key: "acc", type: "number", label: "Precisão", unit: "mm" })], { acc: "256" })
    expect(screen.getByText("256 mm")).toBeInTheDocument()
  })

  it("renders boolean as Sim/Não", () => {
    renderSummary(
      [f({ key: "a", type: "boolean", label: "Coberta" }), f({ key: "b", type: "boolean", label: "Iluminada" })],
      { a: true, b: "false" },
    )
    expect(screen.getByText("Sim")).toBeInTheDocument()
    expect(screen.getByText("Não")).toBeInTheDocument()
  })

  it("renders select and multiselect values as chips, splitting legacy strings", () => {
    renderSummary(
      [
        f({ key: "mat", type: "multiselect", label: "Materiais", options: ["PLA", "PETG"] }),
        f({ key: "kind", type: "select", label: "Tipo", options: ["A"] }),
      ],
      { mat: "PLA, PETG", kind: "A" },
    )
    expect(screen.getByText("PLA")).toBeInTheDocument()
    expect(screen.getByText("PETG")).toBeInTheDocument()
    expect(screen.getByText("A")).toBeInTheDocument()
  })

  it("keeps line breaks in long text and offers show more / less for long values", async () => {
    const user = userEvent.setup()
    const long = `linha 1\nlinha 2\n${"x".repeat(200)}`
    renderSummary([f({ key: "notes", type: "longtext", label: "Observações" })], { notes: long })
    const paragraph = screen.getByText((_, node) => node?.tagName === "P" && node.textContent === long)
    expect(paragraph.className).toContain("whitespace-pre-line")
    expect(paragraph.className).toContain("line-clamp-3")
    await user.click(screen.getByRole("button", { name: "ver mais" }))
    expect(paragraph.className).not.toContain("line-clamp-3")
    expect(screen.getByRole("button", { name: "ver menos" })).toBeInTheDocument()
  })

  it("does not clamp short long text", () => {
    renderSummary([f({ key: "notes", type: "longtext", label: "Observações" })], { notes: "curto" })
    expect(screen.queryByRole("button", { name: "ver mais" })).not.toBeInTheDocument()
  })

  it("renders http and https URLs as safe links showing the host", () => {
    renderSummary([f({ key: "src", type: "url", label: "Fonte" })], { src: "https://example.com/docs/a?x=1" })
    const link = screen.getByRole("link", { name: "example.com" })
    expect(link).toHaveAttribute("href", "https://example.com/docs/a?x=1")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.getAttribute("rel")).toContain("noreferrer")
  })

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://example.com/a", "/relative/path", "not a url"])(
    "does not render %s as a link",
    (value) => {
      renderSummary([f({ key: "src", type: "url", label: "Fonte" })], { src: value })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
      expect(screen.getByText(value)).toBeInTheDocument()
    },
  )

  it("shows grouped numbers with the same unit on one line", () => {
    const group = "Volume de impressão"
    renderSummary(
      [
        f({ key: "x", type: "number", label: "X", unit: "mm", group }),
        f({ key: "y", type: "number", label: "Y", unit: "mm", group }),
        f({ key: "z", type: "number", label: "Z", unit: "mm", group }),
      ],
      { x: 256, y: "256", z: 300 },
    )
    const block = screen.getByRole("group", { name: group })
    expect(within(block).getByText("256 × 256 × 300 mm")).toBeInTheDocument()
  })

  it("falls back to label/value pairs when a group is not all numbers with one unit", () => {
    const group = "Resolução"
    renderSummary(
      [
        f({ key: "min", type: "number", label: "Mín.", unit: "mm", group }),
        f({ key: "max", type: "number", label: "Máx.", unit: "cm", group }),
      ],
      { min: 1, max: 2 },
    )
    const block = screen.getByRole("group", { name: group })
    expect(within(block).getByText("Mín.")).toBeInTheDocument()
    expect(within(block).getByText("1 mm")).toBeInTheDocument()
    expect(within(block).getByText("2 cm")).toBeInTheDocument()
  })

  it("omits absent values, archived fields and unknown keys", () => {
    renderSummary(
      [
        f({ key: "a", type: "text", label: "Presente" }),
        f({ key: "b", type: "text", label: "Vazio" }),
        f({ key: "c", type: "multiselect", label: "Lista vazia" }),
        f({ key: "old", type: "text", label: "Arquivado", archived: true }),
      ],
      { a: "ok", b: "  ", c: [], old: "segredo", orphan: "fantasma" },
    )
    expect(screen.getByText("Presente")).toBeInTheDocument()
    expect(screen.queryByText("Vazio")).not.toBeInTheDocument()
    expect(screen.queryByText("Lista vazia")).not.toBeInTheDocument()
    expect(screen.queryByText("segredo")).not.toBeInTheDocument()
    expect(screen.queryByText("fantasma")).not.toBeInTheDocument()
  })

  it("shows an empty message when nothing is filled in", () => {
    renderSummary([f({ key: "a", type: "text" })], {})
    expect(screen.getByText("Nenhum atributo preenchido.")).toBeInTheDocument()
  })
})
