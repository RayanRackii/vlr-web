import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { ESLint } from "eslint"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const baselinePath = path.join(repositoryRoot, ".eslint-baseline.json")
async function lint() {
  return new ESLint({ cwd: repositoryRoot }).lintFiles(["."])
}

function countViolations(report) {
  const counts = {}
  for (const file of report) {
    for (const message of file.messages) {
      if (message.severity === 0) continue
      const rule = message.ruleId ?? "fatal"
      counts[rule] = (counts[rule] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

const counts = countViolations(await lint())

if (process.argv.includes("--write-baseline")) {
  await writeFile(
    baselinePath,
    `${JSON.stringify({ version: 1, rules: counts }, null, 2)}\n`,
  )
  console.log(`Wrote ESLint baseline with ${Object.values(counts).reduce((sum, count) => sum + count, 0)} violations.`)
  process.exit(0)
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"))
const regressions = Object.entries(counts)
  .filter(([rule, count]) => count > (baseline.rules?.[rule] ?? 0))
  .map(([rule, count]) => `${rule}: ${baseline.rules?.[rule] ?? 0} -> ${count}`)

if (regressions.length > 0) {
  console.error("New ESLint violations exceed the committed baseline:")
  for (const regression of regressions) console.error(`- ${regression}`)
  process.exit(1)
}

console.log(`ESLint ratchet passed (${Object.values(counts).reduce((sum, count) => sum + count, 0)} existing violations at or below baseline).`)
