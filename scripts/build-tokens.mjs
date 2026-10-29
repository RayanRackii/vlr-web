import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const cssOptions = (node) => node.$extensions?.["com.rolvix.css"] ?? {}
const aliasPath = (value) => typeof value === "string" && /^\{[^{}]+\}$/.test(value) ? value.slice(1, -1) : null
const supportedTypes = new Set(["color", "dimension", "duration", "cubicBezier", "shadow"])
const quantity = (value, units) => value && Number.isFinite(value.value) && units.includes(value.unit)

function validate(type, value) {
  let valid = false
  if (type === "color") {
    valid = value && ["srgb", "oklch", "hsl"].includes(value.colorSpace)
      && Array.isArray(value.components) && value.components.length === 3 && value.components.every(Number.isFinite)
      && (value.alpha === undefined || (Number.isFinite(value.alpha) && value.alpha >= 0 && value.alpha <= 1))
  }
  if (type === "dimension") valid = quantity(value, ["px", "rem"])
  if (type === "duration") valid = quantity(value, ["ms", "s"]) && value.value >= 0
  if (type === "cubicBezier") {
    valid = Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)
      && value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1
  }
  if (type === "shadow") {
    const layers = Array.isArray(value) ? value : [value]
    valid = layers.length > 0 && layers.every((shadow) => shadow && ["offsetX", "offsetY", "blur", "spread"]
      .every((key) => quantity(shadow[key], ["px", "rem"])) && (shadow.inset === undefined || typeof shadow.inset === "boolean"))
    if (valid) for (const shadow of layers) validate("color", shadow.color)
  }
  if (!valid) throw new Error(`Invalid ${type} value: ${JSON.stringify(value)}`)
}

const decimal = (value) => Number(value.toFixed(12))
function serialize(type, value, options = {}) {
  if (type === "color") {
    const { colorSpace, components, alpha } = value
    if (options.format === "hex") return `#${components.map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`
    const channels = colorSpace === "hsl"
      ? `${components[0]} ${components[1]}% ${components[2]}%`
      : components.join(" ")
    if (options.channels) return channels
    const functionName = colorSpace === "srgb" ? "rgb" : colorSpace
    const cssChannels = colorSpace === "srgb" ? components.map((channel) => decimal(channel * 255)).join(" ") : channels
    return `${functionName}(${cssChannels}${alpha === undefined ? "" : ` / ${alpha}`})`
  }
  if (type === "shadow") return (Array.isArray(value) ? value : [value]).map((shadow) => {
    const dimensions = [shadow.offsetX, shadow.offsetY, shadow.blur, shadow.spread]
      .map((dimension) => dimension.value === 0 ? "0" : serialize("dimension", dimension)).join(" ")
    const color = options.shadowColor
      ? `hsl(var(${options.shadowColor}) / ${shadow.color.alpha ?? 1})`
      : serialize("color", shadow.color)
    return `${shadow.inset ? "inset " : ""}${dimensions} ${color}`
  }).join(", ")
  if (type === "cubicBezier") return `cubic-bezier(${value.join(", ")})`
  return `${value.value}${value.unit}`
}

// Pure entry point: tests and future platform exporters can consume the same data.
export function generateCss(sets) {
  const tokens = new Map()
  function collect(group, parents = [], options = {}) {
    options = { ...options, ...cssOptions(group) }
    for (const [name, node] of Object.entries(group)) {
      if (name.startsWith("$")) continue
      const names = [...parents, name]
      if ("$value" in node || "$type" in node) {
        if (!("$value" in node)) throw new Error(`Missing $value: ${names.join(".")}`)
        if (!supportedTypes.has(node.$type)) throw new Error(`Invalid $type: ${names.join(".")}`)
        tokens.set(names.join("."), { ...node, name: `--${name}`, options: { ...options, ...cssOptions(node) } })
      } else collect(node, names, options)
    }
  }
  collect(sets)

  function resolve(name, seen = []) {
    const token = tokens.get(name)
    if (!token) throw new Error(`Unknown token alias: ${name}`)
    if (seen.includes(name)) throw new Error(`Circular token alias: ${[...seen, name].join(" -> ")}`)
    const target = aliasPath(token.$value)
    if (target) {
      const resolved = resolve(target, [...seen, name])
      if (token.$type !== resolved.$type) throw new Error(`Alias type mismatch: ${name} -> ${target}`)
      return { ...token, $value: resolved.$value }
    }
    validate(token.$type, token.$value)
    return token
  }

  const blocks = new Map()
  function addBlock(selector, layer, declaration, supports) {
    const key = JSON.stringify({ selector, layer, supports })
    if (!blocks.has(key)) blocks.set(key, [])
    blocks.get(key).push(`  ${declaration}`)
  }
  for (const [name, token] of tokens) {
    const { selector, layer } = token.options
    if (!selector) throw new Error(`Missing CSS selector: ${name}`)
    const value = resolve(name).$value
    const target = aliasPath(token.$value)
    let output = target ? `var(${tokens.get(target).name})` : serialize(token.$type, value, token.options)
    if (token.options.lightDark) {
      const dark = aliasPath(token.options.lightDark)
      if (resolve(dark).$type !== "color" || token.$type !== "color") throw new Error(`Invalid light-dark color: ${name}`)
      output = `light-dark(${output}, var(${tokens.get(dark).name}))`
    }
    addBlock(selector, layer, `${token.name}: ${output};`)
    if (token.options.supports) {
      addBlock(selector, layer, `${token.name}: ${token.options.supports.value};`, token.options.supports.condition)
    }
  }

  return "/* Generated by scripts/build-tokens.mjs; do not edit. */\n\n" + [...blocks].map(([key, declarations]) => {
    const { selector, layer, supports } = JSON.parse(key)
    let block = `${selector} {\n${declarations.join("\n")}\n}`
    if (supports) block = wrap(`@supports ${supports}`, block)
    return layer ? wrap(`@layer ${layer}`, block) : block
  }).join("\n\n") + "\n"
}

const wrap = (rule, block) => `${rule} {\n${block.split("\n").map((line) => `  ${line}`).join("\n")}\n}`

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export async function loadTokens() {
  const sets = {}
  for (const file of (await readdir(path.join(root, "tokens"))).filter((name) => name.endsWith(".tokens.json")).sort()) {
    const groups = JSON.parse(await readFile(path.join(root, "tokens", file), "utf8"))
    for (const name of Object.keys(groups)) {
      if (name in sets) throw new Error(`Duplicate token group: ${name}`)
      sets[name] = groups[name]
    }
  }
  return sets
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.join(root, "src/styles/tokens.generated.css")
  const generated = generateCss(await loadTokens())
  if (process.argv.includes("--check")) {
    const current = await readFile(output, "utf8").catch(() => "")
    if (current !== generated) {
      console.error("Generated tokens are stale. Run npm run tokens:build.")
      process.exitCode = 1
    }
  } else {
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, generated)
  }
}
