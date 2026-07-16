import { useRef, type ReactNode } from "react"
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"

import { cn } from "@/lib/utils"

export type ParallaxProduct = {
  title: string
  link: string
  thumbnail: string
}

type HeroParallaxProps = {
  products: ParallaxProduct[]
  header?: ReactNode
  className?: string
}

const SPRING_CONFIG = { stiffness: 100, damping: 30, bounce: 0 }

export function HeroParallax({ products, header, className }: HeroParallaxProps) {
  const firstRow = products.slice(0, 5)
  const secondRow = products.slice(5, 10)
  const thirdRow = products.slice(10, 15)

  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const translateX = useSpring(
    useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 1000]),
    SPRING_CONFIG
  )
  const translateXReverse = useSpring(
    useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, -1000]),
    SPRING_CONFIG
  )
  const rotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.25], prefersReducedMotion ? [0, 0] : [18, 0]),
    SPRING_CONFIG
  )
  const opacity = useSpring(
    useTransform(scrollYProgress, [0, 0.25], prefersReducedMotion ? [1, 1] : [0.35, 1]),
    SPRING_CONFIG
  )
  const scale = useSpring(
    useTransform(scrollYProgress, [0, 0.25], prefersReducedMotion ? [1, 1] : [0.96, 1]),
    SPRING_CONFIG
  )

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-[280vh] flex-col self-auto overflow-hidden antialiased [perspective:1200px] [transform-style:preserve-3d] md:h-[300vh]",
        className
      )}
    >
      <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
        {header}

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[55%] bg-gradient-to-b from-background via-background/90 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />

        <motion.div
          style={{
            rotateX,
            opacity,
            scale,
          }}
          className="mt-auto flex flex-col pb-6 [transform-style:preserve-3d] md:pb-10"
        >
          <ParallaxRow products={firstRow} translate={translateX} reverse />
          <ParallaxRow products={secondRow} translate={translateXReverse} />
          <ParallaxRow products={thirdRow} translate={translateX} reverse />
        </motion.div>
      </div>
    </div>
  )
}

type ParallaxRowProps = {
  products: ParallaxProduct[]
  translate: MotionValue<number>
  reverse?: boolean
}

function ParallaxRow({ products, translate, reverse = false }: ParallaxRowProps) {
  return (
    <motion.div
      className={cn(
        "mb-8 flex gap-6 md:mb-16 md:gap-10",
        reverse ? "flex-row-reverse space-x-reverse" : "flex-row"
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.title} product={product} translate={translate} />
      ))}
    </motion.div>
  )
}

type ProductCardProps = {
  product: ParallaxProduct
  translate: MotionValue<number>
}

function ProductCard({ product, translate }: ProductCardProps) {
  return (
    <motion.div
      style={{ x: translate }}
      whileHover={{ y: -12 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group/product relative h-56 w-[18rem] shrink-0 md:h-80 md:w-[28rem] lg:h-96 lg:w-[30rem]"
    >
      <a
        href={product.link}
        className="block h-full w-full overflow-hidden rounded-xl border border-border/50 shadow-lg transition-shadow group-hover/product:shadow-2xl"
      >
        <img
          src={product.thumbnail}
          height={600}
          width={600}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-left-top"
          alt={product.title}
        />
      </a>
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/0 transition-colors group-hover/product:bg-black/50" />
      <h3 className="absolute bottom-4 left-4 text-sm font-semibold text-white opacity-0 transition-opacity group-hover/product:opacity-100 md:text-base">
        {product.title}
      </h3>
    </motion.div>
  )
}
