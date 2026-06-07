export type ShortcutId =
  | 'close-tab'
  | 'close-all-tabs'
  | 'new-query-tab'
  | 'new-database'
  | 'next-tab'
  | 'prev-tab'
  | 'switch-tab'
  | 'focus-search'
  | 'run-query'
  | 'refresh'
  | 'toggle-shortcuts'
  | 'escape'

export interface ShortcutDefinition {
  id: ShortcutId
  label: string
  /** Display keys, e.g. "Mod+W" — Mod becomes ⌘ on Mac, Ctrl elsewhere */
  keys: string
  category: string
}

export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)

export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl'

export function formatKeys(keys: string): string {
  return keys
    .replace(/Mod\+/g, `${MOD_LABEL}+`)
    .replace(/Shift\+/g, '⇧+')
    .replace(/Alt\+/g, IS_MAC ? '⌥+' : 'Alt+')
    .replace(/Enter/g, '↵')
    .replace(/Esc/g, 'Esc')
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'close-tab', label: 'Close tab', keys: 'Mod+W', category: 'Tabs' },
  { id: 'close-all-tabs', label: 'Close all tabs', keys: 'Mod+Shift+W', category: 'Tabs' },
  { id: 'new-query-tab', label: 'New query tab', keys: 'Mod+T', category: 'Tabs' },
  { id: 'next-tab', label: 'Next tab', keys: 'Mod+Shift+]', category: 'Tabs' },
  { id: 'prev-tab', label: 'Previous tab', keys: 'Mod+Shift+[', category: 'Tabs' },
  {
    id: 'switch-tab',
    label: 'Switch to tab 1–9',
    keys: 'Mod+1 … Mod+9',
    category: 'Tabs',
  },
  { id: 'new-database', label: 'Add database', keys: 'Mod+N', category: 'General' },
  { id: 'focus-search', label: 'Focus database search', keys: 'Mod+K', category: 'General' },
  { id: 'refresh', label: 'Refresh', keys: 'Mod+R', category: 'General' },
  { id: 'toggle-shortcuts', label: 'Show keyboard shortcuts', keys: 'Mod+/', category: 'General' },
  { id: 'run-query', label: 'Run query', keys: 'Mod+Enter', category: 'Query' },
  { id: 'escape', label: 'Close dialog / panel', keys: 'Esc', category: 'General' },
]

export const SHORTCUT_CATEGORIES = [...new Set(SHORTCUTS.map((s) => s.category))]

function modKey(e: KeyboardEvent): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey
}

export function matchShortcut(e: KeyboardEvent, id: ShortcutId): boolean {
  if (e.type !== 'keydown') return false

  switch (id) {
    case 'close-tab':
      return modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w'
    case 'close-all-tabs':
      return modKey(e) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w'
    case 'new-query-tab':
      return modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't'
    case 'new-database':
      return modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n'
    case 'next-tab':
      return modKey(e) && e.shiftKey && (e.key === ']' || e.key === '}')
    case 'prev-tab':
      return modKey(e) && e.shiftKey && (e.key === '[' || e.key === '{')
    case 'switch-tab':
      return modKey(e) && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)
    case 'focus-search':
      return modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k'
    case 'run-query':
      return modKey(e) && e.key === 'Enter'
    case 'refresh':
      return modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r'
    case 'toggle-shortcuts':
      return modKey(e) && !e.shiftKey && (e.key === '/' || e.key === '?')
    case 'escape':
      return e.key === 'Escape'
    default:
      return false
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}
