/** Base class for all career-domain errors. Lets the API layer map errors to stable HTTP codes without regex matching. */
export class CareerDomainError extends Error {
  readonly code: DomainErrorCode
  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'CareerDomainError'
    this.code = code
  }
}

/** A state-machine transition was attempted that is illegal or out of order. */
export class IllegalTransitionError extends CareerDomainError {
  constructor(current: string, next: string) {
    super('STATE_CONFLICT', `Illegal mission transition: ${current} -> ${next}`)
    this.name = 'IllegalTransitionError'
  }
}

/** An action intent was already decided or has a stale version. */
export class StaleActionError extends CareerDomainError {
  constructor(message: string) {
    super('STATE_CONFLICT', message)
    this.name = 'StaleActionError'
  }
}

/** A required domain entity was not found. */
export class NotFoundError extends CareerDomainError {
  constructor(message: string) {
    super('NOT_FOUND', message)
    this.name = 'NotFoundError'
  }
}

export type DomainErrorCode = 'STATE_CONFLICT' | 'NOT_FOUND' | 'VALIDATION_ERROR'
