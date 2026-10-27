import type { Absence, AbsenceType } from '../types'
import { addDays, parseDayKey } from './time'

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  vacation: 'Vacaciones',
  medical: 'Visita médica',
  leave: 'Permiso',
  sick: 'Baja',
  other: 'Otra',
}

/** Calendar days of an absence that fall inside `year` (vacations count natural days). */
export function daysInYear(absence: Absence, year: number): number {
  const from = parseDayKey(absence.startDate)
  const to = parseDayKey(absence.endDate || absence.startDate)
  let count = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d.getFullYear() === year) count++
  }
  return count
}

export function vacationDaysUsed(absences: Absence[], year: number): number {
  return absences.filter((a) => a.type === 'vacation').reduce((sum, a) => sum + daysInYear(a, year), 0)
}

/** Whether the absence touches the month [monthStart, nextMonth). */
export function overlapsMonth(absence: Absence, year: number, month: number): boolean {
  const from = parseDayKey(absence.startDate)
  const to = parseDayKey(absence.endDate || absence.startDate)
  return from < new Date(year, month + 1, 1) && to >= new Date(year, month, 1)
}

export function formatAbsenceDates(absence: Absence): string {
  const fmt = (key: string) => parseDayKey(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const days = absence.endDate && absence.endDate !== absence.startDate ? `${fmt(absence.startDate)} – ${fmt(absence.endDate)}` : fmt(absence.startDate)
  const hours = absence.startTime && absence.endTime ? ` · ${absence.startTime}–${absence.endTime}` : ''
  return days + hours
}
