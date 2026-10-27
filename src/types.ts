/** A break inside a shift. Breaks are not counted as worked time. */
export interface ShiftBreak {
  startAt: string
  /** Null while the break is in progress. */
  endAt: string | null
}

/** A work shift. Persisted as-is in localStorage. */
export interface Shift {
  id: string
  /** ISO datetime of clock-in. */
  startAt: string
  /** ISO datetime of clock-out, or null while the shift is open. */
  endAt: string | null
  breaks: ShiftBreak[]
  /** Net worked minutes: shift length minus breaks. */
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

/** Contract figures used by the counters. Edited by the user in Settings. */
export interface WorkSettings {
  annualHours: number
  /** Maximum complementary hours per year agreed in the contract. */
  maxComplementaryHours: number
  /** Weekly hours above which worked time counts as complementary. */
  weeklyThresholdHours: number
  /** Vacation allowance in calendar days per year. */
  vacationDays: number
  /** YYYY-MM-DD. Used to prorate the yearly target in the first year. */
  contractStart: string
  /**
   * Hours already worked this year before using the app (from payslips).
   * Only applied while `openingBalanceYear` is the current year.
   */
  openingOrdinaryHours: number
  openingComplementaryHours: number
  openingBalanceYear: number
  /** Optional, only printed on the PDF report. Stays on this device. */
  employeeName: string
  companyName: string
}

export type AbsenceType = 'vacation' | 'medical' | 'leave' | 'sick' | 'other'

export interface Absence {
  id: string
  type: AbsenceType
  /** YYYY-MM-DD, first day. */
  startDate: string
  /** YYYY-MM-DD, last day (inclusive). Same as startDate for single-day absences. */
  endDate: string
  /** HH:MM, optional (e.g. a medical appointment). */
  startTime: string | null
  endTime: string | null
  note: string
}

export type Tab = 'clock' | 'summary' | 'history' | 'absences' | 'settings'
