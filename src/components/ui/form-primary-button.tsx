import {
  LoadingButton,
  type LoadingButtonProps,
} from "@/components/ui/loading-button"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FormPrimaryButtonProps = LoadingButtonProps & {
  isValid: boolean
  /** Keep the resting label and geometry while a centered spinner is shown. */
  preserveLoadingLayout?: boolean
}

function FormPrimaryButton({
  isValid,
  loading = false,
  disabled,
  preserveLoadingLayout = false,
  children,
  className,
  loadingLabel,
  ...props
}: FormPrimaryButtonProps) {
  const blocked = !isValid || loading || Boolean(disabled)

  if (preserveLoadingLayout) {
    return (
      <Button
        {...props}
        className={cn("relative", loading && "disabled:opacity-100", className)}
        disabled={blocked}
        aria-disabled={blocked}
        aria-busy={loading || undefined}
      >
        <span style={{ opacity: loading ? 0 : 1 }}>{children}</span>
        {loading ? <Loader2 aria-hidden className="absolute left-1/2 top-1/2 -ml-2 -mt-2 animate-spin motion-reduce:animate-none" /> : null}
      </Button>
    )
  }

  return (
    <LoadingButton
      {...props}
      className={className}
      loading={loading}
      loadingLabel={loadingLabel}
      disabled={blocked}
      aria-disabled={blocked}
    >
      {children}
    </LoadingButton>
  )
}

export { FormPrimaryButton }
export type { FormPrimaryButtonProps }
