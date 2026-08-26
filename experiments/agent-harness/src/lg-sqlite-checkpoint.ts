import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { BaseCheckpointSaver } from '@langchain/langgraph'
import type { Checkpoint, CheckpointTuple, CheckpointMetadata } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'

interface CheckpointRow {
  threadId: string
  checkpointId: string
  parentCheckpointId: string | null
  checkpoint: string
  metadata: string
}

interface WriteRow {
  threadId: string
  checkpointId: string
  taskId: string
  writes: string
}

export class SqliteCheckpointSaver extends BaseCheckpointSaver {
  private db: DatabaseType

  constructor(dbPath: string) {
    super()
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        threadId TEXT NOT NULL,
        checkpointId TEXT NOT NULL,
        parentCheckpointId TEXT,
        checkpoint TEXT NOT NULL,
        metadata TEXT NOT NULL,
        PRIMARY KEY (threadId, checkpointId)
      );
      CREATE TABLE IF NOT EXISTS checkpoint_writes (
        threadId TEXT NOT NULL,
        checkpointId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        writes TEXT NOT NULL,
        PRIMARY KEY (threadId, checkpointId, taskId)
      );
    `)
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const cfg = config as { configurable?: Record<string, unknown> }
    const threadId = cfg.configurable?.['thread_id'] as string | undefined
    if (!threadId) return undefined
    const checkpointId = cfg.configurable?.['checkpoint_id'] as string | undefined

    let row: CheckpointRow | undefined
    if (checkpointId) {
      const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE threadId = ? AND checkpointId = ?')
      row = stmt.get(threadId, checkpointId) as CheckpointRow | undefined
    } else {
      const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE threadId = ? ORDER BY checkpointId DESC LIMIT 1')
      row = stmt.get(threadId) as CheckpointRow | undefined
    }
    if (!row) return undefined

    const checkpoint = JSON.parse(row.checkpoint) as Checkpoint
    const metadata = JSON.parse(row.metadata) as CheckpointMetadata

    const writeStmt = this.db.prepare('SELECT * FROM checkpoint_writes WHERE threadId = ? AND checkpointId = ?')
    const writeRows = writeStmt.all(threadId, row.checkpointId) as WriteRow[]

    const resultConfig = {
      configurable: { thread_id: threadId, checkpoint_id: row.checkpointId },
    }

    if (writeRows.length > 0) {
      const pendingWrites = writeRows.map((w) => JSON.parse(w.writes) as unknown)
      return {
        config: resultConfig as CheckpointTuple['config'],
        checkpoint,
        metadata,
        pendingWrites: pendingWrites as CheckpointTuple['pendingWrites'],
      } as CheckpointTuple
    }

    return {
      config: resultConfig as CheckpointTuple['config'],
      checkpoint,
      metadata,
    } as CheckpointTuple
  }

  async *list(config: RunnableConfig, options?: { limit?: number }): AsyncGenerator<CheckpointTuple> {
    const cfg = config as { configurable?: Record<string, unknown> }
    const threadId = cfg.configurable?.['thread_id'] as string | undefined
    if (!threadId) return
    const limit = options?.limit ?? 10
    const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE threadId = ? ORDER BY checkpointId DESC LIMIT ?')
    const rows = stmt.all(threadId, limit) as CheckpointRow[]
    for (const row of rows) {
      const checkpoint = JSON.parse(row.checkpoint) as Checkpoint
      const metadata = JSON.parse(row.metadata) as CheckpointMetadata
      yield {
        config: { configurable: { thread_id: threadId, checkpoint_id: row.checkpointId } } as CheckpointTuple['config'],
        checkpoint,
        metadata,
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: Record<string, number | string>
  ): Promise<RunnableConfig> {
    const cfg = config as { configurable?: Record<string, unknown> }
    const threadId = cfg.configurable?.['thread_id'] as string
    const checkpointId = checkpoint.id
    const parentConfig = cfg.configurable?.['checkpoint_id'] as string | undefined

    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO checkpoints (threadId, checkpointId, parentCheckpointId, checkpoint, metadata) VALUES (?, ?, ?, ?, ?)'
    )
    stmt.run(threadId, checkpointId, parentConfig ?? null, JSON.stringify(checkpoint), JSON.stringify(metadata))

    return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } } as RunnableConfig
  }

  async putWrites(config: RunnableConfig, writes: unknown[], taskId: string): Promise<void> {
    const cfg = config as { configurable?: Record<string, unknown> }
    const threadId = cfg.configurable?.['thread_id'] as string
    const checkpointId = cfg.configurable?.['checkpoint_id'] as string

    for (const write of writes) {
      const w = write as { channel: string; value: unknown; cancellationToken?: unknown }
      const serialized = JSON.stringify([w.channel, w.value, w.cancellationToken])
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO checkpoint_writes (threadId, checkpointId, taskId, writes) VALUES (?, ?, ?, ?)'
      )
      stmt.run(threadId, checkpointId, taskId, serialized)
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    this.db.prepare('DELETE FROM checkpoints WHERE threadId = ?').run(threadId)
    this.db.prepare('DELETE FROM checkpoint_writes WHERE threadId = ?').run(threadId)
  }

  close(): void {
    this.db.close()
  }
}
