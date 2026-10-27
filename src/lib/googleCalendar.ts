import type { CalendarConfig, Shift } from '../types'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const API_BASE = 'https://www.googleapis.com/calendar/v3'
/** Treat tokens as expired a minute early to avoid failing mid-request. */
const EXPIRY_MARGIN_MS = 60_000

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// Minimal typings for the parts of Google Identity Services we use.
interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } }
  }
}

let gisPromise: Promise<GoogleOAuth2> | null = null

/** Loads the GIS script once. Call it early so the token popup opens synchronously on click. */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2)
      else reject(new Error('Google Identity Services no está disponible'))
    }
    script.onerror = () => {
      gisPromise = null
      reject(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

export function isTokenValid(config: CalendarConfig): boolean {
  return config.connected && !!config.accessToken && config.expiresAt - EXPIRY_MARGIN_MS > Date.now()
}

export interface AccessToken {
  accessToken: string
  expiresAt: number
}

/**
 * Opens the Google consent/account popup and resolves with a fresh access token.
 * Must be called directly from a user gesture (click) or browsers block the popup.
 * `silent` skips the consent screen when the user already granted access.
 */
export function requestAccessToken(silent: boolean): Promise<AccessToken> {
  const oauth2 = window.google?.accounts?.oauth2
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('Falta VITE_GOOGLE_CLIENT_ID en el archivo .env'))
  if (!oauth2) return Promise.reject(new Error('Google Identity Services aún no se ha cargado'))
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Autorización denegada'))
          return
        }
        resolve({ accessToken: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 })
      },
      error_callback: (error) => reject(new Error(error.message || `Error de OAuth: ${error.type}`)),
    })
    client.requestAccessToken({ prompt: silent ? '' : 'consent' })
  })
}

export function revokeToken(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token)
}

export class CalendarApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function buildEventBody(shift: Shift) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return {
    summary: 'Turno de trabajo',
    // Restores the event if the user had deleted it in Calendar (PATCH on a cancelled event).
    status: 'confirmed',
    description: 'Registrado con la app de fichaje.',
    start: { dateTime: shift.startAt, timeZone },
    end: { dateTime: shift.endAt, timeZone },
    extendedProperties: { private: { fichajeShiftId: shift.id } },
  }
}

async function calendarFetch(url: string, token: string, init: RequestInit): Promise<{ id: string }> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    let message = `Google Calendar respondió ${response.status}`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new CalendarApiError(response.status, message)
  }
  return (await response.json()) as { id: string }
}

/**
 * Creates the event for a closed shift, or updates the existing one when
 * calendarEventId is set. Returns the event id to store on the shift.
 */
export async function upsertShiftEvent(shift: Shift, calendarId: string, token: string): Promise<string> {
  if (!shift.endAt) throw new Error('El turno sigue abierto')
  const base = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  const body = JSON.stringify(buildEventBody(shift))

  if (shift.calendarEventId) {
    try {
      const updated = await calendarFetch(`${base}/${encodeURIComponent(shift.calendarEventId)}`, token, {
        method: 'PATCH',
        body,
      })
      return updated.id
    } catch (error) {
      // The event was deleted from Calendar by the user: recreate it instead of failing forever.
      if (!(error instanceof CalendarApiError) || (error.status !== 404 && error.status !== 410)) throw error
    }
  }

  const created = await calendarFetch(base, token, { method: 'POST', body })
  return created.id
}
