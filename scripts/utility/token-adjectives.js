const MODULE_ID = "ts-pf2e-utility";
const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "tokenAdjective";

function getSceneTokens(scene) {
  return scene?.tokens?.contents ?? [];
}

function getBaseActor(token) {
  return game.actors?.get(token?.actorId) ?? token?.baseActor ?? token?.actor ?? null;
}

function uniqueTrimmedStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function getBaseTokenNameCandidates(token) {
  const baseActor = getBaseActor(token);
  return uniqueTrimmedStrings([
    baseActor?.name,
    token?.actor?.name,
    baseActor?.prototypeToken?.name,
    baseActor?.flags?.babele?.originalName,
    token?.actor?.flags?.babele?.originalName,
    token?.name,
  ]);
}

function getBaseTokenName(token) {
  return getBaseTokenNameCandidates(token)[0] ?? "";
}

function isEligibleCreatureToken(token) {
  if (!token?.actor) return false;
  if (token.actor.type !== "npc") return false;
  if (token.actor.system?.traits?.rarity === "unique") return false;
  if (token.actorLink) return false;
  if (token.getFlag?.(FLAG_SCOPE, FLAG_KEY)) return true;

  const tokenName = String(token.name ?? "").trim();
  const baseNames = getBaseTokenNameCandidates(token);
  if (!baseNames.length) return true;
  return baseNames.includes(tokenName);
}

function hasCurrentModuleAdjective(token, adjectives) {
  const adjective = token.getFlag?.(FLAG_SCOPE, FLAG_KEY)?.adjective;
  return typeof adjective === "string" && adjectives.includes(adjective);
}

