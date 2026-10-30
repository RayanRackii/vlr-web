import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", "playwright-report", "test-results"]),
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "react-icons", "react-icons/*", "@heroicons/*", "@phosphor-icons/*",
            "phosphor-react", "@tabler/icons*", "@radix-ui/react-icons",
            "@fortawesome/*", "react-feather", "@mui/icons-material*",
            "iconoir-react", "@iconify/*", "remixicon*", "@hugeicons/*",
          ],
          message: "Use lucide-react (see src/lib/icon.ts)",
        }],
      }],
    },
  },
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
