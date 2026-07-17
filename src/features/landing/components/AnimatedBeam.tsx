import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion"
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"

type AnimatedBeamProps = {
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  progress?: MotionValue<number>
  delay?: number
  fromColor?: string
  toColor?: string
  dashed?: boolean
  ambientPulse?: boolean
  packet?: {
    progress: MotionValue<number>
    phase: "ingest" | "emit"
    color: string
  }
}

type BeamCoordinates = {
  startX: number
  startY: number
  endX: number
  endY: number
}

type BeamHeadPoint = {
  x: number
  y: number
}

type DataPacketState = BeamHeadPoint & {
  opacity: number
  scale: number
}

const EMPTY_COORDINATES: BeamCoordinates = {
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
}

const EMPTY_HEAD_POINT: BeamHeadPoint = {
  x: 0,
  y: 0,
}

const EMPTY_PACKET_STATE: DataPacketState = {
  x: 0,
  y: 0,
  opacity: 0,
  scale: 0.4,
}

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  progress,
  delay = 0,
  fromColor = "var(--muted-foreground)",
  toColor = "var(--primary)",
  dashed = false,
  ambientPulse = true,
  packet,
}: AnimatedBeamProps) {
  const gradientId = `beam-${useId().replaceAll(":", "")}`
  const prefersReducedMotion = useReducedMotion()
  const completedProgress = useMotionValue(1)
  const beamProgress = prefersReducedMotion
    ? completedProgress
    : (progress ?? completedProgress)
  const ambientOpacity = useTransform(beamProgress, [0.88, 1], [0, 1])
  const headOpacity = useTransform(
    beamProgress,
    [0, 0.02, 0.98, 1],
    [0, 1, 1, 0.3],
  )
  const beamPathRef = useRef<SVGPathElement>(null)
  const [coordinates, setCoordinates] =
    useState<BeamCoordinates>(EMPTY_COORDINATES)
  const [headPoint, setHeadPoint] =
    useState<BeamHeadPoint>(EMPTY_HEAD_POINT)
  const [packetState, setPacketState] =
    useState<DataPacketState>(EMPTY_PACKET_STATE)

  useLayoutEffect(() => {
    const container = containerRef.current
    const from = fromRef.current
    const to = toRef.current

    if (!container || !from || !to) {
      return
    }

    const updateCoordinates = () => {
      const containerRect = container.getBoundingClientRect()
      const fromRect = from.getBoundingClientRect()
      const toRect = to.getBoundingClientRect()

      setCoordinates({
        startX: fromRect.left + fromRect.width / 2 - containerRect.left,
        startY: fromRect.top + fromRect.height / 2 - containerRect.top,
        endX: toRect.left + toRect.width / 2 - containerRect.left,
        endY: toRect.top + toRect.height / 2 - containerRect.top,
      })
    }

    updateCoordinates()

    const resizeObserver = new ResizeObserver(updateCoordinates)
    resizeObserver.observe(container)
    resizeObserver.observe(from)
    resizeObserver.observe(to)
    window.addEventListener("resize", updateCoordinates)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateCoordinates)
    }
  }, [containerRef, fromRef, toRef])

  const middleX = (coordinates.startX + coordinates.endX) / 2
  const path = [
    `M ${coordinates.startX} ${coordinates.startY}`,
    `C ${middleX} ${coordinates.startY},`,
    `${middleX} ${coordinates.endY},`,
    `${coordinates.endX} ${coordinates.endY}`,
  ].join(" ")

  const updateHeadPoint = useCallback((latestProgress: number) => {
    const beamPath = beamPathRef.current

    if (!beamPath) {
      return
    }

    const totalLength = beamPath.getTotalLength()
    const point = beamPath.getPointAtLength(
      Math.min(Math.max(latestProgress, 0), 1) * totalLength,
    )

    setHeadPoint({ x: point.x, y: point.y })
  }, [])

  const updatePacketState = useCallback(
    (latestProgress: number) => {
      const beamPath = beamPathRef.current

      if (!beamPath || !packet) {
        return
      }

      const clampedProgress = Math.min(Math.max(latestProgress, 0), 1)
      const totalLength = beamPath.getTotalLength()
      const point = beamPath.getPointAtLength(clampedProgress * totalLength)
      const isIngest = packet.phase === "ingest"

      setPacketState({
        x: point.x,
        y: point.y,
        opacity: isIngest
          ? Math.max(0, 1 - clampedProgress ** 3)
          : Math.min(1, clampedProgress * 1.5),
        scale: isIngest
          ? 1 - clampedProgress * 0.6
          : 0.4 + clampedProgress * 0.6,
      })
    },
    [packet],
  )

  useMotionValueEvent(beamProgress, "change", updateHeadPoint)
  useMotionValueEvent(
    packet?.progress ?? completedProgress,
    "change",
    updatePacketState,
  )

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateHeadPoint(beamProgress.get())
      if (packet) {
        updatePacketState(packet.progress.get())
      }
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [beamProgress, packet, path, updateHeadPoint, updatePacketState])

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--border)"
        strokeDasharray="5 9"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity={dashed ? 0.8 : 0.55}
      />
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={coordinates.startX}
          y1={coordinates.startY}
          x2={coordinates.endX}
          y2={coordinates.endY}
        >
          <stop offset="0%" stopColor={fromColor} />
          <stop offset="100%" stopColor={toColor} />
        </linearGradient>
      </defs>
      <motion.path
        ref={beamPathRef}
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeWidth="3.5"
        style={{
          filter:
            "drop-shadow(0 0 5px color-mix(in oklab, var(--primary) 55%, transparent))",
          opacity: beamProgress,
          pathLength: beamProgress,
        }}
      />
      <motion.circle
        cx={headPoint.x}
        cy={headPoint.y}
        r="5"
        fill={toColor}
        style={{
          filter: `drop-shadow(0 0 8px ${toColor})`,
          opacity: prefersReducedMotion ? 0 : headOpacity,
        }}
      />
      {packet && !prefersReducedMotion ? (
        <g transform={`translate(${packetState.x} ${packetState.y})`}>
          <circle
            r="5"
            fill={packet.color}
            opacity={packetState.opacity}
            transform={`scale(${packetState.scale})`}
            style={{
              filter: `drop-shadow(0 0 7px ${packet.color})`,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />
        </g>
      ) : null}
      {ambientPulse ? (
        <motion.path
          d={path}
          fill="none"
          stroke="white"
          strokeDasharray="8 34"
          strokeLinecap="round"
          strokeWidth="2"
          initial={{ strokeDashoffset: 0 }}
          animate={
            prefersReducedMotion ? undefined : { strokeDashoffset: [0, -84] }
          }
          style={{ opacity: prefersReducedMotion ? 0 : ambientOpacity }}
          transition={{
            duration: 2.4,
            delay,
            ease: "linear",
            repeat: Infinity,
            repeatDelay: 1.2 + delay,
          }}
        />
      ) : null}
    </svg>
  )
}
