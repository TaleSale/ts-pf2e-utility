import { t } from "../core.js";

const MODULE_ID = "ts-pf2e-utility";
const DROP_ZONE_ID = "tsu-actor-sync-drop-zone";

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function stabilizeDialogLayout(dialog, root, { minWidth = 640, minHeight = 320, fixedWidth = null, maxHeight = null } = {}) {
  const app = dialog;
  const element = root?.closest?.(".app");
  if (!(element instanceof HTMLElement) || !app?.setPosition) return;

  const contentHeight = Math.ceil(element.scrollHeight || 0);
  const viewportLimit = window.innerHeight - 120;
  const heightLimit = maxHeight ? Math.min(maxHeight, viewportLimit) : viewportLimit;
  const nextHeight = Math.max(minHeight, Math.min(contentHeight + 24, heightLimit));
  const nextWidth = fixedWidth ?? Math.max(minWidth, element.offsetWidth || 0);
  app.setPosition({ width: nextWidth, height: nextHeight });
}

function scheduleDialogLayout(dialog, root, options) {
  stabilizeDialogLayout(dialog, root, options);
  window.requestAnimationFrame(() => stabilizeDialogLayout(dialog, root, options));
  window.setTimeout(() => stabilizeDialogLayout(dialog, root, options), 0);
}

function setDialogActionEnabled(root, enabled, { hide = false } = {}) {
  const submitButton = root?.querySelector?.('button[type="submit"]');
  if (!(submitButton instanceof HTMLButtonElement)) return;
  submitButton.disabled = !enabled;
  submitButton.hidden = Boolean(hide);
  submitButton.style.display = hide ? "none" : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCompendiumBackedSourceUuid(document) {
  const candidate = document?._stats?.compendiumSource
    ?? document?.sourceId
    ?? document?.flags?.core?.sourceId
    ?? null;
  return typeof candidate === "string" && candidate.length ? candidate : null;
}

function getActorSourceUuid(actor) {
  return getCompendiumBackedSourceUuid(actor);
}

async function resolveSourceActor(actor) {
  const sourceUuid = getActorSourceUuid(actor);
  if (!sourceUuid) return null;
  const source = await fromUuid(sourceUuid);
  return source?.documentName === "Actor" ? source : null;
}

function getUuidFromCompendiumLink(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  try {
    const data = JSON.parse(text);
    if (typeof data?.uuid === "string") return data.uuid.trim();
  } catch {
  }

  const richLink = text.match(/@UUID\[(?<uuid>[^\]]+)\]/);
  if (richLink?.groups?.uuid) return richLink.groups.uuid.trim();

  const compendiumUuid = text.match(/Compendium\.[^\s\]\}"']+/);
  return compendiumUuid?.[0]?.trim() ?? null;
}

async function resolvePastedSourceActor(value) {
  const uuid = getUuidFromCompendiumLink(value);
  if (!uuid) return null;

  const source = await fromUuid(uuid).catch((error) => {
    console.warn(`${MODULE_ID} | failed to resolve pasted actor source`, error);
    return null;
  });

  if (source?.documentName !== "Actor" || !source.pack) return null;
  return source;
}

async function resolveDroppedWorldActor(dropData) {
  if (!dropData || typeof dropData !== "object") return null;

  const directUuid = typeof dropData.uuid === "string" ? dropData.uuid : null;
  if (directUuid?.startsWith("Actor.")) {
    const actorId = directUuid.split(".")[1];
    return game.actors?.get(actorId) ?? null;
  }

  if (dropData.type === "Actor") {
    const actorId = dropData.id ?? dropData._id ?? null;
    if (actorId) return game.actors?.get(actorId) ?? null;
  }

  if (dropData.type === "Token") {
    const actorId = dropData.actorId ?? dropData.actorData?._id ?? null;
    if (actorId) return game.actors?.get(actorId) ?? null;
  }

  const dropped = directUuid ? await fromUuid(directUuid).catch(() => null) : null;
  if (!dropped) return null;

  if (dropped.documentName === "Actor") {
    if (dropped.pack) return null;
    return game.actors?.get(dropped.id) ?? dropped;
  }

  const actor = dropped.baseActor ?? dropped.actor ?? null;
  if (!actor?.id || actor.pack) return null;
  return game.actors?.get(actor.id) ?? actor;
}

