import { useState, type FormEvent } from 'react'
import type { Absence, AbsenceType, WorkSettings } from '../types'
import { ABSENCE_LABELS, daysInYear, formatAbsenceDates, vacationDaysUsed } from '../lib/absences'
import { dayKey } from '../lib/time'
import { useNow } from '../hooks/useNow'

interface Props {
  absences: Absence[]
  settings: WorkSettings
  onAdd: (absence: Omit<Absence, 'id'>) => void
  onRemove: (id: string) => void
}

const TYPES: AbsenceType[] = ['vacation', 'medical', 'leave', 'sick', 'other']

export function AbsencesScreen({ absences, settings, onAdd, onRemove }: Props) {
  const now = useNow(60_000)
  const today = dayKey(now)
  const year = now.getFullYear()
  const [type, setType] = useState<AbsenceType>('vacation')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const used = vacationDaysUsed(absences, year)
  const left = settings.vacationDays - used
  const usedPct = settings.vacationDays > 0 ? Math.min(100, (used / settings.vacationDays) * 100) : 0
  const isVacation = type === 'vacation'
  const hasTimes = !isVacation && type !== 'sick'
  const rangeInvalid = endDate < startDate
  const timesInvalid = hasTimes && !!startTime && !!endTime && endTime <= startTime

  const sorted = [...absences].sort((a, b) => b.startDate.localeCompare(a.startDate))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (rangeInvalid || timesInvalid || !startDate) return
    onAdd({
      type,
      startDate,
      endDate: endDate || startDate,
      startTime: hasTimes && startTime ? startTime : null,
      endTime: hasTimes && endTime ? endTime : null,
      note: note.trim(),
    })
    setNote('')
    setStartTime('')
    setEndTime('')
  }

  return (
    <section className="screen">
      <h2 className="screen-title">Vacaciones y ausencias</h2>

      <article className="panel">
        <div className="panel__header">
          <h3 className="panel__title">Vacaciones {year}</h3>
          <span className="panel__figure">
            {used} / {settings.vacationDays} días
          </span>
        </div>
        <div className="progress">
          <div className={`progress__fill ${left < 0 ? 'progress__fill--danger' : ''}`} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="hint">
          {left >= 0 ? `Te quedan ${left} días naturales.` : `Te has pasado ${-left} días del total anual.`}
        </p>
      </article>

      <form className="form-card" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Tipo</span>
          <select id="absence-type" className="field__input" value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {ABSENCE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="time-pair">
          <label className="field">
            <span className="field__label">Desde</span>
            <input
              id="absence-start"
              type="date"
              className="field__input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate < e.target.value) setEndDate(e.target.value)
              }}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Hasta</span>
            <input id="absence-end" type="date" className="field__input" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>
        {hasTimes && (
          <div className="time-pair">
            <label className="field">
              <span className="field__label">Hora salida (opcional)</span>
              <input id="absence-start-time" type="time" className="field__input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Hora vuelta (opcional)</span>
              <input id="absence-end-time" type="time" className="field__input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
        )}
        <label className="field">
          <span className="field__label">Nota</span>
          <input
            id="absence-note"
            className="field__input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === 'medical' ? 'Ej.: justificante entregado' : 'Opcional'}
          />
        </label>
        {rangeInvalid && <p className="alert alert--danger">La fecha final no puede ser anterior a la inicial.</p>}
        {timesInvalid && <p className="alert alert--danger">La hora de vuelta debe ser posterior a la de salida.</p>}
        {type === 'medical' && <p className="hint">Recuerda pedir el justificante con la hora de entrada y salida de la consulta.</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={rangeInvalid || timesInvalid}>
          Guardar {isVacation ? 'vacaciones' : 'ausencia'}
        </button>
      </form>

      <h3 className="section-title">Registro</h3>
      {sorted.length === 0 ? (
        <p className="empty">Aún no has registrado vacaciones ni ausencias.</p>
      ) : (
        <ul className="shift-list">
          {sorted.map((a) => (
            <li key={a.id} className="shift-row shift-row--history">
              <div className="shift-row__main">
                <div className="absence-info">
                  <span className={`badge ${a.type === 'vacation' ? 'badge--ok' : 'badge--neutral'}`}>{ABSENCE_LABELS[a.type]}</span>
                  <span className="absence-dates">{formatAbsenceDates(a)}</span>
                </div>
                {a.type === 'vacation' && <span className="shift-row__total">{daysInYear(a, year) || daysInYear(a, year + 1)} d</span>}
              </div>
              {a.note && <span className="hint">{a.note}</span>}
              <div className="shift-row__actions">
                <span />
                {confirmingId === a.id ? (
                  <div className="shift-row__buttons">
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmingId(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn--small btn--danger-ghost"
                      onClick={() => {
                        onRemove(a.id)
                        setConfirmingId(null)
                      }}
                    >
                      Sí, borrar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmingId(a.id)}>
                    Borrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
