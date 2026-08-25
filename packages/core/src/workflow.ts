import { IllegalTransitionError } from './errors.ts'
import { MISSION_STAGES, type MissionStage } from './model.ts'

const ALLOWED_TRANSITIONS = new Map<MissionStage, MissionStage>(
  MISSION_STAGES.slice(0, -1).map((stage, index) => [stage, MISSION_STAGES[index + 1]!]),
)

/** Fails when a command attempts to skip or reverse a mission stage. */
export function assertMissionTransition(current: MissionStage, next: MissionStage): void {
  if (ALLOWED_TRANSITIONS.get(current) !== next) {
    throw new IllegalTransitionError(current, next)
  }
}
