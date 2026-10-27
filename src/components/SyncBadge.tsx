interface Props {
  synced: boolean
}

export function SyncBadge({ synced }: Props) {
  return <span className={`badge ${synced ? 'badge--ok' : 'badge--pending'}`}>{synced ? 'Sincronizado' : 'Pendiente'}</span>
}
