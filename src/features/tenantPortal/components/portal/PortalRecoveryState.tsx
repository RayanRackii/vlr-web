import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import "./portal.css"

type RecoveryAction = { to: string; label: string }

type Props = {
  icon: LucideIcon
  title: string
  description: string
  primaryAction: RecoveryAction
  secondaryAction?: RecoveryAction
  alert?: boolean
}

/** The portal's illustrated empty-state pattern, also usable outside the signed-in shell. */
export function PortalRecoveryState({ icon: Icon, title, description, primaryAction, secondaryAction, alert }: Props) {
  return (
    <section className="portal-empty portal-recovery">
      <div className="portal-empty-icon" aria-hidden="true">
        <Icon strokeWidth={ICON_STROKE_WIDTH} />
      </div>
      <header className="portal-booking-header">
        <h1>{title}</h1>
        <p role={alert ? "alert" : undefined}>{description}</p>
      </header>
      <div className="portal-recovery-actions">
        <Button className="portal-recovery-button" render={<Link to={primaryAction.to} />}>
          {primaryAction.label}
        </Button>
        {secondaryAction && (
          <Button variant="outline" className="portal-recovery-button" render={<Link to={secondaryAction.to} />}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </section>
  )
}
