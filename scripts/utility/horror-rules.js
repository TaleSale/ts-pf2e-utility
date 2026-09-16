export const OUTCOMES = ["criticalFailure", "failure", "success", "criticalSuccess"];

export function clampDread(value) {
  return Math.max(0, Math.min(5, Math.trunc(Number(value) || 0)));
}

export function horrorDegree(natural, dread, enemyAttack = false) {
  dread = clampDread(dread);
  if (!dread || !Number.isInteger(natural) || natural < 1 || natural > 20) return null;
  if (enemyAttack) return natural >= 21 - dread ? 3 : null;
  return natural <= dread ? 0 : null;
}

export function nextDread(state, delta, { time = 0, combatId = null, round = null, limited = false } = {}) {
  const value = clampDread(state.value);
  if (delta > 0 && limited) {
    const sameRound = combatId && state.lastCombat === combatId && state.lastRound === round;
    const tooSoon = !combatId && Number.isFinite(state.lastGain) && time - state.lastGain < 600;
    if (sameRound || tooSoon) return { state, changed: false, nightmare: false };
  }
  const next = { ...state, value: Math.max(1, clampDread(value + delta)) };
  if (delta > 0) Object.assign(next, { lastGain: time, lastCombat: combatId, lastRound: round });
  return { state: next, changed: true, nightmare: delta > 0 && value + delta > 5 };
}

