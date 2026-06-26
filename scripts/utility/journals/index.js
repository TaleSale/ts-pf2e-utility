import { MODULE_ID } from "../../core.js";
import "./autoformat.js";
import "./image-sections.js";
import { AoAJournalSheet } from "./AoA.js";
import { CCJournalSheet } from "./CC.js";
import { HRJournalSheet } from "./HR.js";
import { SoGJournalSheet } from "./SoG.js";
import { SDoSJournalSheet } from "./SDoS.js";

const SETTING_DEFAULT_JOURNAL_STYLE = "defaultJournalStyle";
const JOURNAL_STYLE_DEFAULT = "default";
const AOA_STYLE_KEY = "aoa";
const AOA_SHEET_ID = `${MODULE_ID}.AoAJournalSheet`;
const JOURNAL_STYLE_CC = "cc";
const CC_SHEET_ID = `${MODULE_ID}.CCJournalSheet`;
const CORE_DEFAULT_JOURNAL_SHEET_ID = "core.JournalEntrySheet";
const JOURNAL_STYLE_HR = "hr";
const HR_SHEET_ID = `${MODULE_ID}.HRJournalSheet`;
const JOURNAL_STYLE_SOG = "sog";
const SOG_SHEET_ID = `${MODULE_ID}.SoGJournalSheet`;
const JOURNAL_STYLE_SDOS = "sdos";
const SDOS_SHEET_ID = `${MODULE_ID}.SDoSJournalSheet`;
const DEFAULT_SHEET_THEMES = {
  dark: "SETTINGS.UI.FIELDS.colorScheme.choices.dark",
  light: "SETTINGS.UI.FIELDS.colorScheme.choices.light",
};

let syncingJournalStyle = false;

function getRenderedJournalSheetState(journal) {
  const sheet = journal?._sheet;
  if (!sheet?.rendered) return null;

  const position = sheet.position
    ? foundry.utils.deepClone(sheet.position)
    : null;

  return { position };
}

function getJournalStyleChoices() {
  return {
    [JOURNAL_STYLE_DEFAULT]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.Default"),
    [AOA_STYLE_KEY]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.AoA"),
    [JOURNAL_STYLE_CC]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.CC"),
    [JOURNAL_STYLE_HR]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.HR"),
    [JOURNAL_STYLE_SOG]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.SoG"),
    [JOURNAL_STYLE_SDOS]: game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.SDoS"),
  };
}

function getSheetIdForJournalStyle(style) {
  switch (style) {
    case AOA_STYLE_KEY:
      return AOA_SHEET_ID;
    case JOURNAL_STYLE_CC:
      return CC_SHEET_ID;
    case JOURNAL_STYLE_HR:
      return HR_SHEET_ID;
    case JOURNAL_STYLE_SOG:
      return SOG_SHEET_ID;
    case JOURNAL_STYLE_SDOS:
      return SDOS_SHEET_ID;
    default:
      return CORE_DEFAULT_JOURNAL_SHEET_ID;
  }
}

function getCurrentCoreJournalSheetId() {
  return game.settings.get("core", "sheetClasses")?.JournalEntry?.[CONST.BASE_DOCUMENT_TYPE] ?? null;
}

function getJournalStyleFromCoreSetting() {
  const currentSheetId = getCurrentCoreJournalSheetId();
  if (currentSheetId === AOA_SHEET_ID) return AOA_STYLE_KEY;
  if (currentSheetId === CC_SHEET_ID) return JOURNAL_STYLE_CC;
  if (currentSheetId === HR_SHEET_ID) return JOURNAL_STYLE_HR;
  if (currentSheetId === SOG_SHEET_ID) return JOURNAL_STYLE_SOG;
  if (currentSheetId === SDOS_SHEET_ID) return JOURNAL_STYLE_SDOS;
  return JOURNAL_STYLE_DEFAULT;
}

