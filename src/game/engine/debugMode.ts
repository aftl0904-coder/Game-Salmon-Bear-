/**
 * Global gameplay debug gate (compile-time).
 * When false: zone signs (平地・溪流 / 平台帶) stay hidden from player view.
 * F1 / ` overlay remains an explicit player toggle.
 * URL ?debug=1 is handled separately (e.g. assertIntegerScale) via isDebugQuery().
 */
export const DEBUG_MODE = false
