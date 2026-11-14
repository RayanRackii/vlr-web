/**
 * Shared Tailwind class strings for the editable lists in "Funções" and
 * "Formulário de cadastro". Below `lg` the whole row is one button that opens the action
 * sheet; from `lg` the edit/delete buttons stay visible in the row.
 */
export const PEOPLE_SURFACE = "min-w-0 rounded-xl border border-border bg-card text-card-foreground"
export const PEOPLE_ROW_ACTIONS = "flex shrink-0 gap-1.5 max-lg:contents"
export const PEOPLE_ROW_ACTION_BUTTON =
  "max-lg:absolute max-lg:inset-0 max-lg:z-10 max-lg:size-full max-lg:min-h-11 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:text-transparent max-lg:hover:bg-muted/40 max-lg:[&>span]:opacity-0"
export const PEOPLE_ROW_DELETE_BUTTON = "max-lg:hidden"
export const PEOPLE_ROW_CHEVRON = "size-4 shrink-0 self-center text-muted-foreground lg:hidden"
export const PEOPLE_ACTIONS_HINT = "flex items-center gap-2 text-sm text-muted-foreground lg:hidden [&_svg]:size-4 [&_svg]:shrink-0"
export const PEOPLE_ICON_TILE = "grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5"
