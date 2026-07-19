import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion"
import {
  useEffect,
  useId,
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

type GlowHead = {
  x: number
  y: number
  opacity: number
}

const EMPTY_COORDS: PathCoords = {
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
}

const EMPTY_HEAD: GlowHead = { x: 0, y: 0, opacity: 0 }

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

function readHead(
  pathElement: SVGPathElement | null,
  progress: number,
): GlowHead {
  if (!pathElement) {
    return EMPTY_HEAD
  }

  const totalLength = pathElement.getTotalLength()
  if (totalLength <= 0) {
    return EMPTY_HEAD
  }

  const clamped = Math.min(Math.max(progress, 0), 1)
  const point = pathElement.getPointAtLength(clamped * totalLength)

  return {
    x: point.x,
    y: point.y,
    opacity: clamped <= 0.02 || clamped >= 0.98 ? 0 : 1,
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
  const coldGradientId = `beam-cold-${useId().replaceAll(":", "")}`
  const liveGradientId = `beam-live-${useId().replaceAll(":", "")}`
  const ingestPathRef = useRef<SVGPathElement>(null)
  const emitPathRef = useRef<SVGPathElement>(null)
  const onProcessRef = useRef(onProcess)
  const onDeliverRef = useRef(onDeliver)
  const phaseRef = useRef<ProductionPhase>("idle")
  const packetProgress = useMotionValue(0)

  const [phase, setPhase] = useState<ProductionPhase>("idle")
  const [ingestCoords, setIngestCoords] = useState<PathCoords>(EMPTY_COORDS)
  const [emitCoords, setEmitCoords] = useState<PathCoords>(EMPTY_COORDS)
  const [ingestHead, setIngestHead] = useState<GlowHead>(EMPTY_HEAD)
  const [emitHead, setEmitHead] = useState<GlowHead>(EMPTY_HEAD)
  const [packetPoint, setPacketPoint] = useState({ x: 0, y: 0 })
  const [packetScale, setPacketScale] = useState(1)
  const [packetOpacity, setPacketOpacity] = useState(0)

  onProcessRef.current = onProcess
  onDeliverRef.current = onDeliver
  phaseRef.current = phase

  const ingestPath = buildCurvePath(ingestCoords)
  const emitPath = buildCurvePath(emitCoords)

  useLayoutEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | undefined
    let tries = 0

    const updatePaths = () => {
      const container = containerRef.current
      const source = sourceRef.current
      const hub = hubRef.current
      const destination = destinationRef.current

      if (!container || !source || !hub || !destination) {
        return false
      }

      const nextIngest = measurePath(container, source, hub)
      const nextEmit = measurePath(container, hub, destination)
      const ingestReady =
        Math.hypot(
          nextIngest.endX - nextIngest.startX,
          nextIngest.endY - nextIngest.startY,
        ) > 8
      const emitReady =
        Math.hypot(
          nextEmit.endX - nextEmit.startX,
          nextEmit.endY - nextEmit.startY,
        ) > 8

      if (!ingestReady || !emitReady) {
        return false
      }

      setIngestCoords(nextIngest)
      setEmitCoords(nextEmit)
      return true
    }

    const onWindowChange = () => {
      updatePaths()
    }

    const armObservers = () => {
      const container = containerRef.current
      const source = sourceRef.current
      const hub = hubRef.current
      const destination = destinationRef.current

      if (!container || !source || !hub || !destination) {
        return
      }

      resizeObserver = new ResizeObserver(onWindowChange)
      resizeObserver.observe(container)
      resizeObserver.observe(source)
      resizeObserver.observe(hub)
      resizeObserver.observe(destination)
      window.addEventListener("resize", onWindowChange)
      window.addEventListener("scroll", onWindowChange, { passive: true })
    }

    const tryMeasure = () => {
      if (cancelled) {
        return
      }

      if (updatePaths()) {
        armObservers()
        return
      }

      tries += 1
      if (tries < 40) {
        window.requestAnimationFrame(tryMeasure)
      }
    }

    tryMeasure()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      window.removeEventListener("resize", onWindowChange)
      window.removeEventListener("scroll", onWindowChange)
    }
  }, [containerRef, destinationRef, hubRef, sourceRef])

  useMotionValueEvent(incomingProgress, "change", (latest) => {
    setIngestHead(readHead(ingestPathRef.current, latest))
  })

  useMotionValueEvent(outgoingProgress, "change", (latest) => {
    setEmitHead(readHead(emitPathRef.current, latest))
  })

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIngestHead(readHead(ingestPathRef.current, incomingProgress.get()))
      setEmitHead(readHead(emitPathRef.current, outgoingProgress.get()))
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [emitPath, incomingProgress, ingestPath, outgoingProgress])

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
  const showScrollHeads = !prefersReducedMotion && !active
  const ingestOpacity = useTransform(incomingProgress, [0, 0.02, 1], [0, 1, 1])
  const emitOpacity = useTransform(outgoingProgress, [0, 0.02, 1], [0, 1, 1])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient
            id={coldGradientId}
            gradientUnits="userSpaceOnUse"
            x1={ingestCoords.startX}
            y1={ingestCoords.startY}
            x2={ingestCoords.endX}
            y2={ingestCoords.endY}
          >
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
          <linearGradient
            id={liveGradientId}
            gradientUnits="userSpaceOnUse"
            x1={emitCoords.startX}
            y1={emitCoords.startY}
            x2={emitCoords.endX}
            y2={emitCoords.endY}
          >
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor={outputColor} />
          </linearGradient>
        </defs>

        {/* Only scroll-drawn beams — no static/dotted rail (avoids path spoilers). */}
        <motion.path
          ref={ingestPathRef}
          d={ingestPath}
          fill="none"
          stroke={`url(#${coldGradientId})`}
          strokeLinecap="round"
          strokeWidth="3"
          style={{
            pathLength: prefersReducedMotion ? 1 : incomingProgress,
            opacity: prefersReducedMotion ? 0.9 : ingestOpacity,
          }}
        />
        <motion.path
          ref={emitPathRef}
          d={emitPath}
          fill="none"
          stroke={`url(#${liveGradientId})`}
          strokeLinecap="round"
          strokeWidth="3.5"
          style={{
            pathLength: prefersReducedMotion ? 1 : outgoingProgress,
            opacity: prefersReducedMotion ? 0.95 : emitOpacity,
          }}
        />
      </svg>

      {showScrollHeads && ingestHead.opacity > 0 ? (
        <div
          className="absolute left-0 top-0 size-3 rounded-full will-change-transform"
          style={{
            backgroundColor: "#64748B",
            opacity: ingestHead.opacity,
            transform: `translate3d(${ingestHead.x}px, ${ingestHead.y}px, 0) translate(-50%, -50%)`,
            boxShadow: "0 0 0 3px rgba(100,116,139,0.25), 0 0 16px 4px #64748B",
          }}
        />
      ) : null}

      {showScrollHeads && emitHead.opacity > 0 ? (
        <div
          className="absolute left-0 top-0 size-3.5 rounded-full will-change-transform"
          style={{
            backgroundColor: outputColor,
            opacity: emitHead.opacity,
            transform: `translate3d(${emitHead.x}px, ${emitHead.y}px, 0) translate(-50%, -50%)`,
            boxShadow: `0 0 0 3px ${outputColor}40, 0 0 18px 5px ${outputColor}`,
          }}
        />
      ) : null}

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
