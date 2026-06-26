import { MODULE_ID } from "../../core.js";

const SETTING_ENABLE_TS_FORMAT_MENU = "enableJournalTsFormatMenu";

const AUTOFORMAT_PATTERNS = [
  {
    pattern: /<section class="statblock"><h4>/gi,
    replacement: '<section class="\u0411\u043b\u043e\u043a\u0421\u0442\u0430\u0442"><h4>',
  },
  {
    pattern: /<section class="statblock"><img/gi,
    replacement: '<section class="\u041f\u0420\u0410\u0412"><img',
  },
];

const TS_SECTION_MENU_ENTRIES = Object.freeze([
  {
    action: "tsu-wrap-blockstat",
    title: "\u0411\u043b\u043e\u043a\u0421\u0442\u0430\u0442",
    className: "\u0411\u043b\u043e\u043a\u0421\u0442\u0430\u0442",
  },
  { action: "tsu-wrap-insite", title: "insite", className: "insite" },
  { action: "tsu-wrap-read", title: "read", className: "read" },
]);

function isTsFormatMenuEnabled() {
  return Boolean(game.settings.get(MODULE_ID, SETTING_ENABLE_TS_FORMAT_MENU));
}

function isJournalEditor(menu) {
  const editorRoot = menu?.view?.dom;
  if (!(editorRoot instanceof HTMLElement)) return false;
  return Boolean(editorRoot.closest(".journal-sheet, .journal-page-sheet, .journal-entry-page"));
}

function replaceEditorHtml(view, nextHtml) {
  if (typeof nextHtml !== "string" || !nextHtml.length) return false;

  const nextDoc = foundry.prosemirror.dom.parseString(nextHtml, view.state.schema);
  const transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
  if (!transaction.docChanged) return false;

  view.dispatch(transaction.scrollIntoView());
  return true;
}

