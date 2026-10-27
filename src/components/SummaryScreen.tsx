import type { Shift } from '../types'
import { useNow } from '../hooks/useNow'
import { formatMinutes, formatTime, isSameDay, periodTotals } from '../lib/time'

interface Props {
  shifts: Shift[]
}

export function SummaryScreen({ shifts }: Props) {
  // Refresh every minute so totals roll over at midnight / new week.
  const now = useNow(60_000)
  const totals = periodTotals(shifts, now)
  const todayShifts = shifts
    .filter((s) => isSameDay(new Date(s.startAt), now))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const cards = [
    { label: 'Hoy', value: totals.today },
    { label: 'Esta semana', value: totals.week },
    { label: 'Este mes', value: totals.month },
    { label: 'Este año', value: totals.year },
  ]

  return (
    <section className="screen">
      <h2 className="screen-title">Resumen</h2>
      <div className="stat-grid">
        {cards.map((card) => (
          <article key={card.label} className="stat-card">
            <span className="stat-card__label">{card.label}</span>
            <span className="stat-card__value">{formatMinutes(card.value)}</span>
          </article>
        ))}
      </div>

      <h3 className="section-title">Fichajes de hoy</h3>
      {todayShifts.length === 0 ? (
        <p className="empty">Todavía no hay fichajes hoy.</p>
      ) : (
        <ul className="shift-list">
          {todayShifts.map((shift) => (
            <li key={shift.id} className="shift-row">
              <div className="shift-row__times">
                <span className="time-in">{formatTime(shift.startAt)}</span>
                <span className="arrow" aria-hidden>
                  →
                </span>
                <span className="time-out">{shift.endAt ? formatTime(shift.endAt) : 'En curso'}</span>
              </div>
              <span className="shift-row__total">{shift.endAt ? formatMinutes(shift.durationMinutes) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
