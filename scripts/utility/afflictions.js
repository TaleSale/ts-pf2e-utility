const MODULE_ID = "ts-pf2e-utility";
const FLAG_KEY = "affliction";
const ACTIVE_FLAG_KEY = "activeAffliction";
const FOLDER_NAME = "Недуги";
const AFFLICTION_ICON = "systems/pf2e/icons/default-icons/effect.svg";
const AFFLICTION_SCRIPT_URL = `/modules/${MODULE_ID}/scripts/utility/afflictions.js?v=20260825-afflictions-v14`;
const AFFLICTION_MACRO_COMMAND = `if (!game.user?.isGM) { ui.notifications?.warn(game.i18n.localize('TS_PF2E_UTILITY.Notifications.OnlyGM')); return; }\nconst tool = await import(\`${AFFLICTION_SCRIPT_URL}\`);\ntool.openAfflictionDialog();`;
const resolutionHistory = globalThis.__tsuAfflictionResolutionHistory ??= new Map();
const resolutionQueues = globalThis.__tsuAfflictionResolutionQueues ??= new Map();

const TYPES = {
  poison: "Яд",
  disease: "Болезнь",
  curse: "Проклятие",
};

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function defaultConfig() {
  return { type: "poison", name: "", dc: 15, save: "fortitude", onset: 0, maxDuration: "", stages: [""], description: "" };
}

function collapseTranslatedStagePairs(stages) {
  const collapsed = [];
  for (let index = 0; index < stages.length; index += 1) {
    const current = stages[index];
    const next = stages[index + 1];
    const currentDamage = extractDamageFormulas(current).join("|").toLowerCase();
    const nextDamage = extractDamageFormulas(next).join("|").toLowerCase();
    const currentIsRussian = /[а-яё]/i.test(current);
    const nextIsRussian = /[а-яё]/i.test(next ?? "");
    if (next && currentDamage && currentDamage === nextDamage && currentIsRussian !== nextIsRussian) {
      collapsed.push(currentIsRussian ? current : next);
      index += 1;
    } else {
      collapsed.push(current);
    }
  }
  return collapsed;
}

function normalizeConfig(value) {
  const config = { ...defaultConfig(), ...(value ?? {}) };
  config.type = Object.hasOwn(TYPES, config.type) ? config.type : "poison";
  config.name = String(config.name ?? "").trim();
  config.dc = Math.max(0, Math.trunc(Number(config.dc) || 0));
  config.save = ["fortitude", "reflex", "will"].includes(config.save) ? config.save : "fortitude";
  config.onset = Math.max(0, Math.trunc(Number(config.onset) || 0));
  config.maxDuration = String(config.maxDuration ?? "").trim();
  config.description = String(config.description ?? "");
  config.stages = collapseTranslatedStagePairs(
    (Array.isArray(config.stages) ? config.stages : []).map((stage) => String(stage ?? "").trim()),
  );
  while (config.stages.length && !config.stages.at(-1)) config.stages.pop();
  return config;
}

