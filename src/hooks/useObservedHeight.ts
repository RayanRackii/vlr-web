import { useCallback, useEffect, useState, type RefCallback } from "react"

export function useObservedHeight<T extends HTMLElement>(): {
  ref: RefCallback<T>
  height: number
} {
  const [node, setNode] = useState<T | null>(null)
  const [height, setHeight] = useState(0)

  const ref = useCallback((next: T | null) => {
    setNode(next)
  }, [])

  useEffect(() => {
    if (node == null) {
      setHeight(0)
      return
    }

    const publish = () => {
      setHeight(node.getBoundingClientRect().height)
    }

    publish()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", publish)
      return () => {
        window.removeEventListener("resize", publish)
      }
    }

    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [node])

  return { ref, height }
}
