const MODULE_ID = "ts-pf2e-utility";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localizedEntries(record = {}) {
  return Object.entries(record)
    .map(([value, label]) => ({ value, label: game.i18n.localize(label) }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

function splitValues(value) {
  return Array.from(new Set(String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean)));
}

function getTraitEntries() {
  const choices = new Map();
  for (const source of [
    CONFIG.PF2E?.actionTraits,
    CONFIG.PF2E?.weaponTraits,
    CONFIG.PF2E?.spellTraits,
  ]) {
    for (const { value, label } of localizedEntries(source)) choices.set(value, label);
  }
  return Array.from(choices, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

function selectedSummary(values, choices, emptyLabel) {
  const selected = splitValues(values);
  if (!selected.length) return emptyLabel;
  const labels = new Map(choices.map(({ value, label }) => [value, label]));
  if (selected.length <= 2) return selected.map((value) => labels.get(value) ?? value).join(", ");
  return `Выбрано: ${selected.length}`;
}

function openCheckboxPicker({ title, choices, selected, multiple = true, onApply }) {
  const selectedSet = new Set(selected);
  const rows = choices.map(({ value, label }) => `
    <label class="tsu-damage-picker-row" data-search="${escapeHtml(`${label} ${value}`.toLocaleLowerCase())}">
      <input type="checkbox" name="choice" value="${escapeHtml(value)}" ${selectedSet.has(value) ? "checked" : ""}>
      <span>${escapeHtml(label)}</span>
    </label>
  `).join("");
  let dialog;
  dialog = new Dialog({
    title,
    content: `
      <style>
        .tsu-damage-picker { display:grid; gap:7px; }
        .tsu-damage-picker-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px 10px; max-height:460px; overflow:auto; }
        .tsu-damage-picker-row { display:flex; align-items:center; gap:7px; min-height:25px; padding:2px 4px; border-bottom:1px solid rgba(0,0,0,.08); }
        .tsu-damage-picker-row input { flex:0 0 auto; }
      </style>
      <form class="tsu-damage-picker">
        <input type="search" name="search" placeholder="Поиск…" autocomplete="off">
        <div class="tsu-damage-picker-list">${rows}</div>
      </form>
    `,
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Готово",
        callback: (html) => {
          const root = html[0] ?? html;
          onApply(Array.from(root.querySelectorAll('[name="choice"]:checked'), (input) => input.value));
        },
      },
    },
    default: "apply",
    render: (html) => {
      const root = html[0] ?? html;
      root.querySelector('[name="search"]')?.addEventListener("input", (event) => {
        const search = String(event.currentTarget.value ?? "").trim().toLocaleLowerCase();
        for (const row of root.querySelectorAll(".tsu-damage-picker-row")) row.hidden = Boolean(search) && !row.dataset.search.includes(search);
      });
      if (!multiple) {
        for (const input of root.querySelectorAll('[name="choice"]')) input.addEventListener("change", () => {
          if (!input.checked) return;
          for (const other of root.querySelectorAll('[name="choice"]')) if (other !== input) other.checked = false;
        });
      }
    },
  }, { width: 520 });
  dialog.render(true);
}

function damageTypeOptions(selected = "bludgeoning") {
  return localizedEntries(CONFIG.PF2E?.damageTypes).map(({ value, label }) =>
    `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function additionalDamageRow() {
  return `
    <div class="tsu-damage-component tsu-damage-extra">
      <input name="formula" type="text" value="1d6" placeholder="Например: 1d6" autocomplete="off" aria-label="Формула дополнительного урона">
      <select name="damageType" aria-label="Тип дополнительного урона">${damageTypeOptions()}</select>
      <button type="button" class="tsu-damage-icon-button" data-action="remove-damage" data-tooltip="Удалить компонент урона"><i class="fas fa-minus"></i></button>
    </div>
  `;
}

function buildContent() {

  return `
    <style>
      #tsu-damage-dialog { display:grid; gap:10px; font-size:13px; }
      #tsu-damage-dialog .tsu-damage-main { display:grid; gap:6px; }
      #tsu-damage-dialog .tsu-damage-labels, #tsu-damage-dialog .tsu-damage-component { display:grid; grid-template-columns:minmax(160px,1fr) minmax(150px,1fr) 32px; gap:8px; align-items:center; }
      #tsu-damage-dialog .tsu-damage-labels { font-weight:600; }
      #tsu-damage-dialog .tsu-damage-field { display:grid; gap:4px; }
      #tsu-damage-dialog .tsu-damage-field > span { font-weight:600; }
      #tsu-damage-dialog input, #tsu-damage-dialog select { width:100%; }
      #tsu-damage-dialog .tsu-damage-picker-button { width:100%; min-height:32px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #tsu-damage-dialog .tsu-damage-icon-button { width:32px; min-width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; }
      #tsu-damage-dialog .tsu-damage-toggle { display:flex; gap:8px; align-items:center; min-height:32px; }
      #tsu-damage-dialog .tsu-damage-toggle input { width:auto; }
      #tsu-damage-dialog fieldset { border:1px solid var(--color-border-light-primary); border-radius:5px; padding:7px; margin:0; }
      #tsu-damage-dialog legend { font-weight:700; padding:0 5px; }
      #tsu-damage-dialog .hint { margin:2px 0 0; color:var(--color-text-subtle); font-size:11px; }
      #tsu-damage-dialog .tsu-damage-preview { padding:7px; border-radius:4px; background:rgba(0,0,0,.08); font-family:monospace; overflow-wrap:anywhere; }
    </style>
    <form id="tsu-damage-dialog">
      <div class="tsu-damage-main">
        <div class="tsu-damage-labels"><span>Формула урона</span><span>Тип урона</span><span></span></div>
        <div class="tsu-damage-component">
          <input name="formula" type="text" value="1d6" placeholder="Например: 2d6+3" autocomplete="off">
          <select name="damageType">${damageTypeOptions()}</select>
          <button type="button" class="tsu-damage-icon-button" data-action="add-damage" data-tooltip="Добавить тип урона"><i class="fas fa-plus"></i></button>
        </div>
        <div class="tsu-damage-extra-list"></div>
      </div>
      <label class="tsu-damage-toggle">
        <input name="persistent" type="checkbox">
        <span>Продолжительный урон</span>
      </label>
      <fieldset>
        <legend>Признаки</legend>
        <input name="traits" type="hidden" value="">
        <button type="button" class="tsu-damage-picker-button" data-action="pick-traits">Выбрать признаки</button>
        <p class="hint">Выбранные признаки будут переданы броску как roll options.</p>
      </fieldset>
      <fieldset>
        <legend>Материал урона</legend>
        <input name="materials" type="hidden" value="">
        <button type="button" class="tsu-damage-picker-button" data-action="pick-materials">Выбрать материал урона</button>
      </fieldset>
      <div class="tsu-damage-preview"></div>
    </form>
  `;
}

function readDamage(root) {
  const persistent = Boolean(root.querySelector('[name="persistent"]')?.checked);
  const materials = splitValues(root.querySelector('[name="materials"]')?.value);
  const traits = splitValues(root.querySelector('[name="traits"]')?.value);
  const components = Array.from(root.querySelectorAll(".tsu-damage-component")).map((row) => ({
    formula: String(row.querySelector('[name="formula"]')?.value ?? "").trim(),
    damageType: String(row.querySelector('[name="damageType"]')?.value ?? "untyped"),
  })).filter((component) => component.formula);
  const formula = components.map((component) => component.formula).join(" + ");
  const instances = components.map((component) => {
    const flavors = [component.damageType, persistent ? "persistent" : null, ...materials].filter(Boolean);
    return `(${component.formula})[${flavors.join(",")}]`;
  });
  const damageFormula = instances.length > 1 ? `{${instances.join(",")}}` : instances[0] ?? "";
  const options = traits.map((trait) => trait.includes(":") ? trait : `item:trait:${trait}`);
  const inline = `@Damage[${damageFormula}${options.length ? `|options:${options.join(",")}` : ""}]`;
  return { formula, damageFormula, options, inline };
}

function updatePreview(root) {
  const preview = root.querySelector(".tsu-damage-preview");
  if (preview) preview.textContent = readDamage(root).inline;
}

function normalizeDamageFormula(formula) {
  const value = String(formula ?? "").trim();
  if (!value || value.startsWith("{")) return value;
  const converted = value.replace(/\]\s*\+\s*(?=\()/g, "],");
  return converted.includes("],") ? `{${converted}}` : converted;
}

async function postDamage(root) {
  const data = readDamage(root);
  if (!data.formula) return ui.notifications?.warn("Введите формулу урона.");
  return postSavedDamage(data);
}

export async function postSavedDamage(data) {
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll");
  if (!DamageRoll) return ui.notifications?.error("PF2E DamageRoll недоступен.");

  try {
    const roll = await new DamageRoll(normalizeDamageFormula(data.damageFormula)).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null }),
      flags: {
        [MODULE_ID]: { quickDamage: true, traits: data.options },
        pf2e: { context: { type: "damage-roll", options: data.options } },
      },
    });
  } catch (error) {
    ui.notifications?.error(`Некорректная формула урона: ${data.formula}`);
    console.error(`${MODULE_ID} | Invalid quick damage formula`, error);
  }
}

async function saveDamageMacro(root) {
  const data = readDamage(root);
  if (!data.formula) return ui.notifications?.warn("Введите формулу урона.");

  const commandData = JSON.stringify({
    formula: data.formula,
    damageFormula: data.damageFormula,
    options: data.options,
  });
  const macro = await Macro.create({
    name: `Урон: ${data.formula}`,
    type: "script",
    img: "icons/svg/blood.svg",
    scope: "global",
    command: `const tool = await import(\`/modules/${MODULE_ID}/scripts/utility/damage.js?v=\${Date.now()}\`);\nawait tool.postSavedDamage(${commandData});`,
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  });
  if (macro) ui.notifications?.info(`Макрос «${macro.name}» сохранён.`);
}

async function copyDamage(root) {
  const data = readDamage(root);
  if (!data.formula) return ui.notifications?.warn("Введите формулу урона.");
  try {
    await navigator.clipboard.writeText(data.inline);
    ui.notifications?.info("Ссылка урона скопирована в буфер обмена.");
  } catch (error) {
    ui.notifications?.error("Не удалось скопировать ссылку урона.");
    console.error(`${MODULE_ID} | Failed to copy quick damage`, error);
  }
}

export function openDamageDialog() {
  let dialog;
  dialog = new Dialog({
    title: "Урон",
    content: buildContent(),
    buttons: {
      chat: { icon: '<i class="fas fa-comment"></i>', label: "В чат", callback: (html) => postDamage(html[0] ?? html) },
      copy: { icon: '<i class="fas fa-copy"></i>', label: "В буфер", callback: (html) => copyDamage(html[0] ?? html) },
      save: { icon: '<i class="fas fa-save" data-tooltip="Сохранить как макрос"></i>', label: "", callback: (html) => saveDamageMacro(html[0] ?? html) },
    },
    default: "chat",
    render: (html) => {
      const root = html[0] ?? html;
      const form = root.querySelector("#tsu-damage-dialog");
      if (!form) return;
      updatePreview(form);
      form.addEventListener("input", () => updatePreview(form));
      const traits = getTraitEntries();
      const materials = localizedEntries(CONFIG.PF2E?.materialDamageEffects);
      form.querySelector('[data-action="add-damage"]')?.addEventListener("click", () => {
        form.querySelector(".tsu-damage-extra-list")?.insertAdjacentHTML("beforeend", additionalDamageRow());
        updatePreview(form);
      });
      form.querySelector(".tsu-damage-extra-list")?.addEventListener("click", (event) => {
        const button = event.target.closest?.('[data-action="remove-damage"]');
        if (!button) return;
        button.closest(".tsu-damage-component")?.remove();
        updatePreview(form);
      });
      form.querySelector('[data-action="pick-traits"]')?.addEventListener("click", () => {
        const input = form.querySelector('[name="traits"]');
        openCheckboxPicker({
          title: "Признаки", choices: traits, selected: splitValues(input.value),
          onApply: (values) => {
            input.value = values.join(",");
            form.querySelector('[data-action="pick-traits"]').textContent = selectedSummary(input.value, traits, "Выбрать признаки");
            updatePreview(form);
          },
        });
      });
      form.querySelector('[data-action="pick-materials"]')?.addEventListener("click", () => {
        const input = form.querySelector('[name="materials"]');
        openCheckboxPicker({
          title: "Выбрать материал урона", choices: materials, selected: splitValues(input.value),
          onApply: (values) => {
            input.value = values.join(",");
            form.querySelector('[data-action="pick-materials"]').textContent = selectedSummary(input.value, materials, "Выбрать материал урона");
            updatePreview(form);
          },
        });
      });
    },
  }, { width: 500 });
  dialog.render(true);
  return dialog;
}
