import {
  motion,
  useReducedMotion,
  type MotionValue,
} from "framer-motion"

const SPARKLES = [
  { left: "8%", top: "20%", delay: 0, size: 3 },
  { left: "18%", top: "72%", delay: 0.7, size: 2 },
  { left: "30%", top: "8%", delay: 1.1, size: 2 },
  { left: "72%", top: "12%", delay: 0.35, size: 3 },
  { left: "84%", top: "68%", delay: 1.4, size: 2 },
  { left: "92%", top: "34%", delay: 0.9, size: 2 },
  { left: "58%", top: "88%", delay: 1.8, size: 3 },
  { left: "42%", top: "82%", delay: 0.2, size: 2 },
] as const

type HubSparklesProps = {
  opacity?: MotionValue<number>
}

export function HubSparkles({ opacity }: HubSparklesProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className="pointer-events-none absolute -inset-14"
      style={opacity ? { opacity } : undefined}
      aria-hidden="true"
    >
      {SPARKLES.map((sparkle, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
          style={{
            height: sparkle.size,
            left: sparkle.left,
            top: sparkle.top,
            width: sparkle.size,
          }}
          animate={
            prefersReducedMotion
              ? { opacity: 0.75, scale: 1 }
              : {
                  opacity: [0.2, 1, 0.2],
                  scale: [0.7, 1.55, 0.7],
                }
          }
          transition={{
            duration: 2.4,
            delay: sparkle.delay,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
    </motion.div>
  )
}
