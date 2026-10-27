import type { Absence, CalendarConfig, Shift, ShiftBreak, WorkSettings } from '../types'

export const SHIFTS_KEY = 'fichaje.shifts.v1'
export const CALENDAR_KEY = 'fichaje.calendar.v1'
export const SETTINGS_KEY = 'fichaje.settings.v1'
export const ABSENCES_KEY = 'fichaje.absences.v1'

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  calendarId: 'primary',
  connected: false,
  accessToken: '',
  expiresAt: 0,
}

export const DEFAULT_SETTINGS: WorkSettings = {
  annualHours: 900,
  maxComplementaryHours: 270,
  weeklyThresholdHours: 20,
  vacationDays: 31,
  contractStart: '',
  openingOrdinaryHours: 0,
  openingComplementaryHours: 0,
  openingBalanceYear: 0,
  employeeName: '',
  companyName: '',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function normalizeBreak(value: unknown): ShiftBreak | null {
  if (!isRecord(value) || typeof value.startAt !== 'string') return null
  return { startAt: value.startAt, endAt: typeof value.endAt === 'string' ? value.endAt : null }
}

/** Accepts shifts saved by older versions (without breaks). */
function normalizeShift(value: unknown): Shift | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.startAt !== 'string') return null
  const breaks = Array.isArray(value.breaks)
    ? value.breaks.map(normalizeBreak).filter((b): b is ShiftBreak => b !== null)
    : []
  return {
    id: value.id,
    startAt: value.startAt,
    endAt: typeof value.endAt === 'string' ? value.endAt : null,
    breaks,
    durationMinutes: typeof value.durationMinutes === 'number' ? value.durationMinutes : 0,
    synced: value.synced === true,
    calendarEventId: typeof value.calendarEventId === 'string' ? value.calendarEventId : null,
  }
}

export function loadShifts(): Shift[] {
  const data = readJson<unknown>(SHIFTS_KEY, [])
  return Array.isArray(data) ? data.map(normalizeShift).filter((s): s is Shift => s !== null) : []
}

export function loadCalendarConfig(): CalendarConfig {
  return { ...DEFAULT_CALENDAR_CONFIG, ...readJson<Partial<CalendarConfig>>(CALENDAR_KEY, {}) }
}

export function loadSettings(): WorkSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<WorkSettings>>(SETTINGS_KEY, {}) }
}

export function loadAbsences(): Absence[] {
  const data = readJson<unknown>(ABSENCES_KEY, [])
  return Array.isArray(data)
    ? data.filter((a): a is Absence => isRecord(a) && typeof a.id === 'string' && typeof a.startDate === 'string')
    : []
}

export const SETTINGS_LINK_PREFIX = '#ajustes='

const NUMERIC_SETTINGS = [
  'annualHours',
  'maxComplementaryHours',
  'weeklyThresholdHours',
  'vacationDays',
  'openingOrdinaryHours',
  'openingComplementaryHours',
  'openingBalanceYear',
] as const
const TEXT_SETTINGS = ['contractStart', 'employeeName', 'companyName'] as const

/**
 * Reads settings from a setup link like `/#ajustes={"annualHours":900,...}`.
 * The hash never reaches the server, so personal figures stay on the device.
 * Unknown keys and invalid values are ignored.
 */
export function parseSettingsLink(hash: string): Partial<WorkSettings> | null {
  if (!hash.startsWith(SETTINGS_LINK_PREFIX)) return null
  try {
    const data: unknown = JSON.parse(decodeURIComponent(hash.slice(SETTINGS_LINK_PREFIX.length)))
    if (!isRecord(data)) return null
    const patch: Partial<WorkSettings> = {}
    for (const key of NUMERIC_SETTINGS) {
      const value = data[key]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) patch[key] = value
    }
    for (const key of TEXT_SETTINGS) {
      const value = data[key]
      if (typeof value === 'string') patch[key] = value.slice(0, 120)
    }
    if (patch.contractStart !== undefined && !/^(\d{4}-\d{2}-\d{2})?$/.test(patch.contractStart)) delete patch.contractStart
    return Object.keys(patch).length > 0 ? patch : null
  } catch {
    return null
  }
}
