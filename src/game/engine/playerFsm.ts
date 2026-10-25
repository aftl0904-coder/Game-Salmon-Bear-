/**
 * Explicit player FSM (Strict QA).
 *
 *   IDLE ←→ MOVE
 *     ↓       ↓
 *   JUMP / LANE_SWAP / ATTACK / HURT
 *     ↓
 *   (timeout ~800ms) → force IDLE + grounded recover
 *
 * JUMP / LANE_SWAP must never freeze mid-air (classic soft-lock).
 */
export type PlayerFsm =
  | 'IDLE'
  | 'MOVE'
  | 'JUMP'
  | 'LANE_SWAP'
  | 'HURT'
  | 'ATTACK'
  | 'DIE'

/** Failsafe: force recover if JUMP / LANE_SWAP hang. */
export const FSM_TIMEOUT_MS = 800
