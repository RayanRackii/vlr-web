import { useLocation } from "react-router-dom"

import {
  buildOnboardingHref,
  resolvePassthroughParams,
} from "@/features/billing/lib/leadAttribution"

/** `/onboarding` link that keeps the visitor's `utm_*` / `ref` (from the URL or the tab's earlier pages). */
export function useOnboardingHref(): string {
  const { search } = useLocation()
  return buildOnboardingHref({ passthrough: resolvePassthroughParams(search) })
}
