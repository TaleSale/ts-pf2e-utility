import { MODULE_ID } from "./core.js";

const SUPPORTED_LANGUAGES = Object.freeze(["en", "ru"]);
const LOCALIZATION_FILES = Object.freeze([
  "devils-pin.json",
  "kuboker.json",
]);

async function mergeLocalizationFile(lang, file, target) {
  try {
    const json = await foundry.utils.fetchJsonWithTimeout(`modules/${MODULE_ID}/lang/${lang}/${file}`);
    foundry.utils.mergeObject(target, json, {
      inplace: true,
      insertKeys: true,
      overwrite: true,
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to load ${lang}/${file}`, error);
  }
}

async function mergeLocalizationSet(lang, target) {
  for (const file of LOCALIZATION_FILES) {
    await mergeLocalizationFile(lang, file, target);
  }
}

export function registerModularLocalization() {
  Hooks.once("i18nInit", async () => {
    const lang = game.i18n?.lang ?? "en";
    const targetLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : "en";

    game.i18n._fallback ||= {};

    if (targetLang !== "en") {
      await mergeLocalizationSet("en", game.i18n._fallback);
    }

    await mergeLocalizationSet(targetLang, game.i18n.translations);
    console.log(`${MODULE_ID} | Localization loaded for: ${targetLang}`);
  });
}
