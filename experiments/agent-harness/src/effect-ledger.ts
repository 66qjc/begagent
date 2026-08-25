import { randomUUID } from 'node:crypto'
import type { DomainStore } from './domain-store.ts'

export interface EffectResult {
  performed: boolean
  receipt: string | undefined
  error?: 'request_hash_conflict'
}

export class SideEffectLedgerStub {
  constructor(private readonly store: DomainStore) {}

  execute(idempotencyKey: string, requestHash: string): EffectResult {
    const existing = this.store.getReceipt(idempotencyKey)
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { performed: false, receipt: existing.receiptId, error: 'request_hash_conflict' }
      }
      return { performed: false, receipt: existing.receiptId }
    }

    const receiptId = `rcpt-${randomUUID().slice(0, 8)}`
    this.store.saveReceipt(idempotencyKey, requestHash, receiptId, new Date().toISOString())
    return { performed: true, receipt: receiptId }
  }
}
