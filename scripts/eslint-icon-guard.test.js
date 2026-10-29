import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

import config from "../eslint.config.js"

describe("icon import guard", () => {
  it("allows Lucide and rejects alternative icon sets in application source", async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config })
    const resolved = await eslint.calculateConfigForFile("src/icon-audit.tsx")
    expect(resolved.rules["no-restricted-imports"][0]).toBe(2)

    for (const library of [
      "react-icons", "react-icons/fa", "@heroicons/react/24/outline",
      "@phosphor-icons/react", "phosphor-react", "@tabler/icons-react",
      "@radix-ui/react-icons", "@fortawesome/react-fontawesome", "react-feather",
      "@mui/icons-material", "@mui/icons-material/Add", "iconoir-react",
      "@iconify/react", "remixicon-react", "@hugeicons/react", "lucide-react",
    ]) {
      const [result] = await eslint.lintText(`import "${library}"`, { filePath: "src/icon-audit.tsx" })
      const restricted = result.messages.filter(({ ruleId }) => ruleId === "no-restricted-imports")
      expect(restricted, library).toHaveLength(library === "lucide-react" ? 0 : 1)
      if (restricted.length) expect(restricted[0].message).toContain("Use lucide-react (see src/lib/icon.ts)")
    }
  })
})