function buildDialogShell({
  title,
  description = "",
  actorLabel = "Актёр не выбран",
  content = "",
  buttonLabel = "Применить",
  buttonIcon = "fa-solid fa-rotate",
}) {
  const descriptionHtml = description
    ? `<div style="margin-top:6px; color:var(--color-text-secondary);">${escapeHtml(description)}</div>`
    : "";
  return `
    <form class="tsu-actor-sync-form" style="display:flex; flex-direction:column; gap:12px; min-height:0;">
      <div class="tsu-drop-zone" id="${DROP_ZONE_ID}" style="border:2px dashed var(--color-border-light-primary); border-radius:8px; padding:18px; text-align:center; background:color-mix(in srgb, var(--color-bg-option) 60%, transparent);">
        <div style="font-size:16px; font-weight:600;">Перетащите лист актёра мира сюда</div>
        ${descriptionHtml}
        <div class="tsu-drop-actor" style="margin-top:10px; font-weight:600;">${escapeHtml(actorLabel)}</div>
      </div>
      <div class="tsu-dialog-content" style="display:flex; flex-direction:column; gap:10px;">${content}</div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="submit">
          <i class="${buttonIcon}"></i> ${escapeHtml(buttonLabel)}
        </button>
      </div>
    </form>
  `;
}

function bindActorDrop(root, onActor) {
  const dropZone = root.querySelector(".tsu-drop-zone");
  if (!(dropZone instanceof HTMLElement)) return;

  const setActive = (active) => {
    dropZone.style.borderColor = active ? "var(--color-border-highlight)" : "var(--color-border-light-primary)";
    dropZone.style.background = active
      ? "color-mix(in srgb, var(--color-bg-option) 80%, var(--color-border-highlight) 20%)"
      : "color-mix(in srgb, var(--color-bg-option) 60%, transparent)";
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

    const actor = await resolveDroppedWorldActor(dropData);
    if (!actor) {
      ui.notifications?.warn("Нужен актёр именно из мира, а не из компендиума.");
      return;
    }

    await onActor(actor);
  });
}

function getDocumentImage(document) {
  return document?.img || document?.texture?.src || "icons/svg/mystery-man.svg";
}

function getPrototypeTokenData(actor) {
  return foundry.utils.deepClone(actor?.prototypeToken?.toObject?.() ?? actor?.prototypeToken ?? {});
}

function getCompendiumLabel(document) {
  const pack = document?.pack ? game.packs?.get(document.pack) : null;
  return pack?.metadata?.label || pack?.title || document?.pack || "Неизвестный компендиум";
}

function getSourceNameSuffix(name) {
  const parts = String(name ?? "").split("/").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" / ") : "";
}

function getPreservedDisplayName(currentName, sourceName) {
  const currentBase = String(currentName ?? "").split("/")[0]?.trim() || String(currentName ?? "").trim();
  const sourceSuffix = getSourceNameSuffix(sourceName);
  if (!currentBase) return String(sourceName ?? "");
  return sourceSuffix ? `${currentBase} / ${sourceSuffix}` : currentBase;
}

