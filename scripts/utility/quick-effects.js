const MODULE_ID = "ts-pf2e-utility";
const CONDITION_PACK_ID = "pf2e.conditionitems";
const QUICK_EFFECTS_FOLDER_NAME = "Быстрые Эффекты";

const MODIFIER_TYPES = [
  { value: "circumstance", label: "Обстоятельства" },
  { value: "status", label: "Состояния" },
  { value: "item", label: "Предмета" },
  { value: "untyped", label: "Без типа" },
];

const NUMBER_VALUES = [1, 2, 3, 4, 5];
const SPEED_VALUES = [5, 10, 15, 20, 25, 30];

const SPEED_OPTIONS = [
  { value: "land", label: "Наземная", selector: "land-speed" },
  { value: "swim", label: "Плавание", selector: "swim-speed" },
  { value: "climb", label: "Карабканье", selector: "climb-speed" },
  { value: "fly", label: "Полёт", selector: "fly-speed" },
  { value: "burrow", label: "Рытьё", selector: "burrow-speed" },
  { value: "all", label: "Все", selector: "speed" },
];

const SAVE_OPTIONS = [
  { value: "reflex", label: "РФЛ", selectors: ["reflex"] },
  { value: "fortitude", label: "СТК", selectors: ["fortitude"] },
  { value: "will", label: "ВОЛ", selectors: ["will"] },
  { value: "reflex+fortitude", label: "РФЛ+СТК", selectors: ["reflex", "fortitude"] },
  { value: "reflex+will", label: "РФЛ+ВОЛ", selectors: ["reflex", "will"] },
  { value: "fortitude+will", label: "СТК+ВОЛ", selectors: ["fortitude", "will"] },
  { value: "all", label: "Все", selectors: ["reflex", "fortitude", "will"] },
];

const SKILL_OPTIONS = [
  { value: "acrobatics", label: "Акробатика" },
  { value: "arcana", label: "Аркана" },
  { value: "athletics", label: "Атлетика" },
  { value: "crafting", label: "Ремесло" },
  { value: "deception", label: "Обман" },
  { value: "diplomacy", label: "Дипломатия" },
  { value: "intimidation", label: "Запугивание" },
  { value: "medicine", label: "Медицина" },
  { value: "nature", label: "Природа" },
  { value: "occultism", label: "Оккультизм" },
  { value: "performance", label: "Выступление" },
  { value: "religion", label: "Религия" },
  { value: "society", label: "Общество" },
  { value: "stealth", label: "Скрытность" },
  { value: "survival", label: "Выживание" },
  { value: "thievery", label: "Воровство" },
];

