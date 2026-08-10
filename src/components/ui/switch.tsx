import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  const isSm = size === "sm"

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "border-zinc-400 bg-zinc-400",
        "aria-checked:border-primary aria-checked:bg-primary",
        "data-checked:border-primary data-checked:bg-primary",
        "dark:border-zinc-500 dark:bg-zinc-500",
        "dark:aria-checked:border-primary dark:aria-checked:bg-primary",
        isSm ? "h-5 w-9" : "h-6 w-11",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md ring-1 ring-black/15 transition-transform",
          isSm ? "size-4 translate-x-0.5" : "size-5 translate-x-0.5",
          isSm
            ? "group-aria-checked:translate-x-[1.05rem] group-data-checked:translate-x-[1.05rem]"
            : "group-aria-checked:translate-x-[1.35rem] group-data-checked:translate-x-[1.35rem]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
