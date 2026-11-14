import type { i18n as I18nInstance } from "i18next"

import { ptBRPermissionCopy } from "@/locales/pt-BR/permissionCopy"
import ptBRCommon from "@/locales/pt-BR/common.json"
import type { SupportedLanguage } from "@/lib/uiLanguage"

type PermissionCopy = {
  workOrders: {
    emptyAssigned: {
      Pending: string
      InProgress: string
      Completed: string
      Canceled: string
    }
    execution: {
      assigneeLoading: string
      assigneeUpdated: string
      assigneeCleared: string
    }
    errors: {
      notAssignedOrForbidden: string
      assignFailed: string
    }
  }
}

export const DEFAULT_LANGUAGE: SupportedLanguage = "pt-BR"

export function mergePermissionCopy<
  T extends {
    workOrders: {
      execution: object
      errors: object
    }
  },
>(common: T, copy: PermissionCopy) {
  return {
    ...common,
    workOrders: {
      ...common.workOrders,
      emptyAssigned: copy.workOrders.emptyAssigned,
      execution: {
        ...common.workOrders.execution,
        ...copy.workOrders.execution,
      },
      errors: {
        ...common.workOrders.errors,
        ...copy.workOrders.errors,
      },
    },
  }
}

/** The default language ships in the entry chunk (it is also the fallback). */
export const defaultCommonBundle = mergePermissionCopy(
  ptBRCommon,
  ptBRPermissionCopy,
)

type CommonBundle = typeof defaultCommonBundle

const loaders: Record<
  Exclude<SupportedLanguage, "pt-BR">,
  () => Promise<CommonBundle>
> = {
  en: async () => {
    const [common, copy] = await Promise.all([
      import("@/locales/en/common.json"),
      import("@/locales/en/permissionCopy"),
    ])
    return mergePermissionCopy(common.default, copy.enPermissionCopy)
  },
  es: async () => {
    const [common, copy] = await Promise.all([
      import("@/locales/es/common.json"),
      import("@/locales/es/permissionCopy"),
    ])
    return mergePermissionCopy(common.default, copy.esPermissionCopy)
  },
}

const pending = new Map<string, Promise<void>>()

/**
 * Makes sure the `common` bundle of `language` is registered on `instance`.
 * Downloads at most once per language; a failed download can be retried.
 */
export function ensureLanguageBundle(
  instance: I18nInstance,
  language: string,
): Promise<void> {
  if (
    language === DEFAULT_LANGUAGE ||
    !(language in loaders) ||
    instance.hasResourceBundle(language, "common")
  ) {
    return Promise.resolve()
  }

  const key = `${language}`
  const existing = pending.get(key)
  if (existing) {
    return existing.then(() => registerIfMissing(instance, language))
  }

  const request = loaders[language as keyof typeof loaders]()
    .then((bundle) => {
      loadedBundles.set(language, bundle)
      registerIfMissing(instance, language)
    })
    .finally(() => {
      pending.delete(key)
    })
  pending.set(key, request)
  return request
}

const loadedBundles = new Map<string, CommonBundle>()

function registerIfMissing(instance: I18nInstance, language: string): void {
  const bundle = loadedBundles.get(language)
  if (bundle && !instance.hasResourceBundle(language, "common")) {
    instance.addResourceBundle(language, "common", bundle, true, true)
  }
}

/** Test/preload hook: registers an already imported bundle. */
export function registerLanguageBundle(
  instance: I18nInstance,
  language: string,
  bundle: CommonBundle,
): void {
  loadedBundles.set(language, bundle)
  registerIfMissing(instance, language)
}
