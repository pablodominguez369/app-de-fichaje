import type { Shift } from '../types'
import { breakMinutes, dayKey, formatDayLabel, formatMinutes, formatTime } from '../lib/time'
import { SyncBadge } from './SyncBadge'

interface Props {
  shifts: Shift[]
  syncingIds: Set<string>
  onSync: (shifts: Shift[]) => void
  onEdit: (id: string) => void
}

export function HistoryScreen({ shifts, syncingIds, onSync, onEdit }: Props) {
  const sorted = [...shifts].sort((a, b) => b.startAt.localeCompare(a.startAt))
  const groups = new Map<string, Shift[]>()
  for (const shift of sorted) {
    const key = dayKey(new Date(shift.startAt))
    groups.set(key, [...(groups.get(key) ?? []), shift])
  }
  const pending = shifts.filter((s) => s.endAt && !s.synced)

  return (
    <section className="screen">
      <div className="screen-header">
        <h2 className="screen-title">Historial</h2>
        {pending.length > 0 && (
          <button type="button" className="btn btn--small btn--ghost" onClick={() => onSync(pending)}>
            Sincronizar pendientes ({pending.length})
          </button>
        )}
      </div>

      {groups.size === 0 && <p className="empty">Aún no hay turnos registrados.</p>}

      {[...groups.entries()].map(([key, dayShifts]) => {
        const dayTotal = dayShifts.reduce((sum, s) => sum + (s.endAt ? s.durationMinutes : 0), 0)
        return (
          <div key={key} className="day-group">
            <div className="day-group__header">
              <span>{formatDayLabel(new Date(dayShifts[0].startAt))}</span>
              <span className="day-group__total">{formatMinutes(dayTotal)}</span>
            </div>
            <ul className="shift-list">
              {dayShifts.map((shift) => {
                const syncing = syncingIds.has(shift.id)
                return (
                  <li key={shift.id} className="shift-row shift-row--history">
                    <div className="shift-row__main">
                      <div className="shift-row__times">
                        <span className="time-in">{formatTime(shift.startAt)}</span>
                        <span className="arrow" aria-hidden>
                          →
                        </span>
                        <span className="time-out">{shift.endAt ? formatTime(shift.endAt) : 'En curso'}</span>
                      </div>
                      <span className="shift-row__total">{shift.endAt ? formatMinutes(shift.durationMinutes) : '—'}</span>
                    </div>
                    {shift.endAt && shift.breaks.length > 0 && (
                      <span className="hint">
                        {shift.breaks.length} descanso{shift.breaks.length > 1 ? 's' : ''} · {formatMinutes(breakMinutes(shift))} descontados
                      </span>
                    )}
                    {shift.endAt && (
                      <div className="shift-row__actions">
                        <SyncBadge synced={shift.synced} />
                        <div className="shift-row__buttons">
                          <button type="button" className="btn btn--small btn--ghost" onClick={() => onEdit(shift.id)}>
                            Editar
                          </button>
                          {!shift.synced && (
                            <button
                              type="button"
                              className="btn btn--small btn--primary"
                              disabled={syncing}
                              onClick={() => onSync([shift])}
                            >
                              {syncing ? 'Sincronizando…' : 'Sincronizar'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
