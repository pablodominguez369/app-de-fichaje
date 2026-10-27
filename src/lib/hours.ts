import type { Shift, WorkSettings } from '../types'
import { addDays, parseDayKey, startOfWeek } from './time'

const DAY_MS = 86_400_000

export interface ShiftSplit {
  ordinary: number
  complementary: number
}

/**
 * Splits each closed shift into ordinary and complementary minutes.
 * Within each week (Monday to Sunday) shifts are taken in order: the first
 * `weeklyThresholdHours` are ordinary and everything after that is complementary.
 * A shift belongs to the week (and day) in which it started.
 */
export function splitShifts(shifts: Shift[], weeklyThresholdHours: number): Map<string, ShiftSplit> {
  const threshold = Math.max(0, weeklyThresholdHours) * 60
  const byWeek = new Map<number, Shift[]>()
  for (const shift of shifts) {
    if (!shift.endAt) continue
    const week = startOfWeek(new Date(shift.startAt)).getTime()
    byWeek.set(week, [...(byWeek.get(week) ?? []), shift])
  }

  const result = new Map<string, ShiftSplit>()
  for (const weekShifts of byWeek.values()) {
    weekShifts.sort((a, b) => a.startAt.localeCompare(b.startAt))
    let accumulated = 0
    for (const shift of weekShifts) {
      const ordinary = Math.max(0, Math.min(shift.durationMinutes, threshold - accumulated))
      result.set(shift.id, { ordinary, complementary: shift.durationMinutes - ordinary })
      accumulated += shift.durationMinutes
    }
  }
  return result
}

/** Sums the split of the closed shifts that started inside [from, to). */
export function sumSplit(shifts: Shift[], split: Map<string, ShiftSplit>, from: Date, to: Date): ShiftSplit {
  const total: ShiftSplit = { ordinary: 0, complementary: 0 }
  for (const shift of shifts) {
    const start = Date.parse(shift.startAt)
    const part = split.get(shift.id)
    if (!part || start < from.getTime() || start >= to.getTime()) continue
    total.ordinary += part.ordinary
    total.complementary += part.complementary
  }
  return total
}

export interface AnnualProgress {
  year: number
  /** Share of the year covered by the contract (1 unless it started this year). */
  factor: number
  /** Date the count starts from (1 Jan or the contract start). */
  countFrom: Date
  targetMinutes: number
  expectedSoFarMinutes: number
  ordinaryMinutes: number
  complementaryMinutes: number
  remainingMinutes: number
  /** Positive: ahead of the expected pace. Negative: behind. */
  paceDiffMinutes: number
  maxComplementaryMinutes: number
  week: { totalMinutes: number; thresholdMinutes: number; complementaryMinutes: number }
}

export function annualProgress(shifts: Shift[], settings: WorkSettings, now: Date = new Date()): AnnualProgress {
  const year = now.getFullYear()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const yearMs = yearEnd.getTime() - yearStart.getTime()

  const contractStart = /^\d{4}-\d{2}-\d{2}$/.test(settings.contractStart) ? parseDayKey(settings.contractStart) : null
  const countFrom = contractStart && contractStart > yearStart && contractStart < yearEnd ? contractStart : yearStart
  // Whole calendar days, so daylight-saving changes don't skew the proration.
  const factor = Math.round((yearEnd.getTime() - countFrom.getTime()) / DAY_MS) / Math.round(yearMs / DAY_MS)
  const elapsed = Math.max(0, Math.min(now.getTime(), yearEnd.getTime()) - countFrom.getTime()) / yearMs

  const annualMinutes = settings.annualHours * 60
  const split = splitShifts(shifts, settings.weeklyThresholdHours)
  const yearSplit = sumSplit(shifts, split, yearStart, yearEnd)
  if (settings.openingBalanceYear === year) {
    yearSplit.ordinary += Math.round(settings.openingOrdinaryHours * 60)
    yearSplit.complementary += Math.round(settings.openingComplementaryHours * 60)
  }
  const targetMinutes = Math.round(annualMinutes * factor)
  const expectedSoFarMinutes = Math.round(annualMinutes * elapsed)

  const weekStart = startOfWeek(now)
  const weekSplit = sumSplit(shifts, split, weekStart, addDays(weekStart, 7))

  return {
    year,
    factor,
    countFrom,
    targetMinutes,
    expectedSoFarMinutes,
    ordinaryMinutes: yearSplit.ordinary,
    complementaryMinutes: yearSplit.complementary,
    remainingMinutes: Math.max(0, targetMinutes - yearSplit.ordinary),
    paceDiffMinutes: yearSplit.ordinary - expectedSoFarMinutes,
    maxComplementaryMinutes: Math.round(settings.maxComplementaryHours * 60 * factor),
    week: {
      totalMinutes: weekSplit.ordinary + weekSplit.complementary,
      thresholdMinutes: settings.weeklyThresholdHours * 60,
      complementaryMinutes: weekSplit.complementary,
    },
  }
}
