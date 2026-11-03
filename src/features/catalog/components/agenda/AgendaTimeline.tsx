import { useTranslation } from "react-i18next"

import {
  AGENDA_DAY_END_HOUR,
  AGENDA_DAY_START_HOUR,
  formatZonedTime,
  type AgendaBlock,
  type AgendaDay,
} from "./agendaLayout"
import "./agenda.css"

const HOUR_MARKS = Array.from(
  { length: Math.floor((AGENDA_DAY_END_HOUR - AGENDA_DAY_START_HOUR) / 2) + 1 },
  (_, index) => AGENDA_DAY_START_HOUR + index * 2,
)

type AgendaTimelineProps = {
  days: AgendaDay[]
  locale: string
}

function blockLabel(block: AgendaBlock): string {
  return block.item.displayNumber ?? block.item.productName
}

export function AgendaTimeline({ days, locale }: AgendaTimelineProps) {
  const { t } = useTranslation()

  const legend = [
    { kind: "work", label: t("catalog.agenda.legend.work") },
    { kind: "prep", label: t("catalog.agenda.legend.prep") },
    { kind: "cleanup", label: t("catalog.agenda.legend.cleanup") },
    { kind: "conflict", label: t("catalog.agenda.legend.conflict") },
  ] as const

  return (
    <div className="agenda-timeline">
      <div className="agenda-legend" aria-hidden="true">
        {legend.map((entry) => (
          <span key={entry.kind}>
            <i className="agenda-swatch" data-kind={entry.kind} />
            {entry.label}
          </span>
        ))}
      </div>

      <div className="agenda-days">
        {days.map((day) => (
          <section className="agenda-day" key={day.key} aria-label={day.label}>
            <div className="agenda-day-head">
              <span>{day.label}</span>
              <span className="agenda-day-count">
                {day.blocks.length === 0
                  ? t("catalog.agenda.free")
                  : t("catalog.agenda.ordersCount", { count: day.blocks.length })}
              </span>
            </div>

            <div className="agenda-track" role="list">
              {day.blocks.map((block) => (
                <div
                  key={block.key}
                  role="listitem"
                  className="agenda-block"
                  data-conflict={block.conflict}
                  style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%` }}
                  title={blockLabel(block)}
                >
                  {block.segments.map((segment, index) => (
                    <div
                      key={`${segment.kind}-${index}`}
                      className="agenda-seg"
                      data-kind={segment.kind}
                      style={{ width: `${segment.widthPct}%` }}
                    >
                      {segment.kind === "work" ? blockLabel(block) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="agenda-hours" aria-hidden="true">
              {HOUR_MARKS.map((hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}h</span>
              ))}
            </div>

            <div className="agenda-stack">
              {day.blocks.length === 0 ? (
                <p className="agenda-empty-day">{t("catalog.agenda.free")}</p>
              ) : (
                day.blocks.map((block) => (
                  <div
                    key={block.key}
                    className="agenda-stack-group"
                    data-conflict={block.conflict}
                  >
                    <div className="agenda-stack-title">
                      <span>
                        {blockLabel(block)} · {block.item.productName}
                      </span>
                      {block.conflict ? (
                        <span className="agenda-conflict-tag">
                          {t("catalog.agenda.legend.conflict")}
                        </span>
                      ) : null}
                    </div>
                    {([
                      ["prep", block.prep],
                      ["work", block.work],
                      ["cleanup", block.cleanup],
                    ] as const).map(([kind, range]) =>
                      range ? (
                        <div className="agenda-stack-row" key={kind} data-kind={kind}>
                          <span>{t(`catalog.agenda.segment.${kind}`)}</span>
                          <time>
                            {formatZonedTime(range[0], locale, block.item.timeZoneId)}–
                            {formatZonedTime(range[1], locale, block.item.timeZoneId)}
                          </time>
                        </div>
                      ) : null,
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
