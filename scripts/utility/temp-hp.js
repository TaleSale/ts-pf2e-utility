const MODULE_ID = "ts-pf2e-utility";
const FLAG_PATH = `flags.${MODULE_ID}.tempHealing`;
const INLINE_DAMAGE_PATTERN = /@(Damage)\[((?:[^[\]]|\[[^[\]]*\])*)\](?:{([^}]+)})?/gi;

let pendingRoll = null;

Hooks.once("init", () => {
  CONFIG.TextEditor.enrichers.unshift({
    pattern: INLINE_DAMAGE_PATTERN,
    enricher: enrichTempHealingDamage,
  });
});

Hooks.once("ready", () => {
  document.addEventListener("click", rememberTempHealingRoll, true);
  document.addEventListener("click", onApplyTempHealing, true);
});

Hooks.on("preCreateChatMessage", (message) => {
  if (!pendingRoll || Date.now() - pendingRoll.createdAt > 10_000) {
    pendingRoll = null;
    return;
  }

  const sourceRolls = message._source?.rolls ?? [];
  const hasDamageRoll = (message.rolls ?? []).some((roll) =>
    roll?.constructor?.name === "DamageRoll" || roll?.class === "DamageRoll",
  ) || sourceRolls.some((roll) => String(roll).includes('"class":"DamageRoll"'));
  if (!hasDamageRoll) return;

  message.updateSource({ [FLAG_PATH]: pendingRoll.mode });
  pendingRoll = null;
});

Hooks.on("renderChatMessageHTML", (message, element) => {
  const mode = message.getFlag(MODULE_ID, "tempHealing");
  if (!mode) return;

  element.dataset.tempHealing = mode;
  const button = element.querySelector(
    'button.healing-only[data-action="applyDamage"], button.apply-healing[data-action="applyDamage"]',
  );
  if (!button) return;

  button.dataset.action = "tsApplyTempHealing";
  button.dataset.tempHealing = mode;
  button.title = localize(mode === "overflow" ? "OverflowTitle" : "TemporaryTitle");

  const label = button.querySelector(".label");
  if (label) label.textContent = localize(mode === "overflow" ? "OverflowButton" : "TemporaryButton");
});

async function enrichTempHealingDamage(match, options) {
  const formula = String(match[2] ?? "");
  const hasOverflow = /\[t\+healing\]/i.test(formula);
  const hasTemporary = /\[thealing\]/i.test(formula);

  if (!hasOverflow && !hasTemporary) {
    return CONFIG.ux.TextEditor.enrichString(match, options);
  }

  const mode = hasOverflow ? "overflow" : "temporary";
  const normalizedFormula = formula.replace(/\[(?:t\+healing|thealing)\]/gi, "[healing]");
  const normalizedMatch = Array.from(match);
  normalizedMatch[0] = String(match[0]).replace(formula, normalizedFormula);
  normalizedMatch[2] = normalizedFormula;

  const element = await CONFIG.ux.TextEditor.enrichString(normalizedMatch, options);
  if (element instanceof HTMLElement) {
    element.dataset.tempHealing = mode;
    element.dataset.tooltip = localize(mode === "overflow" ? "OverflowTitle" : "TemporaryTitle");
  }
  return element;
}

function rememberTempHealingRoll(event) {
  const link = event.target.closest?.("a.inline-roll[data-temp-healing]");
  if (!link) return;

  pendingRoll = {
    mode: link.dataset.tempHealing,
    createdAt: Date.now(),
  };
}

async function onApplyTempHealing(event) {
  const button = event.target.closest?.('button[data-action="tsApplyTempHealing"]');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const messageId = button.closest("li.chat-message")?.dataset.messageId;
  const message = game.messages.get(messageId);
  const rollIndex = Number(button.closest("[data-roll-index]")?.dataset.rollIndex) || 0;
  const roll = message?.rolls.at(rollIndex);
  if (!message || !roll || !Number.isFinite(Number(roll.total))) return;

  const messageElement = button.closest("li.chat-message");
  const tokens = messageElement?.dataset.actorIsTarget && message.token
    ? [message.token]
    : game.user.getActiveTokens();
  if (!tokens.length) {
    ui.notifications.error(game.i18n.localize("PF2E.ErrorMessage.NoTokenSelected"));
    return;
  }

  const multiplier = Math.abs(Number(button.dataset.multiplier) || 1);
  const adjustment = event.shiftKey ? await promptForAdjustment() : 0;
  if (adjustment === null) return;

  const amount = Math.max(0, Math.trunc(Math.abs(Number(roll.total)) * multiplier + adjustment));
  const mode = button.dataset.tempHealing;
  let changed = 0;

  for (const token of tokens) {
    const actor = token.actor;
    const hp = actor?.system?.attributes?.hp;
    if (!actor || !hp || !actor.canUserModify(game.user, "update")) continue;

    const current = Number(hp.value) || 0;
    const maximum = Number(hp.max) || 0;
    const currentTemp = Number(hp.temp) || 0;
    const regularHealing = mode === "overflow" ? Math.min(amount, Math.max(0, maximum - current)) : 0;
    const offeredTemp = mode === "overflow" ? amount - regularHealing : amount;
    const nextTemp = Math.max(currentTemp, offeredTemp);
    const updates = {};

    if (regularHealing > 0) updates["system.attributes.hp.value"] = current + regularHealing;
    if (nextTemp !== currentTemp) {
      updates["system.attributes.hp.temp"] = nextTemp;
      updates["system.attributes.hp.tempsource"] = null;
    }
    if (Object.keys(updates).length) {
      await actor.update(updates);
      changed += 1;
    }
  }

  const key = changed ? "Applied" : "NoChange";
  ui.notifications.info(game.i18n.format(`TS_PF2E_UTILITY.TempHP.${key}`, { amount }));
}

async function promptForAdjustment() {
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: localize("AdjustmentTitle") },
    content: `<div class="form-group"><label>${localize("AdjustmentLabel")}</label><div class="form-fields"><input type="number" name="adjustment" value="0" step="1"></div></div>`,
    ok: {
      callback: (_event, button) => Number(button.form.elements.adjustment.value) || 0,
    },
  });
  return result ?? null;
}

function localize(key) {
  return game.i18n.localize(`TS_PF2E_UTILITY.TempHP.${key}`);
}
