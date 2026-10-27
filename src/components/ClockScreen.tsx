import type { Shift } from '../types'
import { useNow } from '../hooks/useNow'
import { formatElapsed, formatTime, liveWorkedMs, openBreak } from '../lib/time'

interface Props {
  openShift: Shift | null
  onClockIn: () => void
  onClockOut: () => void
  onStartBreak: () => void
  onEndBreak: () => void
}

export function ClockScreen({ openShift, onClockIn, onClockOut, onStartBreak, onEndBreak }: Props) {
  const now = useNow(1000)
  const working = openShift !== null
  const currentBreak = openBreak(openShift)
  const worked = openShift ? liveWorkedMs(openShift, now) : 0
  const rawDate = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)

  const status = !openShift
    ? 'Fuera de turno'
    : currentBreak
      ? `En descanso desde ${formatTime(currentBreak.startAt)}`
      : `Trabajando desde ${formatTime(openShift.startAt)}`

  return (
    <section className="clock-screen">
      <div className="clock-now">
        <time className="clock-time">{now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        <p className="clock-date">{dateLabel}</p>
      </div>

      <div className={`status-pill ${!working ? 'status-pill--out' : currentBreak ? 'status-pill--break' : 'status-pill--in'}`}>
        <span className="status-dot" aria-hidden />
        {status}
      </div>

      <button
        type="button"
        className={`punch-button ${working ? 'punch-button--out' : 'punch-button--in'}`}
        onClick={working ? onClockOut : onClockIn}
      >
        <span className="punch-button__label">{working ? 'Fichar salida' : 'Fichar entrada'}</span>
      </button>

      {working && (
        <button type="button" className={`btn break-button ${currentBreak ? 'break-button--active' : ''}`} onClick={currentBreak ? onEndBreak : onStartBreak}>
          {currentBreak ? 'Terminar descanso' : 'Iniciar descanso'}
        </button>
      )}

      <div className="elapsed" aria-live="polite">
        <span className="elapsed__label">{currentBreak ? 'Trabajado (contador en pausa)' : 'Trabajado en este turno'}</span>
        <span className="elapsed__value">{working ? formatElapsed(worked) : '--:--:--'}</span>
        {openShift && openShift.breaks.length > 0 && (
          <span className="elapsed__label">
            {openShift.breaks.length} descanso{openShift.breaks.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </section>
  )
}
