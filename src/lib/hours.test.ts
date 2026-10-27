import { describe, expect, it } from 'vitest'
import type { Absence, Shift, WorkSettings } from '../types'
import { annualProgress, splitShifts } from './hours'
import { vacationDaysUsed } from './absences'
import { DEFAULT_SETTINGS } from './storage'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

function shift(id: string, start: Date, hours: number): Shift {
  const end = new Date(start.getTime() + hours * 3_600_000)
  return {
    id,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    breaks: [],
    durationMinutes: hours * 60,
    synced: false,
    calendarEventId: null,
  }
}

const settings: WorkSettings = { ...DEFAULT_SETTINGS, annualHours: 900, weeklyThresholdHours: 20, maxComplementaryHours: 270 }

describe('splitShifts', () => {
  it('counts hours above the weekly threshold as complementary, in order', () => {
    // Week of Mon 26 Oct 2026: 8 + 8 + 8 = 24 h -> 20 ordinary + 4 complementary
    const shifts = [shift('a', at(2026, 10, 26, 9), 8), shift('b', at(2026, 10, 27, 9), 8), shift('c', at(2026, 10, 28, 9), 8)]
    const split = splitShifts(shifts, 20)
    expect(split.get('a')).toEqual({ ordinary: 480, complementary: 0 })
    expect(split.get('b')).toEqual({ ordinary: 480, complementary: 0 })
    expect(split.get('c')).toEqual({ ordinary: 240, complementary: 240 })
  })

  it('resets every Monday', () => {
    const shifts = [shift('sun', at(2026, 11, 1, 9), 22), shift('mon', at(2026, 11, 2, 9), 8)]
    const split = splitShifts(shifts, 20)
    expect(split.get('sun')?.complementary).toBe(120)
    expect(split.get('mon')?.complementary).toBe(0)
  })
})

describe('annualProgress', () => {
  it('prorates the target from the contract start', () => {
    const progress = annualProgress([], { ...settings, contractStart: '2026-07-02' }, at(2026, 7, 2))
    // 2 Jul -> 31 Dec is 183 of 365 days
    expect(progress.targetMinutes).toBe(Math.round(900 * 60 * (183 / 365)))
    expect(progress.expectedSoFarMinutes).toBe(0)
  })

  it('reports this week and the yearly complementary hours', () => {
    const shifts = [shift('a', at(2026, 10, 26, 9), 12), shift('b', at(2026, 10, 27, 9), 12)]
    const progress = annualProgress(shifts, settings, at(2026, 10, 28, 12))
    expect(progress.week.totalMinutes).toBe(24 * 60)
    expect(progress.week.complementaryMinutes).toBe(4 * 60)
    expect(progress.complementaryMinutes).toBe(4 * 60)
    expect(progress.ordinaryMinutes).toBe(20 * 60)
  })
})

describe('vacationDaysUsed', () => {
  it('counts natural days of vacations within the year', () => {
    const absences: Absence[] = [
      { id: '1', type: 'vacation', startDate: '2026-08-01', endDate: '2026-08-15', startTime: null, endTime: null, note: '' },
      { id: '2', type: 'vacation', startDate: '2026-12-30', endDate: '2027-01-02', startTime: null, endTime: null, note: '' },
      { id: '3', type: 'medical', startDate: '2026-09-10', endDate: '2026-09-10', startTime: '10:00', endTime: '11:00', note: '' },
    ]
    expect(vacationDaysUsed(absences, 2026)).toBe(17)
    expect(vacationDaysUsed(absences, 2027)).toBe(2)
  })
})

describe('opening balance', () => {
  it('adds hours worked before using the app only in its year', () => {
    const withBalance = { ...settings, openingOrdinaryHours: 300, openingComplementaryHours: 10, openingBalanceYear: 2026 }
    expect(annualProgress([], withBalance, at(2026, 10, 28)).ordinaryMinutes).toBe(300 * 60)
    expect(annualProgress([], withBalance, at(2026, 10, 28)).complementaryMinutes).toBe(10 * 60)
    expect(annualProgress([], withBalance, at(2027, 2, 1)).ordinaryMinutes).toBe(0)
  })
})