function buildActorRefreshPreview(actor, sourceActor) {
  const currentToken = getPrototypeTokenData(actor);
  const sourceToken = getPrototypeTokenData(sourceActor);
  const currentImage = getDocumentImage(actor);
  const sourceImage = getDocumentImage(sourceActor);
  const currentTokenImage = getDocumentImage(currentToken);
  const sourceTokenImage = getDocumentImage(sourceToken);
  const currentTokenName = currentToken.name || actor.name;
  const sourceTokenName = sourceToken.name || sourceActor.name;
  const preservedActorName = getPreservedDisplayName(actor.name, sourceActor.name);
  const preservedTokenName = getPreservedDisplayName(currentTokenName, sourceTokenName);

  return `
    <section style="border:1px solid var(--color-border-light-primary); border-radius:8px; overflow:hidden;">
      <header style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:14px 16px; background:color-mix(in srgb, var(--color-bg-option) 75%, transparent);">
        <img src="${escapeHtml(sourceImage)}" alt="" style="width:72px; height:72px; object-fit:contain; border:2px solid var(--color-border-highlight); border-radius:8px; background:var(--color-bg-option);">
        <div style="align-self:stretch;">
          <div>Вы собираетесь обновить данные актёра для</div>
          <div style="font-weight:700;">${escapeHtml(actor.name)}</div>
        </div>
        <div style="align-self:stretch; border:1px solid var(--color-border-light-primary); border-radius:6px; padding:9px 10px; background:color-mix(in srgb, var(--color-bg-option) 45%, transparent);">
          <div><strong>Прототип:</strong> ${escapeHtml(sourceActor.name)}</div>
          <div><strong>Источник:</strong> <span style="color:var(--color-text-hyperlink);">${escapeHtml(getCompendiumLabel(sourceActor))}</span></div>
        </div>
      </header>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px;">
        <div>
          <div style="font-weight:600; margin-bottom:6px;">Текущее изображение</div>
          <img src="${escapeHtml(currentImage)}" alt="" style="width:96px; height:96px; object-fit:contain; border:1px solid var(--color-border-light-primary); border-radius:6px; background:var(--color-bg-option);">
          <div style="margin-top:8px; font-weight:600;">Текущий токен</div>
          <img src="${escapeHtml(currentTokenImage)}" alt="" style="width:64px; height:64px; object-fit:contain; border:1px solid var(--color-border-light-primary); border-radius:6px; background:var(--color-bg-option);">
        </div>
        <div>
          <div style="font-weight:600; margin-bottom:6px;">Будет изображение</div>
          <img src="${escapeHtml(sourceImage)}" alt="" style="width:96px; height:96px; object-fit:contain; border:1px solid var(--color-border-light-primary); border-radius:6px; background:var(--color-bg-option);">
          <div style="margin-top:8px; font-weight:600;">Будет токен</div>
          <img src="${escapeHtml(sourceTokenImage)}" alt="" style="width:64px; height:64px; object-fit:contain; border:1px solid var(--color-border-light-primary); border-radius:6px; background:var(--color-bg-option);">
        </div>
      </div>
    </section>
    <section style="border:1px solid var(--color-border-light-primary); border-radius:8px; padding:12px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <div style="font-weight:600;">Текущее имя</div>
          <div>${escapeHtml(actor.name)}</div>
          <div style="margin-top:8px; font-weight:600;">Текущее имя токена</div>
          <div>${escapeHtml(currentTokenName)}</div>
        </div>
        <div>
          <div style="font-weight:600;">Будет имя</div>
          <div>${escapeHtml(sourceActor.name)}</div>
          <div style="margin-top:8px; font-weight:600;">Будет имя токена</div>
          <div>${escapeHtml(sourceTokenName)}</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          <label style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" name="keepName">
            <span>Сохранять имя</span>
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" name="keepImage">
            <span>Сохранять изображение</span>
          </label>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <label style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" name="keepTokenName">
            <span>Сохранять имя токена</span>
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" name="keepToken">
            <span>Сохранять токен</span>
          </label>
        </div>
      </div>
      <div style="margin-top:10px; color:var(--color-text-secondary);">
        Если сохранить имя: ${escapeHtml(actor.name)} станет ${escapeHtml(preservedActorName)}, токен станет ${escapeHtml(preservedTokenName)}.
      </div>
    </section>
  `;
}

