import type { AgendaState } from "./urlState"

export type AgendaKind = NonNullable<AgendaState["tipo"]>

type KindTone = {
  /** Timeline block: tinted fill and a 3px left border in the kind colour. */
  block: string
  /** First line of a block. */
  title: string
  /** Legend dot. */
  dot: string
  /** Small count pill (week cells). */
  pill: string
}

/** One map for blocks, week pills and the footer legend. Pedido is the primary colour. */
export const agendaKindTone: Record<AgendaKind, KindTone> = {
  pedido: { block: "border-l-primary bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--primary)_24%,transparent)]", title: "text-primary", dot: "bg-primary", pill: "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--primary)_24%,transparent)] text-primary" },
  reserva: { block: "border-l-info bg-[color-mix(in_oklch,var(--info)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_24%,transparent)]", title: "text-info", dot: "bg-info", pill: "bg-[color-mix(in_oklch,var(--info)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_24%,transparent)] text-info" },
  manutencao: { block: "border-l-success bg-[color-mix(in_oklch,var(--success)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_24%,transparent)]", title: "text-success", dot: "bg-success", pill: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_24%,transparent)] text-success" },
  bloqueio: { block: "border-l-muted-foreground bg-muted", title: "text-muted-foreground", dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground" },
}

/** Border for an overdue order, replacing the kind border. */
export const agendaOverdueBorder = "border-l-destructive"
