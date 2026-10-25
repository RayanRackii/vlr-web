/** Shared pick-mode colors so every available space looks the same. */
export const portalPickAvailableClass =
  "cursor-pointer border-emerald-600/80 bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:border-emerald-400/80 dark:bg-emerald-950 dark:text-emerald-50 dark:hover:bg-emerald-900"

export const portalPickAvailableSelectedClass =
  "cursor-pointer border-emerald-700 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-700 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-50 dark:ring-emerald-300"

/** A space the customer already holds — distinct brand tone, not grey. */
export const portalPickOwnReservationClass =
  "cursor-not-allowed border-primary/70 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/15 dark:text-primary-foreground"

/** Hatched fill (not color alone) so "taken by someone else" reads at a glance. */
export const portalPickUnavailableClass =
  "cursor-not-allowed border-foreground/40 bg-muted text-foreground bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--border)_5px,var(--border)_7px)]"

export const portalPickPendingClass =
  "cursor-wait border-border bg-muted/40 text-muted-foreground"