// Intentionally conservative: parsed values are merely dialog defaults; values in the form always win.
export function parsePoisonDescription(description) {
  const source = String(description ?? "");
  const document = new DOMParser().parseFromString(source, "text/html");
  // Localized PF2e descriptions often keep the English original in <details>.
  // It is reference text, not a second set of affliction stages.
  for (const details of document.body.querySelectorAll("details")) details.remove();
  const blocks = [...document.body.querySelectorAll("p, li, blockquote")]
    .map((element) => {
      const copy = element.cloneNode(true);
      for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
      return copy.textContent.replace(/\u00a0/g, " ").trim();
    })
    .filter(Boolean);
  const text = (blocks.length ? blocks : [document.body.textContent]).join("\n").replace(/\u00a0/g, " ");
  const config = defaultConfig();
  const inlineSave = text.match(/@Check\[\s*(fortitude|reflex|will)\s*\|\s*dc\s*:\s*(\d+)/i);
  const save = inlineSave
    ?? text.match(/(?:спас(?:бросок)?|saving throw)\s*[:—-]?\s*(Стойкость|Рефлекс|Воля|fortitude|reflex|will).*?(?:КС|DC)\s*(\d+)/i)
    ?? text.match(/(?:КС|DC)\s*(\d+).*?(Стойкость|Рефлекс|Воля|fortitude|reflex|will)/i);
  if (save) {
    const saveName = String(save[1] ?? save[2]).toLowerCase();
    config.save = /рефлекс|reflex/.test(saveName) ? "reflex" : /воля|will/.test(saveName) ? "will" : "fortitude";
    config.dc = Number([save[1], save[2]].find((entry) => /^\d+$/.test(String(entry ?? "")))) || config.dc;
  }
  const onset = text.match(/(?:возникновение|активация|onset|activation)\s*[:—-]?\s*(\d+)\s*(?:раунд|round)/i);
  if (onset) config.onset = Number(onset[1]) || 0;
  const duration = text.match(/(?:макс\.?\s*продолжительность|максимальная\s*продолжительность|max(?:imum)?\s*duration)\s*[:—-]?\s*([^\n]+)/i);
  if (duration) config.maxDuration = duration[1].trim();
  const stages = blocks.map((block) => {
    const match = block.match(/^\s*(?:стадия|stage)\s*(\d+)\s*[:—-]?\s*([\s\S]*)$/i);
    return match ? { number: Number(match[1]), text: match[2].trim() } : null;
  }).filter(Boolean);
  if (stages.length) {
    const stagesByNumber = new Map();
    for (const stage of stages) {
      if (!stagesByNumber.has(stage.number)) stagesByNumber.set(stage.number, stage.text);
    }
    config.stages = [...stagesByNumber.entries()].sort(([a], [b]) => a - b).map(([, text]) => text);
  }
  return config;
}

function dialogContent(config) {
  const stages = config.stages.length ? config.stages : [""];
  return `<style>
    #tsu-affliction { display:grid; gap:9px; } #tsu-affliction label { display:grid; gap:3px; }
    #tsu-affliction .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
    #tsu-affliction textarea { min-height:74px; resize:vertical; } #tsu-affliction .source textarea { min-height:120px; font-family:monospace; font-size:11px; }
    #tsu-affliction .stage { display:grid; gap:5px; margin:9px 0; padding:8px; border:1px solid var(--color-border-light-primary); border-radius:5px; }
    #tsu-affliction .stage-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    #tsu-affliction .stage-head button { width:30px; min-width:30px; height:28px; padding:0; }
    #tsu-affliction .stage-preview { min-height:34px; padding:7px; background:rgba(0,0,0,.08); border-radius:4px; line-height:1.35; }
    #tsu-affliction .stage textarea { min-height:76px; line-height:1.35; font-family:monospace; font-size:11px; }
    #tsu-affliction .drop { border:2px dashed var(--color-border-light-primary); border-radius:5px; padding:10px; text-align:center; color:var(--color-text-subtle); }
    #tsu-affliction .drop.is-dragover { border-color:var(--color-warm-2); background:rgba(255,255,255,.08); color:var(--color-text-primary); }
  </style><form id="tsu-affliction">
    <label>Тип <select name="type">${Object.entries(TYPES).map(([value, label]) => `<option value="${value}" ${config.type === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <div class="drop" data-drop-zone><i class="fas fa-flask"></i> Перетащите сюда существующий яд (предмет)</div>
    <label>Название <input name="name" value="${escapeHtml(config.name)}" placeholder="Например: Яд гигантского скорпиона"></label>
    <details class="source"><summary>Источник: описание яда (для автозаполнения)</summary><label><textarea name="description" placeholder="Вставьте описание яда для автозаполнения; затем отредактируйте поля ниже вручную.">${escapeHtml(config.description)}</textarea></label></details>
    <button type="button" data-action="parse"><i class="fa-solid fa-wand-magic-sparkles"></i> Настроить из описания</button>
    <section><strong>Стадии</strong><div data-stages>${stages.map((stage, index) => stageRow(index, stage)).join("")}</div><button type="button" data-action="add-stage"><i class="fas fa-plus"></i> Стадия</button></section>
    <div class="grid"><label>Спас <select name="save"><option value="fortitude" ${config.save === "fortitude" ? "selected" : ""}>Стойкость</option><option value="reflex" ${config.save === "reflex" ? "selected" : ""}>Рефлекс</option><option value="will" ${config.save === "will" ? "selected" : ""}>Воля</option></select></label><label>КС <input name="dc" type="number" min="0" value="${config.dc}"></label><label>Возникновение, раундов <input name="onset" type="number" min="0" value="${config.onset}"></label></div>
    <label>Макс. продолжительность <input name="maxDuration" value="${escapeHtml(config.maxDuration)}" placeholder="например, 6 раундов"></label>
  </form>`;
}

function applyConfigToForm(form, config) {
  const value = normalizeConfig(config);
  for (const key of ["type", "name", "description", "dc", "save", "onset", "maxDuration"]) {
    const input = form.querySelector(`[name='${key}']`);
    if (input) input.value = value[key];
  }
  form.querySelector("[data-stages]").innerHTML = (value.stages.length ? value.stages : [""]).map((stage, index) => stageRow(index, stage)).join("");
  void updateStagePreviews(form);
}

async function getDroppedItem(event) {
  try {
    const data = TextEditor.getDragEventData(event);
    const uuid = data.uuid ?? (data.type === "Item" && data.id ? `Item.${data.id}` : null);
    const item = uuid ? await fromUuid(uuid) : null;
    return item?.documentName === "Item" ? item : null;
  } catch { return null; }
}

function stageRow(index, value = "") {
  return `<div class="stage">
    <div class="stage-head"><strong>Стадия ${index + 1}</strong><button type="button" data-action="remove-stage" title="Удалить"><i class="fas fa-minus"></i></button></div>
    <div class="stage-preview" data-stage-preview></div>
    <textarea name="stage" placeholder="Урон, состояния или текст стадии">${escapeHtml(value)}</textarea>
  </div>`;
}

async function updateStagePreview(row) {
  const preview = row?.querySelector?.("[data-stage-preview]");
  const input = row?.querySelector?.("[name='stage']");
  if (!preview || !input) return;
  const source = String(input.value ?? "").trim();
  preview.innerHTML = source
    ? await TextEditor.enrichHTML(source, { async: true })
    : '<span class="hint">Описание стадии</span>';
}

async function updateStagePreviews(form) {
  await Promise.all([...form.querySelectorAll(".stage")].map(updateStagePreview));
}

function readDialog(root) {
  return normalizeConfig({ type: root.querySelector("[name='type']")?.value, name: root.querySelector("[name='name']")?.value,
    description: root.querySelector("[name='description']")?.value, dc: root.querySelector("[name='dc']")?.value,
    save: root.querySelector("[name='save']")?.value, onset: root.querySelector("[name='onset']")?.value,
    maxDuration: root.querySelector("[name='maxDuration']")?.value, stages: [...root.querySelectorAll("[name='stage']")].map((input) => input.value) });
}

async function getOrCreateFolder() {
  const existing = game.folders?.find((folder) => folder.type === "Item" && folder.name === FOLDER_NAME);
  return existing ?? Folder.create({ name: FOLDER_NAME, type: "Item", sorting: "a" });
}

async function saveAffliction(config) {
  if (!config.name) return ui.notifications.warn("Введите название недуга.");
  const folder = await getOrCreateFolder();
  const item = await Item.create({ name: config.name, type: "effect", img: AFFLICTION_ICON, folder: folder.id,
    system: { description: { value: config.description }, duration: { value: -1, unit: "unlimited", expiry: null }, rules: [], slug: `tsu-${config.type}-${foundry.utils.slugify(config.name)}` }, flags: { [MODULE_ID]: { [FLAG_KEY]: config } } });
  ui.notifications.info(`Недуг «${item.name}» сохранён в папку «${FOLDER_NAME}».`);
  return item;
}

async function saveAfflictionMacro(config) {
  if (!config.name) return ui.notifications.warn("Введите название недуга.");
  const normalized = normalizeConfig(config);
  const commandData = JSON.stringify(normalized);
  const folder = game.folders?.find((entry) => entry.type === "Macro" && entry.name === FOLDER_NAME)
    ?? await Folder.create({ name: FOLDER_NAME, type: "Macro", sorting: "a" });
  const existing = game.macros?.find((entry) => entry.getFlag?.(MODULE_ID, "afflictionMacro")?.name === normalized.name);
  const source = {
    name: `Недуг: ${config.name}`,
    type: "script",
    img: AFFLICTION_ICON,
    scope: "global",
    folder: folder.id,
    command: buildSavedAfflictionMacroCommand(commandData),
    flags: { [MODULE_ID]: { afflictionMacro: normalized } },
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  const macro = existing ? await existing.update(source) : await Macro.create(source);
  if (macro) ui.notifications.info(`Макрос «${macro.name}» сохранён в папке макросов «${FOLDER_NAME}».`);
  return macro;
}

function buildSavedAfflictionMacroCommand(configOrJson) {
  const data = typeof configOrJson === "string" ? configOrJson : JSON.stringify(normalizeConfig(configOrJson));
  return `if (!game.user?.isGM) return;\nconst tool = await import(\`${AFFLICTION_SCRIPT_URL}\`);\nawait tool.postSavedAffliction(${data});`;
}

function actorForPost() {
  const target = [...(game.user?.targets ?? [])].find((token) => token?.actor);
  return target?.actor ?? null;
}

function isAuthoritativeGM() {
  const primaryGM = [...(game.users ?? [])]
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => (Number(right.role) - Number(left.role)) || String(left.id).localeCompare(String(right.id)))[0];
  return Boolean(primaryGM && game.user?.id === primaryGM.id);
}

async function withActorTarget(actor, callback) {
  const previousTargetIds = [...(game.user?.targets ?? [])].map((token) => token.id);
  const token = actor?.getActiveTokens?.(true, true)?.[0] ?? null;
  if (!token?.id) return callback(token);
  try {
    canvas.tokens?.setTargets?.([token.id]);
    return await callback(token);
  } finally {
    canvas.tokens?.setTargets?.(previousTargetIds);
  }
}

async function createCheckMessageForActor(source, actor) {
  return withActorTarget(actor, () => ChatMessage.create(source));
}

async function repairAfflictionMacros() {
  for (const macro of game.macros ?? []) {
    const command = String(macro.command ?? "");
    if (!command.includes("utility/afflictions.js")) continue;
    const savedConfig = macro.getFlag?.(MODULE_ID, "afflictionMacro");
    const canonicalCommand = command.includes("tool.openAfflictionDialog")
      ? AFFLICTION_MACRO_COMMAND
      : savedConfig
        ? buildSavedAfflictionMacroCommand(savedConfig)
        : command.replace(/\?v=\$\{Date\.now\(\)\}/g, "");
    const updates = {};
    if (macro.img !== AFFLICTION_ICON) updates.img = AFFLICTION_ICON;
    if (canonicalCommand !== command) updates.command = canonicalCommand;
    if (Object.keys(updates).length) await macro.update(updates);
  }

  const pack = game.packs?.get(`${MODULE_ID}.utility`);
  if (!game.user?.isGM || !pack) return;
  const index = await pack.getIndex({ fields: ["img", "command"] });
  const entry = index.get("UtAfflict00001");
  if (!entry || (entry.img === AFFLICTION_ICON && entry.command === AFFLICTION_MACRO_COMMAND)) return;
  const wasLocked = Boolean(pack.locked);
  try {
    if (wasLocked) await pack.configure({ locked: false });
    await pack.documentClass.updateDocuments([{
      _id: "UtAfflict00001",
      img: AFFLICTION_ICON,
      command: AFFLICTION_MACRO_COMMAND,
    }], { pack: pack.collection });
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

async function postInitialSave(config, actor = actorForPost()) {
  if (!isAuthoritativeGM()) return;
  if (!actor) return ui.notifications.warn("Выберите токен в целях перед отправкой спаса недуга.");
  const onsetText = config.onset ? ` Возникновение: ${config.onset} раунд(ов).` : "";
  const check = `@Check[${config.save}|dc:${config.dc}]{Спасбросок}`;
  const source = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<span>${escapeHtml(config.name)}${onsetText}</span>`,
    content: `<p>${check}</p>`,
    flags: { [MODULE_ID]: { [FLAG_KEY]: { config, actorUuid: actor.uuid, mode: "initial" } } },
  };
  // Target Helper captures every currently targeted token during preCreateChatMessage.
  // Do not replace the user's target selection here.
  await ChatMessage.create(source);
}

async function syncActiveEffect(actor, active = null) {
  const existing = actor.items?.find((item) => item.type === "effect" && item.getFlag(MODULE_ID, ACTIVE_FLAG_KEY));
  if (!active) {
    if (existing) await existing.delete();
    return;
  }
  const label = active.stage ? `Стадия ${active.stage}` : "Возникновение";
  const name = `${active.config.name} — ${label}`;
  const source = { [MODULE_ID]: { [ACTIVE_FLAG_KEY]: active } };
  if (existing) return existing.update({ name, flags: source });
  return actor.createEmbeddedDocuments("Item", [{
    name, type: "effect", img: AFFLICTION_ICON,
    system: { description: { value: `<p>${escapeHtml(active.config.name)}: ${escapeHtml(label)}.</p>` }, duration: { value: -1, unit: "unlimited", expiry: null }, rules: [] },
    flags: source,
  }]);
}

function outcomeName(value) { return ["criticalFailure", "failure", "success", "criticalSuccess"][Number(value)] ?? ""; }

async function resolveSave(data, actor, outcomeValue) {
  const outcome = outcomeName(outcomeValue);
  if (!outcome) return { damageMessageIds: [] };
  const config = normalizeConfig(data.config);
  const previous = actor.getFlag(MODULE_ID, ACTIVE_FLAG_KEY);
  const maximumStage = Math.max(1, config.stages.length);
  const managedEffect = actor.items?.find((item) => item.type === "effect" && item.getFlag(MODULE_ID, ACTIVE_FLAG_KEY));
  // An actor flag left behind after deleting the visible effect must not turn a
  // fresh application into a repeated exposure.
  const samePoison = Boolean(
    managedEffect
    && config.type === "poison"
    && previous?.config?.name === config.name
    && managedEffect.getFlag(MODULE_ID, ACTIVE_FLAG_KEY)?.config?.name === config.name,
  );
  const repeatedExposure = data.mode === "initial" && samePoison;
  const recoveryCheck = data.mode === "stage";
  // Clamp legacy/corrupt values before applying a degree adjustment. This also
  // repairs actors that previously reached an impossible stage such as 6.
  const currentStage = Math.min(maximumStage, Math.max(0, Math.trunc(Number(previous?.stage) || 0)));
  let stage = currentStage;
  let onsetRemaining = Math.max(0, Math.trunc(Number(previous?.onsetRemaining) || 0));

  if (repeatedExposure) {
    // A successful new exposure never improves an existing poison. A failed
    // exposure worsens it by one step (two on a critical failure).
    if (["success", "criticalSuccess"].includes(outcome)) return { damageMessageIds: [] };
    stage = Math.min(maximumStage, currentStage + (outcome === "criticalFailure" ? 2 : 1));
    onsetRemaining = 0;
  } else if (recoveryCheck) {
    const adjustment = {
      criticalSuccess: -2,
      success: -1,
      failure: 1,
      criticalFailure: 2,
    }[outcome];
    stage = Math.min(maximumStage, Math.max(0, currentStage + adjustment));
    onsetRemaining = 0;
    if (stage === 0) {
      await actor.unsetFlag(MODULE_ID, ACTIVE_FLAG_KEY);
      await syncActiveEffect(actor);
      return { damageMessageIds: [] };
    }
  } else {
    // On the initial save, failure begins at stage 1 and critical failure at
    // stage 2 (bounded by the affliction's actual maximum stage).
    if (["success", "criticalSuccess"].includes(outcome)) return { damageMessageIds: [] };
    stage = config.onset ? 0 : Math.min(maximumStage, outcome === "criticalFailure" ? 2 : 1);
    onsetRemaining = config.onset;
  }

  const active = { config, stage, onsetRemaining, lastPromptCombat: null };
  await actor.setFlag(MODULE_ID, ACTIVE_FLAG_KEY, active);
  await syncActiveEffect(actor, active);
  const damageMessages = await rollStageDamage(actor, active);
  return { damageMessageIds: damageMessages.map((message) => message?.id).filter(Boolean) };
}

function extractDamageFormulas(source) {
  const text = String(source ?? "");
  const formulas = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("@Damage[", cursor);
    if (start < 0) break;
    let depth = 1;
    let end = start + 8;
    for (; end < text.length && depth > 0; end += 1) {
      if (text[end] === "[") depth += 1;
      else if (text[end] === "]") depth -= 1;
    }
    if (depth !== 0) break;
    const parameters = text.slice(start + 8, end - 1);
    const formula = parameters.split("|")[0]?.trim();
    if (formula) formulas.push(formula);
    cursor = end;
  }
  return formulas;
}

async function rollStageDamage(actor, active) {
  if (!active.stage) return [];
  const formulas = extractDamageFormulas(active.config.stages[active.stage - 1]);
  if (!formulas.length) return [];
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll");
  if (!DamageRoll) {
    console.warn(`${MODULE_ID} | PF2E DamageRoll is unavailable`);
    return [];
  }
  return withActorTarget(actor, async (token) => {
    const messages = [];
    for (const formula of formulas) {
      try {
        const roll = await new DamageRoll(formula).evaluate();
        const message = await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `${escapeHtml(active.config.name)} — Стадия ${active.stage}`,
          flags: { pf2e: { context: { type: "damage-roll", target: { actor: actor.uuid, token: token?.document?.uuid ?? null } } } },
        });
        if (message) messages.push(message);
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to roll affliction stage damage: ${formula}`, error);
        ui.notifications.error(`Не удалось бросить урон стадии: ${formula}`);
      }
    }
    return messages;
  });
}

