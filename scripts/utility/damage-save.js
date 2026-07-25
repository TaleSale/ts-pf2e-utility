const MODULE_ID = "ts-pf2e-utility";
const SETTING_ENABLE = "enableDamageSave";
const FLAG_PATH = `flags.${MODULE_ID}.damageSave`;
const TOOLBELT_FLAG_PATH = "flags.pf2e-toolbelt.targetHelper";
const SAVE_PATTERN = /@Check\[((?:(?!\]).)*)\](?:\{([^}]+)\})?/gi;

let pendingSave = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: "TS_PF2E_UTILITY.Settings.Other.DamageSave.Name",
    hint: "TS_PF2E_UTILITY.Settings.Other.DamageSave.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once("ready", () => document.addEventListener("click", rememberFirstSave, true));

Hooks.on("preCreateChatMessage", (message) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) {
    pendingSave = null;
    return;
  }
  if (!pendingSave || Date.now() - pendingSave.createdAt > 10_000) {
    pendingSave = null;
    return;
  }

  const sourceRolls = message._source?.rolls ?? [];
  const isDamage = (message.rolls ?? []).some((roll) =>
    roll?.constructor?.name === "DamageRoll" || roll?.class === "DamageRoll",
  ) || sourceRolls.some((roll) => String(roll).includes('"class":"DamageRoll"'));
  if (!isDamage) return;

  const updates = {
    [FLAG_PATH]: true,
  };
  if (pendingSave.saveVariant) {
    foundry.utils.setProperty(updates, `${TOOLBELT_FLAG_PATH}.saveVariants.null`, pendingSave.saveVariant);
    if (pendingSave.itemUuid) foundry.utils.setProperty(updates, `${TOOLBELT_FLAG_PATH}.item`, pendingSave.itemUuid);
  }
  message.updateSource(updates);
  pendingSave = null;
});

function rememberFirstSave(event) {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  const damageLink = event.target.closest?.("a.inline-roll[data-damage-roll], a.inline-roll.damage-roll");
  if (!damageLink) return;

  const item = getOwningItem(damageLink);
  const inline = findFirstSave(String(item?.system?.description?.value ?? ""));
  if (!inline) return;

  const itemContainer = damageLink.closest?.("[data-item-id]");
  const saveLink = Array.from(itemContainer?.querySelectorAll?.("a.inline-check") ?? []).find(isSaveLink);
  pendingSave = {
    inline,
    itemUuid: item?.uuid,
    saveVariant: saveLink ? getSaveVariant(saveLink) : getSaveVariantFromInline(inline),
    createdAt: Date.now(),
  };
}

function isSaveLink(element) {
  return ["fortitude", "reflex", "will"].includes(String(element?.dataset?.pf2Check).toLowerCase())
    && Number.isFinite(Number(element?.dataset?.pf2Dc));
}

function getSaveVariant(element) {
  return {
    basic: element.dataset.isBasic != null,
    dc: Number(element.dataset.pf2Dc),
    statistic: String(element.dataset.pf2Check).toLowerCase(),
    saves: {},
  };
}

function getSaveVariantFromInline(inline) {
  const parameters = inline.match(/@Check\[([^\]]+)\]/i)?.[1]?.split("|") ?? [];
  const statistic = parameters[0]?.trim().toLowerCase();
  const dc = Number(parameters.find((parameter) => /^dc:/i.test(parameter.trim()))?.split(":")[1]);
  if (!["fortitude", "reflex", "will"].includes(statistic) || !Number.isFinite(dc)) return null;
  return {
    basic: parameters.some((parameter) => /^basic\b/i.test(parameter.trim())),
    dc,
    statistic,
    saves: {},
  };
}

function getOwningItem(element) {
  const itemId = element.closest?.("[data-item-id]")?.dataset.itemId;
  if (!itemId) return null;

  const appElement = element.closest?.(".application");
  const appId = appElement?.dataset.appid ?? appElement?.id;
  const app = Object.values(ui.windows ?? {}).find((entry) =>
    String(entry.appId) === String(appId) || entry.element?.[0] === appElement || entry.element === appElement,
  );
  const actor = app?.actor ?? app?.document?.actor ?? (app?.document?.documentName === "Actor" ? app.document : null);
  return actor?.items?.get(itemId)
    ?? game.actors.find((candidate) => candidate.items?.has(itemId))?.items.get(itemId)
    ?? null;
}

function findFirstSave(description) {
  SAVE_PATTERN.lastIndex = 0;
  for (const match of description.matchAll(SAVE_PATTERN)) {
    const parameters = String(match[1] ?? "").toLowerCase();
    if (/(?:^|[|,])\s*(?:fortitude|reflex|will)\b/.test(parameters)) return match[0];
  }
  return null;
}
