export interface BridgeEffectResult {
  status: 'sent' | 'unknown'
  sent: boolean
}

interface PendingEffect {
  key: string
  payload: unknown
}

export class BridgeSimulator {
  private online = true
  private pending: PendingEffect[] = []

  isOnline(): boolean {
    return this.online
  }

  disconnect(): void {
    this.online = false
  }

  reconnect(): void {
    this.online = true
    // Reconnect does NOT auto-resend. Pending effects are cleared; the caller
    // must re-validate page/connector/Envelope/freshness and re-request.
    this.pending = []
  }

  attemptEffect(key: string, payload: unknown): BridgeEffectResult {
    if (!this.online) {
      this.pending.push({ key, payload })
      return { status: 'unknown', sent: false }
    }
    return { status: 'sent', sent: true }
  }

  get pendingEffects(): PendingEffect[] {
    return [...this.pending]
  }
}
