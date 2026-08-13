import { Loader2 } from "lucide-react"
import type { ComponentProps } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

type LoadingButtonProps = ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    /** Optional label while loading; defaults to children. */
    loadingLabel?: string
  }

function LoadingButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      className={cn(loading && "pointer-events-none", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" data-icon="inline-start" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

export { LoadingButton }
export type { LoadingButtonProps }
