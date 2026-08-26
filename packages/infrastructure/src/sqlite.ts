import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import {
  createEmptyWorkspaceState,
  type CareerRepository,
  type WorkspaceState,
} from '@career/core'

const PROJECTION_TABLES = [
  'pursuits',
  'jobs',
  'tasks',
  'memory_items',
  'evidence_items',
  'resume_versions',
  'action_intents',
  'applications',
  'hr_messages',
] as const

type ProjectionTable = (typeof PROJECTION_TABLES)[number]

const STATE_KEYS: Record<ProjectionTable, keyof WorkspaceState> = {
  pursuits: 'pursuits',
  jobs: 'jobs',
  tasks: 'tasks',
  memory_items: 'memories',
  evidence_items: 'evidence',
  resume_versions: 'resumes',
  action_intents: 'actions',
  applications: 'applications',
  hr_messages: 'hrMessages',
}

interface PayloadRow {
  payload: string
}

/** SQLite implementation of the career-domain repository. */
export class SqliteCareerRepository implements CareerRepository {
  private readonly database: Database.Database
  private readonly statements: PreparedStatements

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.database = new Database(path)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this.migrate()
    this.statements = this.prepareStatements()
  }

  async transaction<T>(work: (draft: WorkspaceState) => T): Promise<T> {
    const execute = this.database.transaction(() => {
      const draft = this.readState()
      const result = work(draft)
      this.writeState(draft)
      return result
    })
    return execute()
  }

  async snapshot(): Promise<WorkspaceState> {
    return this.readState()
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.database.prepare('SELECT 1').get()
      return true
    } catch {
      return false
    }
  }

  close(): void {
    this.database.close()
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('schema_version', '1');

      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pursuits (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resume_versions (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS action_intents (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS hr_messages (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS domain_events (
        seq INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `)
  }

  private prepareStatements(): PreparedStatements {
    const read = {
      mission: this.database.prepare('SELECT payload FROM missions LIMIT 1'),
      events: this.database.prepare('SELECT payload FROM domain_events ORDER BY seq'),
    } as const
    const reads = {} as Record<ProjectionTable, Database.Statement>
    for (const table of PROJECTION_TABLES) {
      reads[table] = this.database.prepare(`SELECT payload FROM ${table} ORDER BY rowid`)
    }
    const deletes = {} as Record<ProjectionTable, Database.Statement>
    for (const table of PROJECTION_TABLES) {
      deletes[table] = this.database.prepare(`DELETE FROM ${table}`)
    }
    const inserts = {} as Record<ProjectionTable, Database.Statement>
    for (const table of PROJECTION_TABLES) {
      inserts[table] = table === 'action_intents'
        ? this.database.prepare(`INSERT INTO ${table} (id, mission_id, idempotency_key, payload) VALUES (?, ?, ?, ?)`)
        : this.database.prepare(`INSERT INTO ${table} (id, mission_id, payload) VALUES (?, ?, ?)`)
    }
    return {
      readMission: read.mission,
      readEvents: read.events,
      readTable: reads,
      deleteTable: deletes,
      insertTable: inserts,
      deleteEvents: this.database.prepare('DELETE FROM domain_events'),
      deleteMission: this.database.prepare('DELETE FROM missions'),
      insertMission: this.database.prepare('INSERT INTO missions (id, payload) VALUES (?, ?)'),
      insertEvent: this.database.prepare('INSERT INTO domain_events (seq, id, mission_id, type, payload) VALUES (?, ?, ?, ?, ?)'),
    }
  }

  private readState(): WorkspaceState {
    const state = createEmptyWorkspaceState()
    const missionRow = this.statements.readMission.get() as PayloadRow | undefined
    if (!missionRow) return state
    state.mission = JSON.parse(missionRow.payload) as WorkspaceState['mission']

    for (const table of PROJECTION_TABLES) {
      const rows = this.statements.readTable[table].all() as PayloadRow[]
      const key = STATE_KEYS[table]
      ;(state[key] as unknown[]) = rows.map((row) => JSON.parse(row.payload) as unknown)
    }
    const eventRows = this.statements.readEvents.all() as PayloadRow[]
    state.events = eventRows.map((row) => JSON.parse(row.payload) as WorkspaceState['events'][number])
    return state
  }

  private writeState(state: WorkspaceState): void {
    const { deleteTable, insertTable, deleteEvents, deleteMission, insertMission, insertEvent } = this.statements
    for (const table of PROJECTION_TABLES) deleteTable[table].run()
    deleteEvents.run()
    deleteMission.run()
    if (!state.mission) return

    insertMission.run(state.mission.id, JSON.stringify(state.mission))

    for (const table of PROJECTION_TABLES) {
      const key = STATE_KEYS[table]
      const insert = insertTable[table]
      for (const item of state[key] as Array<{ id: string; missionId: string; idempotencyKey?: string }>) {
        if (table === 'action_intents') {
          insert.run(item.id, item.missionId, item.idempotencyKey, JSON.stringify(item))
        } else {
          insert.run(item.id, item.missionId, JSON.stringify(item))
        }
      }
    }

    for (const event of state.events) {
      insertEvent.run(event.seq, event.id, event.missionId, event.type, JSON.stringify(event))
    }
  }
}

interface PreparedStatements {
  readMission: Database.Statement
  readEvents: Database.Statement
  readTable: Record<ProjectionTable, Database.Statement>
  deleteTable: Record<ProjectionTable, Database.Statement>
  insertTable: Record<ProjectionTable, Database.Statement>
  deleteEvents: Database.Statement
  deleteMission: Database.Statement
  insertMission: Database.Statement
  insertEvent: Database.Statement
}
