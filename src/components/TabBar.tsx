import type { Tab } from '../types'
import { formatKeys } from '../shortcuts'
import './TabBar.css'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  getLabel: (tab: Tab) => string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function TabBar({
  tabs,
  activeTabId,
  getLabel,
  onSelect,
  onClose,
}: Props) {
  if (tabs.length === 0) return null

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(tab.id)}
            role="tab"
            aria-selected={isActive}
          >
            <span className="tab-icon">{tab.type === 'table' ? '▥' : '⌘'}</span>
            <span className="tab-label">{getLabel(tab)}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              type="button"
              aria-label="Close tab"
              title={`Close (${formatKeys('Mod+W')})`}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
