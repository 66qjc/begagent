import { createHash } from 'node:crypto'

export interface CacheKey {
  sourceId: string
  version: number
  contentHash: string
  permissionVariant: string
  schemaVersion: number
}

export interface InvalidationEvent {
  type: 'cache.invalidated'
  sourceId: string
  oldKey: string
  occurredAt: string
}

export class ContextCache {
  private entries = new Map<string, unknown>()
  private invalidationEvents: InvalidationEvent[] = []
  private seenSourceHashes = new Map<string, string>() // sourceId -> last contentHash

  private keyHash(key: CacheKey): string {
    const parts = [key.sourceId, String(key.version), key.contentHash, key.permissionVariant, String(key.schemaVersion)]
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
  }

  set(key: CacheKey, value: unknown): void {
    const oldHash = this.seenSourceHashes.get(key.sourceId)
    if (oldHash !== undefined && oldHash !== key.contentHash) {
      // Content hash changed for the same source: invalidate any prior entry.
      this.invalidationEvents.push({
        type: 'cache.invalidated',
        sourceId: key.sourceId,
        oldKey: oldHash,
        occurredAt: new Date().toISOString(),
      })
    }
    this.seenSourceHashes.set(key.sourceId, key.contentHash)
    this.entries.set(this.keyHash(key), value)
  }

  get(key: CacheKey): unknown | undefined {
    const oldHash = this.seenSourceHashes.get(key.sourceId)
    if (oldHash !== undefined && oldHash !== key.contentHash) {
      // Content hash changed for the same source since last access: invalidate.
      this.invalidationEvents.push({
        type: 'cache.invalidated',
        sourceId: key.sourceId,
        oldKey: oldHash,
        occurredAt: new Date().toISOString(),
      })
      this.seenSourceHashes.set(key.sourceId, key.contentHash)
      return undefined
    }
    return this.entries.get(this.keyHash(key))
  }

  getInvalidationEvents(): InvalidationEvent[] {
    return [...this.invalidationEvents]
  }
}
