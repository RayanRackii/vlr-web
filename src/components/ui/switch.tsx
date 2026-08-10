import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "data-[size=default]:h-6 data-[size=default]:w-11 data-[size=sm]:h-5 data-[size=sm]:w-9",
        "data-checked:border-primary data-checked:bg-primary",
        "data-unchecked:border-border data-unchecked:bg-muted-foreground/35",
        "dark:data-unchecked:bg-muted-foreground/50",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform",
          "group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4",
          "group-data-[size=default]/switch:data-checked:translate-x-[1.25rem]",
          "group-data-[size=sm]/switch:data-checked:translate-x-[1rem]",
          "group-data-[size=default]/switch:data-unchecked:translate-x-0.5",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-0.5",
          "dark:data-checked:bg-primary-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
