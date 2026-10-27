import { useState } from 'react'
import type { Shift, WorkSettings } from '../types'
import { useNow } from '../hooks/useNow'
import { annualProgress } from '../lib/hours'
import { formatHours, formatMinutes, formatTime, isSameDay, periodTotals } from '../lib/time'

interface Props {
  shifts: Shift[]
  settings: WorkSettings
  onExport: (year: number, month: number) => void
}

function currentMonthValue(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function SummaryScreen({ shifts, settings, onExport }: Props) {
  // Refresh every minute so totals roll over at midnight / new week.
  const now = useNow(60_000)
  const [exportMonth, setExportMonth] = useState(() => currentMonthValue(new Date()))
  const totals = periodTotals(shifts, now)
  const progress = annualProgress(shifts, settings, now)
  const todayShifts = shifts
    .filter((s) => isSameDay(new Date(s.startAt), now))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const cards = [
    { label: 'Hoy', value: totals.today },
    { label: 'Esta semana', value: totals.week },
    { label: 'Este mes', value: totals.month },
    { label: 'Este año', value: totals.year },
  ]

  const ordinaryPct = progress.targetMinutes > 0 ? Math.min(100, (progress.ordinaryMinutes / progress.targetMinutes) * 100) : 0
  const pacePct = progress.targetMinutes > 0 ? Math.min(100, (progress.expectedSoFarMinutes / progress.targetMinutes) * 100) : 0
  const complementaryPct =
    progress.maxComplementaryMinutes > 0 ? (progress.complementaryMinutes / progress.maxComplementaryMinutes) * 100 : 0
  const complementaryLevel = complementaryPct >= 100 ? 'danger' : complementaryPct >= 80 ? 'warning' : 'ok'
  const weekPct = progress.week.thresholdMinutes > 0 ? Math.min(100, (progress.week.totalMinutes / progress.week.thresholdMinutes) * 100) : 0
  const prorated = progress.factor < 0.999
  const ahead = progress.paceDiffMinutes >= 0

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

      <article className="panel">
        <div className="panel__header">
          <h3 className="panel__title">Horas del contrato {progress.year}</h3>
          <span className={`badge ${ahead ? 'badge--ok' : 'badge--pending'}`}>
            {ahead ? `+${formatHours(progress.paceDiffMinutes)} sobre el ritmo` : `${formatHours(-progress.paceDiffMinutes)} por debajo del ritmo`}
          </span>
        </div>
        <div className="progress" role="img" aria-label={`${Math.round(ordinaryPct)} % de las horas del año`}>
          <div className="progress__fill" style={{ width: `${ordinaryPct}%` }} />
          <div className="progress__marker" style={{ left: `${pacePct}%` }} title="Donde deberías ir hoy" />
        </div>
        <dl className="kv">
          <div>
            <dt>Ordinarias hechas</dt>
            <dd>{formatHours(progress.ordinaryMinutes)}</dd>
          </div>
          <div>
            <dt>Te quedan</dt>
            <dd>{formatHours(progress.remainingMinutes)}</dd>
          </div>
          <div>
            <dt>Objetivo del año</dt>
            <dd>{formatHours(progress.targetMinutes)}</dd>
          </div>
          <div>
            <dt>Deberías llevar</dt>
            <dd>{formatHours(progress.expectedSoFarMinutes)}</dd>
          </div>
        </dl>
        {settings.openingBalanceYear === progress.year && settings.openingOrdinaryHours + settings.openingComplementaryHours > 0 && (
          <p className="hint">Incluye {formatHours(settings.openingOrdinaryHours * 60)} hechas antes de usar la app.</p>
        )}
        {prorated && (
          <p className="hint">
            Proporcional desde el {progress.countFrom.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} (inicio del contrato).
          </p>
        )}
      </article>

      <article className={`panel panel--${complementaryLevel}`}>
        <div className="panel__header">
          <h3 className="panel__title">Horas complementarias</h3>
          <span className="panel__figure">
            {formatHours(progress.complementaryMinutes)} / {formatHours(progress.maxComplementaryMinutes)}
          </span>
        </div>
        <div className="progress">
          <div className={`progress__fill progress__fill--${complementaryLevel}`} style={{ width: `${Math.min(100, complementaryPct)}%` }} />
        </div>
        <p className="hint">
          Esta semana: {formatMinutes(progress.week.totalMinutes)} de {settings.weeklyThresholdHours} h ordinarias
          {progress.week.complementaryMinutes > 0 && ` · ${formatMinutes(progress.week.complementaryMinutes)} complementarias`}
        </p>
        <div className="progress progress--thin">
          <div
            className={`progress__fill ${progress.week.complementaryMinutes > 0 ? 'progress__fill--warning' : ''}`}
            style={{ width: `${weekPct}%` }}
          />
        </div>
        {complementaryLevel === 'warning' && <p className="alert">Te acercas al máximo de horas complementarias del año.</p>}
        {complementaryLevel === 'danger' && <p className="alert alert--danger">Has superado el máximo de horas complementarias pactado.</p>}
      </article>

      <article className="panel">
        <h3 className="panel__title">Resumen mensual en PDF</h3>
        <p className="hint">Registro día a día con entradas, salidas, descansos y horas ordinarias y complementarias, para cotejarlo con la nómina.</p>
        <div className="inline-form">
          <label className="field field--grow">
            <span className="field__label">Mes</span>
            <input id="export-month" type="month" className="field__input" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!/^\d{4}-\d{2}$/.test(exportMonth)}
            onClick={() => {
              const [y, m] = exportMonth.split('-').map(Number)
              onExport(y, m - 1)
            }}
          >
            Descargar PDF
          </button>
        </div>
      </article>

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
