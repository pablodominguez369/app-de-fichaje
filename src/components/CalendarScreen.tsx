import { useState } from 'react'
import type { CalendarConfig } from '../types'
import { isTokenValid } from '../lib/googleCalendar'

interface Props {
  calendar: CalendarConfig
  hasClientId: boolean
  pendingCount: number
  onConnect: () => void
  onDisconnect: () => void
  onCalendarIdChange: (calendarId: string) => void
}

export function CalendarScreen({ calendar, hasClientId, pendingCount, onConnect, onDisconnect, onCalendarIdChange }: Props) {
  const [calendarId, setCalendarId] = useState(calendar.calendarId)
  const tokenValid = isTokenValid(calendar)

  return (
    <section className="screen">
      <h2 className="screen-title">Google Calendar</h2>

      <div className="form-card">
        <div className="connection-row">
          <span className={`status-pill ${calendar.connected ? 'status-pill--in' : 'status-pill--neutral'}`}>
            <span className="status-dot" aria-hidden />
            {calendar.connected ? 'Conectado' : 'Desconectado'}
          </span>
          {calendar.connected && !tokenValid && <span className="muted small">La sesión caduca cada hora; se renovará al sincronizar.</span>}
        </div>

        {!hasClientId && (
          <p className="alert">
            Falta <code>VITE_GOOGLE_CLIENT_ID</code>. Créalo en Google Cloud y añádelo al archivo <code>.env</code> (ver README).
          </p>
        )}

        {calendar.connected ? (
          <button type="button" className="btn btn--danger-ghost btn--block" onClick={onDisconnect}>
            Desconectar
          </button>
        ) : (
          <button type="button" className="btn btn--calendar btn--block" disabled={!hasClientId} onClick={onConnect}>
            Conectar con Google
          </button>
        )}

        <label className="field">
          <span className="field__label">ID del calendario</span>
          <input
            className="field__input"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            onBlur={() => onCalendarIdChange(calendarId)}
            placeholder="primary"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className="hint">«primary» es tu calendario principal. Para otro, copia su ID desde la configuración de Google Calendar.</span>
        </label>

        <p className="muted small">Turnos pendientes de sincronizar: {pendingCount}</p>
      </div>
    </section>
  )
}
