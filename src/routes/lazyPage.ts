import { lazy, type ComponentType, type LazyExoticComponent } from "react"

/**
 * Lazy route page for modules that use named exports:
 * `lazyPage(() => import("./pages/X"), "X")` -> `React.lazy` with a default export.
 */
export function lazyPage<
  TModule extends Record<string, unknown>,
  TKey extends keyof TModule & string,
>(
  load: () => Promise<TModule>,
  name: TKey,
): LazyExoticComponent<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TModule[TKey] extends ComponentType<any> ? TModule[TKey] : never
> {
  return lazy(async () => {
    const module = await load()
    return { default: module[name] as never }
  })
}
