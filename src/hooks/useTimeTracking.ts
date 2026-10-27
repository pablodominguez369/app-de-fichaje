import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Absence, CalendarConfig, Shift, ShiftBreak, WorkSettings } from '../types'
import {
  ABSENCES_KEY,
  CALENDAR_KEY,
  DEFAULT_CALENDAR_CONFIG,
  SETTINGS_KEY,
  SHIFTS_KEY,
  loadAbsences,
  loadCalendarConfig,
  loadSettings,
  loadShifts,
  writeJson,
} from '../lib/storage'
import { netMinutes } from '../lib/time'
import {
  CalendarApiError,
  GOOGLE_CLIENT_ID,
  isTokenValid,
  loadGoogleIdentity,
  requestAccessToken,
  revokeToken,
  upsertShiftEvent,
} from '../lib/googleCalendar'
import { downloadMonthlyReport } from '../lib/pdfReport'

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowIso(): string {
  const date = new Date()
  date.setSeconds(0, 0)
  return date.toISOString()
}

const sameBreaks = (a: ShiftBreak[], b: ShiftBreak[]) => JSON.stringify(a) === JSON.stringify(b)

export function useTimeTracking() {
  const [shifts, setShifts] = useState<Shift[]>(loadShifts)
  const [calendar, setCalendar] = useState<CalendarConfig>(loadCalendarConfig)
  const [settings, setSettings] = useState<WorkSettings>(loadSettings)
  const [absences, setAbsences] = useState<Absence[]>(loadAbsences)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set())
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Refs give async callbacks the latest state without re-creating them.
  const calendarRef = useRef(calendar)
  const shiftsRef = useRef(shifts)
  useLayoutEffect(() => {
    calendarRef.current = calendar
    shiftsRef.current = shifts
  }, [calendar, shifts])

  useEffect(() => writeJson(SHIFTS_KEY, shifts), [shifts])
  useEffect(() => writeJson(CALENDAR_KEY, calendar), [calendar])
  useEffect(() => writeJson(SETTINGS_KEY, settings), [settings])
  useEffect(() => writeJson(ABSENCES_KEY, absences), [absences])

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) loadGoogleIdentity().catch(() => undefined)
  }, [])

  const openShift = useMemo(() => shifts.find((s) => s.endAt === null) ?? null, [shifts])

  const clockIn = useCallback(() => {
    if (shiftsRef.current.some((s) => s.endAt === null)) return
    const shift: Shift = {
      id: createId(),
      startAt: nowIso(),
      endAt: null,
      breaks: [],
      durationMinutes: 0,
      synced: false,
      calendarEventId: null,
    }
    setShifts((prev) => [...prev, shift])
  }, [])

  const startBreak = useCallback(() => {
    setShifts((prev) =>
      prev.map((s) =>
        s.endAt === null && !s.breaks.some((b) => b.endAt === null)
          ? { ...s, breaks: [...s.breaks, { startAt: nowIso(), endAt: null }] }
          : s,
      ),
    )
  }, [])

  const endBreak = useCallback(() => {
    const endAt = nowIso()
    setShifts((prev) =>
      prev.map((s) => (s.endAt === null ? { ...s, breaks: s.breaks.map((b) => (b.endAt === null ? { ...b, endAt } : b)) } : s)),
    )
  }, [])

  /** Gets a usable token. Opens the Google popup if needed, so call it synchronously from a click. */
  const ensureToken = useCallback((): Promise<string> => {
    const current = calendarRef.current
    if (isTokenValid(current)) return Promise.resolve(current.accessToken)
    return requestAccessToken(current.connected).then(({ accessToken, expiresAt }) => {
      setCalendar((prev) => ({ ...prev, connected: true, accessToken, expiresAt }))
      return accessToken
    })
  }, [])

  const syncShifts = useCallback(
    (targets: Shift[]) => {
      const closed = targets.filter((s) => s.endAt)
      if (closed.length === 0) return Promise.resolve()
      const ids = closed.map((s) => s.id)
      setSyncingIds((prev) => new Set([...prev, ...ids]))

      return ensureToken()
        .then(async (token) => {
          let failures = 0
          for (const shift of closed) {
            try {
              const eventId = await upsertShiftEvent(shift, calendarRef.current.calendarId, token)
              setShifts((prev) =>
                prev.map((s) => {
                  if (s.id !== shift.id) return s
                  // Only mark as synced if the shift wasn't edited while the request was in flight.
                  const unchanged = s.startAt === shift.startAt && s.endAt === shift.endAt && sameBreaks(s.breaks, shift.breaks)
                  return unchanged ? { ...s, synced: true, calendarEventId: eventId } : { ...s, calendarEventId: eventId }
                }),
              )
            } catch (error) {
              failures++
              if (error instanceof CalendarApiError && error.status === 401) {
                setCalendar((prev) => ({ ...prev, accessToken: '', expiresAt: 0 }))
                throw error
              }
            }
          }
          setMessage(
            failures === 0
              ? { kind: 'ok', text: closed.length === 1 ? 'Turno sincronizado con Google Calendar' : `${closed.length} turnos sincronizados` }
              : { kind: 'error', text: `${failures} turno(s) no se pudieron sincronizar. Quedan como pendientes.` },
          )
        })
        .catch((error: unknown) => {
          const text = error instanceof Error ? error.message : 'Error desconocido'
          setMessage({ kind: 'error', text: `No se pudo sincronizar: ${text}` })
        })
        .finally(() => {
          setSyncingIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.delete(id))
            return next
          })
        })
    },
    [ensureToken],
  )

  /** Closes the open shift (and any open break) and, if Calendar is connected, creates its event. */
  const clockOut = useCallback((): string | null => {
    const open = shiftsRef.current.find((s) => s.endAt === null)
    if (!open) return null
    const endAt = nowIso()
    const breaks = open.breaks.map((b) => (b.endAt === null ? { ...b, endAt } : b))
    const closed: Shift = { ...open, endAt, breaks, durationMinutes: netMinutes(open.startAt, endAt, breaks) }
    setShifts((prev) => prev.map((s) => (s.id === open.id ? closed : s)))
    if (calendarRef.current.connected) void syncShifts([closed])
    return closed.id
  }, [syncShifts])

  /** Saves edited times locally. A changed shift goes back to "Pendiente" until it is synced again. */
  const updateShift = useCallback((id: string, startAt: string, endAt: string, breaks: ShiftBreak[]): Shift | null => {
    const existing = shiftsRef.current.find((s) => s.id === id)
    if (!existing) return null
    const changed = existing.startAt !== startAt || existing.endAt !== endAt || !sameBreaks(existing.breaks, breaks)
    const updated: Shift = {
      ...existing,
      startAt,
      endAt,
      breaks,
      durationMinutes: netMinutes(startAt, endAt, breaks),
      synced: changed ? false : existing.synced,
    }
    setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }, [])

  const connectCalendar = useCallback(() => {
    requestAccessToken(false)
      .then(({ accessToken, expiresAt }) => {
        setCalendar((prev) => ({ ...prev, connected: true, accessToken, expiresAt }))
        setMessage({ kind: 'ok', text: 'Google Calendar conectado' })
      })
      .catch((error: unknown) => {
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo conectar' })
      })
  }, [])

  const disconnectCalendar = useCallback(() => {
    const token = calendarRef.current.accessToken
    if (token) revokeToken(token)
    setCalendar((prev) => ({ ...DEFAULT_CALENDAR_CONFIG, calendarId: prev.calendarId }))
    setMessage({ kind: 'ok', text: 'Google Calendar desconectado' })
  }, [])

  const setCalendarId = useCallback((calendarId: string) => {
    setCalendar((prev) => ({ ...prev, calendarId: calendarId.trim() || 'primary' }))
  }, [])

  const updateSettings = useCallback((patch: Partial<WorkSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const addAbsence = useCallback((absence: Omit<Absence, 'id'>) => {
    setAbsences((prev) => [...prev, { ...absence, id: createId() }])
    setMessage({ kind: 'ok', text: absence.type === 'vacation' ? 'Vacaciones guardadas' : 'Ausencia guardada' })
  }, [])

  const removeAbsence = useCallback((id: string) => {
    setAbsences((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const exportMonth = useCallback(
    (year: number, month: number) => {
      downloadMonthlyReport({ shifts: shiftsRef.current, absences, settings, year, month }).catch((error: unknown) => {
        setMessage({ kind: 'error', text: `No se pudo generar el PDF: ${error instanceof Error ? error.message : 'error desconocido'}` })
      })
    },
    [absences, settings],
  )

  return {
    shifts,
    openShift,
    calendar,
    settings,
    absences,
    syncingIds,
    message,
    clearMessage: () => setMessage(null),
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    updateShift,
    syncShifts,
    connectCalendar,
    disconnectCalendar,
    setCalendarId,
    updateSettings,
    addAbsence,
    removeAbsence,
    exportMonth,
    hasClientId: !!GOOGLE_CLIENT_ID,
  }
}

export type TimeTracking = ReturnType<typeof useTimeTracking>