async function applyJournalStyleLocally(style) {
  const targetSheetId = getSheetIdForJournalStyle(style);
  const classes = CONFIG.JournalEntry?.sheetClasses?.[CONST.BASE_DOCUMENT_TYPE];
  if (!foundry.utils.isPlainObject(classes)) return;

  for (const sheet of Object.values(classes)) {
    sheet.default = sheet.id === targetSheetId;
  }

  const collection = CONFIG.JournalEntry?.collection?.instance ?? [];
  for (const journal of collection) {
    const sheetState = getRenderedJournalSheetState(journal);
    if (!sheetState) {
      journal._sheet = null;
      continue;
    }

    await journal._onSheetChange({ sheetOpen: true });
    if (journal.sheet && !journal.sheet.rendered) {
      await journal.sheet.render(true);
    }
    if (sheetState.position && journal.sheet?.setPosition instanceof Function) {
      journal.sheet.setPosition(sheetState.position);
    }
  }
}

function localizeSheetLabel(label) {
  return typeof label === "function" ? label() : game.i18n.localize(label);
}

function registerJournalSheets() {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    getDocumentClass("JournalEntry"),
    MODULE_ID,
    AoAJournalSheet,
    {
      label: localizeSheetLabel("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.AoA"),
      canBeDefault: true,
      canConfigure: true,
      themes: DEFAULT_SHEET_THEMES,
    },
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    getDocumentClass("JournalEntry"),
    MODULE_ID,
    CCJournalSheet,
    {
      label: localizeSheetLabel("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.CC"),
      canBeDefault: true,
      canConfigure: true,
      themes: DEFAULT_SHEET_THEMES,
    },
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    getDocumentClass("JournalEntry"),
    MODULE_ID,
    HRJournalSheet,
    {
      label: localizeSheetLabel("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.HR"),
      canBeDefault: true,
      canConfigure: true,
      themes: DEFAULT_SHEET_THEMES,
    },
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    getDocumentClass("JournalEntry"),
    MODULE_ID,
    SoGJournalSheet,
    {
      label: localizeSheetLabel("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.SoG"),
      canBeDefault: true,
      canConfigure: true,
      themes: DEFAULT_SHEET_THEMES,
    },
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    getDocumentClass("JournalEntry"),
    MODULE_ID,
    SDoSJournalSheet,
    {
      label: localizeSheetLabel("TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Choices.SDoS"),
      canBeDefault: true,
      canConfigure: true,
      themes: DEFAULT_SHEET_THEMES,
    },
  );
}

async function applyJournalStyleToCore(style) {
  if (!game.user?.isGM) return;

  const targetSheetId = getSheetIdForJournalStyle(style);
  const currentSetting = foundry.utils.deepClone(game.settings.get("core", "sheetClasses"));
  currentSetting.JournalEntry ??= {};

  await applyJournalStyleLocally(style);

  if ((currentSetting.JournalEntry[CONST.BASE_DOCUMENT_TYPE] ?? null) === targetSheetId) return;

  currentSetting.JournalEntry[CONST.BASE_DOCUMENT_TYPE] = targetSheetId;
  await game.settings.set("core", "sheetClasses", currentSetting);
  foundry.applications.apps.DocumentSheetConfig.updateDefaultSheets(currentSetting);
}

async function syncModuleJournalStyleSetting() {
  if (!game.user?.isGM) return;

  const coreStyle = getJournalStyleFromCoreSetting();
  const currentStyle = game.settings.get(MODULE_ID, SETTING_DEFAULT_JOURNAL_STYLE);
  if (currentStyle === coreStyle) return;

  syncingJournalStyle = true;
  try {
    await game.settings.set(MODULE_ID, SETTING_DEFAULT_JOURNAL_STYLE, coreStyle);
  } finally {
    syncingJournalStyle = false;
  }
}

Hooks.once("init", () => {
  registerJournalSheets();

  game.settings.register(MODULE_ID, SETTING_DEFAULT_JOURNAL_STYLE, {
    name: "TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Name",
    hint: "TS_PF2E_UTILITY.Settings.Journals.DefaultStyle.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    choices: getJournalStyleChoices(),
    default: JOURNAL_STYLE_DEFAULT,
    onChange: (style) => {
      if (syncingJournalStyle) return;
      void applyJournalStyleToCore(style);
    },
  });
});

Hooks.once("ready", () => {
  foundry.applications.apps.DocumentSheetConfig.updateDefaultSheets(game.settings.get("core", "sheetClasses"));
  void applyJournalStyleLocally(getJournalStyleFromCoreSetting());
  void syncModuleJournalStyleSetting();
});