function buildManualSourceInput(actor) {
  return `
    <section data-manual-source-drop style="border:1px solid var(--color-border-light-primary); border-radius:8px; padding:12px;">
      <div style="color:var(--color-text-secondary);">У этого актёра нет ссылки на исходный документ компендиума.</div>
      <label style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
        <span style="font-weight:600;">Ссылка на актёра из компендиума</span>
        <input type="text" name="manualSourceUuid" placeholder="Compendium.pf2e...Actor..." autocomplete="off" style="width:100%;">
      </label>
      <div style="display:flex; justify-content:flex-end; margin-top:10px;">
        <button type="button" data-action="resolve-manual-source">
          <i class="fa-solid fa-link"></i> Использовать ссылку
        </button>
      </div>
      <div style="margin-top:8px; font-weight:600;">${escapeHtml(actor.name)}</div>
    </section>
  `;
}

async function replaceActorWithSource(actor, sourceActor, {
  keepImage = false,
  keepToken = false,
  keepName = false,
  keepTokenName = false,
} = {}) {
  const currentImage = actor.img;
  const currentToken = getPrototypeTokenData(actor);
  const currentTokenName = currentToken.name || actor.name;
  const sourceToken = getPrototypeTokenData(sourceActor);
  const sourceData = sourceActor.toObject();
  const actorData = foundry.utils.deepClone(sourceData);
  actorData._id = actor.id;
  actorData.folder = actor.folder?.id ?? actor.folder ?? null;
  actorData.sort = actor.sort;
  actorData.ownership = foundry.utils.deepClone(actor.ownership ?? {});

  if (keepImage) {
    actorData.img = currentImage;
  }

  if (keepToken) {
    actorData.prototypeToken = currentToken;
  }

  if (keepName) {
    actorData.name = getPreservedDisplayName(actor.name, sourceActor.name);
  }

  if (keepTokenName) {
    actorData.prototypeToken ??= sourceToken;
    actorData.prototypeToken.name = getPreservedDisplayName(currentTokenName, sourceToken.name || sourceActor.name);
  } else if (keepToken) {
    actorData.prototypeToken.name = sourceToken.name || sourceActor.name;
  }

  const items = Array.isArray(actorData.items) ? foundry.utils.deepClone(actorData.items) : [];
  const effects = Array.isArray(actorData.effects) ? actorData.effects : [];
  delete actorData.items;
  delete actorData.effects;

  await actor.update(actorData, { diff: false, recursive: false });

  if (actor.items.size) {
    await actor.deleteEmbeddedDocuments("Item", actor.items.map((item) => item.id));
  }
  if (actor.effects.size) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map((effect) => effect.id));
  }

  await createActorItemsInDependencyOrder(actor, items);
  if (effects.length) {
    await actor.createEmbeddedDocuments("ActiveEffect", effects, { keepId: true });
  }
}

function splitActorItemsForCreation(items) {
  const spellcastingEntries = [];
  const weapons = [];
  const spells = [];
  const linkedMelee = [];
  const otherItems = [];

  for (const item of items) {
    if (item.type === "spellcastingEntry") {
      spellcastingEntries.push(item);
      continue;
    }

    if (item.type === "weapon") {
      weapons.push(item);
      continue;
    }

    if (item.type === "spell") {
      spells.push(item);
      continue;
    }

    if (item.type === "melee" && item.flags?.pf2e?.linkedWeapon) {
      linkedMelee.push(item);
      continue;
    }

    otherItems.push(item);
  }

  return [spellcastingEntries, weapons, otherItems, spells, linkedMelee].filter((group) => group.length);
}

async function createActorItemsInDependencyOrder(actor, items) {
  const groups = splitActorItemsForCreation(items);
  for (const group of groups) {
    await actor.createEmbeddedDocuments("Item", group, { keepId: true });
  }
}

function normalizeForComparison(data) {
  const clone = foundry.utils.deepClone(data ?? {});
  delete clone._id;
  delete clone._stats;
  delete clone.folder;
  delete clone.sort;
  return clone;
}

