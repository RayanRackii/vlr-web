import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color] duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:!size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-[color-mix(in_oklch,var(--destructive)_78%,var(--foreground))] focus-visible:ring-ring dark:bg-[color-mix(in_oklch,var(--destructive)_24%,transparent)]",
        success:
          "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--success)_26%,transparent)]",
        warning:
          "bg-[color-mix(in_oklch,var(--warning)_22%,transparent)] text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)]",
        info:
          "bg-[color-mix(in_oklch,var(--info)_16%,transparent)] text-[color-mix(in_oklch,var(--info)_78%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--info)_26%,transparent)]",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
