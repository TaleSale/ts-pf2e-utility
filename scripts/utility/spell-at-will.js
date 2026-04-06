import { MODULE_ID } from "../core.js";

const FLAG_KEY = "spellMods";
const SETTING_ENABLE = "enableSpellAtWill";
const TAG_SEPARATOR = " / ";
const MOD_TAGS = Object.freeze([
  { key: "atWill", labels: { en: "At Will", ru: "\u041f\u043e \u0436\u0435\u043b\u0430\u043d\u0438\u044e" }, row: "counteraction" },
  { key: "constant", labels: { en: "Constant", ru: "\u041f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u043e" }, row: "counteraction" },
  { key: "self", labels: { en: "Self", ru: "\u041d\u0430 \u0441\u0435\u0431\u044f" }, row: "ritual" },
]);

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCyrillic(value) {
  return /[\u0400-\u04FF]/.test(value);
}

function getPrimaryName(name) {
  return String(name ?? "").split(TAG_SEPARATOR)[0]?.trim() ?? "";
}

function getTagAliases(tag) {
  return Array.from(new Set([tag.labels.en, tag.labels.ru]));
}

function getTagDisplayLabel(tag) {
  return game.i18n?.lang === "ru" ? tag.labels.ru : tag.labels.en;
}

function getTagNameLabel(tag, itemName) {
  return hasCyrillic(getPrimaryName(itemName)) ? tag.labels.ru : tag.labels.en;
}

function collectActiveLabels(flags, itemName) {
  return MOD_TAGS
    .filter((tag) => Boolean(flags?.[tag.key]))
    .map((tag) => getTagNameLabel(tag, itemName));
}

function stripKnownTags(name) {
  let cleanName = String(name ?? "");

  for (const tag of MOD_TAGS) {
    for (const alias of getTagAliases(tag)) {
      const label = escapeRegExp(alias);
      cleanName = cleanName
        .replace(new RegExp(`\\s*,\\s*${label}(?=\\s*\\))`, "gi"), "")
        .replace(new RegExp(`\\(\\s*${label}\\s*\\)`, "gi"), "")
        .replace(new RegExp(`\\s*\\(${label},\\s*`, "gi"), " (")
        .replace(new RegExp(`\\s*,\\s*${label}\\s*`, "gi"), ", ");
    }
  }

  return cleanName
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*,/g, ", ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function appendLabelsToPrimaryName(name, activeLabels) {
  if (!activeLabels.length) return stripKnownTags(name);

  const cleanName = stripKnownTags(name);
  const [primaryName, ...rest] = cleanName.split(TAG_SEPARATOR);
  const secondaryName = rest.join(TAG_SEPARATOR).trim();
  const labelsText = activeLabels.join(", ");
  let nextPrimary = primaryName.trim();

  if (nextPrimary.endsWith(")")) {
    const lastOpenParenIndex = nextPrimary.lastIndexOf("(");
    if (lastOpenParenIndex >= 0) {
      const prefix = nextPrimary.slice(0, lastOpenParenIndex);
      const existing = nextPrimary.slice(lastOpenParenIndex + 1, -1).trim();
      nextPrimary = existing ? `${prefix}(${existing}, ${labelsText})` : `${prefix}(${labelsText})`;
    } else {
      nextPrimary = `${nextPrimary} (${labelsText})`;
    }
  } else {
    nextPrimary = `${nextPrimary} (${labelsText})`;
  }

  return secondaryName ? `${nextPrimary}${TAG_SEPARATOR}${secondaryName}` : nextPrimary;
}

function getCurrentFlags(item) {
  return foundry.utils.deepClone(item.getFlag(MODULE_ID, FLAG_KEY) ?? {});
}

function getSpellItem(app) {
  const item = app?.document ?? app?.item ?? null;
  return item?.type === "spell" ? item : null;
}

function isInnateSpell(item) {
  const spellcasting = item?.spellcasting;
  return Boolean(spellcasting?.isInnate || spellcasting?.system?.prepared?.value === "innate" || spellcasting?.system?.type === "innate");
}

function shouldForceInnateUses(flags) {
  return Boolean(flags?.atWill || flags?.constant);
}

async function rerenderOpenSpellSheets() {
  for (const app of foundry.applications.instances.values()) {
    if (app?.document?.type !== "spell") continue;
    await app.render();
  }

  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.document?.type !== "spell") continue;
    app.render(false);
  }
}