function getNodePath(root, node) {
  const path = [];
  let current = node;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function resolveNodePath(root, path) {
  let current = root;

  for (const index of path ?? []) {
    current = current?.childNodes?.[index] ?? null;
    if (!current) return null;
  }

  return current;
}

function serializeNode(node) {
  if (node instanceof Element) return node.outerHTML;
  return node.textContent ?? "";
}

function serializeElementWithInnerHtml(element, innerHtml) {
  const clone = element.cloneNode(false);
  if (!(clone instanceof HTMLElement)) return innerHtml;
  clone.innerHTML = innerHtml;
  return clone.outerHTML;
}

function isEmptyParagraph(node) {
  if (!(node instanceof HTMLParagraphElement)) return false;

  const html = node.innerHTML
    .replace(/<br\s+class="ProseMirror-trailingBreak"\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .trim();
  return html === "";
}

function cleanupSectionSiblings(root, startIndex, endIndex) {
  const nodes = Array.from(root.childNodes);
  const from = Math.max(0, startIndex - 1);
  const to = Math.min(nodes.length - 1, endIndex + 1);

  for (let index = to; index >= from; index -= 1) {
    const node = nodes[index];
    if (!isEmptyParagraph(node)) continue;

    const previous = node.previousSibling;
    const next = node.nextSibling;
    const touchesSection = previous instanceof HTMLElement && previous.matches("section")
      || next instanceof HTMLElement && next.matches("section");
    if (touchesSection) node.remove();
  }
}

function cleanupReplacementBoundaries(root, startIndex, endIndex) {
  const nodes = Array.from(root.childNodes);
  let from = Math.max(0, startIndex);
  let to = Math.min(nodes.length - 1, endIndex);

  while (from <= to) {
    const node = root.childNodes[from];
    if (!isEmptyParagraph(node)) break;
    node.remove();
    to -= 1;
  }

  while (from <= to) {
    const node = root.childNodes[to];
    if (!isEmptyParagraph(node)) break;
    node.remove();
    to -= 1;
  }
}

function buildSingleParagraphSectionHtml(topLevelNode, sourceRange, className) {
  if (!(topLevelNode instanceof HTMLParagraphElement)) return null;

  const startPath = getNodePath(topLevelNode, sourceRange.startContainer);
  const endPath = getNodePath(topLevelNode, sourceRange.endContainer);
  if (!startPath || !endPath) return null;

  const paragraphClone = topLevelNode.cloneNode(true);
  if (!(paragraphClone instanceof HTMLParagraphElement)) return null;

  const startNode = resolveNodePath(paragraphClone, startPath);
  const endNode = resolveNodePath(paragraphClone, endPath);
  if (!(startNode instanceof Node) || !(endNode instanceof Node)) return null;

  const documentRef = paragraphClone.ownerDocument;
  const beforeRange = documentRef.createRange();
  beforeRange.selectNodeContents(paragraphClone);
  beforeRange.setEnd(startNode, sourceRange.startOffset);

  const selectedRange = documentRef.createRange();
  selectedRange.setStart(startNode, sourceRange.startOffset);
  selectedRange.setEnd(endNode, sourceRange.endOffset);

  const afterRange = documentRef.createRange();
  afterRange.selectNodeContents(paragraphClone);
  afterRange.setStart(endNode, sourceRange.endOffset);

  const toHtml = (range) => {
    const container = documentRef.createElement("div");
    container.append(range.cloneContents());
    return container.innerHTML;
  };

  const beforeHtml = toHtml(beforeRange).trim();
  const selectedHtml = toHtml(selectedRange).trim();
  const afterHtml = toHtml(afterRange).trim();
  if (!selectedHtml) return null;

  const parts = [];
  if (beforeHtml) {
    parts.push(serializeElementWithInnerHtml(topLevelNode, beforeHtml));
  }

  const section = documentRef.createElement("section");
  section.className = className;
  const selectedParagraph = topLevelNode.cloneNode(false);
  if (!(selectedParagraph instanceof HTMLParagraphElement)) return null;
  selectedParagraph.innerHTML = selectedHtml;
  section.append(selectedParagraph);
  parts.push(section.outerHTML);

  if (afterHtml) {
    parts.push(serializeElementWithInnerHtml(topLevelNode, afterHtml));
  }

  return parts.join("");
}

function wrapSelectionInSection(view, className) {
  const state = view?.state;
  const editorRoot = view?.dom;
  const root = view?.root;
  const selection = typeof root?.getSelection === "function"
    ? root.getSelection()
    : globalThis.getSelection?.();
  if (!state || !(editorRoot instanceof HTMLElement) || !selection?.rangeCount || selection.isCollapsed) return false;

  const sourceRange = selection.getRangeAt(0);
  const startPath = getNodePath(editorRoot, sourceRange.startContainer);
  const endPath = getNodePath(editorRoot, sourceRange.endContainer);
  if (!startPath || !endPath) return false;
  const startTopLevelIndex = startPath[0] ?? 0;
  const endTopLevelIndex = endPath[0] ?? startTopLevelIndex;
  const originalNodes = Array.from(editorRoot.childNodes);
  const singleTopLevelNode = originalNodes[startTopLevelIndex];

  if (
    startTopLevelIndex === endTopLevelIndex
    && singleTopLevelNode instanceof HTMLParagraphElement
  ) {
    const replacementHtml = buildSingleParagraphSectionHtml(singleTopLevelNode, sourceRange, className);
    if (!replacementHtml) return false;

    const parsed = foundry.prosemirror.dom.parseString(replacementHtml, state.schema);
    const from = view.posAtDOM(editorRoot, startTopLevelIndex);
    const to = view.posAtDOM(editorRoot, startTopLevelIndex + 1);
    const tr = state.tr.replaceRange(from, to, parsed.slice(0)).scrollIntoView();
    if (!tr.docChanged) return false;

    view.dispatch(tr);
    return true;
  }

  const editorClone = editorRoot.cloneNode(true);
  if (!(editorClone instanceof HTMLElement)) return false;

  const startNode = resolveNodePath(editorClone, startPath);
  const endNode = resolveNodePath(editorClone, endPath);
  if (!(startNode instanceof Node) || !(endNode instanceof Node)) return false;

  const range = editorClone.ownerDocument.createRange();
  range.setStart(startNode, sourceRange.startOffset);
  range.setEnd(endNode, sourceRange.endOffset);

  const wrapper = editorClone.ownerDocument.createElement("section");
  wrapper.className = className;
  wrapper.append(range.extractContents());
  range.insertNode(wrapper);

  const nextNodes = Array.from(editorClone.childNodes);
  const trailingUnchangedCount = Math.max(0, originalNodes.length - endTopLevelIndex - 1);
  const replacementEndIndex = Math.max(startTopLevelIndex, nextNodes.length - trailingUnchangedCount);
  cleanupSectionSiblings(editorClone, startTopLevelIndex, Math.max(startTopLevelIndex, replacementEndIndex - 1));
  cleanupReplacementBoundaries(editorClone, startTopLevelIndex, Math.max(startTopLevelIndex, replacementEndIndex - 1));
  const normalizedNodes = Array.from(editorClone.childNodes);
  const normalizedTrailingUnchangedCount = Math.max(0, originalNodes.length - endTopLevelIndex - 1);
  const normalizedReplacementEndIndex = Math.max(
    startTopLevelIndex,
    normalizedNodes.length - normalizedTrailingUnchangedCount,
  );
  const replacementNodes = normalizedNodes.slice(startTopLevelIndex, normalizedReplacementEndIndex);
  if (!replacementNodes.length) return false;

  const wrappedHtml = replacementNodes.map((node) => serializeNode(node)).join("");
  const parsed = foundry.prosemirror.dom.parseString(wrappedHtml, state.schema);
  const from = view.posAtDOM(editorRoot, startTopLevelIndex);
  const to = view.posAtDOM(editorRoot, endTopLevelIndex + 1);
  const tr = state.tr.replaceRange(from, to, parsed.slice(0)).scrollIntoView();
  if (!tr.docChanged) return false;

  view.dispatch(tr);
  return true;
}

function autoformatJournalHtml(view) {
  const currentHtml = view?.dom?.innerHTML;
  if (typeof currentHtml !== "string" || !currentHtml.length) return false;

  let nextHtml = currentHtml;
  for (const { pattern, replacement } of AUTOFORMAT_PATTERNS) {
    nextHtml = nextHtml.replace(pattern, replacement);
  }

  if (nextHtml === currentHtml) return false;

  return replaceEditorHtml(view, nextHtml);
}

Hooks.on("getProseMirrorMenuDropDowns", (menu, dropdowns) => {
  if (!isJournalEditor(menu)) return;
  if (!isTsFormatMenuEnabled()) return;

  dropdowns.format ??= {};
  dropdowns.format.entries ??= [];
  if (dropdowns.format.entries.some((entry) => entry?.action === "tsu-sections")) return;

  dropdowns.format.entries.push({
    action: "tsu-sections",
    title: "TS",
    children: TS_SECTION_MENU_ENTRIES.map(({ action, title, className }) => ({
      action,
      title,
      priority: 3,
      cmd: (_state, _dispatch, view) => {
        wrapSelectionInSection(view, className);
      },
    })),
  });
});

Hooks.on("getProseMirrorMenuItems", (menu, items) => {
  if (!isJournalEditor(menu)) return;
  if (!isTsFormatMenuEnabled()) return;

  items.push({
    action: "tsu-journal-autoformat",
    title: "TS Journal Autoformat",
    icon: '<i class="fa-solid fa-wand-magic-sparkles fa-fw"></i>',
    scope: "text",
    cssClass: "right",
    cmd: (_state, _dispatch, view) => {
      autoformatJournalHtml(view);
    },
  });
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE_TS_FORMAT_MENU, {
    name: "TS_PF2E_UTILITY.Settings.Journals.TSFormatMenu.Name",
    hint: "TS_PF2E_UTILITY.Settings.Journals.TSFormatMenu.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });
});
