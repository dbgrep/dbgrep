import { useEffect, useRef } from 'react'
import './ContextMenu.css'

export interface ContextMenuItem {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  separator?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [onClose])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const rect = menu.getBoundingClientRect()
    const padding = 8
    let left = x
    let top = y

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = window.innerHeight - rect.height - padding
    }

    menu.style.left = `${Math.max(padding, left)}px`
    menu.style.top = `${Math.max(padding, top)}px`
  }, [x, y])

  return (
    <div className="context-menu-backdrop">
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
        role="menu"
      >
        {items.map((item) =>
          item.separator ? (
            <div key={item.id} className="context-menu-separator" role="separator" />
          ) : (
            <button
              key={item.id}
              type="button"
              className={`context-menu-item ${item.danger ? 'danger' : ''}`}
              disabled={item.disabled}
              role="menuitem"
              onClick={() => {
                item.onClick()
                onClose()
              }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