function toolbeltOutcomeIndex(value) {
  if (Number.isInteger(value)) return value;
  return ["criticalFailure", "failure", "success", "criticalSuccess"].indexOf(String(value ?? ""));
}

function resolutionKey(message, target) {
  return `${message?.id ?? "unknown"}:${target?.id ?? target?.document?.id ?? target?.actor?.id ?? "unknown"}`;
}

async function restoreResolutionSnapshot(actor, snapshot) {
  if (snapshot == null) {
    await actor.unsetFlag(MODULE_ID, ACTIVE_FLAG_KEY);
    await syncActiveEffect(actor);
  } else {
    const restored = foundry.utils.deepClone(snapshot);
    await actor.setFlag(MODULE_ID, ACTIVE_FLAG_KEY, restored);
    await syncActiveEffect(actor, restored);
  }
}

async function deleteResolutionDamage(messageIds = []) {
  for (const id of messageIds) {
    const message = game.messages?.get(id);
    if (message?.canUserModify?.(game.user, "delete")) await message.delete();
  }
}

async function processToolbeltSave({ message, target, data } = {}, { reroll = false } = {}) {
  // Toolbelt emits its hooks on every connected client. Only one GM may mutate
  // the affliction, otherwise a single failure advances once per connected user.
  if (!isAuthoritativeGM()) return;
  const affliction = message?.getFlag?.(MODULE_ID, FLAG_KEY);
  if (!affliction || !target?.actor || data?.success == null) return;
  const key = resolutionKey(message, target);
  const previous = resolutionHistory.get(key);
  // Some Toolbelt workflows emit the ordinary result hook more than once.
  if (previous && !reroll) return;
  const snapshot = previous?.snapshot ?? foundry.utils.deepClone(target.actor.getFlag(MODULE_ID, ACTIVE_FLAG_KEY) ?? null);
  if (reroll && previous) {
    await deleteResolutionDamage(previous.damageMessageIds);
    await restoreResolutionSnapshot(target.actor, snapshot);
  }
  const result = await resolveSave(affliction, target.actor, toolbeltOutcomeIndex(data.success));
  resolutionHistory.set(key, { snapshot, damageMessageIds: result.damageMessageIds });
}

