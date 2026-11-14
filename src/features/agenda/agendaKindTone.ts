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
  pedido: { block: "border-l-primary bg-primary/10", title: "text-primary", dot: "bg-primary", pill: "bg-primary/10 text-primary" },
  reserva: { block: "border-l-info bg-info/10", title: "text-info", dot: "bg-info", pill: "bg-info/10 text-info" },
  manutencao: { block: "border-l-success bg-success/10", title: "text-success", dot: "bg-success", pill: "bg-success/10 text-success" },
  bloqueio: { block: "border-l-muted-foreground bg-muted", title: "text-muted-foreground", dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground" },
}

/** Border for an overdue order, replacing the kind border. */
export const agendaOverdueBorder = "border-l-destructive"