function getItemSourceUuid(item) {
  return getCompendiumBackedSourceUuid(item);
}

async function resolveSourceItem(item) {
  const sourceUuid = getItemSourceUuid(item);
  if (sourceUuid) {
    const direct = await fromUuid(sourceUuid).catch(() => null);
    if (direct?.documentName === "Item") return direct;
  }

  return null;
}

async function collectRefreshRows(actor, itemType) {
  const rows = [];
  const items = actor.items.filter((item) => item.type === itemType || (itemType === "non-spell" && item.type !== "spell"));

  for (const item of items) {
    const sourceItem = await resolveSourceItem(item);
    if (!sourceItem) continue;

    const currentData = normalizeForComparison(item.toObject());
    const sourceData = normalizeForComparison(sourceItem.toObject());
    const changed = JSON.stringify(currentData) !== JSON.stringify(sourceData);
    if (!changed) continue;

    rows.push({
      id: item.id,
      name: item.name,
      type: item.type,
      sourceUuid: sourceItem.uuid,
    });
  }

  rows.sort((left, right) => left.name.localeCompare(right.name, game.i18n?.lang || "ru", { sensitivity: "base" }));
  return rows;
}

function buildRowsTable(key, title, rows) {
  const checkedAttr = key === "spells" ? " checked" : "";
  const body = rows.length
    ? rows.map((row) => `
      <tr>
        <td style="width:36px; text-align:center;">
          <input type="checkbox" class="tsu-row-checkbox" data-group="${key}" data-item-id="${escapeHtml(row.id)}" data-source-uuid="${escapeHtml(row.sourceUuid)}"${checkedAttr}>
        </td>
        <td>${escapeHtml(row.name)}</td>
        <td style="color:var(--color-text-secondary); width:120px;">${escapeHtml(row.type)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" style="color:var(--color-text-secondary);">Обновлений не найдено.</td></tr>`;

  return `
    <section class="tsu-table-block" data-group="${key}" style="border:1px solid var(--color-border-light-primary); border-radius:8px; overflow:visible;">
      <header style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:color-mix(in srgb, var(--color-bg-option) 75%, transparent);">
        <div style="font-weight:600;">${escapeHtml(title)} (${rows.length})</div>
        <label style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" class="tsu-group-checkbox" data-group="${key}"${checkedAttr}>
          <span>Выбрать всё</span>
        </label>
      </header>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="width:36px;"></th>
            <th style="text-align:left;">Название</th>
            <th style="text-align:left; width:120px;">Тип</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function bindSelectionControls(root) {
  for (const groupCheckbox of root.querySelectorAll(".tsu-group-checkbox")) {
    groupCheckbox.addEventListener("change", (event) => {
      const input = event.currentTarget;
      const group = input.dataset.group;
      for (const row of root.querySelectorAll(`.tsu-row-checkbox[data-group="${group}"]`)) {
        row.checked = input.checked;
      }
    });
  }

  for (const rowCheckbox of root.querySelectorAll(".tsu-row-checkbox")) {
    rowCheckbox.addEventListener("change", (event) => {
      const input = event.currentTarget;
      const group = input.dataset.group;
      const rows = Array.from(root.querySelectorAll(`.tsu-row-checkbox[data-group="${group}"]`));
      const checked = rows.filter((row) => row.checked).length;
      const groupCheckbox = root.querySelector(`.tsu-group-checkbox[data-group="${group}"]`);
      if (!(groupCheckbox instanceof HTMLInputElement)) return;
      groupCheckbox.checked = checked === rows.length && rows.length > 0;
      groupCheckbox.indeterminate = checked > 0 && checked < rows.length;
    });
  }
}

async function renderItemRefreshContent(root, actor) {
  const dropZone = root.querySelector(".tsu-drop-zone");
  if (dropZone instanceof HTMLElement) dropZone.style.display = "none";

  const contentRoot = root.querySelector(".tsu-dialog-content");
  if (!(contentRoot instanceof HTMLElement)) return;
  const appRoot = root.closest(".app");
  if (appRoot instanceof HTMLElement) {
    appRoot.style.overflow = "hidden";
  }

  const sourceActor = await resolveSourceActor(actor);
  if (!sourceActor) {
    contentRoot.innerHTML = `<div style="color:var(--color-text-secondary);">У актёра нет ссылки на исходный документ компендиума.</div>`;
    return;
  }

  const [itemRows, spellRows] = await Promise.all([
    collectRefreshRows(actor, sourceActor, "non-spell"),
    collectRefreshRows(actor, sourceActor, "spell"),
  ]);

  contentRoot.innerHTML = `
    <div style="color:var(--color-text-secondary);">
      Источник: ${escapeHtml(sourceActor.name)}
    </div>
    ${buildRowsTable("items", "Предметы", itemRows)}
    ${buildRowsTable("spells", "Заклинания", spellRows)}
  `;

  bindSelectionControls(root);
  root.dataset.actorId = actor.id;
}

async function refreshSelectedItems(root) {
  const actorId = root.dataset.actorId;
  const actor = game.actors?.get(actorId) ?? null;
  if (!actor) {
    ui.notifications?.warn("Сначала перетащите актёра из мира.");
    return false;
  }

  const selectedRows = Array.from(root.querySelectorAll(".tsu-row-checkbox:checked"));
  if (!selectedRows.length) {
    ui.notifications?.warn("Не выбраны предметы или заклинания для обновления.");
    return false;
  }

  const updates = [];
  const spellLocations = new Map();
  for (const row of selectedRows) {
    const item = actor.items.get(row.dataset.itemId);
    if (!item) continue;

    const sourceItem = await fromUuid(row.dataset.sourceUuid).catch(() => null);
    if (sourceItem?.documentName !== "Item") continue;

    const sourceData = sourceItem.toObject();
    const itemData = foundry.utils.deepClone(sourceData);
    itemData._id = item.id;
    itemData.sort = item.sort;

    if (item.type === "spell") {
      spellLocations.set(item.id, foundry.utils.deepClone(item.system?.location ?? {}));
      itemData.system ??= {};
      itemData.system.location = foundry.utils.deepClone(item.system?.location ?? {});
      itemData.flags ??= {};
      itemData.flags[MODULE_ID] = foundry.utils.deepClone(item.flags?.[MODULE_ID] ?? {});
    }

    const linkedWeapon = item.flags?.pf2e?.linkedWeapon ?? null;
    if (linkedWeapon) {
      itemData.flags ??= {};
      itemData.flags.pf2e ??= {};
      itemData.flags.pf2e.linkedWeapon = linkedWeapon;
    }

    updates.push(itemData);
  }

  if (!updates.length) {
    ui.notifications?.warn("Не удалось подготовить обновления для выбранных записей.");
    return false;
  }

  await actor.updateEmbeddedDocuments("Item", updates, { diff: false, recursive: false });
  if (spellLocations.size) {
    const spellUpdates = [];
    for (const [itemId, location] of spellLocations.entries()) {
      const patch = { _id: itemId };
      patch["system.location.value"] = location?.value ?? null;
      if (location && "heightenedLevel" in location) {
        patch["system.location.heightenedLevel"] = location.heightenedLevel;
      }
      spellUpdates.push(patch);
    }
    await actor.updateEmbeddedDocuments("Item", spellUpdates);
  }
  ui.notifications?.info(`Обновлено записей: ${updates.length}.`);
  return true;
}

async function renderItemRefreshContentFromItemSources(root, actor) {
  const dropZone = root.querySelector(".tsu-drop-zone");
  if (dropZone instanceof HTMLElement) dropZone.style.display = "none";

  const contentRoot = root.querySelector(".tsu-dialog-content");
  if (!(contentRoot instanceof HTMLElement)) return;
  const appRoot = root.closest(".app");
  if (appRoot instanceof HTMLElement) {
    appRoot.style.overflow = "hidden";
  }

  const sourceActor = await resolveSourceActor(actor);
  const [itemRows, spellRows] = await Promise.all([
    collectRefreshRows(actor, sourceActor, "non-spell"),
    collectRefreshRows(actor, sourceActor, "spell"),
  ]);

  const sourceLabel = sourceActor?.name
    ? `<div style="color:var(--color-text-secondary);">Источник: ${escapeHtml(sourceActor.name)}</div>`
    : "";

  contentRoot.innerHTML = `
    ${sourceLabel}
    ${buildRowsTable("items", "Предметы", itemRows)}
    ${buildRowsTable("spells", "Заклинания", spellRows)}
  `;

  bindSelectionControls(root);
  root.dataset.actorId = actor.id;
}

async function renderItemRefreshContentDirect(root, actor) {
  const dropZone = root.querySelector(".tsu-drop-zone");
  if (dropZone instanceof HTMLElement) dropZone.style.display = "none";

  const contentRoot = root.querySelector(".tsu-dialog-content");
  if (!(contentRoot instanceof HTMLElement)) return;
  const appRoot = root.closest(".app");
  if (appRoot instanceof HTMLElement) {
    appRoot.style.overflow = "hidden";
  }

  const [itemRows, spellRows] = await Promise.all([
    collectRefreshRows(actor, "non-spell"),
    collectRefreshRows(actor, "spell"),
  ]);

  contentRoot.innerHTML = `
    ${buildRowsTable("items", t("Utility.ActorSync.ItemsLabel", "Items"), itemRows)}
    ${buildRowsTable("spells", t("Utility.ActorSync.SpellsLabel", "Spells"), spellRows)}
  `;

  bindSelectionControls(root);
  root.dataset.actorId = actor.id;
}

export async function openActorFullRefreshDialog() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n?.localize("TS_PF2E_UTILITY.Notifications.OnlyGM") ?? "Only GM");
    return;
  }

  let selectedActor = null;
  let selectedSourceActor = null;

  const dialog = new Dialog({
    title: "Обновление существа без смены ID",
    content: buildDialogShell({
      title: "Обновление существа без смены ID",
      description: "Макрос найдёт исходное существо в компендиуме и полностью заменит данные актёра, сохранив его ID.",
      buttonLabel: "Обновить существо",
    }),
    buttons: {},
    render: (html) => {
      const root = getElement(html);
      if (!root) return;
      stabilizeDialogLayout(dialog, root, { minWidth: 640, minHeight: 320, fixedWidth: 640 });

      const renderSelectedActorContent = () => {
        const label = root.querySelector(".tsu-drop-actor");
        if (label) label.textContent = selectedActor?.name ?? "Актёр не выбран";

        const contentRoot = root.querySelector(".tsu-dialog-content");
        if (contentRoot instanceof HTMLElement) {
          contentRoot.innerHTML = selectedSourceActor
            ? buildActorRefreshPreview(selectedActor, selectedSourceActor)
            : buildManualSourceInput(selectedActor);
        }

        setDialogActionEnabled(root, Boolean(selectedSourceActor));
        scheduleDialogLayout(dialog, root, { minWidth: 720, minHeight: 520, fixedWidth: 720, maxHeight: 760 });
      };

      const resolveManualSource = async () => {
        if (!selectedActor) {
          ui.notifications?.warn("Сначала перетащите актёра из мира.");
          return null;
        }

        const input = root.querySelector('input[name="manualSourceUuid"]');
        const sourceActor = await resolvePastedSourceActor(input?.value);
        if (!sourceActor) {
          ui.notifications?.warn("Не удалось найти актёра в компендиуме по этой ссылке.");
          return null;
        }

        selectedSourceActor = sourceActor;
        renderSelectedActorContent();
        return sourceActor;
      };

      bindActorDrop(root, async (actor) => {
        selectedActor = actor;
        selectedSourceActor = await resolveSourceActor(selectedActor);
        renderSelectedActorContent();
      });

      const form = root.querySelector("form");
      setDialogActionEnabled(root, false);
      root.addEventListener("click", async (event) => {
        if (event.target?.closest?.('[data-action="resolve-manual-source"]')) {
          await resolveManualSource();
        }
      });
      root.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter" || event.target?.name !== "manualSourceUuid") return;
        event.preventDefault();
        await resolveManualSource();
      });
      root.addEventListener("dragover", (event) => {
        if (!event.target?.closest?.("[data-manual-source-drop]")) return;
        event.preventDefault();
      });
      root.addEventListener("drop", async (event) => {
        if (!event.target?.closest?.("[data-manual-source-drop]")) return;
        event.preventDefault();
        event.stopPropagation();

        const raw = event.dataTransfer?.getData("text/plain") ?? "";
        const uuid = getUuidFromCompendiumLink(raw);
        const input = root.querySelector('input[name="manualSourceUuid"]');
        if (input instanceof HTMLInputElement && uuid) {
          input.value = uuid;
        }
        await resolveManualSource();
      });
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedActor) {
          ui.notifications?.warn("Сначала перетащите актёра из мира.");
          return;
        }

        const manualSourceInput = root.querySelector('input[name="manualSourceUuid"]');
        let sourceActor = selectedSourceActor ?? await resolveSourceActor(selectedActor);
        if (!sourceActor && manualSourceInput?.value?.trim()) {
          sourceActor = await resolveManualSource();
          if (!sourceActor) return;
        }
        if (!sourceActor) {
          ui.notifications?.warn("У этого актёра нет ссылки на исходный документ компендиума.");
          return;
        }

        const confirmed = await Dialog.confirm({
          title: "Подтвердите обновление актёра",
          content: `<p>Обновить <strong>${escapeHtml(selectedActor.name)}</strong> из компендиума <strong>${escapeHtml(getCompendiumLabel(sourceActor))}</strong>?</p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false,
        });
        if (!confirmed) return;

        const keepImage = Boolean(form.elements?.keepImage?.checked);
        const keepToken = Boolean(form.elements?.keepToken?.checked);
        const keepName = Boolean(form.elements?.keepName?.checked);
        const keepTokenName = Boolean(form.elements?.keepTokenName?.checked);
        await replaceActorWithSource(selectedActor, sourceActor, { keepImage, keepToken, keepName, keepTokenName });
        ui.notifications?.info(`Актёр ${selectedActor.name} обновлён из ${sourceActor.name}.`);
        dialog.close();
      });
    },
  }, { width: 720, height: "auto" });

  dialog.render(true);
}

