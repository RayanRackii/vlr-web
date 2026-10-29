# Design tokens

`*.tokens.json` is the source of truth for the shared colors (light/dark),
brand colors, radius, elevation and motion, plus portal widths, availability
colors, spring and shadow. Values use the [DTCG 2025.10 format](https://www.designtokens.org/tr/2025.10/format/):
structured colors, dimensions, durations, cubic Bézier curves and shadows.

To add a token, put an explicit `$type` and `$value` in an existing group:

```json
"motion-duration-fast": { "$type": "duration", "$value": { "value": 120, "unit": "ms" } }
```

Use `{light.primary}` for a whole-token alias of the same type. The final name
becomes the CSS custom property (`--motion-duration-fast`). Groups inherit
`$extensions.com.rolvix.css` to select the CSS scope and optional layer.
`base.tokens.json` precedes `dark.tokens.json`; preserve that order so `.dark`
wins when both selectors match the root. Keep each variable unique per scope.

CSS extensions preserve existing behavior: `format: "hex"` for brand/portal
colors, `channels: true` for HSL shadow channels, `shadowColor` for runtime
shadow color references, `lightDark` for portal color pairs, and `supports`
for the enhanced `linear()` spring with its cubic Bézier fallback. These are
web export details; typed `$value` data is available for a future native exporter.

Run `npm run tokens:build` and include `src/styles/tokens.generated.css` with
the JSON change. Never edit generated CSS directly. `npm run tokens:check`
fails on drift; `npx vitest run scripts/build-tokens.test.mjs` validates source
values/types/aliases and compares generation in memory with the checked-in CSS.
No dependencies are needed by the generator.

The generated defaults keep their original scopes/layers and CSS references.
Tenant inline primary/secondary overrides and Tailwind mappings stay unchanged.
There was no global spacing variable scale; the portal width variables are
dimensions. The layered brand gradient composition, font declarations, reduced
motion rules, focus utilities, `calc()`/`env()` safe-area offset and component
styles in other feature sheets remain handwritten: they describe web behavior
or local styles rather than the shared typed values migrated here. The spring's
`linear()` samples stay in CSS export metadata because DTCG has no linear easing
type; its portable value is the existing cubic Bézier fallback.
