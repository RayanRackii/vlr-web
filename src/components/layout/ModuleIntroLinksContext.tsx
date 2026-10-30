import { createContext, useContext, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { moduleIntroPath, type ModuleIntroKey } from "./navigationIntros"

const ModuleIntroLinksContext = createContext<readonly ModuleIntroKey[]>([])

export function ModuleIntroLinksProvider({ keys, children }: { keys: readonly ModuleIntroKey[]; children: ReactNode }) {
  return <ModuleIntroLinksContext.Provider value={keys}>{children}</ModuleIntroLinksContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModuleIntroLink(key: ModuleIntroKey) {
  const { t } = useTranslation()
  const keys = useContext(ModuleIntroLinksContext)
  return keys.includes(key)
    ? { to: moduleIntroPath(key), label: t("emptyStates.learnMore") }
    : undefined
}
