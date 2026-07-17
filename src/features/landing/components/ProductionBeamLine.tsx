import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from "framer-motion"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"

type ProductionPhase = "idle" | "ingest" | "processing" | "emit"

type ProductionBeamLineProps = {
  containerRef: RefObject<HTMLElement | null>
  sourceRef: RefObject<HTMLElement | null>
  hubRef: RefObject<HTMLElement | null>
  destinationRef: RefObject<HTMLElement | null>
  incomingProgress: MotionValue<number>
  outgoingProgress: MotionValue<number>
  outputColor: string
  startDelay: number
  active: boolean
  onProcess: () => void
  onDeliver: () => void
}

type PathCoords = {
  startX: number
  startY: number
  endX: number
  endY: number
}

const EMPTY_COORDS: PathCoords = {
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
}

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })

function buildCurvePath(coords: PathCoords) {
  const middleX = (coords.startX + coords.endX) / 2
  return [
    `M ${coords.startX} ${coords.startY}`,
    `C ${middleX} ${coords.startY},`,
    `${middleX} ${coords.endY},`,
    `${coords.endX} ${coords.endY}`,
  ].join(" ")
}

function measurePath(
  container: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
): PathCoords {
  const containerRect = container.getBoundingClientRect()
  const fromRect = from.getBoundingClientRect()
  const toRect = to.getBoundingClientRect()

  return {
    startX: fromRect.left + fromRect.width / 2 - containerRect.left,
    startY: fromRect.top + fromRect.height / 2 - containerRect.top,
    endX: toRect.left + toRect.width / 2 - containerRect.left,
    endY: toRect.top + toRect.height / 2 - containerRect.top,
  }
}

