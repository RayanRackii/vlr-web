import { lazy, type ComponentType, type LazyExoticComponent } from "react"

import {
  clearChunkReloadFlag,
  isChunkLoadError,
  reloadOnceForChunkError,
} from "@/lib/chunkLoadError"

/**
 * Lazy route page for modules that use named exports:
 * `lazyPage(() => import("./pages/X"), "X")` -> `React.lazy` with a default export.
 * A chunk that no longer exists after a deploy triggers one guarded page reload; `React.lazy`
 * caches a rejected import, so a reload is the only way to recover.
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
    let module: TModule
    try {
      module = await load()
    } catch (error) {
      if (isChunkLoadError(error) && reloadOnceForChunkError()) {
        // The page is reloading: stay suspended instead of flashing the error screen.
        return new Promise<never>(() => undefined)
      }
      throw error
    }
    clearChunkReloadFlag()
    return { default: module[name] as never }
  })
}
