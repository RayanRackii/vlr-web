import { motion, useReducedMotion } from "framer-motion"

const AMBIENT_PATHS = [
  "M-100 80 C220 20 360 260 720 160 S1120 80 1540 220",
  "M-80 260 C240 380 410 80 760 230 S1160 410 1540 300",
  "M-120 440 C210 310 450 520 790 350 S1200 170 1540 430",
] as const

export function BackgroundBeams() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <svg
      viewBox="0 0 1440 520"
      className="pointer-events-none absolute inset-0 size-full opacity-[0.12]"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ambient-beam-gradient" x1="0" x2="1">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="45%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {AMBIENT_PATHS.map((path, index) => (
        <motion.path
          key={path}
          d={path}
          fill="none"
          stroke="url(#ambient-beam-gradient)"
          strokeWidth="1.2"
          initial={prefersReducedMotion ? false : { pathLength: 0.2, opacity: 0.2 }}
          animate={
            prefersReducedMotion
              ? { pathLength: 1, opacity: 0.35 }
              : {
                  pathLength: [0.2, 1, 0.2],
                  opacity: [0.15, 0.55, 0.15],
                }
          }
          transition={{
            duration: 9 + index * 2,
            delay: index * 1.4,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
    </svg>
  )
}
