import type { ExternalChannelPort } from '@career/core'

interface ChannelReceipt {
  externalId: string
}

/** Controlled, idempotent ATS and HR environment for demos and tests. */
export class ControlledMockChannels implements ExternalChannelPort {
  private readonly applicationReceipts = new Map<string, ChannelReceipt>()
  private readonly hrReceipts = new Map<string, ChannelReceipt>()

  async submitApplication(input: Parameters<ExternalChannelPort['submitApplication']>[0]): Promise<ChannelReceipt> {
    const existing = this.applicationReceipts.get(input.idempotencyKey)
    if (existing) return existing
    const receipt = { externalId: `mock-ats-${String(this.applicationReceipts.size + 1).padStart(3, '0')}` }
    this.applicationReceipts.set(input.idempotencyKey, receipt)
    return receipt
  }

  async sendHrReply(input: Parameters<ExternalChannelPort['sendHrReply']>[0]): Promise<ChannelReceipt> {
    const existing = this.hrReceipts.get(input.idempotencyKey)
    if (existing) return existing
    const receipt = { externalId: `mock-hr-${String(this.hrReceipts.size + 1).padStart(3, '0')}` }
    this.hrReceipts.set(input.idempotencyKey, receipt)
    return receipt
  }
}
