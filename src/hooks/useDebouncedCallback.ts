import { useEffect, useMemo, useRef } from "react"

export type DebouncedCallback<TArgs extends unknown[]> = ((
  ...args: TArgs
) => unknown) & {
  flush: () => unknown
  cancel: () => void
}

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => unknown,
  delayMs: number,
): DebouncedCallback<TArgs> {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArgsRef = useRef<TArgs | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingArgsRef.current = null
  }

  const flush = () => {
    if (timeoutRef.current === null || pendingArgsRef.current === null) {
      return undefined
    }

    const args = pendingArgsRef.current
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    pendingArgsRef.current = null
    return callbackRef.current(...args)
  }

  useEffect(() => cancel, [])

  return useMemo(() => {
    const schedule = ((...args: TArgs) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }

      pendingArgsRef.current = args
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        pendingArgsRef.current = null
        callbackRef.current(...args)
      }, delayMs)
    }) as DebouncedCallback<TArgs>

    schedule.flush = flush
    schedule.cancel = cancel
    return schedule
  }, [delayMs])
}
