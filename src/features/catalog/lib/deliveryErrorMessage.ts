const MESSAGE_KEYS: Record<string, string> = {
  "WhatsApp recipient is missing.": "catalog.notifications.errors.whatsappMissing",
  "Email recipient is missing.": "catalog.notifications.errors.emailMissing",
  "SMS channel is not available.": "catalog.notifications.errors.smsUnavailable",
  "Channel has no external provider.": "catalog.notifications.errors.noProvider",
}

const UNSUPPORTED_CHANNEL = /^Unsupported channel (.+)\.$/

type Translate = (key: string, options?: Record<string, string>) => string

/** Maps a known delivery error message to the active language. Unknown text stays as sent. */
export function deliveryErrorText(
  message: string | null | undefined,
  translate: Translate,
): string | null {
  const text = message?.trim()
  if (!text) {
    return null
  }

  const unsupported = UNSUPPORTED_CHANNEL.exec(text)
  if (unsupported?.[1]) {
    return translate("catalog.notifications.errors.unsupportedChannel", {
      channel: unsupported[1],
    })
  }

  const key = MESSAGE_KEYS[text]
  return key ? translate(key) : text
}
