import { useEffect, useRef } from 'react'
import {
  SHORTCUTS,
  SHORTCUT_CATEGORIES,
  formatKeys,
} from '../shortcuts'
import './ShortcutsPanel.css'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export default function ShortcutsPanel({ open, onClose, anchorRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [open, onClose, anchorRef])

  if (!open) return null

  return (
    <div className="shortcuts-panel" ref={panelRef} role="dialog" aria-label="Keyboard shortcuts">
      <div className="shortcuts-panel-header">
        <h2>Keyboard Shortcuts</h2>
        <button type="button" className="shortcuts-panel-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="shortcuts-panel-body">
        {SHORTCUT_CATEGORIES.map((category) => (
          <section key={category} className="shortcuts-section">
            <h3>{category}</h3>
            <ul>
              {SHORTCUTS.filter((s) => s.category === category).map((shortcut) => (
                <li key={shortcut.id}>
                  <span className="shortcut-label">{shortcut.label}</span>
                  <kbd className="shortcut-keys">{formatKeys(shortcut.keys)}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export function ShortcutsButton({
  onClick,
  buttonRef,
  expanded = false,
}: {
  onClick: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
  expanded?: boolean
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="shortcuts-toggle-btn"
      onClick={onClick}
      aria-label="Keyboard shortcuts"
      aria-expanded={expanded}
      title={`Keyboard shortcuts (${formatKeys('Mod+/')})`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
