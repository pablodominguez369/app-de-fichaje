import type { Shift } from '../types'

const MINUTE_MS = 60_000

export function diffMinutes(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / MINUTE_MS))
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Monday 00:00 of the week containing `date` (local time). */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  const offset = (day.getDay() + 6) % 7 // Mon=0 ... Sun=6
  day.setDate(day.getDate() - offset)
  return day
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export interface PeriodTotals {
  today: number
  week: number
  month: number
  year: number
}

/**
 * Minutes of closed shifts inside [from, to). Shifts crossing a boundary
 * (e.g. overnight) only count the part that falls inside the period.
 */
export function minutesInRange(shifts: Shift[], from: Date, to: Date): number {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  let totalMs = 0
  for (const shift of shifts) {
    if (!shift.endAt) continue
    const start = Math.max(Date.parse(shift.startAt), fromMs)
    const end = Math.min(Date.parse(shift.endAt), toMs)
    if (end > start) totalMs += end - start
  }
  return Math.round(totalMs / MINUTE_MS)
}

export function periodTotals(shifts: Shift[], now: Date = new Date()): PeriodTotals {
  const today = startOfDay(now)
  const week = startOfWeek(now)
  const month = startOfMonth(now)
  const year = startOfYear(now)
  return {
    today: minutesInRange(shifts, today, addDays(today, 1)),
    week: minutesInRange(shifts, week, addDays(week, 7)),
    month: minutesInRange(shifts, month, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    year: minutesInRange(shifts, year, new Date(now.getFullYear() + 1, 0, 1)),
  }
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Local YYYY-MM-DD key, used to group shifts by day. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "7 h 05 min" style. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} h ${pad(m)} min` : `${m} min`
}

/** "HH:MM:SS" for the live counter. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Value for <input type="time">. */
export function toTimeInput(iso: string): string {
  return formatTime(iso)
}

/**
 * Builds start/end ISO strings from the shift's original date plus HH:MM inputs.
 * If end < start the shift is assumed to finish the next day (overnight).
 */
export function applyTimes(baseStartIso: string, startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const start = new Date(baseStartIso)
  start.setHours(sh, sm, 0, 0)
  const end = new Date(start)
  end.setHours(eh, em, 0, 0)
  const overnight = end.getTime() < start.getTime()
  if (overnight) end.setDate(end.getDate() + 1)
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    durationMinutes: diffMinutes(start.toISOString(), end.toISOString()),
    overnight,
  }
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'Hoy'
  if (isSameDay(date, addDays(startOfDay(now), -1))) return 'Ayer'
  const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
