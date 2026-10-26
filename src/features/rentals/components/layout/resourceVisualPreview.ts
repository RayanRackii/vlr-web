/**
 * Raw SVG markup from a draft revision is never trusted into the DOM (no
 * `dangerouslySetInnerHTML`): wrapping it as an `<img>` data URL renders it in
 * the browser's restricted "image" context, where embedded scripts don't run.
 */
export function buildRevisionPreviewSrc(
  floorSvg: string,
  linesSvg: string,
  netSvg: string,
  viewBox: string,
): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${floorSvg}${linesSvg}${netSvg}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(markup)}`
}
