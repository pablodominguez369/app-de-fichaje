/** A work shift. Persisted as-is in localStorage. */
export interface Shift {
  id: string
  /** ISO datetime of clock-in. */
  startAt: string
  /** ISO datetime of clock-out, or null while the shift is open. */
  endAt: string | null
  durationMinutes: number
  synced: boolean
  calendarEventId: string | null
}

export interface CalendarConfig {
  calendarId: string
  connected: boolean
  accessToken: string
  /** Epoch ms when accessToken expires (GIS tokens last ~1h, no refresh token). */
  expiresAt: number
}

export type Tab = 'clock' | 'summary' | 'history' | 'calendar'