const CONDITION_OPTIONS = [
  { label: "Застигнут врасплох", itemId: "AJh5ex99aV6VTggg" },
  { label: "Ослаблен", itemId: "MIRkyAjyBeXivMa7", valued: true },
  { label: "Неуклюж", itemId: "i3OJZU2nk64Df3xm", valued: true },
  { label: "Одурманен", itemId: "e1XGnhKNSQIm5IXg", valued: true },
  { label: "Замедлен", itemId: "xYTAsEpcJE1Ccni3", valued: true },
  { label: "Ошеломлен", itemId: "dfCMdR4wnpbYNTix", valued: true },
  { label: "Тошнота", itemId: "fesd1n5eVhpCSS18", valued: true },
  { label: "Скрыт", itemId: "DmAIPqOBomZ7H95W" },
  { label: "Спрятан", itemId: "iU0fEDdBp3rXpTMC" },
  { label: "Ослеплен", itemId: "TkIyaNPgTZFBCCuh" },
  { label: "Слепота", itemId: "XgEqL1kFApUbl5Z2" },
  { label: "Глухота", itemId: "9PR9y0bi4JPKnHPR" },
  { label: "Заворожен", itemId: "AdPVz7rbaVSRxHFg" },
  { label: "Замешательство", itemId: "yblD8fOR1J8rDwEQ" },
  { label: "Под контролем", itemId: "9qGBRpbX9NEwtAAr" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function optionHtml(options, selected = "") {
  return options
    .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
}

function numberOptionHtml(values, selected = values[0]) {
  return values
    .map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`)
    .join("");
}

function signedValue(sign, value) {
  const numeric = Number(value) || 0;
  return sign === "-" ? -numeric : numeric;
}

function formatSigned(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function getSelectedTokens() {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) ui.notifications?.warn("Выберите хотя бы один токен.");
  return tokens;
}

function getSkillSummary(selectedSkills) {
  if (selectedSkills.size === 0) return "Выбрать навыки";
  if (selectedSkills.size === SKILL_OPTIONS.length) return "Все навыки";
  if (selectedSkills.size <= 2) {
    return SKILL_OPTIONS.filter((skill) => selectedSkills.has(skill.value)).map((skill) => skill.label).join(", ");
  }
  return `Выбрано: ${selectedSkills.size}`;
}

function createModifierRule({ label, selector, selectors, value, type, slug }) {
  const rule = {
    key: "FlatModifier",
    label,
    selector: selectors ?? selector,
    slug,
    value,
  };
  if (type && type !== "untyped") rule.type = type;
  return rule;
}

function createGrantConditionRule(condition) {
  const rule = {
    key: "GrantItem",
    uuid: `Compendium.${CONDITION_PACK_ID}.Item.${condition.itemId}`,
    onDeleteActions: { grantee: "restrict" },
  };
  if (condition.value) {
    rule.alterations = [{
      mode: "override",
      property: "badge-value",
      value: condition.value,
    }];
  }
  return rule;
}

function buildDuration(type, root) {
  if (type === "rounds") {
    return {
      unit: "rounds",
      value: Number(root.querySelector("[name='duration-rounds']")?.value) || 1,
      expiry: "turn-end",
    };
  }
  if (type === "minutes") {
    return {
      unit: "minutes",
      value: Number(root.querySelector("[name='duration-minutes']")?.value) || 1,
      expiry: "turn-end",
    };
  }
  if (type === "turnEnd") return { unit: "rounds", value: 0, expiry: "turn-end" };
  if (type === "nextTurnStart") return { unit: "rounds", value: 1, expiry: "turn-start" };
  if (type === "nextTurnEnd") return { unit: "rounds", value: 1, expiry: "turn-end" };
  return { unit: "unlimited", value: -1, expiry: null };
}

function getDurationLabel(duration) {
  if (duration.unit === "unlimited") return "без ограничения";
  if (duration.unit === "minutes") return `${duration.value} мин.`;
  if (duration.unit === "rounds" && duration.value === 0 && duration.expiry === "turn-end") return "до конца текущего хода";
  if (duration.unit === "rounds" && duration.value === 1 && duration.expiry === "turn-start") return "до начала следующего хода цели";
  if (duration.unit === "rounds" && duration.value === 1 && duration.expiry === "turn-end") return "до конца следующего хода цели";
  if (duration.unit === "rounds") return `${duration.value} раунд(ов)`;
  return "на выбранную длительность";
}

function buildContent(selectedSkills) {
  const conditionRows = CONDITION_OPTIONS.map((condition) => `
    <label class="tsu-qe-row tsu-qe-row--condition">
      <input type="checkbox" name="condition" value="${escapeHtml(condition.itemId)}">
      <span>${escapeHtml(condition.label)}</span>
      ${condition.valued ? `<select name="condition-value-${escapeHtml(condition.itemId)}">${numberOptionHtml(NUMBER_VALUES)}</select>` : ""}
    </label>
  `).join("");

  return `
    <style>
      #tsu-quick-effects { font-size: 12px; }
      #tsu-quick-effects .tsu-qe-grid { display: grid; grid-template-columns: minmax(360px, 1.25fr) minmax(250px, 0.75fr); gap: 12px; align-items: start; }
      #tsu-quick-effects .tsu-qe-panel { border: 1px solid var(--color-border-light-primary); border-radius: 6px; padding: 8px; background: rgba(0, 0, 0, 0.03); }
      #tsu-quick-effects .tsu-qe-heading { margin: 0 0 7px; font-weight: 700; }
      #tsu-quick-effects .tsu-qe-row { display: grid; grid-template-columns: 20px minmax(82px, 1fr) auto auto auto auto; gap: 6px; align-items: center; min-height: 28px; margin-bottom: 5px; }
      #tsu-quick-effects .tsu-qe-row--condition { grid-template-columns: 20px 1fr auto; }
      #tsu-quick-effects select, #tsu-quick-effects input[type="number"] { height: 26px; min-width: 46px; }
      #tsu-quick-effects .tsu-qe-skill-button { height: 26px; min-width: 122px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #tsu-quick-effects .tsu-qe-save-row { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--color-border-light-primary); }
      #tsu-quick-effects .tsu-qe-save-button { width: 100%; min-height: 30px; }
      #tsu-quick-effects .tsu-qe-duration { margin-top: 10px; border-top: 1px solid var(--color-border-light-primary); padding-top: 8px; }
      #tsu-quick-effects .tsu-qe-duration-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      #tsu-quick-effects .tsu-qe-duration-inline { display: grid; grid-template-columns: auto 58px 1fr; gap: 6px; align-items: center; }
      #tsu-quick-effects .tsu-qe-duration button { min-height: 28px; }
      .tsu-qe-skill-picker .tsu-qe-skill-actions { display: flex; gap: 6px; margin-bottom: 8px; }
      .tsu-qe-skill-picker .tsu-qe-skill-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 10px; }
      .tsu-qe-skill-picker label { display: flex; align-items: center; gap: 6px; min-height: 24px; }
    </style>
    <form id="tsu-quick-effects">
      <p>Выберите эффекты для выбранных токенов.</p>
      <div class="tsu-qe-grid">
        <section class="tsu-qe-panel">
          <h3 class="tsu-qe-heading">Модификаторы</h3>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-speed">
            <span>Скорость</span>
            <select name="speed-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="speed-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="speed-value">${numberOptionHtml(SPEED_VALUES, 5)}</select>
            <select name="speed-selector">${optionHtml(SPEED_OPTIONS, "land")}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-attack">
            <span>Атака</span>
            <select name="attack-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="attack-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="attack-value">${numberOptionHtml(NUMBER_VALUES)}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-damage">
            <span>Урон</span>
            <select name="damage-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="damage-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="damage-value">${numberOptionHtml(NUMBER_VALUES)}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-ac">
            <span>КБ</span>
            <select name="ac-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="ac-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="ac-value">${numberOptionHtml(NUMBER_VALUES)}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-saves">
            <span>Спасброски</span>
            <select name="saves-selector">${optionHtml(SAVE_OPTIONS)}</select>
            <select name="saves-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="saves-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="saves-value">${numberOptionHtml(NUMBER_VALUES)}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-skills">
            <span>Навыки</span>
            <button type="button" class="tsu-qe-skill-button" data-action="pick-skills">${escapeHtml(getSkillSummary(selectedSkills))}</button>
            <select name="skills-type">${optionHtml(MODIFIER_TYPES)}</select>
            <select name="skills-sign"><option value="+">+</option><option value="-">-</option></select>
            <select name="skills-value">${numberOptionHtml(NUMBER_VALUES)}</select>
          </label>
          <label class="tsu-qe-row">
            <input type="checkbox" name="mod-temphp">
            <span>Временное здоровье</span>
            <input type="number" name="temphp-value" min="1" step="1" value="1">
          </label>
          <div class="tsu-qe-save-row">
            <button type="button" class="tsu-qe-save-button" data-action="save-item">
              <i class="fas fa-save"></i> Сохранить как предмет
            </button>
          </div>
        </section>
        <section class="tsu-qe-panel">
          <h3 class="tsu-qe-heading">Состояния</h3>
          ${conditionRows}
        </section>
      </div>
      <section class="tsu-qe-duration">
        <h3 class="tsu-qe-heading">Длительность</h3>
        <div class="tsu-qe-duration-grid">
          <div class="tsu-qe-duration-inline">
            <span>Раунды</span>
            <select name="duration-rounds">${numberOptionHtml([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])}</select>
            <button type="button" data-action="apply" data-duration="rounds">Раунд(ы)</button>
          </div>
          <div class="tsu-qe-duration-inline">
            <span>Минуты</span>
            <select name="duration-minutes">${numberOptionHtml([1, 2, 3, 4, 5, 10])}</select>
            <button type="button" data-action="apply" data-duration="minutes">Минута(ы)</button>
          </div>
          <button type="button" data-action="apply" data-duration="turnEnd">До конца текущего хода</button>
          <button type="button" data-action="apply" data-duration="nextTurnStart">До начала следующего хода цели</button>
          <button type="button" data-action="apply" data-duration="nextTurnEnd">До конца следующего хода цели</button>
          <button type="button" data-action="apply" data-duration="unlimited">Без ограничения</button>
        </div>
      </section>
    </form>
  `;
}

function openSkillPicker(selectedSkills, onChange) {
  const skillRows = SKILL_OPTIONS.map((skill) => `
    <label>
      <input type="checkbox" name="skill" value="${escapeHtml(skill.value)}" ${selectedSkills.has(skill.value) ? "checked" : ""}>
      <span>${escapeHtml(skill.label)}</span>
    </label>
  `).join("");

  let dialog;
  dialog = new Dialog({
    title: "Выбор навыков",
    content: `
      <form class="tsu-qe-skill-picker">
        <div class="tsu-qe-skill-actions">
          <button type="button" data-action="all">Все навыки</button>
          <button type="button" data-action="clear">Сбросить</button>
        </div>
        <div class="tsu-qe-skill-grid">${skillRows}</div>
      </form>
    `,
    buttons: {
      apply: {
        label: "Готово",
        callback: (html) => {
          const root = html[0] ?? html;
          selectedSkills.clear();
          for (const input of root.querySelectorAll("input[name='skill']:checked")) selectedSkills.add(input.value);
          onChange();
        },
      },
    },
    render: (html) => {
      const root = html[0] ?? html;
      root.querySelector("[data-action='all']")?.addEventListener("click", () => {
        for (const input of root.querySelectorAll("input[name='skill']")) input.checked = true;
      });
      root.querySelector("[data-action='clear']")?.addEventListener("click", () => {
        for (const input of root.querySelectorAll("input[name='skill']")) input.checked = false;
      });
    },
    default: "apply",
  });
  dialog.render(true);
}

function collectSelections(root, selectedSkills) {
  const rules = [];
  const names = [];

  if (root.querySelector("[name='mod-speed']")?.checked) {
    const option = SPEED_OPTIONS.find((speed) => speed.value === root.querySelector("[name='speed-selector']")?.value) ?? SPEED_OPTIONS[0];
    const value = signedValue(root.querySelector("[name='speed-sign']")?.value, root.querySelector("[name='speed-value']")?.value);
    rules.push(createModifierRule({
      label: `Скорость ${formatSigned(value)} (${option.label})`,
      selector: option.selector,
      value,
      type: root.querySelector("[name='speed-type']")?.value,
      slug: `tsu-quick-speed-${option.value}-${value}`,
    }));
    names.push(`Скорость ${formatSigned(value)}`);
  }

  for (const row of [
    { key: "attack", name: "Атака", selector: "attack-roll" },
    { key: "damage", name: "Урон", selector: "damage" },
    { key: "ac", name: "КБ", selector: "ac" },
  ]) {
    if (!root.querySelector(`[name='mod-${row.key}']`)?.checked) continue;
    const value = signedValue(root.querySelector(`[name='${row.key}-sign']`)?.value, root.querySelector(`[name='${row.key}-value']`)?.value);
    rules.push(createModifierRule({
      label: `${row.name} ${formatSigned(value)}`,
      selector: row.selector,
      value,
      type: root.querySelector(`[name='${row.key}-type']`)?.value,
      slug: `tsu-quick-${row.key}-${value}`,
    }));
    names.push(`${row.name} ${formatSigned(value)}`);
  }

  if (root.querySelector("[name='mod-saves']")?.checked) {
    const selected = SAVE_OPTIONS.find((save) => save.value === root.querySelector("[name='saves-selector']")?.value) ?? SAVE_OPTIONS[0];
    const value = signedValue(root.querySelector("[name='saves-sign']")?.value, root.querySelector("[name='saves-value']")?.value);
    rules.push(createModifierRule({
      label: `Спасброски ${formatSigned(value)} (${selected.label})`,
      selectors: selected.selectors,
      value,
      type: root.querySelector("[name='saves-type']")?.value,
      slug: `tsu-quick-saves-${selected.value}-${value}`,
    }));
    names.push(`Спасброски ${formatSigned(value)}`);
  }

  if (root.querySelector("[name='mod-skills']")?.checked) {
    if (!selectedSkills.size) {
      throw new Error("Выберите хотя бы один навык для строки «Навыки».");
    }
    const value = signedValue(root.querySelector("[name='skills-sign']")?.value, root.querySelector("[name='skills-value']")?.value);
    const skillLabels = SKILL_OPTIONS.filter((skill) => selectedSkills.has(skill.value)).map((skill) => skill.label);
    rules.push(createModifierRule({
      label: `Навыки ${formatSigned(value)} (${skillLabels.join(", ")})`,
      selectors: Array.from(selectedSkills),
      value,
      type: root.querySelector("[name='skills-type']")?.value,
      slug: `tsu-quick-skills-${value}`,
    }));
    names.push(`Навыки ${formatSigned(value)}`);
  }

  if (root.querySelector("[name='mod-temphp']")?.checked) {
    const value = Math.max(1, Number(root.querySelector("[name='temphp-value']")?.value) || 1);
    rules.push({ key: "TempHP", value, priority: 50 });
    names.push(`Временное здоровье ${value}`);
  }

  for (const input of root.querySelectorAll("input[name='condition']:checked")) {
    const condition = CONDITION_OPTIONS.find((option) => option.itemId === input.value);
    if (!condition) continue;
    const value = condition.valued
      ? Math.max(1, Number(root.querySelector(`[name='condition-value-${condition.itemId}']`)?.value) || 1)
      : null;
    rules.push(createGrantConditionRule({ ...condition, value }));
    names.push(value ? `${condition.label} ${value}` : condition.label);
  }

  return { rules, names };
}

async function getOrCreateQuickEffectsFolder() {
  const folders = Array.from(game.folders?.contents ?? game.folders ?? []);
  const existing = folders.find((folder) => folder.type === "Item" && folder.name === QUICK_EFFECTS_FOLDER_NAME);
  if (existing) return existing;

  return Folder.create({
    name: QUICK_EFFECTS_FOLDER_NAME,
    type: "Item",
    parent: null,
  });
}

async function saveQuickEffectItem(effectData) {
  const folder = await getOrCreateQuickEffectsFolder();
  const itemData = foundry.utils.deepClone(effectData);
  itemData.folder = folder.id;
  const [created] = await Item.createDocuments([itemData], { renderSheet: false });
  return created;
}

function buildQuickEffectData(root, selectedSkills, duration) {
  let selections;
  try {
    selections = collectSelections(root, selectedSkills);
  } catch (error) {
    ui.notifications?.warn(error.message);
    return null;
  }

  if (!selections.rules.length) {
    ui.notifications?.warn("Выберите хотя бы один эффект.");
    return null;
  }

  return {
    name: `Быстрый эффект: ${selections.names.join(", ")}`,
    type: "effect",
    img: "systems/pf2e/icons/default-icons/effect.svg",
    system: {
      duration,
      rules: selections.rules,
    },
    flags: {
      [MODULE_ID]: {
        quickEffect: true,
      },
    },
  };
}

async function saveQuickEffectFromDialog(root, selectedSkills) {
  const duration = buildDuration("rounds", root);
  const effectData = buildQuickEffectData(root, selectedSkills, duration);
  if (!effectData) return false;

  try {
    const savedItem = await saveQuickEffectItem(effectData);
    ui.notifications?.info(`Предмет "${savedItem.name}" сохранён в папку "${QUICK_EFFECTS_FOLDER_NAME}".`);
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to save quick effect item`, error);
    ui.notifications?.error("Не удалось сохранить быстрый эффект как предмет. Подробности в консоли.");
    return false;
  }
}

