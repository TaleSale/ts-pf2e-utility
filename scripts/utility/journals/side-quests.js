import { MODULE_ID } from "../../core.js";

function appRoot(element) {
  return element instanceof HTMLElement ? element : element?.[0] ?? null;
}

function resolveJournalPage(app, section) {
  const document = app?.document ?? app?.object;
  if (document?.documentName === "JournalEntryPage") return document;
  if (document?.documentName !== "JournalEntry") return null;
  const pageId = section.closest(".journal-entry-page[data-page-id]")?.dataset?.pageId;
  return pageId ? document.pages?.get?.(pageId) ?? null : null;
}

function sectionTitle(section) {
  const heading = section.querySelector("h1, h2, h3, h4, h5, h6");
  if (!(heading instanceof HTMLElement)) return "";
  const clone = heading.cloneNode(true);
  clone.querySelectorAll(".tsu-sidequest-journal-send, .tsu-research-journal-send").forEach((button) => button.remove());
  return String(clone.textContent ?? "").trim();
}

function sectionDescription(section) {
  return String(section.querySelector("p")?.textContent ?? "").trim();
}

async function ensureSectionSourceId(page, section, sectionIndex, { selector, datasetKey }) {
  let sourceSectionId = String(section.dataset[datasetKey] ?? "").trim();
  if (sourceSectionId || !page?.testUserPermission?.(game.user, "OWNER")) return sourceSectionId;

  const template = document.createElement("template");
  template.innerHTML = String(page.text?.content ?? "");
  const storedSection = template.content.querySelectorAll(selector)[sectionIndex];
  if (!(storedSection instanceof HTMLElement)) return "";
  sourceSectionId = foundry.utils.randomID();
  storedSection.dataset[datasetKey] = sourceSectionId;
  await page.update({ "text.content": template.innerHTML });
  section.dataset[datasetKey] = sourceSectionId;
  return sourceSectionId;
}

function activeSideQuestSheets() {
  const api = game.modules?.get(MODULE_ID)?.api;
  return Array.from(api?.sideQuestSheets ?? []).filter((entry) => {
    try {
      return entry && typeof entry.addFromJournal === "function" && entry.isActive?.() !== false;
    } catch (_error) {
      return false;
    }
  });
}

async function chooseSideQuestSheet(sheets) {
  if (sheets.length <= 1) return sheets[0] ?? null;
  const options = sheets
    .map((sheet) => `<option value="${foundry.utils.escapeHTML(String(sheet.id))}">${foundry.utils.escapeHTML(String(sheet.label ?? sheet.id))}</option>`)
    .join("");
  const selectedId = await Dialog.prompt({
    title: "Куда добавить сайд-квест?",
    content: `<form><div class="form-group"><label>Активный лист</label><div class="form-fields"><select name="sheetId">${options}</select></div></div></form>`,
    label: "Добавить",
    callback: (html) => (html?.[0] ?? html)?.querySelector?.('[name="sheetId"]')?.value ?? "",
    rejectClose: false,
  });
  return sheets.find((sheet) => sheet.id === selectedId) ?? null;
}

function activeResearchSheets() {
  const api = game.modules?.get(MODULE_ID)?.api;
  return Array.from(api?.researchSheets ?? []).filter((entry) => {
    try {
      return entry && typeof entry.addFromJournal === "function" && entry.isActive?.() !== false;
    } catch (_error) {
      return false;
    }
  });
}

async function chooseResearchSheet(sheets) {
  if (sheets.length <= 1) return sheets[0] ?? null;
  const options = sheets
    .map((sheet) => `<option value="${foundry.utils.escapeHTML(String(sheet.id))}">${foundry.utils.escapeHTML(String(sheet.label ?? sheet.id))}</option>`)
    .join("");
  const selectedId = await Dialog.prompt({
    title: "Куда добавить изыскание?",
    content: `<form><div class="form-group"><label>Активный лист</label><div class="form-fields"><select name="sheetId">${options}</select></div></div></form>`,
    label: "Добавить",
    callback: (html) => (html?.[0] ?? html)?.querySelector?.('[name="sheetId"]')?.value ?? "",
    rejectClose: false,
  });
  return sheets.find((sheet) => sheet.id === selectedId) ?? null;
}

