import { Component, type ErrorInfo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"

function AppErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto w-full max-w-xl p-6">
      <ErrorState message={t("app.errorBoundary.title")} onRetry={onRetry} />
      {/* Plain anchor: the root boundary can sit outside the router. */}
      <a className="mt-4 inline-block text-sm underline" href="/">
        {t("app.errorBoundary.home")}
      </a>
    </main>
  )
}

type Props = { children: ReactNode }
type State = { failed: boolean }

/** The only class component: React has no hook API for render-error boundaries. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Name and component stack only; never user data.
    console.error("AppErrorBoundary caught a render error", error.name, error.message, info.componentStack)
  }

  private reset = () => {
    this.setState({ failed: false })
  }

  render() {
    if (this.state.failed) return <AppErrorFallback onRetry={this.reset} />
    return this.props.children
  }
}
