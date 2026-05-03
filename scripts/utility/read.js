import { MODULE_ID } from "../core.js";

const SETTING_ENABLE_READ = "enableJournalRead";
const READ_BODY_CLASS = "tsu-journal-read-enabled";
const READ_BLOCK_PATTERN = /<section\s+class=(["'])read\1>([\s\S]*?)<\/section>/gi;

function isReadEnabled() {
  return Boolean(game.settings.get(MODULE_ID, SETTING_ENABLE_READ));
}

function updateReadBodyClass(enabled = isReadEnabled()) {
  document.body.classList.toggle(READ_BODY_CLASS, Boolean(enabled));
}

function isJournalApp(app) {
  const documentName = app?.document?.documentName ?? "";
  if (documentName === "JournalEntry" || documentName === "JournalEntryPage") return true;

  const constructorName = app?.constructor?.name ?? "";
  if (constructorName.includes("Journal")) return true;

  const element = app?.element?.[0] ?? app?.element ?? null;
  return Boolean(element?.classList?.contains?.("journal-sheet"));
}

async function rerenderOpenJournalSheets() {
  const seen = new Set();

  const rerender = async (app) => {
    if (!app || seen.has(app) || !isJournalApp(app)) return;
    seen.add(app);
    if (typeof app.render === "function") await app.render(false);
  };

  for (const app of foundry.applications.instances.values()) {
    await rerender(app);
  }

  for (const app of Object.values(ui.windows ?? {})) {
    await rerender(app);
  }
}

function decodeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function appendHtmlContent(fragment, documentRef, html) {
  const template = documentRef.createElement("template");
  template.innerHTML = html;
  fragment.append(template.content);
}

function buildReadFragment(documentRef, source, enabled = isReadEnabled()) {
  const decoded = decodeMarkup(source);
  if (!decoded.includes("<section")) return null;

  READ_BLOCK_PATTERN.lastIndex = 0;
  if (!READ_BLOCK_PATTERN.test(decoded)) {
    READ_BLOCK_PATTERN.lastIndex = 0;
    return null;
  }
  READ_BLOCK_PATTERN.lastIndex = 0;

  const fragment = documentRef.createDocumentFragment();
  let cursor = 0;
  let matched = false;

  for (const match of decoded.matchAll(READ_BLOCK_PATTERN)) {
    const fullMatch = match[0];
    const innerContent = match[2] ?? "";
    const start = match.index ?? 0;
    const normalizedContent = innerContent.trim();

    if (start > cursor) {
      fragment.append(documentRef.createTextNode(decoded.slice(cursor, start)));
    }

    if (enabled) {
      const section = documentRef.createElement("section");
      section.className = "read";
      section.innerHTML = normalizedContent;
      fragment.append(section);
    } else if (normalizedContent) {
      appendHtmlContent(fragment, documentRef, normalizedContent);
    }

    cursor = start + fullMatch.length;
    matched = true;
  }

  if (cursor < decoded.length) {
    fragment.append(documentRef.createTextNode(decoded.slice(cursor)));
  }

  return matched ? fragment : null;
}

function replaceReadTextNode(node, enabled = isReadEnabled()) {
  const documentRef = node.ownerDocument;
  if (!documentRef) return false;

  const fragment = buildReadFragment(documentRef, node.nodeValue ?? "", enabled);
  if (!fragment) return false;

  const parent = node.parentElement;
  const nodeText = decodeMarkup(node.nodeValue ?? "").trim();
  const parentText = decodeMarkup(parent?.textContent ?? "").trim();
  const canReplaceParent = parent instanceof HTMLParagraphElement && nodeText && nodeText === parentText;

  if (canReplaceParent) {
    parent.replaceWith(fragment);
    return true;
  }

  node.replaceWith(fragment);
  return true;
}

function unwrapReadSections(root) {
  if (!(root instanceof HTMLElement)) return;

  for (const section of root.querySelectorAll(".journal-page-content .read")) {
    if (!(section instanceof HTMLElement)) continue;
    const fragment = section.ownerDocument.createDocumentFragment();
    while (section.firstChild) fragment.append(section.firstChild);
    section.replaceWith(fragment);
  }
}

function hydrateReadMarkup(root) {
  if (!(root instanceof HTMLElement)) return;
  const enabled = isReadEnabled();
  if (!enabled) unwrapReadSections(root);
  const candidates = root.querySelectorAll(".journal-page-content");

  for (const content of candidates) {
    if (!(content instanceof HTMLElement)) continue;

    const walker = content.ownerDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
      if (!(textNode instanceof Text)) continue;
      const value = textNode.nodeValue ?? "";
      if (!value.includes("&lt;section") && !value.includes("<section")) continue;
      replaceReadTextNode(textNode, enabled);
    }
  }
}

function isReadActionClick(section, event) {
  const bounds = section.getBoundingClientRect();
  const hotspotSize = 28;
  const hitRight = event.clientX >= (bounds.right - hotspotSize);
  const hitTop = event.clientY <= (bounds.top + hotspotSize);
  return hitRight && hitTop;
}

async function onReadSectionClick(event) {
  if (!game.ready || !game.settings.get(MODULE_ID, SETTING_ENABLE_READ)) return;
  if (!(event.target instanceof Element)) return;

  const section = event.target.closest(".read");
  if (!(section instanceof HTMLElement)) return;
  if (!section.closest(".journal-sheet")) return;
  if (!isReadActionClick(section, event)) return;

  event.preventDefault();
  event.stopPropagation();

  const content = section.innerHTML.trim();
  if (!content) return;

  await ChatMessage.create({
    user: game.user?.id ?? null,
    speaker: ChatMessage.getSpeaker(),
    content,
  });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE_READ, {
    name: "TS_PF2E_UTILITY.Settings.Journals.Read.Name",
    hint: "TS_PF2E_UTILITY.Settings.Journals.Read.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: (enabled) => {
      updateReadBodyClass(enabled);
      void rerenderOpenJournalSheets();
    },
  });
});

Hooks.once("ready", () => {
  updateReadBodyClass();

  document.addEventListener("click", (event) => {
    void onReadSectionClick(event);
  });

  const hydrateRenderedJournal = (_app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    hydrateReadMarkup(root);
    globalThis.requestAnimationFrame?.(() => hydrateReadMarkup(root));
  };

  Hooks.on("renderJournalSheet", hydrateRenderedJournal);
  Hooks.on("renderJournalEntrySheet", hydrateRenderedJournal);
  Hooks.on("renderJournalEntryPageSheet", hydrateRenderedJournal);

  for (const sheet of document.querySelectorAll(".journal-sheet")) {
    if (sheet instanceof HTMLElement) hydrateReadMarkup(sheet);
  }
});
