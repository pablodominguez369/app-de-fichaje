import { useEffect, useState } from 'react'
import type { Tab } from './types'
import { useTimeTracking } from './hooks/useTimeTracking'
import { ClockScreen } from './components/ClockScreen'
import { SummaryScreen } from './components/SummaryScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { AdjustShiftScreen } from './components/AdjustShiftScreen'
import { CalendarScreen } from './components/CalendarScreen'
import { TabBar } from './components/TabBar'

export default function App() {
  const tracking = useTimeTracking()
  const [tab, setTab] = useState<Tab>('clock')
  const [adjustingId, setAdjustingId] = useState<string | null>(null)

  const { message, clearMessage } = tracking
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(clearMessage, 4000)
    return () => window.clearTimeout(id)
  }, [message, clearMessage])

  const pendingCount = tracking.shifts.filter((s) => s.endAt && !s.synced).length
  const adjustingShift = adjustingId ? tracking.shifts.find((s) => s.id === adjustingId && s.endAt) : undefined

  const handleClockOut = () => {
    const closedId = tracking.clockOut()
    if (closedId) setAdjustingId(closedId)
  }

  const changeTab = (next: Tab) => {
    setAdjustingId(null)
    setTab(next)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Fichaje</h1>
        <button
          type="button"
          className={`calendar-chip ${tracking.calendar.connected ? 'calendar-chip--on' : ''}`}
          onClick={() => changeTab('calendar')}
        >
          <span className="status-dot" aria-hidden />
          {tracking.calendar.connected ? 'Calendar conectado' : 'Calendar desconectado'}
        </button>
      </header>

      <main className="app-main">
        {adjustingShift ? (
          <AdjustShiftScreen
            key={adjustingShift.id}
            shift={adjustingShift}
            syncing={tracking.syncingIds.has(adjustingShift.id)}
            calendarConnected={tracking.calendar.connected}
            onSave={(startAt, endAt) => {
              tracking.updateShift(adjustingShift.id, startAt, endAt)
              setAdjustingId(null)
            }}
            onSaveAndSync={(startAt, endAt) => {
              const updated = tracking.updateShift(adjustingShift.id, startAt, endAt)
              if (updated) void tracking.syncShifts([updated])
            }}
            onClose={() => setAdjustingId(null)}
          />
        ) : tab === 'clock' ? (
          <ClockScreen openShift={tracking.openShift} onClockIn={tracking.clockIn} onClockOut={handleClockOut} />
        ) : tab === 'summary' ? (
          <SummaryScreen shifts={tracking.shifts} />
        ) : tab === 'history' ? (
          <HistoryScreen
            shifts={tracking.shifts}
            syncingIds={tracking.syncingIds}
            onSync={(shifts) => void tracking.syncShifts(shifts)}
            onEdit={setAdjustingId}
          />
        ) : (
          <CalendarScreen
            calendar={tracking.calendar}
            hasClientId={tracking.hasClientId}
            pendingCount={pendingCount}
            onConnect={tracking.connectCalendar}
            onDisconnect={tracking.disconnectCalendar}
            onCalendarIdChange={tracking.setCalendarId}
          />
        )}
      </main>

      {message && (
        <div className={`toast toast--${message.kind}`} role="status" onClick={clearMessage}>
          {message.text}
        </div>
      )}

      <TabBar active={tab} pendingCount={pendingCount} onChange={changeTab} />
    </div>
  )
}
