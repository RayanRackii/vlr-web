/** Mirrors backend `TrialSubdomainGenerator.SuggestBase` for review preview. */
export function suggestTrialSubdomainBase(legalName: string): string {
  const length = 4
  if (!legalName.trim()) {
    return "x".repeat(length)
  }

  const decomposed = legalName.trim().normalize("NFD")
  let result = ""

  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch)) {
      continue
    }
    if (!/[a-zA-Z0-9]/.test(ch)) {
      continue
    }
    result += ch.toLowerCase()
    if (result.length >= length) {
      break
    }
  }

  while (result.length < length) {
    result += "x"
  }

  return result
}
