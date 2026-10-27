import { useState } from 'react'
import type { CalendarConfig, WorkSettings } from '../types'
import { isTokenValid } from '../lib/googleCalendar'
import { useNow } from '../hooks/useNow'

interface Props {
  calendar: CalendarConfig
  settings: WorkSettings
  hasClientId: boolean
  pendingCount: number
  onConnect: () => void
  onDisconnect: () => void
  onCalendarIdChange: (calendarId: string) => void
  onSettingsChange: (patch: Partial<WorkSettings>) => void
}

type NumericKey = 'annualHours' | 'maxComplementaryHours' | 'weeklyThresholdHours' | 'vacationDays'

const NUMERIC_FIELDS: { key: NumericKey; label: string; hint: string }[] = [
  { key: 'annualHours', label: 'Horas al año', hint: 'Jornada anual de tu contrato.' },
  { key: 'weeklyThresholdHours', label: 'Horas por semana', hint: 'Lo que pase de aquí cada semana cuenta como complementario.' },
  { key: 'maxComplementaryHours', label: 'Máx. complementarias', hint: 'Al año, según tu pacto de horas complementarias.' },
  { key: 'vacationDays', label: 'Vacaciones', hint: 'Días naturales al año.' },
]

export function SettingsScreen({
  calendar,
  settings,
  hasClientId,
  pendingCount,
  onConnect,
  onDisconnect,
  onCalendarIdChange,
  onSettingsChange,
}: Props) {
  const [calendarId, setCalendarId] = useState(calendar.calendarId)
  const tokenValid = isTokenValid(calendar)
  const currentYear = useNow(60_000).getFullYear()
  const openingYearMatches = settings.openingBalanceYear === currentYear

  const updateOpening = (key: 'openingOrdinaryHours' | 'openingComplementaryHours', raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return
    // Values from a previous year are discarded when the user enters this year's.
    const base = openingYearMatches ? {} : { openingOrdinaryHours: 0, openingComplementaryHours: 0 }
    onSettingsChange({ ...base, [key]: value, openingBalanceYear: currentYear })
  }

  return (
    <section className="screen">
      <h2 className="screen-title">Ajustes</h2>

      <h3 className="section-title">Tu contrato</h3>
      <div className="form-card">
        <div className="settings-grid">
          {NUMERIC_FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span className="field__label">{field.label}</span>
              <input
                id={`setting-${field.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="field__input"
                value={settings[field.key]}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value) && value >= 0) onSettingsChange({ [field.key]: value })
                }}
              />
              <span className="hint">{field.hint}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span className="field__label">Inicio del contrato</span>
          <input
            id="setting-contractStart"
            type="date"
            className="field__input"
            value={settings.contractStart}
            onChange={(e) => onSettingsChange({ contractStart: e.target.value })}
          />
          <span className="hint">Si empezaste este año, el objetivo anual se calcula en proporción.</span>
        </label>
        <div className="field">
          <span className="field__label">Horas ya hechas este año antes de usar la app</span>
          <div className="time-pair">
            <label className="field">
              <span className="hint">Ordinarias</span>
              <input
                id="setting-openingOrdinaryHours"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="field__input"
                value={openingYearMatches ? settings.openingOrdinaryHours : 0}
                onChange={(e) => updateOpening('openingOrdinaryHours', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="hint">Complementarias</span>
              <input
                id="setting-openingComplementaryHours"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="field__input"
                value={openingYearMatches ? settings.openingComplementaryHours : 0}
                onChange={(e) => updateOpening('openingComplementaryHours', e.target.value)}
              />
            </label>
          </div>
          <span className="hint">Cópialas de tus nóminas para que el contador anual y el ritmo salgan bien. Se reinician cada año.</span>
        </div>
        <label className="field">
          <span className="field__label">Tu nombre (para el PDF)</span>
          <input
            id="setting-employeeName"
            className="field__input"
            value={settings.employeeName}
            onChange={(e) => onSettingsChange({ employeeName: e.target.value })}
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span className="field__label">Empresa (para el PDF)</span>
          <input
            id="setting-companyName"
            className="field__input"
            value={settings.companyName}
            onChange={(e) => onSettingsChange({ companyName: e.target.value })}
            autoComplete="organization"
          />
          <span className="hint">Estos datos solo se guardan en este dispositivo.</span>
        </label>
      </div>

      <h3 className="section-title">Google Calendar</h3>
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
            id="setting-calendarId"
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
