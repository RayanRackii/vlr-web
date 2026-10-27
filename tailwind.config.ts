import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"
import plugin from "tailwindcss/plugin"

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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
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
