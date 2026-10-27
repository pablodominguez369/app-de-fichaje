import { useState } from 'react'
import type { Shift } from '../types'
import { applyTimes, formatDayLabel, formatMinutes, toTimeInput } from '../lib/time'
import { SyncBadge } from './SyncBadge'

interface Props {
  shift: Shift
  syncing: boolean
  calendarConnected: boolean
  onSave: (startAt: string, endAt: string) => void
  onSaveAndSync: (startAt: string, endAt: string) => void
  onClose: () => void
}

export function AdjustShiftScreen({ shift, syncing, calendarConnected, onSave, onSaveAndSync, onClose }: Props) {
  const [startTime, setStartTime] = useState(() => toTimeInput(shift.startAt))
  const [endTime, setEndTime] = useState(() => (shift.endAt ? toTimeInput(shift.endAt) : toTimeInput(shift.startAt)))

  const valid = /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)
  const result = valid ? applyTimes(shift.startAt, startTime, endTime) : null

  return (
    <section className="screen adjust-screen">
      <div className="screen-header">
        <h2 className="screen-title">Ajustar turno</h2>
        <SyncBadge synced={shift.synced} />
      </div>
      <p className="muted">{formatDayLabel(new Date(shift.startAt))}</p>

      <div className="form-card">
        <label className="field">
          <span className="field__label">Hora entrada</span>
          <input
            type="time"
            className="field__input field__input--in"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Hora salida</span>
          <input
            type="time"
            className="field__input field__input--out"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>

        <div className="adjust-total">
          <span>Total</span>
          <strong>{result ? formatMinutes(result.durationMinutes) : '—'}</strong>
        </div>
        {result?.overnight && <p className="hint">La salida es anterior a la entrada: se cuenta como turno que termina al día siguiente.</p>}
      </div>

      <div className="button-stack">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!result}
          onClick={() => result && onSave(result.startAt, result.endAt)}
        >
          Guardar
        </button>
        <button
          type="button"
          className="btn btn--calendar btn--block"
          disabled={!result || syncing}
          onClick={() => result && onSaveAndSync(result.startAt, result.endAt)}
        >
          {syncing ? 'Sincronizando…' : 'Sincronizar con Google Calendar'}
        </button>
        {!calendarConnected && <p className="hint">Google Calendar no está conectado: al sincronizar se te pedirá iniciar sesión.</p>}
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
          Volver
        </button>
      </div>
    </section>
  )
}
