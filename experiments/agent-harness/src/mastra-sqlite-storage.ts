import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { WorkflowsStorage } from '@mastra/core/storage'
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput, UpdateWorkflowStateOptions } from '@mastra/core/storage'
import type { WorkflowRunState, StepResult } from '@mastra/core/workflows'

interface SnapshotRow {
  workflowName: string
  runId: string
  snapshot: string
  updatedAt: string
}

export class SqliteWorkflowsStorage extends WorkflowsStorage {
  private db: DatabaseType

  constructor(dbPath: string) {
    super()
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_snapshots (
        workflowName TEXT NOT NULL,
        runId TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (workflowName, runId)
      );
    `)
  }

  supportsConcurrentUpdates(): boolean {
    return false
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.exec('DELETE FROM workflow_snapshots')
  }

  async updateWorkflowResults({ workflowName, runId, stepId, result }: {
    workflowName: string
    runId: string
    stepId: string
    result: StepResult<unknown, unknown, unknown, unknown>
    requestContext: Record<string, unknown>
  }): Promise<Record<string, StepResult<unknown, unknown, unknown, unknown>>> {
    const existing = await this.loadWorkflowSnapshot({ workflowName, runId })
    if (existing) {
      const ctx = existing.context as Record<string, unknown>
      ctx[stepId] = result
      await this.persistWorkflowSnapshot({ workflowName, runId, snapshot: existing })
      return ctx as Record<string, StepResult<unknown, unknown, unknown, unknown>>
    }
    return {}
  }

  async updateWorkflowState({ workflowName, runId, opts }: {
    workflowName: string
    runId: string
    opts: UpdateWorkflowStateOptions
  }): Promise<WorkflowRunState | undefined> {
    const existing = await this.loadWorkflowSnapshot({ workflowName, runId })
    if (existing) {
      if (opts.status) existing.status = opts.status
      await this.persistWorkflowSnapshot({ workflowName, runId, snapshot: existing })
      return existing
    }
    return undefined
  }

  async persistWorkflowSnapshot({ workflowName, runId, snapshot }: {
    workflowName: string
    runId: string
    resourceId?: string
    snapshot: WorkflowRunState
    createdAt?: Date
    updatedAt?: Date
  }): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO workflow_snapshots (workflowName, runId, snapshot, updatedAt) VALUES (?, ?, ?, ?)'
    )
    stmt.run(workflowName, runId, JSON.stringify(snapshot), new Date().toISOString())
  }

  async loadWorkflowSnapshot({ workflowName, runId }: {
    workflowName: string
    runId: string
  }): Promise<WorkflowRunState | null> {
    const stmt = this.db.prepare('SELECT * FROM workflow_snapshots WHERE workflowName = ? AND runId = ?')
    const row = stmt.get(workflowName, runId) as SnapshotRow | undefined
    if (!row) return null
    return JSON.parse(row.snapshot) as WorkflowRunState
  }

  async listWorkflowRuns(_args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return { runs: [], total: 0 }
  }

  async getWorkflowRunById({ runId, workflowName }: {
    runId: string
    workflowName?: string
  }): Promise<WorkflowRun | null> {
    const stmt = workflowName
      ? this.db.prepare('SELECT * FROM workflow_snapshots WHERE workflowName = ? AND runId = ?')
      : this.db.prepare('SELECT * FROM workflow_snapshots WHERE runId = ?')
    const row = workflowName ? stmt.get(workflowName, runId) as SnapshotRow | undefined : stmt.get(runId) as SnapshotRow | undefined
    if (!row) return null
    const snapshot = JSON.parse(row.snapshot) as WorkflowRunState
    return {
      runId,
      workflowName: row.workflowName,
      snapshot,
      createdAt: new Date(row.updatedAt),
      updatedAt: new Date(row.updatedAt),
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: {
    runId: string
    workflowName: string
  }): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM workflow_snapshots WHERE workflowName = ? AND runId = ?')
    stmt.run(workflowName, runId)
  }

  close(): void {
    this.db.close()
  }
}
