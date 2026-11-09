import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogCancel } from "./alert-dialog"

it("centres confirmations in a fixed viewport independently of popup transforms", () => {
  render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>Unsaved changes</AlertDialogTitle><AlertDialogCancel>Stay</AlertDialogCancel></AlertDialogContent></AlertDialog>)
  const dialog = screen.getByRole("alertdialog")
  expect(dialog.parentElement).toHaveClass("fixed", "inset-0", "flex", "items-center", "justify-center")
  expect(dialog).toHaveClass("relative", "pointer-events-auto")
  expect(dialog).not.toHaveClass("top-1/2", "-translate-y-1/2")
})