async function sendJournalSection(section, app) {
  const page = resolveJournalPage(app, section);
  const title = sectionTitle(section);
  if (!page || !title) {
    ui.notifications?.warn?.("Для сайд-квеста нужен заголовок внутри section.side-quest.");
    return;
  }

  const contentRoot = section.closest(".journal-page-content") ?? section.parentElement;
  const sections = Array.from(contentRoot?.querySelectorAll?.("section.side-quest") ?? []);
  const sectionIndex = sections.indexOf(section);
  if (sectionIndex < 0) return;
  const sourceSectionId = await ensureSectionSourceId(page, section, sectionIndex, {
    selector: "section.side-quest",
    datasetKey: "sideQuestId",
  });

  const sheet = await chooseSideQuestSheet(activeSideQuestSheets());
  if (!sheet) {
    ui.notifications?.warn?.("Нет активного листа кампании с поддержкой сайд-квестов.");
    return;
  }

  const result = await sheet.addFromJournal({
    sourceUuid: page.uuid,
    sourceSectionId,
    sourceSectionIndex: sectionIndex,
    sourceHeading: title,
    title,
    description: sectionDescription(section),
  });
  if (result?.queued) ui.notifications?.info?.("Сайд-квест отправлен активному мастеру.");
  else if (result?.updated) ui.notifications?.info?.("Сайд-квест уже существует и обновлён из журнала.");
}

async function sendResearchSection(section, app) {
  const page = resolveJournalPage(app, section);
  const title = sectionTitle(section);
  if (!page || !title) {
    ui.notifications?.warn?.("Для изыскания нужен заголовок внутри section.research.");
    return;
  }

  const contentRoot = section.closest(".journal-page-content") ?? section.parentElement;
  const sections = Array.from(contentRoot?.querySelectorAll?.("section.research") ?? []);
  const sectionIndex = sections.indexOf(section);
  if (sectionIndex < 0) return;
  const sourceResearchId = await ensureSectionSourceId(page, section, sectionIndex, {
    selector: "section.research",
    datasetKey: "researchId",
  });

  const sheet = await chooseResearchSheet(activeResearchSheets());
  if (!sheet) {
    ui.notifications?.warn?.("Нет активного листа кампании с поддержкой изысканий.");
    return;
  }

  const result = await sheet.addFromJournal({
    sourceUuid: page.uuid,
    sourceResearchId,
    sourceSectionIndex: sectionIndex,
    sourceHeading: title,
  });
  if (result?.queued) ui.notifications?.info?.("Изыскание отправлено активному мастеру.");
  else if (result?.updated) ui.notifications?.info?.("Изыскание уже существует и обновлено из журнала.");
}

function hydrateJournalSideQuests(app, element) {
  const root = appRoot(element);
  if (!root || root.matches(".ProseMirror, [contenteditable='true']")) return;

  for (const section of root.querySelectorAll(".journal-page-content section.side-quest")) {
    if (!(section instanceof HTMLElement)) continue;
    if (section.closest(".ProseMirror, [contenteditable='true']")) continue;
    const heading = section.querySelector("h1, h2, h3, h4, h5, h6");
    if (!(heading instanceof HTMLElement) || heading.querySelector(":scope > .tsu-sidequest-journal-send")) continue;

    const button = section.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "tsu-sidequest-journal-send";
    button.title = "Добавить в сайд-квесты";
    button.setAttribute("aria-label", "Добавить в сайд-квесты");
    button.innerHTML = '<i class="fa-solid fa-book-open"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void sendJournalSection(section, app);
    });
    heading.prepend(button);
  }

  for (const section of root.querySelectorAll(".journal-page-content section.research")) {
    if (!(section instanceof HTMLElement)) continue;
    if (section.closest(".ProseMirror, [contenteditable='true']")) continue;
    const heading = section.querySelector("h1, h2, h3, h4, h5, h6");
    if (!(heading instanceof HTMLElement) || heading.querySelector(":scope > .tsu-research-journal-send")) continue;

    const button = section.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "tsu-research-journal-send";
    button.title = "Добавить в изыскания";
    button.setAttribute("aria-label", "Добавить в изыскания");
    button.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void sendResearchSection(section, app);
    });
    heading.prepend(button);
  }
}

Hooks.once("ready", () => {
  const hydrate = (app, element) => {
    hydrateJournalSideQuests(app, element);
    globalThis.requestAnimationFrame?.(() => hydrateJournalSideQuests(app, element));
  };
  Hooks.on("renderJournalSheet", hydrate);
  Hooks.on("renderJournalEntrySheet", hydrate);
  Hooks.on("renderJournalEntryPageSheet", hydrate);
});
