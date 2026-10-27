import { useState } from 'react'
import type { Shift, ShiftBreak } from '../types'
import { applyTimes, formatDayLabel, formatMinutes, toTimeInput, type BreakTimes } from '../lib/time'
import { SyncBadge } from './SyncBadge'

interface Props {
  shift: Shift
  syncing: boolean
  calendarConnected: boolean
  onSave: (startAt: string, endAt: string, breaks: ShiftBreak[]) => void
  onSaveAndSync: (startAt: string, endAt: string, breaks: ShiftBreak[]) => void
  onClose: () => void
}

const TIME_RE = /^\d{2}:\d{2}$/

export function AdjustShiftScreen({ shift, syncing, calendarConnected, onSave, onSaveAndSync, onClose }: Props) {
  const [startTime, setStartTime] = useState(() => toTimeInput(shift.startAt))
  const [endTime, setEndTime] = useState(() => (shift.endAt ? toTimeInput(shift.endAt) : toTimeInput(shift.startAt)))
  const [breaks, setBreaks] = useState<BreakTimes[]>(() =>
    shift.breaks.map((b) => ({ start: toTimeInput(b.startAt), end: toTimeInput(b.endAt ?? shift.endAt ?? b.startAt) })),
  )

  const allValid = [startTime, endTime, ...breaks.flatMap((b) => [b.start, b.end])].every((t) => TIME_RE.test(t))
  const result = allValid ? applyTimes(shift.startAt, startTime, endTime, breaks) : null
  const ok = result?.ok ? result : null

  const updateBreak = (index: number, patch: Partial<BreakTimes>) =>
    setBreaks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)))

  return (
    <section className="screen adjust-screen">
      <div className="screen-header">
        <h2 className="screen-title">Ajustar turno</h2>
        <SyncBadge synced={shift.synced} />
      </div>
      <p className="muted">{formatDayLabel(new Date(shift.startAt))}</p>

      <div className="form-card">
        <div className="time-pair">
          <label className="field">
            <span className="field__label">Hora entrada</span>
            <input
              id="adjust-start"
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
              id="adjust-end"
              type="time"
              className="field__input field__input--out"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="breaks-editor">
          <div className="breaks-editor__header">
            <span className="field__label">Descansos</span>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setBreaks((prev) => [...prev, { start: startTime, end: startTime }])}>
              Añadir descanso
            </button>
          </div>
          {breaks.length === 0 && <p className="hint">Sin descansos.</p>}
          {breaks.map((b, index) => (
            <div key={index} className="break-row">
              <input
                id={`break-start-${index}`}
                type="time"
                className="field__input field__input--small"
                aria-label={`Inicio del descanso ${index + 1}`}
                value={b.start}
                onChange={(e) => updateBreak(index, { start: e.target.value })}
              />
              <span className="arrow" aria-hidden>
                →
              </span>
              <input
                id={`break-end-${index}`}
                type="time"
                className="field__input field__input--small"
                aria-label={`Fin del descanso ${index + 1}`}
                value={b.end}
                onChange={(e) => updateBreak(index, { end: e.target.value })}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar descanso ${index + 1}`}
                onClick={() => setBreaks((prev) => prev.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="adjust-total">
          <span>Tiempo trabajado</span>
          <strong>{ok ? formatMinutes(ok.durationMinutes) : '—'}</strong>
        </div>
        {result && !result.ok && <p className="alert alert--danger">{result.error}</p>}
        {ok?.overnight && <p className="hint">La salida es anterior a la entrada: se cuenta como turno que termina al día siguiente.</p>}
      </div>

      <div className="button-stack">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!ok}
          onClick={() => ok && onSave(ok.startAt, ok.endAt, ok.breaks)}
        >
          Guardar
        </button>
        <button
          type="button"
          className="btn btn--calendar btn--block"
          disabled={!ok || syncing}
          onClick={() => ok && onSaveAndSync(ok.startAt, ok.endAt, ok.breaks)}
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
