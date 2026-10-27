import type { CalendarConfig, Shift } from '../types'

export const SHIFTS_KEY = 'fichaje.shifts.v1'
export const CALENDAR_KEY = 'fichaje.calendar.v1'

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  calendarId: 'primary',
  connected: false,
  accessToken: '',
  expiresAt: 0,
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode): the app keeps working in memory.
  }
}

function isShift(value: unknown): value is Shift {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.id === 'string' && typeof s.startAt === 'string'
}

export function loadShifts(): Shift[] {
  const data = readJson<unknown>(SHIFTS_KEY, [])
  return Array.isArray(data) ? data.filter(isShift) : []
}

export function loadCalendarConfig(): CalendarConfig {
  return { ...DEFAULT_CALENDAR_CONFIG, ...readJson<Partial<CalendarConfig>>(CALENDAR_KEY, {}) }
}