async function applyQuickEffects(root, selectedSkills, duration) {
  const effectData = buildQuickEffectData(root, selectedSkills, duration);
  if (!effectData) return false;

  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) {
    getSelectedTokens();
    return false;
  }

  let applied = 0;
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) {
      ui.notifications?.warn(`Токен "${token.name}" не связан с актёром.`);
      continue;
    }
    await actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(effectData)]);
    applied += 1;
  }

  ui.notifications?.info(`Быстрый эффект применён: ${applied}. Длительность: ${getDurationLabel(duration)}.`);
  return true;
}

export async function openQuickEffectsDialog() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n?.localize("TS_PF2E_UTILITY.Notifications.OnlyGM") ?? "Только мастер может использовать этот инструмент.");
    return;
  }

  const pack = game.packs?.get(CONDITION_PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Compendium ${CONDITION_PACK_ID} не найден.`);
    return;
  }

  const selectedSkills = new Set();
  let dialog;
  const refreshSkillButton = () => {
    const root = dialog?.element?.[0] ?? dialog?.element;
    const button = root?.querySelector("[data-action='pick-skills']");
    if (button) button.textContent = getSkillSummary(selectedSkills);
  };

  dialog = new Dialog({
    title: "Быстрые эффекты",
    content: buildContent(selectedSkills),
    buttons: {
      cancel: {
        label: "Отмена",
      },
    },
    render: (html) => {
      const root = html[0] ?? html;
      root.closest(".app")?.style.setProperty("min-width", "760px");
      root.querySelector("[data-action='pick-skills']")?.addEventListener("click", () => {
        openSkillPicker(selectedSkills, refreshSkillButton);
      });
      root.querySelector("[data-action='save-item']")?.addEventListener("click", async () => {
        const saved = await saveQuickEffectFromDialog(root, selectedSkills);
        if (saved) dialog.close();
      });
      for (const button of root.querySelectorAll("[data-action='apply']")) {
        button.addEventListener("click", async () => {
          const duration = buildDuration(button.dataset.duration, root);
          const completed = await applyQuickEffects(root, selectedSkills, duration);
          if (completed) dialog.close();
        });
      }
    },
    default: "cancel",
  }, {
    width: 800,
    resizable: true,
  });
  dialog.render(true);
}
