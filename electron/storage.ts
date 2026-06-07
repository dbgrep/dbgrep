import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { SavedConnection, Tab } from '../src/types'

const DATA_DIR = path.join(os.homedir(), '.dbviewer')
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json')
const SESSION_FILE = path.join(DATA_DIR, 'session.json')

export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  activeConnectionId: string | null
  querySql: Record<string, string>
  expanded: Record<string, boolean>
}

const EMPTY_SESSION: SessionState = {
  tabs: [],
  activeTabId: null,
  activeConnectionId: null,
  querySql: {},
  expanded: {},
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

async function writeJsonFile(filePath: string, data: unknown, mode = 0o644) {
  await ensureDir()
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode })
  await fs.rename(tmp, filePath)
  await fs.chmod(filePath, mode)
}

export function getDataDir() {
  return DATA_DIR
}

export async function readConnections(): Promise<SavedConnection[]> {
  await ensureDir()
  return readJsonFile<SavedConnection[]>(CONNECTIONS_FILE, [])
}

export async function writeConnections(connections: SavedConnection[]): Promise<void> {
  await writeJsonFile(CONNECTIONS_FILE, connections, 0o600)
}

export async function readSession(): Promise<SessionState> {
  await ensureDir()
  const session = await readJsonFile<SessionState>(SESSION_FILE, EMPTY_SESSION)
  return {
    tabs: session.tabs ?? [],
    activeTabId: session.activeTabId ?? null,
    activeConnectionId: session.activeConnectionId ?? null,
    querySql: session.querySql ?? {},
    expanded: session.expanded ?? {},
  }
}

export async function writeSession(session: SessionState): Promise<void> {
  await writeJsonFile(SESSION_FILE, session)
}
