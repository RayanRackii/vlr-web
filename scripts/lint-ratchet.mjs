import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { ESLint } from "eslint"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const baselinePath = path.join(repositoryRoot, ".eslint-baseline.json")

function optionValue(option) {
  const index = process.argv.indexOf(option)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function lint() {
  return new ESLint({ cwd: repositoryRoot }).lintFiles(["."])
}

function countViolations(report) {
  const counts = {}
  for (const file of report) {
    const filePath = path.relative(repositoryRoot, file.filePath).split(path.sep).join("/")
    for (const message of file.messages) {
      if (message.severity === 0) continue
      const rule = message.ruleId ?? "fatal"
      counts[filePath] ??= {}
      counts[filePath][rule] = (counts[filePath][rule] ?? 0) + 1
    }
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, rules]) => [
        file,
        Object.fromEntries(Object.entries(rules).sort(([left], [right]) => left.localeCompare(right))),
      ]),
  )
}

function totalViolations(counts) {
  return Object.values(counts).reduce(
    (total, rules) => total + Object.values(rules).reduce((sum, count) => sum + count, 0),
    0,
  )
}

async function readBaseline(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

function regressionsAgainstBaseline(counts, baseline) {
  const regressions = []

  if (baseline.version === 1) {
    const ruleCounts = {}
    for (const rules of Object.values(counts)) {
      for (const [rule, count] of Object.entries(rules)) {
        ruleCounts[rule] = (ruleCounts[rule] ?? 0) + count
      }
    }
    for (const [rule, count] of Object.entries(ruleCounts)) {
      const allowed = baseline.rules?.[rule] ?? 0
      if (count > allowed) regressions.push(`${rule}: ${allowed} -> ${count}`)
    }
    return regressions
  }

  for (const [file, rules] of Object.entries(counts)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline.files?.[file]?.[rule] ?? 0
      if (count > allowed) regressions.push(`${file} (${rule}): ${allowed} -> ${count}`)
    }
  }
  return regressions
}

function baselineRegressions(candidate, base) {
  if (base.version === 1 || candidate.version === 1) return []

  const regressions = []
  for (const [file, rules] of Object.entries(candidate.files ?? {})) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = base.files?.[file]?.[rule] ?? 0
      if (count > allowed) regressions.push(`${file} (${rule}): ${allowed} -> ${count}`)
    }
  }
  return regressions
}

const counts = countViolations(await lint())

if (process.argv.includes("--write-baseline")) {
  await writeFile(
    baselinePath,
    `${JSON.stringify({ version: 2, files: counts }, null, 2)}\n`,
  )
  console.log(`Wrote ESLint baseline with ${totalViolations(counts)} violations.`)
  process.exit(0)
}

const selectedBaselinePath = optionValue("--baseline") ?? baselinePath
const baseline = await readBaseline(selectedBaselinePath)
const candidateBaselinePath = optionValue("--verify-baseline")
const regressions = regressionsAgainstBaseline(counts, baseline)

if (candidateBaselinePath) {
  regressions.push(
    ...baselineRegressions(await readBaseline(candidateBaselinePath), baseline).map(
      (regression) => `baseline ${regression}`,
    ),
  )
}

if (regressions.length > 0) {
  console.error("New ESLint violations exceed the base baseline:")
  for (const regression of regressions) console.error(`- ${regression}`)
  process.exit(1)
}

console.log(`ESLint ratchet passed (${totalViolations(counts)} existing violations at or below baseline).`)
