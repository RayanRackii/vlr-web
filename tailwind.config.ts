import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"
import plugin from "tailwindcss/plugin"

/**
 * Theme colours are CSS variables, which Tailwind 3 cannot combine with opacity
 * modifiers (`bg-primary/10` would emit no rule). `<alpha-value>` is replaced by
 * Tailwind with the modifier (or 1), so the unmodified class keeps the exact colour.
 */
const token = (name: string) =>
  `color-mix(in oklch, var(--${name}) calc(<alpha-value> * 100%), transparent)`

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Base UI exposes state as data attributes (data-orientation, data-active).
      // The shadcn/Base UI components use Tailwind v4 shorthand variants
      // (`data-horizontal:`, `group-data-vertical/tabs:`, `data-active:`); on
      // Tailwind v3 those only exist when mapped here (also enables group-/peer-).
      data: {
        horizontal: 'orientation="horizontal"',
        vertical: 'orientation="vertical"',
        active: "active",
      },
      // Tailwind 3 does not provide the aria-invalid shorthand by default.
      aria: {
        invalid: 'invalid="true"',
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      keyframes: {
        "marquee-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "skeleton-shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "top-progress": {
          "0%": { transform: "scaleX(0.12)" },
          "100%": { transform: "scaleX(0.92)" },
        },
      },
      animation: {
        "marquee-right": "marquee-right 135s linear infinite",
        "skeleton-shimmer": "skeleton-shimmer 1.35s ease-in-out infinite",
        "top-progress": "top-progress 0.9s ease-out forwards",
      },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        success: {
          DEFAULT: token("success"),
          foreground: token("success-foreground"),
        },
        warning: {
          DEFAULT: token("warning"),
          foreground: token("warning-foreground"),
        },
        info: {
          DEFAULT: token("info"),
          foreground: token("info-foreground"),
        },
        // Sidebar tokens exist in tokens.generated.css but were never mapped, so every
        // `bg-sidebar-accent` / `text-sidebar-*` / `ring-sidebar-ring` class was dead.
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
          primary: token("sidebar-primary"),
          "primary-foreground": token("sidebar-primary-foreground"),
          accent: token("sidebar-accent"),
          "accent-foreground": token("sidebar-accent-foreground"),
          border: token("sidebar-border"),
          ring: token("sidebar-ring"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
    },
  },
  plugins: [
    animate,
    // Touch pointers (phones/tablets) need larger hit targets than mouse pointers;
    // `coarse:` lets editor controls grow only where there's no mouse precision.
    plugin(({ addVariant }) => {
      addVariant("coarse", "@media (pointer: coarse)")
    }),
  ],
} satisfies Config