function getBaseName(token) {
  const stored = token.getFlag?.(FLAG_SCOPE, FLAG_KEY)?.baseName;
  const baseName = typeof stored === "string" && stored.trim()
    ? stored.trim()
    : getBaseTokenName(token);
  return baseName || "Существо";
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function hasNonAsciiText(values) {
  return values.some((value) => /[^\u0000-\u007f]/.test(value));
}

function hasCyrillicText(values) {
  return values.some((value) => /[А-Яа-яЁё]/.test(value));
}

function matchesCurrentLanguage(values) {
  const lang = game.i18n?.lang ?? "en";
  if (lang === "en") return true;
  if (lang.startsWith("ru")) return hasCyrillicText(values);
  return hasNonAsciiText(values);
}

function getTokenAdjectivePath() {
  return CONFIG.Token?.adjectivesPrefix ?? "TOKEN.Adjectives";
}

function collectTokenAdjectives(source) {
  const path = getTokenAdjectivePath();
  const values = [];
  const nested = foundry.utils.getProperty(source ?? {}, path);

  if (nested && typeof nested === "object") {
    values.push(...Object.values(nested));
  }

  for (const [key, value] of Object.entries(source ?? {})) {
    if (key.startsWith(`${path}.`)) values.push(value);
  }

  return uniqueStrings(values.filter((value) => typeof value === "string"));
}

function getInstalledModules() {
  const modules = game.modules;
  return typeof modules?.values === "function" ? Array.from(modules.values()) : Array.from(modules ?? []);
}

function shouldInspectModuleTranslations(module) {
  return module?.active || module?.coreTranslation || module?.manifest?.coreTranslation;
}

function shouldInspectLanguage(language, lang) {
  const languageId = language?.lang;
  const matchesCurrentLanguage = languageId === lang
    || languageId?.startsWith(`${lang}-`)
    || lang.startsWith(`${languageId}-`);
  if (!language?.path || !matchesCurrentLanguage) return false;

  const matchesSystem = !language.system || language.system === game.system?.id;
  const matchesModule = !language.module || game.modules?.get(language.module)?.active;
  return matchesSystem && matchesModule;
}

function getLanguageFilesForCurrentLanguage() {
  const lang = game.i18n?.lang;
  if (!lang || lang === "en") return [];

  const files = [];
  for (const module of getInstalledModules()) {
    if (!shouldInspectModuleTranslations(module)) continue;

    const languages = module.languages ?? module.manifest?.languages ?? [];
    for (const language of languages) {
      if (!shouldInspectLanguage(language, lang)) continue;
      files.push(language.path);
      if (!language.path.startsWith("modules/")) {
        files.push(`modules/${module.id}/${language.path}`);
      }
    }
  }

  return uniqueStrings(files);
}

function getRussianInterfaceTranslationFiles() {
  if (!game.i18n?.lang?.startsWith("ru")) return [];

  const candidates = [];
  for (const moduleId of ["rus", "rus-main", "ru-ru"]) {
    if (game.modules?.get(moduleId)?.active || moduleId === "rus-main") {
      candidates.push(`modules/${moduleId}/interface.json`);
      candidates.push(`modules/${moduleId}/lang/ru.json`);
      candidates.push(`modules/${moduleId}/lang/ru-RU.json`);
    }
  }

  return candidates;
}

async function loadTranslationFile(file) {
  const response = await fetch(file);
  if (!response.ok) return {};

  const data = await response.json();
  return foundry.utils.expandObject(data);
}

async function getAdjectivesFromLanguageFiles() {
  const adjectives = [];
  for (const file of uniqueStrings([...getLanguageFilesForCurrentLanguage(), ...getRussianInterfaceTranslationFiles()])) {
    try {
      const data = await loadTranslationFile(file);
      adjectives.push(...collectTokenAdjectives(data));
    } catch (error) {
      console.debug(`${MODULE_ID} | Failed to inspect translation file ${file}`, error);
    }
  }

  return uniqueStrings(adjectives);
}

async function getFoundryTokenAdjectives() {
  const path = CONFIG.Token?.adjectivesPrefix ?? "TOKEN.Adjectives";
  const isEnglish = game.i18n?.lang === "en";
  const translations = collectTokenAdjectives(game.i18n?.translations);

  if (!isEnglish && matchesCurrentLanguage(translations)) {
    return translations;
  }

  if (!isEnglish) {
    const translatedFiles = await getAdjectivesFromLanguageFiles();
    if (matchesCurrentLanguage(translatedFiles)) return translatedFiles;
  }

  if (translations.length) return translations;

  const translatedFiles = await getAdjectivesFromLanguageFiles();
  if (translatedFiles.length) return translatedFiles;

  const fallback = foundry.utils.getProperty(game.i18n?._fallback ?? {}, path);
  const source = fallback || {};
  const keys = Object.keys(source);

  const localizedFromKeys = keys
    .map((key) => game.i18n?.localize?.(`${path}.${key}`))
    .filter((value) => typeof value === "string" && value.trim() && !value.startsWith(`${path}.`));
  if (localizedFromKeys.length) return uniqueStrings(localizedFromKeys);

  return uniqueStrings(Object.values(source).filter((value) => typeof value === "string" && value.trim()));
}

function pickAdjective(adjectives, baseName, usedNames) {
  const shuffled = [...adjectives].sort(() => Math.random() - 0.5);
  for (const adjective of shuffled) {
    const nextName = `${adjective} ${baseName}`;
    if (!usedNames.has(nextName)) return { adjective, nextName };
  }

  const adjective = shuffled[0] ?? "";
  let suffix = 2;
  let nextName = `${adjective} ${baseName} ${suffix}`;
  while (usedNames.has(nextName)) {
    suffix += 1;
    nextName = `${adjective} ${baseName} ${suffix}`;
  }
  return { adjective, nextName };
}

export async function assignTokenAdjectivesToCurrentScene() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n?.localize("TS_PF2E_UTILITY.Notifications.OnlyGM") ?? "Only GM");
    return;
  }

  const scene = canvas?.scene ?? game.scenes?.viewed ?? null;
  if (!scene) {
    ui.notifications?.warn("Откройте сцену, на которой нужно выдать прилагательные токенам.");
    return;
  }

  const adjectives = await getFoundryTokenAdjectives();
  if (!adjectives.length) {
    ui.notifications?.warn("Foundry не вернул список прилагательных для токенов.");
    return;
  }

  const tokens = getSceneTokens(scene);
  const usedNames = new Set(tokens.map((token) => String(token.name ?? "").trim()).filter(Boolean));
  const updates = [];
  let skippedLinked = 0;
  let skippedNonCreatures = 0;
  let skippedUnique = 0;
  let skippedCustomNames = 0;
  let skippedExisting = 0;

  for (const token of tokens) {
    if (!token?.actor || token.actor.type !== "npc") {
      skippedNonCreatures += 1;
      continue;
    }

    if (token.actor.system?.traits?.rarity === "unique") {
      skippedUnique += 1;
      continue;
    }

    if (token.actorLink) {
      skippedLinked += 1;
      continue;
    }

    if (!isEligibleCreatureToken(token)) {
      skippedCustomNames += 1;
      continue;
    }

    if (hasCurrentModuleAdjective(token, adjectives)) {
      skippedExisting += 1;
      continue;
    }

    const baseName = getBaseName(token);
    const { adjective, nextName } = pickAdjective(adjectives, baseName, usedNames);
    usedNames.add(nextName);
    updates.push({
      _id: token.id,
      name: nextName,
      flags: {
        [FLAG_SCOPE]: {
          [FLAG_KEY]: { adjective, baseName },
        },
      },
    });
  }

  if (!updates.length) {
    ui.notifications?.info(`На сцене "${scene.name}" нет подходящих существ без прилагательных.`);
    return;
  }

  await scene.updateEmbeddedDocuments("Token", updates);
  ui.notifications?.info(
    `Прилагательные выданы: ${updates.length}. Пропущено уникальных: ${skippedUnique}. Пропущено с привязкой данных актера: ${skippedLinked}. Пропущено с собственным именем: ${skippedCustomNames}. Уже были с прилагательными: ${skippedExisting}.`,
  );
}
