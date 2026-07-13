import { escapeHtml } from "../core.js";

const MODULE_ID = "ts-pf2e-utility";

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function setButtonEnabled(root, selector, enabled) {
  const button = root?.querySelector?.(selector);
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = !enabled;
}

function scheduleDialogLayout(dialog, root, { minWidth = 760, minHeight = 520, fixedWidth = 760, maxHeight = 820 } = {}) {
  const app = dialog;
  const element = root?.closest?.(".app");
  if (!(element instanceof HTMLElement) || !app?.setPosition) return;

  const resize = () => {
    const contentHeight = Math.ceil(element.scrollHeight || 0);
    const viewportLimit = window.innerHeight - 80;
    const heightLimit = Math.min(maxHeight, viewportLimit);
    const nextHeight = Math.max(minHeight, Math.min(contentHeight + 24, heightLimit));
    app.setPosition({ width: Math.max(minWidth, fixedWidth), height: nextHeight });
  };

  resize();
  window.requestAnimationFrame(resize);
  window.setTimeout(resize, 0);
}

function stripHtml(value) {
  const html = String(value ?? "").trim();
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function localizeConfigValue(record, key, fallback = null) {
  if (!key || !record) return fallback ?? String(key ?? "");
  const entry = record[key];
  if (typeof entry === "string") {
    const localized = game.i18n?.localize?.(entry);
    return localized && localized !== entry ? localized : entry;
  }
  if (entry && typeof entry === "object") {
    const label = entry.label ?? entry.name ?? entry.value ?? fallback ?? String(key);
    if (typeof label === "string") {
      const localized = game.i18n?.localize?.(label);
      return localized && localized !== label ? localized : label;
    }
  }
  return fallback ?? String(key);
}

function findConfigLabel(slug, records, fallback = null) {
  for (const record of records) {
    if (!record || !Object.hasOwn(record, slug)) continue;
    const label = localizeConfigValue(record, slug, null);
    if (label) return label;
  }
  return fallback ?? String(slug ?? "");
}

function formatSigned(value) {
  const numeric = Number(value) || 0;
  return numeric >= 0 ? `+${numeric}` : `${numeric}`;
}

function foundryText(value) {
  return String(value ?? "").replace(/[{}\[\]]/g, "").trim();
}

function formatActorLink(actor) {
  const uuid = actor.uuid ?? `Actor.${actor.id}`;
  return `@UUID[${uuid}]{${foundryText(actor.name)}}`;
}

function formatTraitLink(slug, label = null) {
  const text = label ?? findConfigLabel(slug, [
    CONFIG.PF2E?.rarityTraits,
    CONFIG.PF2E?.actorSizes,
    CONFIG.PF2E?.creatureTraits,
    CONFIG.PF2E?.hazardTraits,
    CONFIG.PF2E?.traits,
  ], slug);
  return `@Trait[${slug}]{${foundryText(text)}}`;
}

function getActorLevel(actor) {
  return Number(actor.system?.details?.level?.value ?? actor.level ?? 0) || 0;
}

function formatTraits(actor) {
  const labels = [];
  const rarity = actor.system?.traits?.rarity;
  const size = actor.system?.traits?.size?.value ?? actor.system?.traits?.size;
  const traits = Array.isArray(actor.system?.traits?.value) ? actor.system.traits.value : [];

  if (rarity && rarity !== "common") labels.push(formatTraitLink(rarity));
  if (size) labels.push(formatTraitLink(size));
  for (const trait of traits) labels.push(formatTraitLink(trait));

  return labels.join(" ");
}

function formatLanguages(actor) {
  const data = actor.system?.details?.languages ?? actor.system?.traits?.languages ?? {};
  const value = Array.isArray(data.value) ? data.value : [];
  const labels = value
    .map((slug) => localizeConfigValue(CONFIG.PF2E?.languages, slug, slug))
    .filter(Boolean);
  const details = String(data.details ?? "").trim();
  if (details) labels.push(details);
  return labels.length ? labels.join(", ") : "-";
}

function formatSenses(actor) {
  const senses = Array.isArray(actor.system?.perception?.senses) ? actor.system.perception.senses : [];
  const labels = senses.map((sense) => {
    if (typeof sense === "string") return sense;
    if (!sense || typeof sense !== "object") return "";
    const type = sense.type ? localizeConfigValue(CONFIG.PF2E?.senses, sense.type, sense.type) : "";
    const acuity = formatSenseAcuity(sense.acuity);
    const isPrecise = String(sense.acuity ?? "").toLowerCase() === "precise";
    const range = Number.isFinite(Number(sense.range)) ? String(sense.range) : "";
    if (!type) return "";
    if (acuity && !isPrecise) return `${type} (${[acuity, range].filter(Boolean).join(" ")})`;
    return [type, range].filter(Boolean).join(" ");
  }).filter(Boolean);

  const details = String(actor.system?.perception?.details ?? "").trim();
  if (details) labels.push(details);
  return labels.join(", ");
}

function formatSenseAcuity(acuity) {
  const slug = String(acuity ?? "").trim();
  if (!slug) return "";
  const label = findConfigLabel(slug, [
    CONFIG.PF2E?.senseAcuity,
    CONFIG.PF2E?.senseAcuities,
    CONFIG.PF2E?.sensesAcuity,
    CONFIG.PF2E?.sensesAcuities,
  ], null);
  if (label) return label;

  return {
    precise: "точное",
    imprecise: "неточное",
    vague: "смутное",
  }[slug.toLowerCase()] ?? slug;
}

function formatPerception(actor) {
  const modifier = actor.perception?.mod ?? actor.system?.perception?.mod ?? actor.system?.perception?.value ?? 0;
  const senses = formatSenses(actor);
  return `${formatSigned(modifier)}${senses ? `, ${senses}` : ""}`;
}

function formatEquipment(actor) {
  const physicalTypes = new Set(["armor", "backpack", "consumable", "equipment", "shield", "treasure", "weapon", "ammo"]);
  const items = (actor.items?.contents ?? actor.items ?? [])
    .filter((item) => physicalTypes.has(item.type))
    .map((item) => {
      const quantity = Number(item.system?.quantity ?? item.quantity ?? 1);
      const name = String(item.name ?? "").trim();
      if (!name) return "";
      return quantity > 1 ? `${escapeHtml(name)} x${escapeHtml(quantity)}` : escapeHtml(name);
    })
    .filter(Boolean)
    .sort((left, right) => stripHtml(left).localeCompare(stripHtml(right), "ru"));

  return items.length ? items.join(", ") : "-";
}

function proficiencyLabel(value) {
  const key = String(value ?? "").toLowerCase();
  const rank = Number(value);
  const map = {
    untrained: "нетренирован",
    trained: "обучен",
    expert: "эксперт",
    master: "мастер",
    legendary: "легенда",
    0: "нетренирован",
    1: "обучен",
    2: "эксперт",
    3: "мастер",
    4: "легенда",
  };
  return map[key] ?? map[rank] ?? "";
}

function formatHazardStealth(actor) {
  const stealth = actor.system?.attributes?.stealth ?? {};
  const rawDc = stealth.dc ?? stealth.value ?? stealth.totalModifier;
  const numeric = Number(rawDc);
  const dc = Number.isFinite(numeric)
    ? (numeric < 10 ? numeric + 10 : numeric)
    : null;
  const details = String(stealth.details ?? stealth.notes ?? "").trim();
  const proficiency = proficiencyLabel(stealth.proficiency ?? stealth.rank ?? stealth.proficient?.value);
  const note = details || proficiency;
  return `${dc === null ? "-" : `КС${dc}`}${note ? ` (${note})` : ""}`;
}

function getHazardDescription(actor) {
  return stripHtml(
    actor.system?.details?.description?.value
    ?? actor.system?.details?.description
    ?? actor.system?.description?.value
    ?? actor.system?.details?.publicNotes,
  ) || "-";
}

function buildCreatureStatblockHtml(actor) {
  const level = getActorLevel(actor);
  const traits = formatTraits(actor);
  const equipment = formatEquipment(actor);

  return [
    `<section class="БлокСтат">`,
    `  <h4><span>${formatActorLink(actor)} (${escapeHtml(level)}) / Существо ${escapeHtml(level)}</span></h4>`,
    traits ? `  <p>${traits}</p>` : "",
    `  <p><strong>Восприятие:</strong> ${escapeHtml(formatPerception(actor))}</p>`,
    `  <p><strong>Языки:</strong> ${escapeHtml(formatLanguages(actor))}</p>`,
    `  <p><strong>Снаряжение:</strong> ${equipment}</p>`,
    `</section>`,
  ].filter(Boolean).join("\n");
}

function buildHazardStatblockHtml(actor) {
  const level = getActorLevel(actor);
  const traits = formatTraits(actor);

  return [
    `<section class="БлокСтат">`,
    `  <h4><span>${formatActorLink(actor)} / Опасность ${escapeHtml(level)}</span></h4>`,
    traits ? `  <p>${traits}</p>` : "",
    `  <p><strong>Скрытность:</strong> ${escapeHtml(formatHazardStealth(actor))}</p>`,
    `  <p><strong>Описание:</strong> ${escapeHtml(getHazardDescription(actor))}</p>`,
    `</section>`,
  ].filter(Boolean).join("\n");
}

function buildLootStatblockHtml(actor) {
  return [
    `<section class="БлокСтат">`,
    `  <p><strong>Снаряжение:</strong> ${formatEquipment(actor)}</p>`,
    `</section>`,
  ].join("\n");
}

function buildStatblockHtml(actor) {
  if (actor.type === "hazard") return buildHazardStatblockHtml(actor);
  if (actor.type === "loot") return buildLootStatblockHtml(actor);
  return buildCreatureStatblockHtml(actor);
}

function buildDialogContent() {
  return `
    <form class="tsu-creature-statblock-form" style="display:flex; flex-direction:column; gap:12px; min-height:0;">
      <div class="tsu-drop-zone" style="border:2px dashed var(--color-border-light-primary); border-radius:8px; padding:18px; text-align:center; background:color-mix(in srgb, var(--color-bg-option) 60%, transparent);">
        <div style="font-size:16px; font-weight:600;">Перетащите сюда существо, опасность или добычу</div>
        <div style="margin-top:6px; color:var(--color-text-secondary);">Макрос соберёт HTML-код секции БлокСтат и скопирует его в буфер обмена.</div>
        <div class="tsu-drop-actor" style="margin-top:10px; font-weight:600;">Актёр не выбран</div>
      </div>
      <label style="display:flex; flex-direction:column; gap:6px;">
        <span style="font-weight:600;">Код БлокСтата</span>
        <textarea class="tsu-statblock-output" rows="18" spellcheck="false" style="width:100%; resize:vertical; font-family:Consolas, monospace;"></textarea>
      </label>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="tsu-copy-statblock" disabled>
          <i class="fa-solid fa-copy"></i> Скопировать код
        </button>
      </div>
    </form>
  `;
}

async function resolveDroppedActor(dropData) {
  if (!dropData || typeof dropData !== "object") return null;

  const directUuid = typeof dropData.uuid === "string" ? dropData.uuid : null;
  if (directUuid) {
    const dropped = await fromUuid(directUuid).catch(() => null);
    if (dropped?.documentName === "Actor") return dropped;
    const actor = dropped?.actor ?? dropped?.baseActor ?? null;
    if (actor?.documentName === "Actor") return actor;
  }

  if (dropData.type === "Actor") {
    const actorId = dropData.id ?? dropData._id ?? null;
    if (actorId) return game.actors?.get(actorId) ?? null;
  }

  if (dropData.type === "Token") {
    const actorId = dropData.actorId ?? dropData.actorData?._id ?? null;
    if (actorId) return game.actors?.get(actorId) ?? null;
  }

  return null;
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

function bindActorDrop(root, dialog) {
  const dropZone = root.querySelector(".tsu-drop-zone");
  const actorLabel = root.querySelector(".tsu-drop-actor");
  const textarea = root.querySelector(".tsu-statblock-output");
  if (!(dropZone instanceof HTMLElement) || !(actorLabel instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) return;

  const setActive = (active) => {
    dropZone.style.borderColor = active ? "var(--color-border-highlight)" : "var(--color-border-light-primary)";
    dropZone.style.background = active
      ? "color-mix(in srgb, var(--color-bg-option) 80%, var(--color-border-highlight) 20%)"
      : "color-mix(in srgb, var(--color-bg-option) 60%, transparent)";
  };

  const updateOutput = async (actor) => {
    const html = buildStatblockHtml(actor);
    actorLabel.textContent = actor.name;
    textarea.value = html;
    setButtonEnabled(root, ".tsu-copy-statblock", true);
    scheduleDialogLayout(dialog, root);

    try {
      await copyText(html);
      ui.notifications?.info(`Код БлокСтата для ${actor.name} скопирован в буфер обмена.`);
    } catch (error) {
      console.warn(`${MODULE_ID} | failed to copy creature statblock`, error);
      ui.notifications?.warn("Код сформирован, но буфер обмена недоступен. Скопируйте текст из окна вручную.");
    }
  };

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    setActive(true);
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    setActive(true);
  });
  dropZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    if (event.currentTarget === event.target) setActive(false);
  });
  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    setActive(false);

    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) {
      ui.notifications?.warn("Не удалось прочитать данные перетаскивания.");
      return;
    }

    let dropData;
    try {
      dropData = JSON.parse(raw);
    } catch (error) {
      console.warn(`${MODULE_ID} | invalid actor drop payload`, error);
      ui.notifications?.warn("Это не похоже на лист актёра.");
      return;
    }

    const actor = await resolveDroppedActor(dropData);
    if (!actor) {
      ui.notifications?.warn("Нужен актёр: существо, опасность или добыча.");
      return;
    }

    if (!["npc", "hazard", "loot"].includes(actor.type)) {
      ui.notifications?.warn("Макрос работает с существами, опасностями и добычей.");
      return;
    }

    await updateOutput(actor);
  });
}

export async function openCreatureStatblockDialog() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n?.localize("TS_PF2E_UTILITY.Notifications.OnlyGM") ?? "Only GM");
    return;
  }

  const dialog = new Dialog({
    title: "БлокСтат Существа",
    content: buildDialogContent(),
    buttons: {},
    render: (html) => {
      const root = getElement(html);
      if (!root) return;

      bindActorDrop(root, dialog);
      scheduleDialogLayout(dialog, root);

      const textarea = root.querySelector(".tsu-statblock-output");
      const copyButton = root.querySelector(".tsu-copy-statblock");

      copyButton?.addEventListener("click", async () => {
        if (!(textarea instanceof HTMLTextAreaElement) || !textarea.value.trim()) return;
        try {
          await copyText(textarea.value);
          ui.notifications?.info("Код БлокСтата скопирован в буфер обмена.");
        } catch (error) {
          console.warn(`${MODULE_ID} | failed to copy statblock from button`, error);
          ui.notifications?.warn("Буфер обмена недоступен. Скопируйте текст из окна вручную.");
        }
      });
    },
  }, { width: 760, height: "auto" });

  dialog.render(true);
}