function buildTagControls(tag, checked) {
  const text = document.createElement("span");
  text.className = "tsu-spell-mod-text";
  text.textContent = getTagDisplayLabel(tag);
  text.title = getTagDisplayLabel(tag);

  const input = document.createElement("input");
  input.className = "tsu-spell-mod-input";
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.key = tag.key;
  input.ariaLabel = getTagDisplayLabel(tag);

  return [text, input];
}

function configureRow(group, rowKey, input, controls) {
  const label = Array.from(group.children).find((child) => child instanceof HTMLLabelElement);
  if (!(label instanceof HTMLLabelElement)) return;

  group.classList.add("tsu-spell-mod-row", `tsu-spell-mod-row--${rowKey}`);

  for (const child of Array.from(group.children)) {
    if (child !== label) child.remove();
  }

  const fields = document.createElement("div");
  fields.className = "tsu-spell-mod-fields";
  input.classList.add("tsu-spell-mod-input", "tsu-spell-mod-input--native");
  fields.append(input, ...controls);

  group.append(fields);
}

async function migrateFlagsFromName(item) {
  const flags = getCurrentFlags(item);
  let changed = false;

  for (const tag of MOD_TAGS) {
    if (flags[tag.key] !== undefined) continue;
    const hasTagInName = getTagAliases(tag).some((label) => new RegExp(escapeRegExp(label), "i").test(item.name));
    if (!hasTagInName) continue;
    flags[tag.key] = true;
    changed = true;
  }

  if (!changed) return false;
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: flags });
  return true;
}

async function normalizeInnateUses(item, flags) {
  if (!isInnateSpell(item) || !shouldForceInnateUses(flags)) return false;

  const uses = item.system.location?.uses ?? {};
  if (uses.value === 99 && uses.max === 99) return false;

  await item.update({ "system.location.uses": { value: 99, max: 99 } });
  return true;
}

async function onCheckboxChange(item, input) {
  const flags = getCurrentFlags(item);
  flags[input.dataset.key] = input.checked;

  const activeLabels = collectActiveLabels(flags, item.name);
  const updateData = {
    name: appendLabelsToPrimaryName(item.name, activeLabels),
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: flags,
  };

  if (isInnateSpell(item) && shouldForceInnateUses(flags)) {
    updateData["system.location.uses"] = { value: 99, max: 99 };
  }

  await item.update(updateData);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: "Enable spell tags",
    hint: "Adds At Will, Constant, and Self toggles to the PF2E spell sheet.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      void rerenderOpenSpellSheets();
    },
  });
});

Hooks.on("renderSpellSheetPF2e", async (app, element) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;

  const item = getSpellItem(app);
  if (!item) return;

  if (await migrateFlagsFromName(item)) return;

  const flags = getCurrentFlags(item);
  if (await normalizeInnateUses(item, flags)) return;

  const root = getElement(element);
  if (!root || root.querySelector(".tsu-spell-mod-table")) return;

  const counteractionInput = root.querySelector('input[name="system.counteraction"]');
  const ritualToggle = root.querySelector('input[data-action="toggle-ritual-data"]');
  const counteractionGroup = counteractionInput?.closest(".form-group");
  const ritualGroup = ritualToggle?.closest(".form-group");

  if (!(counteractionGroup instanceof HTMLElement) || !(ritualGroup instanceof HTMLElement)) return;

  const layout = document.createElement("div");
  layout.className = "tsu-spell-mod-table";
  counteractionGroup.before(layout);
  layout.append(counteractionGroup, ritualGroup);

  const rowGroups = {
    counteraction: { group: counteractionGroup, input: counteractionInput },
    ritual: { group: ritualGroup, input: ritualToggle },
  };

  for (const [rowKey, rowData] of Object.entries(rowGroups)) {
    if (!(rowData.input instanceof HTMLInputElement)) continue;
    const controls = [];
    for (const tag of MOD_TAGS.filter((entry) => entry.row === rowKey)) {
      const checked = Boolean(flags[tag.key] || getTagAliases(tag).some((label) => new RegExp(escapeRegExp(label), "i").test(item.name)));
      const [text, checkbox] = buildTagControls(tag, checked);
      checkbox.addEventListener("change", (event) => {
        void onCheckboxChange(item, event.currentTarget);
      });
      controls.push(text, checkbox);
    }

    configureRow(rowData.group, rowKey, rowData.input, controls);
  }
});

Hooks.on("preUpdateItem", (item, changes) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  if (item.type !== "spell" || typeof changes.name !== "string") return;

  const flags = item.getFlag(MODULE_ID, FLAG_KEY);
  const activeLabels = collectActiveLabels(flags, changes.name ?? item.name);
  if (!activeLabels.length) return;

  changes.name = appendLabelsToPrimaryName(changes.name, activeLabels);
});
