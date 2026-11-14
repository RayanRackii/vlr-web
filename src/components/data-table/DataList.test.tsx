import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DataList, type DataListColumn, type DataListProps } from "@/components/data-table/DataList"

type Row = { id: string; name: string; city: string }

const rows: Row[] = [
  { id: "a", name: "Ana", city: "Recife" },
  { id: "b", name: "Bruno", city: "Natal" },
]

const columns: DataListColumn<Row>[] = [
  { id: "name", header: "Nome", cell: (row) => row.name },
  { id: "city", header: "Cidade", cell: (row) => row.city, hideBelow: "lg" },
  { id: "act", header: "Ações", cell: () => "ok", align: "end" },
]

function renderList(props: Partial<DataListProps<Row>> = {}) {
  const all = {
    label: "Pessoas",
    columns,
    rows,
    getRowId: (row: Row) => row.id,
    renderCard: (row: Row) => <span>card {row.name}</span>,
    empty: { title: "Nada aqui" },
    ...props,
  } as DataListProps<Row>
  return render(<DataList<Row> {...all} />)
}

describe("DataList", () => {
  it("renders the columns and one table row per item", () => {
    renderList()
    const table = screen.getByRole("table", { name: "Pessoas" })
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Nome", "Cidade", "Ações"])
    const all = within(table).getAllByRole("row")
    expect(all).toHaveLength(3)
    expect(all[1]).toHaveTextContent("Ana")
    expect(all[2]).toHaveTextContent("Bruno")
  })

  it("renders renderCard once per item in the card list", () => {
    renderList()
    const list = screen.getByRole("list", { name: "Pessoas" })
    const items = within(list).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("card Ana")
    expect(items[1]).toHaveTextContent("card Bruno")
  })

  it("keeps cards inside the frame: one shrinkable column and min-w-0 items", () => {
    renderList()
    const list = screen.getByRole("list", { name: "Pessoas" })
    expect(list).toHaveClass("grid-cols-1")
    for (const item of within(list).getAllByRole("listitem")) {
      expect(item).toHaveClass("min-w-0")
    }
  })

  it("hides columns below lg and aligns end columns", () => {
    renderList()
    expect(screen.getByRole("columnheader", { name: "Cidade" })).toHaveClass("hidden", "lg:table-cell")
    expect(screen.getByRole("columnheader", { name: "Ações" })).toHaveClass("text-right")
  })

  it("puts rowAttributes on the table row and the card", () => {
    renderList({ rowAttributes: (row) => ({ "data-status": row.id }) })
    expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveAttribute("data-status", "a")
    expect(within(screen.getByRole("list")).getAllByRole("listitem")[1]).toHaveAttribute("data-status", "b")
  })

  it("renders heading and toolbar", () => {
    renderList({ heading: <p>2 itens</p>, toolbar: <div>barra</div> })
    expect(screen.getByText("2 itens")).toBeInTheDocument()
    expect(screen.getByText("barra")).toBeInTheDocument()
  })

  it("shows the empty state when there are no rows", () => {
    renderList({ rows: [], empty: { title: "Nada aqui", description: "Tente outro filtro" } })
    expect(screen.getByText("Nada aqui")).toBeInTheDocument()
    expect(screen.getByText("Tente outro filtro")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows a status and no rows while loading", () => {
    renderList({ state: "loading", loadingLabel: "Carregando pessoas" })
    expect(screen.getByRole("status", { name: "Carregando pessoas" })).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText("Ana")).not.toBeInTheDocument()
    expect(screen.queryByText("Nada aqui")).not.toBeInTheDocument()
  })

  it("shows the error and calls onRetry", () => {
    const onRetry = vi.fn()
    renderList({ state: "error", error: "Falhou", onRetry })
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou")
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  describe("selection", () => {
    it("renders no checkboxes without selection props", () => {
      renderList()
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
    })

    function withSelection(selected: string[] = []) {
      const onChange = vi.fn()
      renderList({
        selection: {
          selectedIds: new Set(selected),
          onChange,
          rowLabel: (row) => `Selecionar ${row.name}`,
          selectAllLabel: "Selecionar todos",
        },
      })
      return onChange
    }

    it("toggles a row from the table", () => {
      const onChange = withSelection()
      const table = screen.getByRole("table", { name: "Pessoas" })
      fireEvent.click(within(table).getByRole("checkbox", { name: "Selecionar Ana" }))
      expect(onChange).toHaveBeenCalledWith(new Set(["a"]))
    })

    it("toggles a row from the card", () => {
      const onChange = withSelection(["a"])
      const list = screen.getByRole("list", { name: "Pessoas" })
      fireEvent.click(within(list).getByRole("checkbox", { name: "Selecionar Ana" }))
      expect(onChange).toHaveBeenCalledWith(new Set())
      fireEvent.click(within(list).getByRole("checkbox", { name: "Selecionar Bruno" }))
      expect(onChange).toHaveBeenLastCalledWith(new Set(["a", "b"]))
    })

    it("header checkbox selects all, then clears all", () => {
      const onChange = withSelection()
      const table = screen.getByRole("table", { name: "Pessoas" })
      fireEvent.click(within(table).getByRole("checkbox", { name: "Selecionar todos" }))
      expect(onChange).toHaveBeenCalledWith(new Set(["a", "b"]))
    })

    it("header checkbox clears when everything is selected", () => {
      const onChange = withSelection(["a", "b"])
      const table = screen.getByRole("table", { name: "Pessoas" })
      const header = within(table).getByRole("checkbox", { name: "Selecionar todos" }) as HTMLInputElement
      expect(header.checked).toBe(true)
      fireEvent.click(header)
      expect(onChange).toHaveBeenCalledWith(new Set())
    })

    it("header checkbox is indeterminate when only some rows are selected", () => {
      withSelection(["a"])
      const table = screen.getByRole("table", { name: "Pessoas" })
      const header = within(table).getByRole("checkbox", { name: "Selecionar todos" }) as HTMLInputElement
      expect(header.indeterminate).toBe(true)
      expect(header.checked).toBe(false)
    })

    it("select-all keeps selected ids that are not in the visible rows", () => {
      const onChange = vi.fn()
      renderList({
        selection: {
          selectedIds: new Set(["hidden"]),
          onChange,
          rowLabel: (row) => `Selecionar ${row.name}`,
          selectAllLabel: "Selecionar todos",
        },
      })
      const table = screen.getByRole("table", { name: "Pessoas" })
      fireEvent.click(within(table).getByRole("checkbox", { name: "Selecionar todos" }))
      expect(onChange).toHaveBeenCalledWith(new Set(["hidden", "a", "b"]))
    })

    it("clearing all keeps selected ids that are not in the visible rows", () => {
      const onChange = vi.fn()
      renderList({
        selection: {
          selectedIds: new Set(["hidden", "a", "b"]),
          onChange,
          rowLabel: (row) => `Selecionar ${row.name}`,
          selectAllLabel: "Selecionar todos",
        },
      })
      const table = screen.getByRole("table", { name: "Pessoas" })
      fireEvent.click(within(table).getByRole("checkbox", { name: "Selecionar todos" }))
      expect(onChange).toHaveBeenCalledWith(new Set(["hidden"]))
    })

    it("renders no select-all with zero rows (empty state)", () => {
      renderList({
        rows: [],
        selection: {
          selectedIds: new Set(),
          onChange: vi.fn(),
          rowLabel: (row) => row.name,
          selectAllLabel: "Selecionar todos",
        },
      })
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
      expect(screen.getByText("Nada aqui")).toBeInTheDocument()
    })
  })
})
