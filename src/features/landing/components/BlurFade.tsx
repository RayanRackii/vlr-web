import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

type BlurFadeProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export function BlurFade({
  children,
  className,
  delay = 0,
}: BlurFadeProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={
        prefersReducedMotion
          ? false
          : { filter: "blur(10px)", opacity: 0, y: 18 }
      }
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
