/** Full page reload; a separate module so tests can replace the real navigation. */
export function reloadPage(): void {
  window.location.reload()
}
