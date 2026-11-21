import type { TFunction } from "i18next"

import {
  KNOWN_NOTIFICATION_CHANNELS,
  type KnownNotificationChannel,
} from "@/features/catalog/schemas/catalogSchemas"

function isKnownChannel(channel: string): channel is KnownNotificationChannel {
  return (KNOWN_NOTIFICATION_CHANNELS as readonly string[]).includes(channel)
}

/** Localized channel name; a channel this build does not know gets a neutral label, never the raw value. */
export function notificationChannelLabel(t: TFunction, channel: string): string {
  return t(isKnownChannel(channel) ? `catalog.channels.${channel}` : "catalog.channels.unknown")
}
