import type { Shift } from '../types'
import { useNow } from '../hooks/useNow'
import { formatElapsed, formatTime } from '../lib/time'

interface Props {
  openShift: Shift | null
  onClockIn: () => void
  onClockOut: () => void
}

export function ClockScreen({ openShift, onClockIn, onClockOut }: Props) {
  const now = useNow(1000)
  const working = openShift !== null
  const elapsed = openShift ? now.getTime() - Date.parse(openShift.startAt) : 0
  const rawDate = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)

  return (
    <section className="clock-screen">
      <div className="clock-now">
        <time className="clock-time">{now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        <p className="clock-date">{dateLabel}</p>
      </div>

      <div className={`status-pill ${working ? 'status-pill--in' : 'status-pill--out'}`}>
        <span className="status-dot" aria-hidden />
        {openShift ? `Trabajando desde ${formatTime(openShift.startAt)}` : 'Fuera de turno'}
      </div>

      <button
        type="button"
        className={`punch-button ${working ? 'punch-button--out' : 'punch-button--in'}`}
        onClick={working ? onClockOut : onClockIn}
      >
        <span className="punch-button__label">{working ? 'Fichar salida' : 'Fichar entrada'}</span>
      </button>

      <div className="elapsed" aria-live="polite">
        <span className="elapsed__label">Turno en curso</span>
        <span className="elapsed__value">{working ? formatElapsed(elapsed) : '--:--:--'}</span>
      </div>
    </section>
  )
}