export async function openActorTranslationRefreshDialog() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n?.localize("TS_PF2E_UTILITY.Notifications.OnlyGM") ?? "Only GM");
    return;
  }

  const dialog = new Dialog({
    title: "Выборочное обновление предметов и заклинаний",
    content: buildDialogShell({
      title: "Выборочное обновление предметов и заклинаний",
      description: "Макрос покажет предметы и заклинания существа, которые отличаются от исходника в компендиуме, и позволит обновить всё сразу или выборочно.",
      content: "",
      buttonLabel: "Обновить выбранное",
    }),
    buttons: {},
    render: (html) => {
      const root = getElement(html);
      if (!root) return;
      scheduleDialogLayout(dialog, root, { minWidth: 640, minHeight: 320, fixedWidth: 640 });

      bindActorDrop(root, async (actor) => {
        await renderItemRefreshContentDirect(root, actor);
        setDialogActionEnabled(root, true, { hide: false });
        scheduleDialogLayout(dialog, root, { minWidth: 640, minHeight: 420, fixedWidth: 640, maxHeight: 520 });
      });

      const form = root.querySelector("form");
      setDialogActionEnabled(root, false, { hide: false });
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const changed = await refreshSelectedItems(root);
        if (changed) dialog.close();
      });
    },
  }, { width: 640, height: "auto" });

  dialog.render(true);
}
