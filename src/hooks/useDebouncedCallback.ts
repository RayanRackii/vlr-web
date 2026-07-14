import { useEffect, useMemo, useRef } from "react"

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): (...args: TArgs) => void {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useMemo(
    () =>
      (...args: TArgs) => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args)
        }, delayMs)
      },
    [delayMs],
  )
}
