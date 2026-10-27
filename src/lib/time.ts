import type { Shift, ShiftBreak } from '../types'

const MINUTE_MS = 60_000

export function diffMinutes(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / MINUTE_MS))
}

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/** Break time (ms) inside [fromMs, toMs). Open breaks run until `openEndMs`. */
function breakMsInRange(breaks: ShiftBreak[], fromMs: number, toMs: number, openEndMs: number): number {
  return breaks.reduce((sum, b) => {
    const end = b.endAt ? Date.parse(b.endAt) : openEndMs
    return sum + overlapMs(Date.parse(b.startAt), end, fromMs, toMs)
  }, 0)
}

/** Net worked minutes of a closed shift: length minus breaks. */
export function netMinutes(startAt: string, endAt: string, breaks: ShiftBreak[]): number {
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  const net = end - start - breakMsInRange(breaks, start, end, end)
  return Math.max(0, Math.round(net / MINUTE_MS))
}

export function breakMinutes(shift: Shift): number {
  const end = shift.endAt ? Date.parse(shift.endAt) : Date.now()
  return Math.round(breakMsInRange(shift.breaks, Date.parse(shift.startAt), end, end) / MINUTE_MS)
}

/** Net worked ms of an open shift up to `now` (pauses while on break). */
export function liveWorkedMs(shift: Shift, now: Date): number {
  const start = Date.parse(shift.startAt)
  const nowMs = now.getTime()
  return Math.max(0, nowMs - start - breakMsInRange(shift.breaks, start, nowMs, nowMs))
}

export function openBreak(shift: Shift | null): ShiftBreak | null {
  return shift?.breaks.find((b) => b.endAt === null) ?? null
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

export function addDays(date: Date, days: number): Date {
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
 * Net minutes of closed shifts inside [from, to). Shifts crossing a boundary
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
    if (end <= start) continue
    totalMs += end - start - breakMsInRange(shift.breaks, start, end, Date.parse(shift.endAt))
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

const pad = (n: number) => String(n).padStart(2, '0')

/** Local YYYY-MM-DD key, used to group shifts by day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parses a local YYYY-MM-DD key into a Date at 00:00. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "7 h 05 min" style. */
export function formatMinutes(total: number): string {
  const sign = total < 0 ? '-' : ''
  const abs = Math.abs(total)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return h > 0 ? `${sign}${h} h ${pad(m)} min` : `${sign}${m} min`
}

/** "7,5 h" style, for compact counters. */
export function formatHours(minutes: number): string {
  return `${(minutes / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`
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

export interface BreakTimes {
  start: string
  end: string
}

export type AppliedTimes =
  | { ok: true; startAt: string; endAt: string; breaks: ShiftBreak[]; durationMinutes: number; overnight: boolean }
  | { ok: false; error: string }

/**
 * Builds start/end ISO strings from the shift's original date plus HH:MM inputs.
 * If a time is earlier than the clock-in time it is placed on the next day (overnight shift).
 */
export function applyTimes(baseStartIso: string, startTime: string, endTime: string, breakTimes: BreakTimes[] = []): AppliedTimes {
  const start = new Date(baseStartIso)
  const [sh, sm] = startTime.split(':').map(Number)
  start.setHours(sh, sm, 0, 0)

  // Places an HH:MM on the shift's day, or the next one if it falls before clock-in.
  const at = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    const date = new Date(start)
    date.setHours(h, m, 0, 0)
    if (date.getTime() < start.getTime()) date.setDate(date.getDate() + 1)
    return date
  }

  const end = at(endTime)
  const breaks: ShiftBreak[] = []
  for (const b of breakTimes) {
    const bStart = at(b.start)
    const bEnd = at(b.end)
    if (bEnd.getTime() <= bStart.getTime()) return { ok: false, error: 'Cada descanso debe terminar después de empezar.' }
    if (bEnd.getTime() > end.getTime()) return { ok: false, error: 'Los descansos deben estar dentro del turno.' }
    breaks.push({ startAt: bStart.toISOString(), endAt: bEnd.toISOString() })
  }
  breaks.sort((a, b) => a.startAt.localeCompare(b.startAt))
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i].startAt < breaks[i - 1].endAt!) return { ok: false, error: 'Los descansos no pueden solaparse.' }
  }

  const startAt = start.toISOString()
  const endAt = end.toISOString()
  return {
    ok: true,
    startAt,
    endAt,
    breaks,
    durationMinutes: netMinutes(startAt, endAt, breaks),
    overnight: !isSameDay(start, end),
  }
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'Hoy'
  if (isSameDay(date, addDays(startOfDay(now), -1))) return 'Ayer'
  const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