export function ProductionBeamLine({
  containerRef,
  sourceRef,
  hubRef,
  destinationRef,
  incomingProgress,
  outgoingProgress,
  outputColor,
  startDelay,
  active,
  onProcess,
  onDeliver,
}: ProductionBeamLineProps) {
  const prefersReducedMotion = useReducedMotion()
  const ingestPathRef = useRef<SVGPathElement>(null)
  const emitPathRef = useRef<SVGPathElement>(null)
  const onProcessRef = useRef(onProcess)
  const onDeliverRef = useRef(onDeliver)
  const phaseRef = useRef<ProductionPhase>("idle")
  const packetProgress = useMotionValue(0)

  const [phase, setPhase] = useState<ProductionPhase>("idle")
  const [ingestCoords, setIngestCoords] = useState<PathCoords>(EMPTY_COORDS)
  const [emitCoords, setEmitCoords] = useState<PathCoords>(EMPTY_COORDS)
  const [packetPoint, setPacketPoint] = useState({ x: 0, y: 0 })
  const [packetScale, setPacketScale] = useState(1)
  const [packetOpacity, setPacketOpacity] = useState(0)

  onProcessRef.current = onProcess
  onDeliverRef.current = onDeliver
  phaseRef.current = phase

  const ingestPath = buildCurvePath(ingestCoords)
  const emitPath = buildCurvePath(emitCoords)

  useLayoutEffect(() => {
    const container = containerRef.current
    const source = sourceRef.current
    const hub = hubRef.current
    const destination = destinationRef.current

    if (!container || !source || !hub || !destination) {
      return
    }

    const updatePaths = () => {
      setIngestCoords(measurePath(container, source, hub))
      setEmitCoords(measurePath(container, hub, destination))
    }

    updatePaths()

    const resizeObserver = new ResizeObserver(updatePaths)
    resizeObserver.observe(container)
    resizeObserver.observe(source)
    resizeObserver.observe(hub)
    resizeObserver.observe(destination)
    window.addEventListener("resize", updatePaths)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updatePaths)
    }
  }, [containerRef, destinationRef, hubRef, sourceRef])

  useMotionValueEvent(packetProgress, "change", (latest) => {
    const currentPhase = phaseRef.current
    const pathElement =
      currentPhase === "emit" ? emitPathRef.current : ingestPathRef.current

    if (
      !pathElement ||
      currentPhase === "idle" ||
      currentPhase === "processing"
    ) {
      return
    }

    const totalLength = pathElement.getTotalLength()
    if (totalLength <= 0) {
      return
    }

    const clamped = Math.min(Math.max(latest, 0), 1)
    const point = pathElement.getPointAtLength(clamped * totalLength)
    const isIngest = currentPhase === "ingest"

    setPacketPoint({ x: point.x, y: point.y })
    setPacketScale(isIngest ? 1 - clamped * 0.45 : 0.55 + clamped * 0.55)
    setPacketOpacity(
      isIngest ? 1 - clamped * 0.15 : Math.min(1, 0.35 + clamped),
    )
  })

  useEffect(() => {
    if (!active || prefersReducedMotion) {
      setPhase("idle")
      setPacketOpacity(0)
      return
    }

    let cancelled = false
    let currentAnimation: ReturnType<typeof animate> | undefined

    const runCycle = async () => {
      await wait(startDelay)

      while (!cancelled) {
        phaseRef.current = "ingest"
        setPhase("ingest")
        packetProgress.set(0)
        setPacketOpacity(1)
        setPacketScale(1)
        const ingestPathElement = ingestPathRef.current
        if (ingestPathElement) {
          const start = ingestPathElement.getPointAtLength(0)
          setPacketPoint({ x: start.x, y: start.y })
        }
        currentAnimation = animate(packetProgress, 1, {
          duration: 1.2,
          ease: [0.42, 0, 0.2, 1],
        })
        await currentAnimation

        if (cancelled) {
          return
        }

        phaseRef.current = "processing"
        setPhase("processing")
        setPacketOpacity(0)
        onProcessRef.current()
        await wait(280)

        if (cancelled) {
          return
        }

        phaseRef.current = "emit"
        setPhase("emit")
        packetProgress.set(0)
        setPacketOpacity(0.55)
        setPacketScale(0.55)
        // Seed first emit position on the outgoing path immediately.
        const emitPathElement = emitPathRef.current
        if (emitPathElement) {
          const start = emitPathElement.getPointAtLength(0)
          setPacketPoint({ x: start.x, y: start.y })
        }
        currentAnimation = animate(packetProgress, 1, {
          duration: 1.2,
          ease: [0.42, 0, 0.2, 1],
        })
        await currentAnimation

        if (cancelled) {
          return
        }

        onDeliverRef.current()
        phaseRef.current = "idle"
        setPhase("idle")
        setPacketOpacity(0)
        await wait(750)
      }
    }

    void runCycle()

    return () => {
      cancelled = true
      currentAnimation?.stop()
    }
  }, [active, packetProgress, prefersReducedMotion, startDelay])

  const packetVisible =
    !prefersReducedMotion &&
    active &&
    (phase === "ingest" || phase === "emit") &&
    packetOpacity > 0.05

  const packetColor = phase === "emit" ? outputColor : "#64748b"

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-visible"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 size-full overflow-visible">
        <motion.path
          ref={ingestPathRef}
          d={ingestPath}
          fill="none"
          stroke="#64748b"
          strokeLinecap="round"
          strokeWidth="3"
          style={{
            pathLength: prefersReducedMotion ? 1 : incomingProgress,
            opacity: prefersReducedMotion ? 0.85 : incomingProgress,
            filter: "drop-shadow(0 0 4px rgba(100,116,139,0.45))",
          }}
        />
        <motion.path
          ref={emitPathRef}
          d={emitPath}
          fill="none"
          stroke={outputColor}
          strokeLinecap="round"
          strokeWidth="3.5"
          style={{
            pathLength: prefersReducedMotion ? 1 : outgoingProgress,
            opacity: prefersReducedMotion ? 0.9 : outgoingProgress,
            filter: `drop-shadow(0 0 6px ${outputColor})`,
          }}
        />
      </svg>

      {packetVisible ? (
        <div
          className="absolute left-0 top-0 size-5 rounded-md border-2 border-white will-change-transform"
          style={{
            backgroundColor: packetColor,
            opacity: packetOpacity,
            transform: `translate3d(${packetPoint.x}px, ${packetPoint.y}px, 0) translate(-50%, -50%) scale(${packetScale})`,
            boxShadow: `0 0 0 4px ${packetColor}40, 0 0 22px 6px ${packetColor}`,
          }}
        />
      ) : null}
    </div>
  )
}