function enqueueToolbeltSave(payload, options = {}) {
  const key = resolutionKey(payload?.message, payload?.target);
  const previous = resolutionQueues.get(key) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => processToolbeltSave(payload, options))
    .catch((error) => console.error(`${MODULE_ID} | Affliction save processing failed`, error));
  resolutionQueues.set(key, current);
  void current.finally(() => {
    if (resolutionQueues.get(key) === current) resolutionQueues.delete(key);
  });
}

async function promptNextSave(actor, active) {
  if (!isAuthoritativeGM()) return;
  const check = `@Check[${active.config.save}|dc:${active.config.dc}]{Спасбросок}`;
  const source = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<span>${escapeHtml(active.config.name)} — конец хода</span>`,
    content: `<p>${check}</p>`,
    flags: { [MODULE_ID]: { [FLAG_KEY]: { config: active.config, actorUuid: actor.uuid, mode: "stage" } } },
  };
  await createCheckMessageForActor(source, actor);
}

if (!globalThis.__tsuAfflictionHooksRegistered) {
  globalThis.__tsuAfflictionHooksRegistered = true;

  Hooks.on("pf2e-toolbelt.rollSave", ({ message, target, data } = {}) => {
    enqueueToolbeltSave({ message, target, data });
  });

  Hooks.on("pf2e-toolbelt.rerollSave", ({ message, target, data } = {}) => {
    enqueueToolbeltSave({ message, target, data }, { reroll: true });
  });

  // Deleting the visible managed effect also ends the tracked affliction.
  Hooks.on("deleteItem", (item) => {
    if (!isAuthoritativeGM() || !item?.getFlag?.(MODULE_ID, ACTIVE_FLAG_KEY)) return;
    const actor = item.parent;
    if (actor?.documentName === "Actor") void actor.unsetFlag(MODULE_ID, ACTIVE_FLAG_KEY);
  });

// A saved definition remains an ordinary PF2e effect. Its sheet gets a small
// launcher, so it can be reused without recreating the configuration.
  Hooks.on("renderItemSheet", (app, html) => {
    const item = app?.item ?? app?.document;
    const config = item?.getFlag?.(MODULE_ID, FLAG_KEY);
    const root = html?.[0] ?? html;
    if (!config || !root?.querySelector || root.querySelector("[data-tsu-affliction-launch]")) return;
    const header = root.querySelector(".window-header") ?? root.querySelector("header");
    if (!header) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-control";
    button.dataset.tsuAfflictionLaunch = "true";
    button.innerHTML = '<i class="fas fa-comment-medical"></i>';
    button.title = "Спас недуга в чат";
    button.addEventListener("click", () => void postInitialSave(normalizeConfig(config)));
    header.append(button);
  });

  Hooks.on("updateCombat", (combat, change) => {
    if (!isAuthoritativeGM()) return;
    if (!("turn" in change || "round" in change)) return;
    const combatants = [...(combat.combatants ?? [])];
    if (!combatants.length) return;
    // The update has already advanced to the next combatant, so the preceding
    // entry is the creature whose turn has just ended.
    const currentIndex = Math.max(0, Number(combat.turn) || 0);
    const actor = combatants[(currentIndex - 1 + combatants.length) % combatants.length]?.actor;
    const savedActive = actor?.getFlag(MODULE_ID, ACTIVE_FLAG_KEY);
    if (!savedActive) return;
    const active = foundry.utils.deepClone(savedActive);
    active.config = normalizeConfig(active.config);
    active.stage = Math.min(
      Math.max(1, active.config.stages.length),
      Math.max(0, Math.trunc(Number(active.stage) || 0)),
    );
    const key = `${combat.round}:${combat.turn}`;
    if (active.lastPromptCombat === key) return;
    active.lastPromptCombat = key;
    if (active.onsetRemaining > 0) {
      active.onsetRemaining -= 1;
      // The onset itself has no recovery check. The check appears only when it ends.
      if (active.onsetRemaining > 0) return void actor.setFlag(MODULE_ID, ACTIVE_FLAG_KEY, active).then(() => syncActiveEffect(actor, active));
    }
    void actor.setFlag(MODULE_ID, ACTIVE_FLAG_KEY, active).then(async () => { await syncActiveEffect(actor, active); return promptNextSave(actor, active); });
  });
}

export function openAfflictionDialog(initial = {}) {
  void repairAfflictionMacros();
  let dialog;
  dialog = new Dialog({ title: "Недуги", content: dialogContent(normalizeConfig(initial)), buttons: {
    chat: { label: "Спас в чат", icon: '<i class="fas fa-comment"></i>', requiresTarget: true, callback: (html) => void postInitialSave(readDialog(html[0] ?? html), actorForPost()) },
    macro: { label: "Сохранить макрос", icon: '<i class="fas fa-code"></i>', callback: (html) => saveAfflictionMacro(readDialog(html[0] ?? html)) },
  }, default: "chat", render: (html) => {
    const root = html[0] ?? html; const form = root.querySelector("#tsu-affliction");
    form.querySelector("[data-action='parse']")?.addEventListener("click", () => { const parsed = parsePoisonDescription(form.querySelector("[name='description']").value); const name = form.querySelector("[name='name']")?.value; applyConfigToForm(form, { ...parsed, name, description: form.querySelector("[name='description']").value }); });
    form.querySelector("[data-action='add-stage']")?.addEventListener("click", () => { form.querySelector("[data-stages]").insertAdjacentHTML("beforeend", stageRow(form.querySelectorAll("[name='stage']").length)); void updateStagePreviews(form); });
    form.querySelector("[data-stages]")?.addEventListener("click", (event) => { const button = event.target.closest("[data-action='remove-stage']"); if (button && form.querySelectorAll("[name='stage']").length > 1) button.closest(".stage")?.remove(); });
    form.querySelector("[data-stages]")?.addEventListener("input", (event) => { const row = event.target.closest?.(".stage"); if (row) void updateStagePreview(row); });
    const dropZone = form.querySelector("[data-drop-zone]");
    dropZone?.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("is-dragover"); });
    dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("is-dragover"));
    dropZone?.addEventListener("drop", async (event) => {
      event.preventDefault(); dropZone.classList.remove("is-dragover");
      const item = await getDroppedItem(event);
      if (!item) return ui.notifications.warn("Не удалось прочитать перетащенный предмет.");
      const saved = item.getFlag?.(MODULE_ID, FLAG_KEY);
      const description = String(item.system?.description?.value ?? "");
      applyConfigToForm(form, saved ? saved : { ...parsePoisonDescription(description), name: item.name, description });
      if (!saved) ui.notifications.info(`Яд «${item.name}» распознан из описания. При необходимости поправьте поля вручную.`);
    });
    void updateStagePreviews(form);
  } }, { width: 640 });
  // Dialog V1 closes unconditionally after every callback, so validate here,
  // before its submit implementation is allowed to close the window.
  const submit = dialog.submit;
  dialog.submit = function(button, event) {
    if (button?.requiresTarget && !actorForPost()) {
      ui.notifications.warn("Выберите токен в целях перед отправкой спаса недуга.");
      return;
    }
    return submit.call(this, button, event);
  };
  dialog.render(true); return dialog;
}

export async function postSavedAffliction(config, actor = actorForPost()) {
  return postInitialSave(normalizeConfig(config), actor);
}
