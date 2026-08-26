import { IllegalTransitionError } from './errors.ts'
import { MISSION_STATUS, PURSUIT_STAGES, type MissionStatus, type PursuitStage } from './model.ts'

const ALLOWED_PURSUIT_TRANSITIONS = new Map<PursuitStage, PursuitStage>(
  PURSUIT_STAGES.slice(0, -1).map((stage, index) => [stage, PURSUIT_STAGES[index + 1]!]),
)

/** Fails when a command attempts to skip or reverse a pursuit stage. */
export function assertPursuitTransition(current: PursuitStage, next: PursuitStage): void {
  if (ALLOWED_PURSUIT_TRANSITIONS.get(current) !== next) {
    throw new IllegalTransitionError(current, next)
  }
}

/** Fails when a mission attempts an illegal status transition. */
export function assertMissionTransition(current: MissionStatus, next: MissionStatus): void {
  if (current === 'active' && next === 'completed') return
  throw new IllegalTransitionError(current, next)
}
