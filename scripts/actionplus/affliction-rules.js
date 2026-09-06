const OUTCOMES = new Set(["criticalSuccess", "success", "failure", "criticalFailure"]);

function clampStage(stage, maxStage) {
  return Math.max(0, Math.min(Math.max(1, Number(maxStage) || 1), Math.trunc(Number(stage) || 0)));
}

export function exposureTransition({ stage, outcome, maxStage }) {
  if (!OUTCOMES.has(outcome)) return { stage: clampStage(stage, maxStage), changed: false };
  const step = outcome === "criticalFailure" ? 2 : outcome === "failure" ? 1 : 0;
  const current = clampStage(stage, maxStage);
  const next = clampStage(current + step, maxStage);
  return { stage: next, changed: next !== current };
}

export function periodicTransition({ stage, outcome, maxStage, virulent = false, virulentSuccesses = 0 }) {
  const current = clampStage(stage, maxStage);
  let next = current;
  let successes = Math.max(0, Math.trunc(Number(virulentSuccesses) || 0));

  if (!OUTCOMES.has(outcome)) return { stage: current, virulentSuccesses: successes, cured: current <= 0 };

  if (virulent) {
    if (outcome === "criticalSuccess") {
      next -= 1;
      successes = 0;
    } else if (outcome === "success") {
      successes += 1;
      if (successes >= 2) {
        next -= 1;
        successes = 0;
      }
    } else {
      successes = 0;
      if (outcome === "failure") next += 1;
      else if (outcome === "criticalFailure") next += 2;
    }
  } else {
    successes = 0;
    if (outcome === "criticalSuccess") next -= 2;
    else if (outcome === "success") next -= 1;
    else if (outcome === "failure") next += 1;
    else if (outcome === "criticalFailure") next += 2;
  }

  next = clampStage(next, maxStage);
  return { stage: next, virulentSuccesses: successes, cured: next <= 0 };
}
