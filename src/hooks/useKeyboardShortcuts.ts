import { useEffect } from 'react'
import { matchShortcut, isTypingTarget, type ShortcutId } from '../shortcuts'

export interface ShortcutHandlers {
  onCloseTab: () => void
  onCloseAllTabs: () => void
  onNewQueryTab: () => void
  onNewDatabase: () => void
  onNextTab: () => void
  onPrevTab: () => void
  onSwitchTab: (index: number) => void
  onFocusSearch: () => void
  onRunQuery: () => void
  onRefresh: () => void
  onToggleShortcuts: () => void
  onEscape: () => void
  /** When true, most shortcuts are suppressed (Escape still works) */
  modalOpen?: boolean
}

function dispatchShortcut(id: ShortcutId, handlers: ShortcutHandlers) {
  switch (id) {
    case 'close-tab':
      handlers.onCloseTab()
      break
    case 'close-all-tabs':
      handlers.onCloseAllTabs()
      break
    case 'new-query-tab':
      handlers.onNewQueryTab()
      break
    case 'new-database':
      handlers.onNewDatabase()
      break
    case 'next-tab':
      handlers.onNextTab()
      break
    case 'prev-tab':
      handlers.onPrevTab()
      break
    case 'switch-tab':
      break
    case 'focus-search':
      handlers.onFocusSearch()
      break
    case 'run-query':
      handlers.onRunQuery()
      break
    case 'refresh':
      handlers.onRefresh()
      break
    case 'toggle-shortcuts':
      handlers.onToggleShortcuts()
      break
    case 'escape':
      handlers.onEscape()
      break
  }
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchShortcut(e, 'escape')) {
        e.preventDefault()
        handlers.onEscape()
        return
      }

      if (handlers.modalOpen) return

      const typing = isTypingTarget(e.target)

      if (matchShortcut(e, 'switch-tab')) {
        e.preventDefault()
        handlers.onSwitchTab(parseInt(e.key, 10) - 1)
        return
      }

      if (matchShortcut(e, 'focus-search')) {
        e.preventDefault()
        handlers.onFocusSearch()
        return
      }

      if (typing) {
        if (matchShortcut(e, 'run-query')) {
          e.preventDefault()
          handlers.onRunQuery()
        }
        return
      }

      const ids: ShortcutId[] = [
        'close-tab',
        'close-all-tabs',
        'new-query-tab',
        'new-database',
        'next-tab',
        'prev-tab',
        'run-query',
        'refresh',
        'toggle-shortcuts',
      ]

      for (const id of ids) {
        if (matchShortcut(e, id)) {
          e.preventDefault()
          dispatchShortcut(id, handlers)
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}

export function useElectronCloseTabShortcut(onCloseTab: () => void) {
  useEffect(() => {
    if (!window.appApi?.onShortcut) return
    return window.appApi.onShortcut((id) => {
      if (id === 'close-tab') onCloseTab()
    })
  }, [onCloseTab])
}
