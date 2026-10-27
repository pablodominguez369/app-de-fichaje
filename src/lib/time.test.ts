import { describe, expect, it } from 'vitest'
import type { Shift } from '../types'
import { applyTimes, diffMinutes, periodTotals, startOfWeek } from './time'

function shift(start: Date, end: Date | null): Shift {
  return {
    id: start.toISOString(),
    startAt: start.toISOString(),
    endAt: end ? end.toISOString() : null,
    durationMinutes: end ? diffMinutes(start.toISOString(), end.toISOString()) : 0,
    synced: false,
    calendarEventId: null,
  }
}

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('startOfWeek', () => {
  it('starts on Monday', () => {
    expect(startOfWeek(at(2026, 10, 27, 15))).toEqual(at(2026, 10, 26)) // Tuesday -> Monday
    expect(startOfWeek(at(2026, 11, 1, 10))).toEqual(at(2026, 10, 26)) // Sunday -> previous Monday
    expect(startOfWeek(at(2026, 10, 26, 0))).toEqual(at(2026, 10, 26)) // Monday -> itself
  })
})

describe('periodTotals', () => {
  // Tuesday 27 Oct 2026
  const now = at(2026, 10, 27, 18)
  const shifts = [
    shift(at(2026, 10, 27, 8), at(2026, 10, 27, 12)), // today 240
    shift(at(2026, 10, 27, 13), at(2026, 10, 27, 14, 30)), // today 90
    shift(at(2026, 10, 26, 9), at(2026, 10, 26, 17)), // Monday 480
    shift(at(2026, 10, 25, 9), at(2026, 10, 25, 10)), // Sunday (previous week) 60
    shift(at(2026, 9, 30, 9), at(2026, 9, 30, 10)), // September 60
    shift(at(2025, 12, 31, 9), at(2025, 12, 31, 10)), // last year 60
    shift(at(2026, 10, 27, 16), null), // open shift: ignored
  ]

  it('sums closed shifts per period with weeks starting on Monday', () => {
    expect(periodTotals(shifts, now)).toEqual({
      today: 330,
      week: 330 + 480,
      month: 330 + 480 + 60,
      year: 330 + 480 + 60 + 60,
    })
  })

  it('splits overnight shifts across days', () => {
    const overnight = [shift(at(2026, 10, 26, 22), at(2026, 10, 27, 6))]
    const totals = periodTotals(overnight, now)
    expect(totals.today).toBe(360)
    expect(totals.week).toBe(480)
  })
})

describe('applyTimes', () => {
  it('recalculates duration from edited times', () => {
    const base = at(2026, 10, 27, 8, 3).toISOString()
    const result = applyTimes(base, '08:00', '16:45')
    expect(result.durationMinutes).toBe(525)
    expect(result.overnight).toBe(false)
  })

  it('treats an end before the start as next day', () => {
    const result = applyTimes(at(2026, 10, 27, 22).toISOString(), '22:00', '06:00')
    expect(result.durationMinutes).toBe(480)
    expect(result.overnight).toBe(true)
  })
})
