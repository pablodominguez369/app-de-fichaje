import type { Tab } from '../types'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'clock', label: 'Fichaje', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { id: 'summary', label: 'Resumen', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'history', label: 'Historial', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { id: 'calendar', label: 'Calendar', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z' },
]

interface Props {
  active: Tab
  pendingCount: number
  onChange: (tab: Tab) => void
}

export function TabBar({ active, pendingCount, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Navegación principal">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab ${active === tab.id ? 'tab--active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={tab.icon} />
          </svg>
          <span>{tab.label}</span>
          {tab.id === 'history' && pendingCount > 0 && <span className="tab__badge">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  )
}
