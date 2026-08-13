import { MODULE_ID, SOCKET_CHANNEL, escapeHtml, i18nKey } from "../core.js";

const ENABLE_SETTING = "enableBastardhallSheet";
const DATA_SETTING = "bastardhallData";
const EFFECT_FLAG = "bastardhallEffect";
const DARKNESS_FLAG = "bastardhallDarkness";
const APP_ID = "tsu-bastardhall-sheet";

const AREA_NAMES = Object.freeze([
  "Береговая Линия",
  "Замковые Территории",
  "Подвалы",
  "Приёмные Залы",
  "Подземелье",
  "Личные Залы",
  "Храм",
  "Катакомбы",
  "Башни",
]);

const COLLECTIONS = Object.freeze({
  arts: { label: "Произведения искусства", slugs: ["arts"] },
  gears: { label: "Шестерёнки", slugs: ["gears"] },
  remnants: { label: "Мерзкие остатки", slugs: ["vile-remnant"] },
});

const SOULHEARTS = Object.freeze({
  simple: {
    label: "Простой",
    hp: 1,
    fromRank: 0,
    toRank: 1,
    shape: "circle",
    defaultSlugs: ["soulheart"],
  },
  greater: {
    label: "Большой",
    hp: 2,
    fromRank: 1,
    toRank: 2,
    shape: "diamond",
    defaultSlugs: ["soulheart-greater"],
  },
  strong: {
    label: "Сильный",
    hp: 3,
    fromRank: 2,
    toRank: 3,
    shape: "square",
    defaultSlugs: ["soulheart-major"],
  },
});

const PHANTOMS = Object.freeze([
  { id: "aron", name: "Арон Мордримус", role: "Трактирщик" },
  { id: "ausken", name: "Аускен Даст", role: "Шериф" },
  { id: "banidjer", name: "Баниджер Грили", role: "Торговец" },
  { id: "esmira", name: "Эсмира Вермидиан", role: "Наставник" },
  { id: "ilana", name: "Илана Гринбоу", role: "Ремесленник" },
  { id: "shireyl", name: "Ширейл Анимендер", role: "Жрица" },
]);

const DEFAULT_RESEARCH_TOPICS = Object.freeze([
  "Бастардхолл",
  "Проклятие",
  "Семья Арудора",
  "Флорин Киндлер",
  ...Array.from({ length: 14 }, (_value, index) => `Тема изыскания ${index + 5}`),
]);

const DEFAULT_NIGHT_NPC_RULES = JSON.stringify([
  { key: "FlatModifier", selector: "initiative", type: "untyped", value: 1 },
  { key: "FlatModifier", selector: "saving-throw", type: "untyped", value: 1, predicate: ["item:trait:holy"] },
], null, 2);

const DEFAULT_NIGHT_PC_RULES = JSON.stringify([
  { key: "FlatModifier", selector: "saving-throw", type: "untyped", value: -1, predicate: ["item:trait:fear"] },
], null, 2);

const DEFAULT_PHANTOM_BONUSES = Object.freeze({
  aron: [
    "В «Покое Орма» ПИ получают бонус предмета +1 к проверкам Проживания.",
    "Арон получает физическое тело. ПИ могут брать до 2 созданных им напитков в день на всю группу.",
    "Арон создаёт более сильные напитки; общий лимит остаётся равен 2 напиткам в день на всю группу.",
    "ПИ могут брать до 3 напитков в день на всю группу. Арон также может противодействовать недугу со средним модификатором группы.",
  ],
  ausken: [
    "Аускен помогает бесплатно наносить или переносить 1 руну в день с ограничением по уровню руны.",
    "Доступно Благословение шерифа. Аускен создаёт и устанавливает до 2 доступных рун в день (до 8-го уровня).",
    "После заката ПИ ещё 1 час не получают ночной штраф. Аускен работает с 3 рунами в день (до 11-го уровня).",
    "ПИ полностью игнорируют ночной штраф. Благословение действует 24 часа и может быть дано двум ПИ; доступно 4 руны в день (до 14-го уровня).",
  ],
  banidjer: [
    "Баниджер обслуживает торговую лавку в Майсерин. Доступны обычные предметы до 5-го уровня включительно.",
    "Баниджер проявляет физическое тело. Лавка предлагает обычные предметы до 8-го уровня включительно.",
    "Лавка предлагает обычные предметы до 11-го уровня включительно.",
    "Лавка предлагает обычные предметы до 14-го уровня включительно.",
  ],
  esmira: [
    "В школе Эсмиры ПИ получают бонус предмета +1 к Расшифровке текста, Идентификации магии и алхимии, Изучению заклинания и другим перечисленным занятиям.",
    "Бонус предмета +1 также применяется к проверкам Изыскания, выполняемым в библиотеке Эсмиры.",
    "Бонус предмета школы и библиотеки увеличивается до +2.",
    "Можно взять из библиотеки один переносной комплект книг, постоянно дающий бонус предмета +2 к выбранному виду проверки, пока комплект находится у ПИ.",
  ],
  ilana: [
    "В мастерской Иланы ПИ получают бонус предмета +1 к Созданию и Ремонту. Доступен Заработок денег задачами до 1-го уровня.",
    "Илана получает физическое тело. Доступен Заработок денег задачами до 8-го уровня.",
    "Бонус предмета к Созданию и Ремонту увеличивается до +2; доступны задачи Заработка денег до 11-го уровня.",
    "Доступны задачи Заработка денег до 14-го уровня.",
  ],
  shireyl: [
    "В церкви Ширейл ПИ получают бонус предмета +1 к Лечению ран и Лечению ядов. Бонус к противодействию недугам и ритуалам учитывается мастером вручную.",
    "Ширейл может один раз воскресить ПИ и обучает ритуалу «Сердечные узы». Бонус лечения остаётся +1.",
    "Бонус предмета к Лечению ран и Лечению ядов увеличивается до +2; доступно дополнительное воскрешение и ритуал «Реинкарнация».",
    "Доступно третье воскрешение и ритуал «Укрепляющее варево».",
  ],
});

const LEGACY_ARON_BONUSES = Object.freeze([
  "В «Покое Орма» ПИ получают бонус предмета +1 к проверкам Проживания.",
  "Арон получает физическое тело. ПИ могут брать до 2 созданных им напитков в день.",
  "Арон создаёт более сильные напитки; лимит остаётся равен 2 напиткам в день.",
  "ПИ могут брать до 3 напитков в день. Арон также может противодействовать недугу со средним модификатором группы.",
]);

function defaultPhantomBonuses(phantom) {
  return [...(DEFAULT_PHANTOM_BONUSES[phantom.id] ?? ["", "", "", ""])];
}

function createDefaultMementos() {
  const definitions = [
    {
      id: "jinnivere-riding-crop",
      name: "Хлыст Джиннивер",
      slug: "jinniveres-riding-crop",
      foundArea: "Замковые Территории",
      area: "Подвалы",
      bonus: "Спутники ПИ (такие как фамильяры, эйдолоны и звери-компаньоны) получают бонус состояния +1 ко всем спасброскам до конца Пути Приключений.",
    },
    {
      id: "augsten-cudgel",
      name: "Дубинка Аугстена",
      slug: "augstens-cudgel",
      foundArea: "Подвалы",
      area: "Приёмные Залы",
      bonus: "Персонажи игроков получают нетипичный бонус +1 к инициативе до конца Пути Приключений.",
      rules: JSON.stringify([{ key: "FlatModifier", selector: "initiative", type: "untyped", value: 1 }], null, 2),
    },
    {
      id: "alisendra-fan",
      name: "Веер Алисендры",
      slug: "alisendras-fan",
      foundArea: "Приёмные Залы",
      area: "Подземелье",
      bonus: "Персонажи игроков получают нетипичный бонус +1 к проверкам Вспомнить информацию до конца Пути Приключений.",
      rules: JSON.stringify([{ key: "FlatModifier", selector: "skill-check", type: "untyped", value: 1, predicate: ["action:recall-knowledge"] }], null, 2),
    },
    {
      id: "dazerien-thumbscrew",
      name: "Тиски Дазериэна",
      slug: "dazeriens-thumbscrew",
      foundArea: "Подземелье",
      area: "Личные Залы",
      bonus: "Когда ПИ совершает 8-часовой отдых, он восстанавливает дополнительные ОЗ в количестве, равном его модификатору Телосложения (минимум 1), умноженному на его уровень. Это благо действует до конца Пути Приключений.",
    },
    {
      id: "raudltz-telescope",
      name: "Подзорная труба Раудлица",
      slug: "raudltzs-telescope",
      foundArea: "Личные Залы",
      area: "Храм",
      bonus: "Персонажи игроков получают нетипичный бонус +2 к проверкам Восприятия при действии Поиск до конца Пути Приключений.",
      rules: JSON.stringify([{ key: "FlatModifier", selector: "perception", type: "untyped", value: 2, predicate: ["action:seek"] }], null, 2),
    },
    {
      id: "ryhasphinea-hourglass",
      name: "Песочные часы Рихасфинеи",
      slug: "ryhasphineas-hourglass",
      foundArea: "Храм",
      area: "Катакомбы",
      bonus: "Персонажи игроков получают нетипичный бонус +2 ко всем проверкам восстановления от состояния при смерти до конца Пути Приключений.",
      rules: JSON.stringify([{ key: "FlatModifier", selector: "dying-recovery", type: "untyped", value: 2 }], null, 2),
    },
    {
      id: "irrokcis-medallion",
      name: "Медальон Ирроксиса",
      slug: "irrokciss-medallion",
      foundArea: "Катакомбы",
      area: "Башни",
      bonus: "Все Удары оружием персонажей игроков наносят 1 дополнительный духовный урон до конца Пути Приключений.",
      rules: JSON.stringify([{
        key: "FlatModifier",
        selector: "strike-damage",
        type: "untyped",
        value: 1,
        damageType: "spirit",
        slug: "irrokcis-medallion-damage",
        predicate: ["item:type:weapon", { not: "item:category:unarmed" }],
      }], null, 2),
    },
  ];
  return definitions.map((entry) => ({ rules: "[]", wallUuids: "", ...entry }));
}

function createDefaultData() {
  return {
    version: 7,
    inventory: [],
    soulhearts: {
      simple: 0,
      greater: 0,
      strong: 0,
      images: { simple: "", greater: "", strong: "" },
      slugs: Object.fromEntries(Object.entries(SOULHEARTS).map(([key, value]) => [key, value.defaultSlugs.join(", ")])),
    },
    collections: { arts: 0, gears: 0, remnants: 0 },
    homebrew: { medallionUnarmed: false },
    research: DEFAULT_RESEARCH_TOPICS.map((name, index) => ({ id: `research-${index + 1}`, name, points: -1 })),
    phantoms: PHANTOMS.map((phantom) => ({ ...phantom, found: false, rank: 0, actorUuid: "", bonuses: defaultPhantomBonuses(phantom) })),
    mementos: createDefaultMementos(),
    climate: {
      stages: {
        initial: {
          sunrise: 7.5,
          sunset: 19.5,
          description: "Небо по большей части ясное, видно лишь несколько облаков. Температура прохладная и свежая, а ветер ограничивается периодическими порывами, которые кажутся скорее освежающими, чем холодными.",
        },
        phantoms: {
          sunrise: 8,
          sunset: 19,
          description: "Небо становится пасмурным. Температура остается прохладной и свежей, но периодические порывы ветра теперь несут ощутимую ледяную кусачесть.",
        },
        jinnivere: {
          sunrise: 8.5,
          sunset: 18.5,
          description: "Небо темнеет и остается пасмурным на протяжении всего дня. Температура остается прохладной и свежей, но периодические порывы ветра теперь становятся более частыми и время от времени перерастают в шквалы. При каждом закате гремит гул далёкого грома.",
        },
      },
      sceneRefs: "",
      excludedNpcRefs: "",
      stormActive: false,
      night: {
        darkness: 1,
        npcRules: DEFAULT_NIGHT_NPC_RULES,
        pcRules: DEFAULT_NIGHT_PC_RULES,
      },
      storm: {
        darkness: "",
        description: "",
        npcRules: "[]",
        pcRules: "[]",
      },
    },
  };
}

function clone(value) {
  return foundry.utils.deepClone(value);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function inventoryStackKey(entry) {
  const category = String(entry?.category ?? "other");
  const identity = category === "memento"
    ? entry?.mementoId
    : (entry?.slug || entry?.name || entry?.uuid || entry?.id);
  return `${category}:${normalizeLookup(identity)}`;
}

function stackInventoryEntries(entries) {
  const stacks = [];
  const byKey = new Map();

  for (const rawEntry of normalizeArray(entries)) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = { ...rawEntry, quantity: Math.max(1, Number(rawEntry.quantity) || 1) };
    const key = inventoryStackKey(entry);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      stacks.push(entry);
      continue;
    }

    existing.quantity += entry.quantity;
    const existingTime = Number(existing.depositedAt) || 0;
    const entryTime = Number(entry.depositedAt) || 0;
    if (entryTime >= existingTime) {
      for (const property of ["uuid", "name", "slug", "img", "depositedBy", "depositedAt"]) {
        if (entry[property] !== undefined && entry[property] !== null && entry[property] !== "") {
          existing[property] = entry[property];
        }
      }
    }
  }

  return stacks.sort((left, right) => (Number(left.depositedAt) || 0) - (Number(right.depositedAt) || 0));
}

function normalizeData(raw) {
  const storedVersion = Number(raw?.version ?? 0);
  const data = foundry.utils.mergeObject(createDefaultData(), clone(raw ?? {}), {
    inplace: false,
    recursive: true,
    overwrite: true,
  });
  data.version = 7;
  data.inventory = stackInventoryEntries(data.inventory);
  if (storedVersion < 6) {
    data.soulhearts.slugs = Object.fromEntries(Object.entries(SOULHEARTS).map(([key, value]) => [key, value.defaultSlugs.join(", ")]));
  }
  data.research = normalizeArray(data.research).slice(0, 18);
  while (data.research.length < 18) {
    const index = data.research.length;
    data.research.push({ id: `research-${index + 1}`, name: DEFAULT_RESEARCH_TOPICS[index], points: -1 });
  }
  if (storedVersion < 3) {
    data.research = data.research.map((topic) => ({ ...topic, points: Number(topic.points) === 0 ? -1 : Number(topic.points) }));
  }
  data.phantoms = normalizeArray(data.phantoms);
  data.phantoms = PHANTOMS.map((definition) => {
    const stored = data.phantoms.find((entry) => entry?.id === definition.id) ?? {};
    const bonuses = normalizeArray(stored.bonuses);
    const found = stored.found === true || Number(stored.rank) > 0;
    return {
      ...definition,
      ...stored,
      found,
      rank: Math.clamp(Number(stored.rank) || 0, 0, 3),
      bonuses: Array.from({ length: 4 }, (_value, index) => {
        const storedBonus = String(bonuses[index] ?? "").trim();
        const migrateAronBonus = storedVersion < 7 && definition.id === "aron" && storedBonus === LEGACY_ARON_BONUSES[index];
        const migrateDefault = migrateAronBonus || (storedVersion < 5 && (definition.id === "banidjer" || !storedBonus));
        return String(migrateDefault ? defaultPhantomBonuses(definition)[index] : (storedBonus || defaultPhantomBonuses(definition)[index] || ""));
      }),
    };
  });
  data.mementos = normalizeArray(data.mementos);
  const defaults = createDefaultMementos();
  data.mementos = defaults.map((definition) => {
    const stored = data.mementos.find((entry) => entry?.id === definition.id) ?? {};
    const merged = {
      ...definition,
      ...stored,
    };
    if (storedVersion < 3) {
      merged.foundArea = definition.foundArea;
      merged.area = definition.area;
    }
    if (storedVersion < 4 && ["dazerien-thumbscrew", "raudltz-telescope", "ryhasphinea-hourglass", "irrokcis-medallion"].includes(definition.id)) {
      Object.assign(merged, definition, { wallUuids: stored.wallUuids ?? definition.wallUuids });
    }
    return merged;
  });
  return data;
}

function getData() {
  return normalizeData(game.settings.get(MODULE_ID, DATA_SETTING));
}

async function saveData(data) {
  if (!game.user?.isGM) throw new Error("Only a GM can save Bastardhall data.");
  await game.settings.set(MODULE_ID, DATA_SETTING, normalizeData(data));
}

function getItemSlug(item) {
  return String(item?.slug ?? item?.system?.slug ?? item?.name ?? "").trim().toLowerCase();
}

function splitRefs(value) {
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLookup(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function matchesConfiguredSlug(item, configured) {
  const slug = getItemSlug(item);
  const name = normalizeLookup(item?.name);
  return splitRefs(configured).some((candidate) => {
    const normalized = normalizeLookup(candidate);
    return normalized && (normalizeLookup(slug) === normalized || name === normalized);
  });
}

function identifySoulheart(item, data) {
  for (const [tier, definition] of Object.entries(SOULHEARTS)) {
    if (matchesConfiguredSlug(item, data.soulhearts.slugs[tier])) return { tier, ...definition };
  }

  const haystack = `${getItemSlug(item)} ${String(item?.name ?? "").toLowerCase()}`;
  if (/simple|lesser|простой|малый/.test(haystack) && /soul|серд/.test(haystack)) return { tier: "simple", ...SOULHEARTS.simple };
  if (/greater|большой|средн/.test(haystack) && /soul|серд/.test(haystack)) return { tier: "greater", ...SOULHEARTS.greater };
  if (/major|powerful|strong|сильн|мощн/.test(haystack) && /soul|серд/.test(haystack)) return { tier: "strong", ...SOULHEARTS.strong };
  return null;
}

function identifyCollection(item) {
  for (const [key, definition] of Object.entries(COLLECTIONS)) {
    if (definition.slugs.includes(getItemSlug(item))) return key;
  }
  return null;
}

function identifyMemento(item, data) {
  return data.mementos.find((entry) => entry.slug && matchesConfiguredSlug(item, entry.slug)) ?? null;
}

function getQuantity(item) {
  return Math.max(1, Number(item?.system?.quantity ?? 1) || 1);
}

function totalBonusHp(data) {
  return Object.entries(SOULHEARTS).reduce((sum, [tier, definition]) => (
    sum + ((Number(data.soulhearts[tier]) || 0) * definition.hp)
  ), 0);
}

function allPhantomsFound(data) {
  return data.phantoms.length === PHANTOMS.length && data.phantoms.every((phantom) => phantom.found === true);
}

function jinnivereReturned(data) {
  return data.inventory.some((entry) => (
    entry.category === "memento"
    && (entry.mementoId === "jinnivere-riding-crop" || entry.slug === "jinniveres-riding-crop")
  ));
}

function normalizeHour(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.clamp(numeric, 0, 23.99) : fallback;
}

function formatHour(value) {
  const totalMinutes = Math.round(normalizeHour(value, 0) * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getClimateStage(data) {
  const stages = data.climate.stages ?? {};
  let key = "initial";
  let label = "Береговая Линия";
  if (allPhantomsFound(data)) {
    key = "phantoms";
    label = "Замковые Территории";
  }
  if (jinnivereReturned(data)) {
    key = "jinnivere";
    label = "Подвал";
  }
  const defaults = createDefaultData().climate.stages[key];
  const configured = stages[key] ?? defaults;
  const sunrise = normalizeHour(configured.sunrise, defaults.sunrise);
  const sunset = normalizeHour(configured.sunset, defaults.sunset);
  const dayDuration = sunrise <= sunset ? sunset - sunrise : (24 - sunrise) + sunset;
  return {
    key,
    label,
    sunrise,
    sunset,
    sunriseLabel: formatHour(sunrise),
    sunsetLabel: formatHour(sunset),
    dayDuration,
    nightDuration: 24 - dayDuration,
    description: String(configured.description ?? defaults.description ?? ""),
    dayDurationLabel: Number.isInteger(dayDuration) ? String(dayDuration) : String(dayDuration).replace(".5", "½"),
    nightDurationLabel: Number.isInteger(24 - dayDuration) ? String(24 - dayDuration) : String(24 - dayDuration).replace(".5", "½"),
  };
}

function isDaytime(data) {
  const components = currentClockComponents();
  const hour = components
    ? Number(components.hour ?? 0) + (Number(components.minute ?? 0) / 60) + (Number(components.second ?? 0) / 3600)
    : (Number(game.time?.worldTime ?? 0) / 3600) % 24;
  const stage = getClimateStage(data);
  const start = stage.sunrise;
  const end = stage.sunset;
  if (start === end) return true;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function currentClockComponents() {
  // PF2e's clock applies its configured `worldCreatedOn` offset to the raw
  // Foundry counter. This is the same Luxon DateTime used by the visible
  // `game.pf2e.worldClock` window.
  const pf2eWorldTime = game.pf2e?.worldClock?.worldTime;
  if (Number.isFinite(Number(pf2eWorldTime?.hour))) {
    return {
      hour: Number(pf2eWorldTime.hour),
      minute: Number(pf2eWorldTime.minute),
      second: Number(pf2eWorldTime.second),
    };
  }

  // Seasons & Stars can apply a system-specific world-time transformation
  // (notably for PF2e/Golarion). Its public date API must therefore take
  // precedence over Foundry's raw calendar components and other clock UIs.
  try {
    const date = game.seasonsStars?.api?.getCurrentDate?.();
    const components = date?.time ?? date?.toObject?.()?.time;
    if (Number.isFinite(Number(components?.hour))) return components;
  } catch (_error) {
    // Fall through when Seasons & Stars is not active or not ready yet.
  }

  const simpleTimekeepingComponents = ui.simpleTimekeeping?.components;
  if (Number.isFinite(Number(simpleTimekeepingComponents?.hour))) return simpleTimekeepingComponents;

  const visibleClockText = document.querySelector("#simple-timekeeping #date-time-text")?.textContent ?? "";
  const visibleClockMatch = visibleClockText.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s|$)/);
  if (visibleClockMatch) {
    return {
      hour: Number(visibleClockMatch[1]),
      minute: Number(visibleClockMatch[2]),
      second: Number(visibleClockMatch[3] ?? 0),
    };
  }
  const calendar = game.time?.calendar;
  const worldTime = Number(game.time?.worldTime ?? 0);
  if (typeof calendar?.timeToComponents === "function") {
    try {
      const components = calendar.timeToComponents(worldTime);
      if (Number.isFinite(Number(components?.hour))) return components;
    } catch (_error) {
      // Fall through to other installed calendar APIs.
    }
  }
  try {
    const components = globalThis.SimpleCalendar?.api?.currentDateTime?.();
    if (Number.isFinite(Number(components?.hour))) return components;
  } catch (_error) {
    // Fall through to Foundry's own components.
  }
  return game.time?.components ?? null;
}

function currentWorldHour() {
  const components = currentClockComponents();
  return components
    ? Number(components.hour ?? 0) + (Number(components.minute ?? 0) / 60) + (Number(components.second ?? 0) / 3600)
    : ((Number(game.time?.worldTime ?? 0) / 3600) % 24 + 24) % 24;
}

function currentWorldTimeLabel() {
  const totalSeconds = Math.floor(currentWorldHour() * 3600) % 86400;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function phantomRank(data, id) {
  const phantom = data.phantoms.find((entry) => entry.id === id);
  return phantom?.found ? Number(phantom.rank) || 0 : -1;
}

function pcNightPenaltyActive(data, nightActive) {
  if (!nightActive) return false;
  const rank = phantomRank(data, "ausken");
  if (rank >= 3) return false;
  if (rank < 2) return true;
  const sunset = getClimateStage(data).sunset;
  const elapsedSinceSunset = (currentWorldHour() - sunset + 24) % 24;
  return elapsedSinceSunset >= 1;
}

function phantomPermanentEffect(id, rank) {
  if (rank < 0) return null;
  if (id === "aron") return {
    name: "Поддержка Арона",
    description: "Бонус предмета +1 к проверкам Проживания в «Покое Орма».",
    rules: [
      { key: "RollOption", domain: "all", option: "bastardhall:location:orms-rest", toggleable: true, label: "В «Покое Орма»" },
      { key: "FlatModifier", selector: "survival", type: "item", value: 1, predicate: ["bastardhall:location:orms-rest", "action:subsist"] },
    ],
    img: "icons/containers/kitchenware/mug-stein-wood-brown.webp",
  };
  if (id === "esmira") {
    const value = rank >= 2 ? 2 : 1;
    return {
      name: "Поддержка Эсмиры",
      description: `В школе и библиотеке Эсмиры перечисленные проверки получают бонус предмета +${value}. Ограничение по месту контролирует мастер.`,
      rules: [
        { key: "RollOption", domain: "all", option: "bastardhall:location:esmira-library", toggleable: true, label: "В школе или библиотеке Эсмиры" },
        {
          key: "FlatModifier",
          selector: "skill-check",
          type: "item",
          value,
          predicate: ["bastardhall:location:esmira-library", { or: ["action:borrow-an-arcane-spell", "action:decipher-writing", "action:identify-magic", "action:identify-alchemy", "action:learn-a-spell", "action:research"] }],
        },
      ],
      img: "icons/sundries/books/book-open-brown-black.webp",
    };
  }
  if (id === "ilana") {
    const value = rank >= 2 ? 2 : 1;
    return {
      name: "Поддержка Иланы",
      description: `В мастерской Иланы Создание и Ремонт получают бонус предмета +${value}. Ограничение по месту контролирует мастер.`,
      rules: [
        { key: "RollOption", domain: "all", option: "bastardhall:location:ilana-workshop", toggleable: true, label: "В мастерской Иланы" },
        { key: "FlatModifier", selector: "crafting", type: "item", value, predicate: ["bastardhall:location:ilana-workshop", { or: ["action:craft", "action:repair"] }] },
      ],
      img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    };
  }
  if (id === "shireyl") {
    const value = rank >= 2 ? 2 : 1;
    return {
      name: "Поддержка Ширейл",
      description: `В церкви Ширейл Лечение ран и Лечение ядов получают бонус предмета +${value}. Ограничение по месту контролирует мастер.`,
      rules: [
        { key: "RollOption", domain: "all", option: "bastardhall:location:shireyl-church", toggleable: true, label: "В церкви Ширейл" },
        { key: "FlatModifier", selector: "medicine", type: "item", value, predicate: ["bastardhall:location:shireyl-church", { or: ["action:treat-wounds", "action:treat-poison"] }] },
      ],
      img: "icons/magic/life/heart-cross-strong-flame-blue.webp",
    };
  }
  return null;
}

function parseRules(json, label) {
  try {
    const parsed = JSON.parse(String(json || "[]"));
    if (!Array.isArray(parsed)) throw new Error("Rule Elements must be an array.");
    return parsed;
  } catch (error) {
    console.warn(`${MODULE_ID} | Invalid Bastardhall Rule Elements (${label})`, error);
    return [];
  }
}

function isPrimaryGM() {
  const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
  return Boolean(game.user?.isGM && (!activeGM || activeGM.id === game.user.id));
}

function managedEffects(actor, key) {
  return actor?.items?.filter((item) => item.getFlag?.(MODULE_ID, EFFECT_FLAG) === key) ?? [];
}

function managedEffect(actor, key) {
  return managedEffects(actor, key)[0] ?? null;
}

function effectSource(key, name, description, rules, img = "systems/pf2e/icons/default-icons/effect.svg") {
  return {
    name,
    type: "effect",
    img: img || "systems/pf2e/icons/default-icons/effect.svg",
    system: {
      description: { value: `<p>${escapeHtml(description || name)}</p>` },
      duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
      level: { value: 1 },
      publication: { title: "", authors: "", license: "OGL", remaster: true },
      rules: clone(rules),
      slug: `tsu-${normalizeLookup(key)}`,
      start: { value: Number(game.time?.worldTime ?? 0), initiative: null },
      tokenIcon: { show: false },
      badge: null,
      unidentified: false,
      traits: { otherTags: [], value: [] },
    },
    flags: { [MODULE_ID]: { [EFFECT_FLAG]: key } },
  };
}

async function syncEffect(actor, key, active, sourceFactory) {
  const matches = managedEffects(actor, key);
  const existing = matches[0] ?? null;
  const duplicates = matches.slice(1);
  if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map((item) => item.id));
  if (!active) {
    if (existing) await actor.deleteEmbeddedDocuments("Item", [existing.id]);
    return;
  }

  const source = sourceFactory();
  if (!existing) {
    await actor.createEmbeddedDocuments("Item", [source]);
    return;
  }

  // Compare against the persisted source. PF2e prepares `system.rules` into
  // RuleElement instances, so comparing the prepared data with plain sources
  // can report a change on every reconciliation. Updating a GrantItem effect
  // then causes PF2e to grant its conditions again unnecessarily.
  const persistedSystem = existing._source?.system ?? existing.system ?? {};
  const currentRules = JSON.stringify(persistedSystem.rules ?? []);
  const nextRules = JSON.stringify(source.system.rules ?? []);
  const currentDescription = String(persistedSystem.description?.value ?? "");
  const tokenIconVisible = persistedSystem.tokenIcon?.show !== false;
  if (existing.name !== source.name || existing.img !== source.img || currentRules !== nextRules || currentDescription !== source.system.description.value || tokenIconVisible) {
    await existing.update({
      name: source.name,
      img: source.img,
      "system.description.value": source.system.description.value,
      "system.rules": source.system.rules,
      "system.tokenIcon.show": false,
    });
  }
}

function isPlayerCharacter(actor) {
  return actor?.type === "character";
}

function isExcludedPhantom(actor, data) {
  const refs = new Set(splitRefs(data.climate.excludedNpcRefs).map(normalizeLookup));
  const actorName = normalizeLookup(actor.name);
  for (const phantom of data.phantoms) {
    if (phantom.actorUuid) refs.add(normalizeLookup(phantom.actorUuid));
    const phantomName = normalizeLookup(phantom.name);
    refs.add(phantomName);
    if (phantomName && actorName.includes(phantomName)) return true;
  }
  return refs.has(normalizeLookup(actor.uuid)) || refs.has(normalizeLookup(actor.id)) || refs.has(actorName);
}

function mementoBonusText(memento, data) {
  const base = String(memento.bonus ?? "");
  if (memento.id !== "irrokcis-medallion" || !data.homebrew?.medallionUnarmed) return base;
  return `${base} Хоумбрю: дополнительный урон также распространяется на безоружные атаки.`.trim();
}

function mementoRules(memento, data, key) {
  const rules = parseRules(memento.rules, key);
  if (memento.id !== "irrokcis-medallion" || !data.homebrew?.medallionUnarmed) return rules;
  return rules.map((rule) => {
    if (rule?.slug !== "irrokcis-medallion-damage") return rule;
    const adjusted = clone(rule);
    delete adjusted.predicate;
    return adjusted;
  });
}

async function reconcileActorEffects(data, nightActive, stormActive, campaignEnabled = true) {
  const hp = totalBonusHp(data);
  const pcNightActive = pcNightPenaltyActive(data, nightActive);
  const collectedMementoIds = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
  const nightPcRules = parseRules(data.climate.night.pcRules, "night/PC");
  const nightNpcRules = parseRules(data.climate.night.npcRules, "night/NPC");
  const stormPcRules = parseRules(data.climate.storm.pcRules, "storm/PC");
  const stormNpcRules = parseRules(data.climate.storm.npcRules, "storm/NPC");

  for (const actor of game.actors?.contents ?? []) {
    const playerCharacter = isPlayerCharacter(actor);
    const eligibleNpc = actor.type === "npc" && !isExcludedPhantom(actor, data);

    await syncEffect(actor, "soulheart-hp", campaignEnabled && playerCharacter && hp > 0, () => effectSource(
      "soulheart-hp",
      "Бастардхолл: ОЗ Сердечников Душ",
      `Максимальные ОЗ увеличены на ${hp} благодаря собранным Сердечникам Душ.`,
      [{ key: "FlatModifier", selector: "hp", type: "untyped", value: hp }],
      data.soulhearts.images.strong || data.soulhearts.images.greater || data.soulhearts.images.simple,
    ));
    await syncEffect(actor, "night-pc", playerCharacter && pcNightActive, () => effectSource("night-pc", "Бастардхолл: Ночь", "Эффект ночи для персонажей игроков.", nightPcRules, "icons/magic/perception/eye-ringed-glow-angry-large-red.webp"));
    await syncEffect(actor, "night-npc", eligibleNpc && nightActive, () => effectSource("night-npc", "Бастардхолл: Ночь", "Эффект ночи для персонажей мастера.", nightNpcRules, "icons/magic/perception/eye-ringed-glow-angry-large-red.webp"));
    await syncEffect(actor, "storm-pc", playerCharacter && stormActive, () => effectSource("storm-pc", "Бастардхолл: Шторм", "Эффект шторма для персонажей игроков.", stormPcRules, "icons/magic/air/weather-clouds-rainbow.webp"));
    await syncEffect(actor, "storm-npc", eligibleNpc && stormActive, () => effectSource("storm-npc", "Бастардхолл: Шторм", "Эффект шторма для персонажей мастера.", stormNpcRules, "icons/magic/air/weather-clouds-rainbow.webp"));

    for (const memento of data.mementos) {
      const key = `memento-${memento.id}`;
      const active = campaignEnabled && playerCharacter && collectedMementoIds.has(memento.id);
      await syncEffect(actor, key, active, () => effectSource(key, `Бастардхолл: ${memento.name}`, mementoBonusText(memento, data), mementoRules(memento, data, key)));
    }

    for (const phantom of data.phantoms) {
      const key = `phantom-${phantom.id}`;
      const support = phantomPermanentEffect(phantom.id, phantom.found ? Number(phantom.rank) || 0 : -1);
      await syncEffect(actor, key, campaignEnabled && playerCharacter && Boolean(support), () => effectSource(key, `Бастардхолл: ${support.name}`, support.description, support.rules, support.img));
    }
  }
  for (const token of canvas?.tokens?.placeables ?? []) token.renderFlags?.set?.({ refreshEffects: true });
}

function resolveScene(ref) {
  const uuidMatch = String(ref).match(/Scene\.([A-Za-z0-9]+)/);
  const id = uuidMatch?.[1] ?? ref;
  return game.scenes?.get(id) ?? game.scenes?.getName?.(ref) ?? null;
}

async function reconcileSceneDarkness(data, nightActive, stormActive) {
  const nightDarkness = Number(data.climate.night.darkness);
  const stormValue = String(data.climate.storm.darkness ?? "").trim();
  const stormDarkness = stormValue === "" ? null : Number(stormValue);
  const desiredValues = [];
  if (nightActive && Number.isFinite(nightDarkness)) desiredValues.push(Math.clamp(nightDarkness, 0, 1));
  if (stormActive && Number.isFinite(stormDarkness)) desiredValues.push(Math.clamp(stormDarkness, 0, 1));
  const desired = desiredValues.length ? Math.max(...desiredValues) : null;

  const configuredScenes = new Map();
  for (const ref of splitRefs(data.climate.sceneRefs)) {
    const scene = resolveScene(ref);
    if (scene) configuredScenes.set(scene.id, scene);
  }
  const targetScenes = new Map(configuredScenes);
  for (const scene of game.scenes?.contents ?? []) {
    if (scene.getFlag(MODULE_ID, DARKNESS_FLAG)) targetScenes.set(scene.id, scene);
  }

  for (const scene of targetScenes.values()) {
    const stored = scene.getFlag(MODULE_ID, DARKNESS_FLAG);
    const sceneDesired = configuredScenes.has(scene.id) ? desired : null;
    if (sceneDesired !== null) {
      if (!stored) {
        await scene.setFlag(MODULE_ID, DARKNESS_FLAG, {
          original: Number(scene.environment?.darknessLevel ?? 0),
          darknessLock: Boolean(scene.environment?.darknessLock),
        });
      }
      if (Number(scene.environment?.darknessLevel ?? 0) !== sceneDesired || scene.environment?.darknessLock) {
        await scene.update({
          "environment.darknessLock": false,
          "environment.darknessLevel": sceneDesired,
        }, { animateDarkness: true });
      }
    } else if (stored) {
      await scene.update({
        "environment.darknessLock": false,
        "environment.darknessLevel": Number(stored.original ?? 0),
      }, { animateDarkness: true });
      if (stored.darknessLock) await scene.update({ "environment.darknessLock": true });
      await scene.unsetFlag(MODULE_ID, DARKNESS_FLAG);
    }
  }
}

async function disableMementoWalls(memento) {
  for (const ref of splitRefs(memento.wallUuids)) {
    try {
      const wall = await fromUuid(ref);
      if (wall?.documentName !== "Wall") continue;
      const enabled = wall.getFlag(MODULE_ID, "wallTexture")?.enabled;
      if (enabled === false) continue;
      await wall.setFlag(MODULE_ID, "wallTexture", {
        ...(wall.getFlag(MODULE_ID, "wallTexture") ?? {}),
        enabled: false,
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to disable Bastardhall border ${ref}`, error);
    }
  }
}

async function restoreMementoWalls(data) {
  for (const memento of data.mementos ?? []) {
    for (const ref of splitRefs(memento.wallUuids)) {
      try {
        const wall = await fromUuid(ref);
        if (wall?.documentName !== "Wall") continue;
        const stored = wall.getFlag(MODULE_ID, "wallTexture");
        if (stored?.enabled !== false) continue;
        await wall.setFlag(MODULE_ID, "wallTexture", { ...stored, enabled: true });
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to restore Bastardhall border ${ref}`, error);
      }
    }
  }
}

async function resetBastardhallData() {
  if (!game.user?.isGM) return;
  const previous = getData();
  await restoreMementoWalls(previous);
  for (const actor of game.actors?.contents ?? []) {
    if (actor.getFlag?.(MODULE_ID, "phantomDaily")) await actor.unsetFlag(MODULE_ID, "phantomDaily");
  }
  const resetData = createDefaultData();
  resetData.inventory = [];
  await game.settings.set(MODULE_ID, DATA_SETTING, resetData);

  // Foundry can retain an indexed array when replacing an Object setting in some
  // versions. Verify the persisted value and explicitly remove inventory keys.
  const persisted = clone(game.settings.get(MODULE_ID, DATA_SETTING) ?? {});
  if (normalizeArray(persisted.inventory).length) {
    persisted.inventory = [];
    await game.settings.set(MODULE_ID, DATA_SETTING, persisted);
  }

  const remaining = getData().inventory.length;
  if (remaining) throw new Error(`Не удалось очистить инвентарь: осталось предметов — ${remaining}.`);
}

function actorReconcileSignature(data, nightActive, stormActive, enabled) {
  const collectedMementos = data.inventory
    .filter((entry) => entry.category === "memento")
    .map((entry) => entry.mementoId)
    .sort();
  return JSON.stringify({
    enabled,
    nightActive,
    pcNightActive: pcNightPenaltyActive(data, nightActive),
    stormActive,
    soulhearts: data.soulhearts,
    climate: {
      excludedNpcRefs: data.climate.excludedNpcRefs,
      nightRules: { pc: data.climate.night.pcRules, npc: data.climate.night.npcRules },
      stormRules: { pc: data.climate.storm.pcRules, npc: data.climate.storm.npcRules },
    },
    collectedMementos,
    mementos: data.mementos.map(({ id, name, bonus, rules }) => ({ id, name, bonus, rules })),
    homebrew: data.homebrew,
    phantoms: data.phantoms.map(({ id, name, found, rank, actorUuid }) => ({ id, name, found, rank, actorUuid })),
  });
}

function sceneReconcileSignature(data, nightActive, stormActive) {
  return JSON.stringify({
    nightActive,
    stormActive,
    sceneRefs: data.climate.sceneRefs,
    nightDarkness: data.climate.night.darkness,
    stormDarkness: data.climate.storm.darkness,
  });
}

function mementoReconcileSignature(data, enabled) {
  return JSON.stringify({
    enabled,
    collected: data.inventory
      .filter((entry) => entry.category === "memento")
      .map((entry) => entry.mementoId)
      .sort(),
    walls: data.mementos.map(({ id, wallUuids }) => ({ id, wallUuids })),
  });
}

let activeReconcile = null;
let pendingReconcile = null;
let lastActorSignature = null;
let lastSceneSignature = null;
let lastMementoSignature = null;

async function runReconcile(request) {
  const data = getData();
  const enabled = Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING));
  const nightActive = enabled && !isDaytime(data);
  const stormActive = enabled && Boolean(data.climate.stormActive);

  const actorSignature = actorReconcileSignature(data, nightActive, stormActive, enabled);
  if (request.forceActors || actorSignature !== lastActorSignature) {
    await reconcileActorEffects(data, nightActive, stormActive, enabled);
    lastActorSignature = actorSignature;
  }

  const sceneSignature = sceneReconcileSignature(data, nightActive, stormActive);
  if (request.forceScenes || sceneSignature !== lastSceneSignature) {
    await reconcileSceneDarkness(data, nightActive, stormActive);
    lastSceneSignature = sceneSignature;
  }

  const mementoSignature = mementoReconcileSignature(data, enabled);
  if (request.forceMementos || mementoSignature !== lastMementoSignature) {
    const collected = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
    if (enabled) {
      for (const memento of data.mementos) {
        if (collected.has(memento.id)) await disableMementoWalls(memento);
      }
    }
    lastMementoSignature = mementoSignature;
  }
}

function queueReconcile({ forceActors = false, forceScenes = false, forceMementos = false } = {}) {
  if (!isPrimaryGM()) return activeReconcile;
  pendingReconcile ??= { forceActors: false, forceScenes: false, forceMementos: false };
  pendingReconcile.forceActors ||= forceActors;
  pendingReconcile.forceScenes ||= forceScenes;
  pendingReconcile.forceMementos ||= forceMementos;
  if (activeReconcile) return activeReconcile;

  activeReconcile = (async () => {
    while (pendingReconcile) {
      const request = pendingReconcile;
      pendingReconcile = null;
      await runReconcile(request);
    }
  })()
    .catch((error) => console.error(`${MODULE_ID} | Bastardhall automation failed`, error))
    .finally(() => {
      activeReconcile = null;
      if (pendingReconcile) queueReconcile();
    });
  return activeReconcile;
}

function getDocumentFromDrop(data) {
  const uuid = data?.uuid
    ?? (data?.pack && data?.id ? `Compendium.${data.pack}.${data.id}` : null)
    ?? (data?.type && data?.id ? `${data.type}.${data.id}` : null)
    ?? null;
  return uuid ? fromUuid(uuid) : null;
}

function resolveActor(ref) {
  if (!ref) return null;
  try {
    const document = globalThis.fromUuidSync?.(ref);
    if (document?.documentName === "Actor") return document;
  } catch (_error) {
    // Fall back to the world collection below.
  }
  const uuidMatch = String(ref).match(/Actor\.([A-Za-z0-9]+)/);
  const id = uuidMatch?.[1] ?? ref;
  return game.actors?.get(id) ?? game.actors?.getName?.(ref) ?? null;
}

async function choosePhantom(data, heart) {
  const eligible = data.phantoms.filter((phantom) => phantom.found && Number(phantom.rank) === heart.fromRank);
  if (!eligible.length) {
    ui.notifications?.warn?.(`Нет фантома с рангом ${heart.fromRank}. Сердечник будет учтён без повышения ранга.`);
    return null;
  }
  const options = eligible.map((phantom) => `<option value="${escapeHtml(phantom.id)}">${escapeHtml(phantom.name)} — ${escapeHtml(phantom.role)}</option>`).join("");
  return Dialog.prompt({
    title: `${heart.label} Сердечник Душ`,
    content: `<form><div class="form-group"><label>Повысить до ранга ${heart.toRank}</label><div class="form-fields"><select name="phantom">${options}</select></div></div></form>`,
    label: "Повысить ранг",
    callback: (html) => html.find?.('[name="phantom"]').val?.() ?? html[0]?.querySelector?.('[name="phantom"]')?.value ?? null,
    rejectClose: false,
  });
}

function playerCharacters() {
  return (game.actors?.contents ?? []).filter((actor) => isPlayerCharacter(actor));
}

async function choosePlayerCharacters(title, max = 1) {
  const controlled = [...new Set((canvas?.tokens?.controlled ?? []).map((token) => token.actor).filter((actor) => actor?.type === "character"))];
  if (controlled.length && controlled.length <= max) return controlled;
  if (!game.user?.isGM && game.user?.character?.type === "character") return [game.user.character];
  const actors = playerCharacters().filter((actor) => game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER"));
  if (!actors.length) {
    ui.notifications?.warn?.("В мире нет персонажей игроков.");
    return [];
  }
  const controls = actors.map((actor, index) => `<label class="checkbox"><input type="checkbox" name="actor" value="${escapeHtml(actor.id)}" ${index === 0 ? "checked" : ""}> ${escapeHtml(actor.name)}</label>`).join("");
  const selected = await Dialog.prompt({
    title,
    content: `<form><p>Выберите ${max === 1 ? "персонажа" : `до ${max} персонажей`}.</p><div class="form-group stacked">${controls}</div></form>`,
    label: "Выбрать",
    callback: (html) => [...(html[0]?.querySelectorAll?.('[name="actor"]:checked') ?? [])].slice(0, max).map((input) => input.value),
    rejectClose: false,
  });
  return normalizeArray(selected).map((id) => game.actors?.get(id)).filter(Boolean);
}

async function equipmentIndex() {
  const pack = game.packs?.get("pf2e.equipment-srd");
  if (!pack) return { pack: null, entries: [] };
  const index = await pack.getIndex({ fields: ["system.slug", "system.level.value", "system.traits.value"] });
  return { pack, entries: [...index] };
}

function indexedSlug(entry) {
  return String(foundry.utils.getProperty(entry, "system.slug") ?? entry.system?.slug ?? "").toLowerCase();
}

function indexedLevel(entry) {
  return Number(foundry.utils.getProperty(entry, "system.level.value") ?? entry.system?.level?.value ?? 0) || 0;
}

async function phantomItemOptions(kind, rank) {
  const { pack, entries } = await equipmentIndex();
  if (!pack) return [];
  if (kind === "drinks") {
    const families = ["antidote", "antiplague", "darkvision-elixir", "eagle-eye-elixir", "elixir-of-life"];
    const maxLevel = [0, 8, 11, 14][Math.clamp(rank, 0, 3)];
    return families.flatMap((family) => {
      const matches = entries.filter((entry) => indexedSlug(entry).includes(family) && indexedLevel(entry) <= maxLevel).sort((a, b) => indexedLevel(b) - indexedLevel(a));
      const entry = matches[0];
      return entry ? [{ uuid: `Compendium.${pack.collection}.${entry._id}`, name: entry.name, img: entry.img, level: indexedLevel(entry) }] : [];
    });
  }
  const familiesByRank = {
    1: ["ghost-touch", "striking"],
    2: ["ghost-touch", "striking", "resilient", "energy-resistant"],
    3: ["ghost-touch", "striking", "resilient", "energy-resistant", "greater-striking", "holy"],
  };
  const families = familiesByRank[Math.clamp(rank, 1, 3)] ?? [];
  const maxLevel = [0, 8, 11, 14][Math.clamp(rank, 0, 3)];
  const seen = new Set();
  return entries.filter((entry) => {
    const slug = indexedSlug(entry);
    return families.some((family) => slug === family || slug.endsWith(`-${family}`) || slug.includes(`${family}-rune`)) && indexedLevel(entry) <= maxLevel;
  }).sort((a, b) => indexedLevel(a) - indexedLevel(b)).flatMap((entry) => {
    const slug = indexedSlug(entry);
    if (seen.has(slug)) return [];
    seen.add(slug);
    return [{ uuid: `Compendium.${pack.collection}.${entry._id}`, name: entry.name, img: entry.img, level: indexedLevel(entry) }];
  });
}

async function choosePhantomItems(title, options, max) {
  if (!options.length) {
    ui.notifications?.warn?.("Подходящие предметы не найдены в pf2e.equipment-srd.");
    return [];
  }
  const optionHtml = options.map((entry) => `<option value="${escapeHtml(entry.uuid)}">${escapeHtml(entry.name)} (ур. ${entry.level})</option>`).join("");
  const rows = Array.from({ length: max }, (_value, index) => `<div class="form-group"><label>${index + 1}</label><div class="form-fields"><select name="item"><option value="">— не брать —</option>${optionHtml}</select></div></div>`).join("");
  const selected = await Dialog.prompt({
    title,
    content: `<form><p>Можно выбрать до ${max}.</p>${rows}</form>`,
    label: "Получить",
    callback: (html) => [...(html[0]?.querySelectorAll?.('[name="item"]') ?? [])].map((select) => select.value).filter(Boolean),
    rejectClose: false,
  });
  return normalizeArray(selected).slice(0, max);
}

async function giveItems(actor, uuids, { infused = false } = {}) {
  const sources = [];
  for (const uuid of uuids) {
    const item = await fromUuid(uuid);
    if (!item || item.documentName !== "Item") continue;
    const source = item.toObject();
    delete source._id;
    if (infused) {
      const traits = normalizeArray(source.system?.traits?.value);
      if (!traits.includes("infused")) traits.push("infused");
      foundry.utils.setProperty(source, "system.traits.value", traits);
    }
    sources.push(source);
  }
  if (sources.length) await actor.createEmbeddedDocuments("Item", sources);
  return sources.length;
}

function temporaryEffectSource(key, name, description, rules, img) {
  const source = effectSource(key, name, description, rules, img);
  source.system.duration = { value: 24, unit: "hours", expiry: "turn-start", sustained: false };
  return source;
}

async function replaceManagedEffect(actor, key, source) {
  const existing = managedEffects(actor, key);
  if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map((item) => item.id));
  await actor.createEmbeddedDocuments("Item", [source]);
}

function currentWorldDay() {
  return Math.floor(Number(game.time?.worldTime ?? 0) / 86400);
}

function dailyUses(actor, key) {
  const stored = actor.getFlag?.(MODULE_ID, `phantomDaily.${key}`) ?? {};
  return Number(stored.day) === currentWorldDay() ? Number(stored.used) || 0 : 0;
}

async function addDailyUses(actor, key, amount) {
  await actor.setFlag(MODULE_ID, `phantomDaily.${key}`, { day: currentWorldDay(), used: dailyUses(actor, key) + amount });
}

async function useAronDrinks(rank) {
  const actor = (await choosePlayerCharacters("Напитки Арона", 1))[0];
  if (!actor) return;
  const max = rank >= 3 ? 3 : 2;
  const usedByGroup = playerCharacters().reduce((used, character) => used + dailyUses(character, "aronDrinks"), 0);
  const remaining = Math.max(0, max - usedByGroup);
  if (!remaining) {
    ui.notifications?.warn?.("Группа уже получила максимальное число напитков Арона сегодня.");
    return;
  }
  const uuids = await choosePhantomItems("Напитки Арона", await phantomItemOptions("drinks", rank), remaining);
  if (!uuids.length) return;
  const count = await giveItems(actor, uuids, { infused: true });
  if (count) {
    await addDailyUses(actor, "aronDrinks", count);
    ui.notifications?.info?.(`${actor.name} получает напитки Арона: ${count}. Осталось сегодня: ${remaining - count}.`);
  }
}

async function useAuskenRunes(rank) {
  const actor = (await choosePlayerCharacters("Руны Аускена", 1))[0];
  if (!actor) return;
  const max = Math.clamp(rank + 1, 2, 4);
  const remaining = Math.max(0, max - dailyUses(actor, "auskenRunes"));
  if (!remaining) {
    ui.notifications?.warn?.(`${actor.name} уже получил максимальное число рун Аускена сегодня.`);
    return;
  }
  const uuids = await choosePhantomItems("Руны Аускена", await phantomItemOptions("runes", rank), remaining);
  if (!uuids.length) return;
  const count = await giveItems(actor, uuids);
  if (count) {
    await addDailyUses(actor, "auskenRunes", count);
    ui.notifications?.info?.(`${actor.name} получает руны Аускена: ${count}. Осталось сегодня: ${remaining - count}.`);
  }
}

async function useAuskenBlessing(rank) {
  const maxTargets = rank >= 3 ? 2 : 1;
  const actors = await choosePlayerCharacters("Благословение шерифа", maxTargets);
  if (!actors.length) return;
  const rules = [{ key: "FlatModifier", selector: "saving-throw", type: "status", value: 1, predicate: ["item:trait:fear"] }];
  if (rank >= 2) rules.push({ key: "AdjustDegreeOfSuccess", selector: "saving-throw", adjustment: { success: "one-degree-better" }, predicate: ["item:trait:fear"] });
  const description = rank >= 2
    ? "На 24 часа: бонус состояния +1 к спасброскам против страха; успех против страха считается критическим успехом. При получении Испуга его значение уменьшается на 1 вручную."
    : "На 24 часа: бонус состояния +1 к спасброскам против страха. При получении Испуга его значение уменьшается на 1 вручную.";
  for (const actor of actors) {
    await replaceManagedEffect(actor, "ausken-blessing", temporaryEffectSource("ausken-blessing", "Бастардхолл: Благословение шерифа", description, rules, "icons/symbols/star-yellow.webp"));
  }
  ui.notifications?.info?.(`Благословение шерифа получили: ${actors.map((actor) => actor.name).join(", ")}.`);
}

async function rollAronCounteract() {
  const levels = playerCharacters().map((actor) => Number(actor.level ?? actor.system?.details?.level?.value ?? 0)).filter(Number.isFinite);
  const level = Math.clamp(Math.round(levels.reduce((sum, value) => sum + value, 0) / Math.max(levels.length, 1)), 0, 25);
  const dc = typeof game.pf2e?.DC?.calculate === "function" ? game.pf2e.DC.calculate(level) : (14 + level);
  const modifier = Number(dc) - 10;
  const roll = await new Roll(`1d20 + ${modifier}`).evaluate();
  await roll.toMessage({ flavor: `<b>Арон — Противодействие</b><br>Средний уровень ПИ: ${level}; модификатор: +${modifier}.` });
}

const ESMIRA_BOOKS = Object.freeze([
  { id: "decipher-writing", label: "Расшифровка текста", predicate: "action:decipher-writing" },
  { id: "identify-magic", label: "Идентификация магии", predicate: "action:identify-magic" },
  { id: "identify-alchemy", label: "Идентификация алхимии", predicate: "action:identify-alchemy" },
  { id: "learn-a-spell", label: "Изучение заклинания", predicate: "action:learn-a-spell" },
  { id: "recall-knowledge", label: "Вспомнить информацию", predicate: "action:recall-knowledge" },
  { id: "research", label: "Изыскание", predicate: "action:research" },
]);

async function useEsmiraBooks() {
  const actor = (await choosePlayerCharacters("Книги Эсмиры", 1))[0];
  if (!actor) return;
  const options = ESMIRA_BOOKS.map((entry) => `<option value="${entry.id}">${entry.label}</option>`).join("");
  const choice = await Dialog.prompt({
    title: "Переносной комплект книг Эсмиры",
    content: `<form><div class="form-group"><label>Вид проверки</label><div class="form-fields"><select name="book">${options}</select></div></div><p>Новый комплект заменит ранее взятый этим персонажем.</p></form>`,
    label: "Взять книги",
    callback: (html) => html[0]?.querySelector?.('[name="book"]')?.value ?? null,
    rejectClose: false,
  });
  const book = ESMIRA_BOOKS.find((entry) => entry.id === choice);
  if (!book) return;
  const rules = [{ key: "FlatModifier", selector: "skill-check", type: "item", value: 2, predicate: [book.predicate] }];
  await replaceManagedEffect(actor, "esmira-books", effectSource("esmira-books", `Книги Эсмиры: ${book.label}`, `Постоянный бонус предмета +2 к проверкам «${book.label}», пока комплект находится у персонажа.`, rules, "icons/sundries/books/book-open-purple.webp"));
  ui.notifications?.info?.(`${actor.name} получает комплект «${book.label}».`);
}

async function depositItem(item, userId = game.user?.id) {
  if (!isPrimaryGM()) return;
  if (!item || item.documentName !== "Item") {
    ui.notifications?.warn?.("В инвентарь Бастардхолла можно положить только предмет.");
    return;
  }

  const data = getData();
  const quantity = getQuantity(item);
  const heart = identifySoulheart(item, data);
  const collection = identifyCollection(item);
  const memento = identifyMemento(item, data);
  let category = "other";
  let mementoId = null;

  if (heart) {
    category = "soulheart";
    data.soulhearts[heart.tier] = (Number(data.soulhearts[heart.tier]) || 0) + quantity;
    data.soulhearts.images[heart.tier] ||= item.img ?? "";
    for (let index = 0; index < quantity; index += 1) {
      const phantomId = await choosePhantom(data, heart);
      if (!phantomId) break;
      const phantom = data.phantoms.find((entry) => entry.id === phantomId);
      if (phantom && phantom.rank === heart.fromRank) phantom.rank = heart.toRank;
    }
  } else if (collection) {
    category = "collection";
    data.collections[collection] = (Number(data.collections[collection]) || 0) + quantity;
  } else if (memento) {
    category = "memento";
    mementoId = memento.id;
    if (data.inventory.some((entry) => entry.category === "memento" && entry.mementoId === memento.id)) {
      ui.notifications?.info?.(`${memento.name} уже возвращена в Бастардхолл.`);
      return;
    }
  }

  data.inventory.push({
    id: foundry.utils.randomID(),
    uuid: item.uuid,
    name: item.name,
    slug: getItemSlug(item),
    img: item.img,
    quantity,
    category,
    mementoId,
    depositedBy: userId,
    depositedAt: Date.now(),
  });
  await saveData(data);
  ui.notifications?.info?.(`${item.name} помещён в инвентарь Бастардхолла.`);
}

function emitDeposit(item) {
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-deposit",
    senderId: game.user?.id,
    uuid: item.uuid,
  });
}

function getFormRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

/**
 * PF2e's effects panel renders every Item of type "effect" and does not honor
 * system.tokenIcon.show.  Bastardhall bonuses intentionally remain real effect
 * Items (so their rules and descriptions are available on the actor), but they
 * should be as unobtrusive as Divine Interventions outside the actor sheet.
 */
function hideManagedEffectPanelIcons(_app, html) {
  const root = getFormRoot(html);
  if (!root) return;

  const selectedActor = canvas?.tokens?.controlled?.at?.(0)?.actor ?? game.user?.character ?? null;
  for (const element of root.querySelectorAll(".effect-item[data-item-id]")) {
    const uuid = element.dataset.itemUuid;
    const item = (uuid ? fromUuidSync(uuid) : null) ?? selectedActor?.items?.get?.(element.dataset.itemId ?? "");
    if (item?.getFlag?.(MODULE_ID, EFFECT_FLAG)) element.remove();
  }

  // Separators are rendered before the module can filter its effects. Remove
  // empty separators so a character with only Bastardhall effects has no stub.
  for (const separator of root.querySelectorAll("hr")) {
    const previous = separator.previousElementSibling;
    const next = separator.nextElementSibling;
    if (!previous || !next || previous.matches("hr") || next.matches("hr")) separator.remove();
  }
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function setPath(object, path, value) {
  foundry.utils.setProperty(object, path, value);
}

function applyConfigForm(root, data) {
  const form = root?.querySelector?.(".bh-config-form");
  if (!form) return data;
  const formData = new FormData(form);
  for (const [path, rawValue] of formData.entries()) {
    let value = rawValue;
    if (path === "climate.night.darkness" || /^climate\.stages\.[^.]+\.(sunrise|sunset)$/.test(path)) value = parseNumber(rawValue);
    if (path === "stormActive" || path === "homebrew.medallionUnarmed") value = rawValue === "true" || rawValue === "on";
    if (/^phantoms\.\d+\.found$/.test(path)) value = rawValue === "true";
    if (/^research\.\d+\.points$/.test(path) || /^phantoms\.\d+\.rank$/.test(path)) value = parseNumber(rawValue);
    setPath(data, path, value);
  }
  return data;
}

function closestDropTarget(event) {
  const target = event?.target;
  return target instanceof Element
    ? target.closest(".bh-inventory-drop, [data-drop-kind], [data-rule-path]")
    : null;
}

export class BastardhallSheet extends FormApplication {
  constructor(...args) {
    super(...args);
    this._view = "main";
    this._clockInterval = null;
  }

  async close(options = {}) {
    if (this._clockInterval) clearInterval(this._clockInterval);
    this._clockInterval = null;
    return super.close(options);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      title: "Лист Бастардхолла",
      template: `modules/${MODULE_ID}/templates/campaigns/bastardhall.hbs`,
      classes: ["pf2e", "tsu-bastardhall-window"],
      width: 980,
      height: 900,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  getData() {
    const data = getData();
    const isGM = Boolean(game.user?.isGM);
    const collectedMementos = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
    const unlockedAreas = new Set(["Береговая Линия"]);
    if (allPhantomsFound(data) || jinnivereReturned(data)) unlockedAreas.add("Замковые Территории");
    for (const memento of data.mementos) {
      if (collectedMementos.has(memento.id)) unlockedAreas.add(memento.area);
    }

    const research = data.research.map((topic, index) => {
      const points = Number(topic.points);
      const unknown = !Number.isFinite(points) || points < 0;
      return {
        ...topic,
        index,
        displayIndex: index + 1,
        unknown,
        displayName: unknown && !isGM ? "Неизвестное Изыскание" : topic.name,
        pointsLabel: unknown ? "—" : points,
      };
    });
    const phantoms = data.phantoms.map((phantom, phantomIndex) => {
      const linkedActor = resolveActor(phantom.actorUuid);
      const rank = Number(phantom.rank) || 0;
      return {
        ...phantom,
        phantomIndex,
        canAronDrinks: phantom.id === "aron" && rank >= 1,
        canAronCounteract: phantom.id === "aron" && rank >= 3,
        canAuskenBlessing: phantom.id === "ausken" && rank >= 1,
        canAuskenRunes: phantom.id === "ausken" && rank >= 1,
        canEsmiraBooks: phantom.id === "esmira" && rank >= 3,
        aronDrinkLimit: rank >= 3 ? 3 : 2,
        auskenRuneLimit: Math.clamp(rank + 1, 2, 4),
        auskenBlessingTargets: rank >= 3 ? 2 : 1,
        linkedActorName: linkedActor?.name ?? "",
        linkedActorImg: linkedActor?.img ?? "",
        rankRows: Array.from({ length: 4 }, (_value, rank) => ({
          rank,
          achieved: rank > 0 && phantom.rank >= rank,
          current: phantom.rank === rank,
          bonus: phantom.bonuses[rank] ?? "",
          tier: rank === 1 ? "simple" : rank === 2 ? "greater" : rank === 3 ? "strong" : "",
          img: rank === 1 ? data.soulhearts.images.simple : rank === 2 ? data.soulhearts.images.greater : rank === 3 ? data.soulhearts.images.strong : "",
        })),
      };
    });
    const mementos = data.mementos.map((memento, index) => ({
      ...memento,
      index,
      displayIndex: index + 1,
      collected: collectedMementos.has(memento.id),
      displayBonus: mementoBonusText(memento, data),
      isMedallion: memento.id === "irrokcis-medallion",
    }));
    const collectedMementoRows = mementos.filter((memento) => memento.collected);
    const inventory = data.inventory.slice().reverse();
    const currentTime = currentWorldTimeLabel();
    const daytime = isDaytime(data);
    const climateStage = getClimateStage(data);

    return {
      data,
      isGM,
      bonusHp: totalBonusHp(data),
      areas: AREA_NAMES.map((name, index) => ({ name, unlocked: unlockedAreas.has(name), wide: index === 0 })),
      collections: Object.entries(COLLECTIONS).map(([key, definition]) => ({ key, label: definition.label, count: Number(data.collections[key]) || 0 })),
      hearts: Object.entries(SOULHEARTS).map(([key, definition]) => ({ key, ...definition, count: Number(data.soulhearts[key]) || 0, img: data.soulhearts.images[key] })),
      research,
      phantoms,
      visiblePhantoms: phantoms.filter((phantom) => phantom.found),
      mementos,
      collectedMementos: collectedMementoRows,
      inventory,
      currentTime,
      daytime,
      climateStage,
      allPhantomsFound: allPhantomsFound(data),
      climateLabel: data.climate.stormActive ? (daytime ? "Шторм" : "Штормовая ночь") : (daytime ? "День" : "Ночь"),
      showMain: this._view === "main" || (this._view === "config" && !isGM),
      showInventory: this._view === "inventory",
      showConfig: this._view === "config" && isGM,
      sceneRefs: splitRefs(data.climate.sceneRefs).map((ref, index) => {
        const scene = resolveScene(ref);
        return { index, ref, name: scene?.name ?? ref, img: scene?.background?.src ?? scene?.thumb ?? "" };
      }),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = getFormRoot(html);
    if (!root) return;

    if (this._clockInterval) clearInterval(this._clockInterval);
    const refreshClock = () => {
      const badge = root.querySelector(".bh-climate-badge");
      if (!badge?.isConnected) return;
      const data = getData();
      const daytime = isDaytime(data);
      const label = data.climate.stormActive ? (daytime ? "Шторм" : "Штормовая ночь") : (daytime ? "День" : "Ночь");
      badge.classList.toggle("is-night", !daytime);
      const icon = badge.querySelector("i");
      if (icon) icon.className = `fa-solid ${daytime ? "fa-sun" : "fa-moon"}`;
      const labelElement = badge.querySelector("span");
      if (labelElement) labelElement.textContent = label;
      const timeElement = badge.querySelector("small");
      if (timeElement) timeElement.textContent = currentWorldTimeLabel();
    };
    refreshClock();
    this._clockInterval = setInterval(refreshClock, 1000);

    root.querySelector("[data-action='open-settings']")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      this._view = "config";
      this.render(false);
    });

    root.querySelector("[data-action='close-settings']")?.addEventListener("click", (event) => {
      event.preventDefault();
      this._view = "main";
      this.render(false);
    });

    root.querySelector("[data-action='reset-sheet']")?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      const resetButton = event.currentTarget;
      const confirmed = await Dialog.confirm({
        title: "Сбросить Лист Бастардхолла?",
        content: "<p>Будут удалены собранные предметы, ранги фантомов, исследования и настройки листа. Зелёный туман вернётся на настроенные бордюры.</p><p><b>Это действие нельзя отменить.</b></p>",
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });
      if (!confirmed) return;
      resetButton.disabled = true;
      try {
        await resetBastardhallData();
        this._view = "main";
        this.render(false);
        ui.notifications?.info?.("Лист Бастардхолла сброшен.");
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to reset Bastardhall`, error);
        ui.notifications?.error?.(`Сброс Бастардхолла не завершён: ${error.message}`);
      } finally {
        resetButton.disabled = false;
      }
    });

    root.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const view = button.dataset.view;
        if (!new Set(["main", "inventory"]).has(view)) return;
        this._view = view;
        this.render(false);
      });
    });

    root.querySelectorAll("[data-action='open-inventory-item']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const item = await fromUuid(button.dataset.uuid);
        item?.sheet?.render?.(true);
      });
    });

    root.querySelectorAll("[data-phantom-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const data = getData();
        const phantom = data.phantoms.find((entry) => entry.id === button.dataset.phantom);
        if (!phantom?.found) return;
        const rank = Number(phantom.rank) || 0;
        button.disabled = true;
        try {
          switch (button.dataset.phantomAction) {
            case "aron-drinks": await useAronDrinks(rank); break;
            case "aron-counteract": await rollAronCounteract(); break;
            case "ausken-blessing": await useAuskenBlessing(rank); break;
            case "ausken-runes": await useAuskenRunes(rank); break;
            case "esmira-books": await useEsmiraBooks(); break;
          }
        } catch (error) {
          console.error(`${MODULE_ID} | Phantom action failed`, error);
          ui.notifications?.error?.(`Способность фантома не выполнена: ${error.message}`);
        } finally {
          button.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-research-step]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!game.user?.isGM) return;
        const data = getData();
        const index = Number(button.dataset.index);
        const delta = Number(button.dataset.researchStep);
        const topic = data.research[index];
        if (!topic) return;
        topic.points = Math.max(-1, (Number(topic.points) || 0) + delta);
        await saveData(data);
      });
    });

    root.querySelector('[name="stormActive"]')?.addEventListener("change", async (event) => {
      if (!game.user?.isGM) return;
      const data = applyConfigForm(root, getData());
      data.climate.stormActive = Boolean(event.currentTarget.checked);
      await saveData(data);
    });

    root.querySelectorAll("[data-action='toggle-phantom']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!game.user?.isGM) return;
        const data = applyConfigForm(root, getData());
        const phantom = data.phantoms[Number(button.dataset.index)];
        if (!phantom) return;
        phantom.found = !phantom.found;
        await saveData(data);
      });
    });

    root.querySelectorAll("[data-action='remove-scene']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!game.user?.isGM) return;
        const data = applyConfigForm(root, getData());
        const refs = splitRefs(data.climate.sceneRefs);
        refs.splice(Number(button.dataset.index), 1);
        data.climate.sceneRefs = refs.join("\n");
        await saveData(data);
      });
    });

    root.querySelectorAll("[data-action='clear-phantom-actor']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!game.user?.isGM) return;
        const data = applyConfigForm(root, getData());
        const phantom = data.phantoms[Number(button.dataset.index)];
        if (!phantom) return;
        phantom.actorUuid = "";
        await saveData(data);
      });
    });

    root.addEventListener("dragover", (event) => {
      const target = closestDropTarget(event);
      if (!target && this._view === "config") return;
      event.preventDefault();
      (target ?? root.querySelector(".bh-sheet"))?.classList.add("is-dragover");
    });
    root.addEventListener("dragleave", (event) => {
      (closestDropTarget(event) ?? root.querySelector(".bh-sheet"))?.classList.remove("is-dragover");
    });
    root.addEventListener("drop", (event) => {
      const target = closestDropTarget(event);
      if (!target && this._view === "config") return;
      event.preventDefault();
      (target ?? root.querySelector(".bh-sheet"))?.classList.remove("is-dragover");
      void this._onDrop(event);
    });

    root.querySelector(".bh-config-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      const data = applyConfigForm(root, getData());
      await saveData(data);
      ui.notifications?.info?.("Настройки Бастардхолла сохранены.");
    });
  }

  async _onDrop(event) {
    event.preventDefault();
    const target = closestDropTarget(event);
    let dropData;
    try {
      dropData = TextEditor.getDragEventData(event);
    } catch (_error) {
      dropData = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
    }
    const document = await getDocumentFromDrop(dropData);

    if (target?.dataset.dropKind === "scene") {
      if (!game.user?.isGM || document?.documentName !== "Scene") {
        ui.notifications?.warn?.("Перетащите сюда сцену из навигации сцен.");
        return;
      }
      const root = getFormRoot(this.element);
      const data = applyConfigForm(root, getData());
      const refs = splitRefs(data.climate.sceneRefs);
      if (!refs.includes(document.uuid)) refs.push(document.uuid);
      data.climate.sceneRefs = refs.join("\n");
      await saveData(data);
      ui.notifications?.info?.(`Сцена «${document.name}» добавлена в Бастардхолл.`);
      return;
    }

    if (target?.dataset.dropKind === "phantom") {
      if (!game.user?.isGM || document?.documentName !== "Actor") {
        ui.notifications?.warn?.("Перетащите сюда актёра-фантома.");
        return;
      }
      const root = getFormRoot(this.element);
      const data = applyConfigForm(root, getData());
      const phantom = data.phantoms[Number(target.dataset.index)];
      if (!phantom) return;
      phantom.actorUuid = document.uuid;
      phantom.found = true;
      await saveData(data);
      ui.notifications?.info?.(`${phantom.name} связан с актёром «${document.name}» и отмечен найденным.`);
      return;
    }

    if (target?.dataset.rulePath) {
      if (!game.user?.isGM || document?.documentName !== "Item" || document.type !== "effect") {
        ui.notifications?.warn?.("Перетащите сюда предмет типа Effect.");
        return;
      }
      const rules = normalizeArray(document.system?.rules);
      if (!rules.length) {
        ui.notifications?.warn?.(`У эффекта «${document.name}» нет Rule Elements.`);
        return;
      }
      const root = getFormRoot(this.element);
      const data = applyConfigForm(root, getData());
      const path = target.dataset.rulePath;
      const currentRules = parseRules(foundry.utils.getProperty(data, path), path);
      setPath(data, path, JSON.stringify([...currentRules, ...clone(rules)], null, 2));
      await saveData(data);
      ui.notifications?.info?.(`Rule Elements эффекта «${document.name}» добавлены.`);
      return;
    }

    if (!document || document.documentName !== "Item") {
      ui.notifications?.warn?.("Перетащите предмет в инвентарь Бастардхолла.");
      return;
    }
    if (isPrimaryGM()) await depositItem(document);
    else emitDeposit(document);
  }

  async _updateObject(_event, _formData) {}
}

export function openBastardhallSheet() {
  const existing = Object.values(ui.windows ?? {}).find((app) => app?.id === APP_ID);
  if (existing?.rendered) {
    existing.bringToTop();
    return existing;
  }
  return new BastardhallSheet().render(true);
}

function addActorDirectoryButton(_app, html) {
  if (!game.settings.get(MODULE_ID, ENABLE_SETTING)) return;
  const root = getFormRoot(html);
  if (!root) return;
  const header = root.querySelector(".header-actions") ?? root.closest(".directory")?.querySelector(".header-actions");
  if (!header || header.querySelector(".tsu-bastardhall-btn")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsu-bastardhall-btn";
  button.title = "Лист Бастардхолла";
  button.style.cssText = "min-width:32px;width:32px;height:32px;flex:0 0 32px;padding:0;margin-left:5px;background:#176b6c;color:#f0e6c7;border:1px solid #c9ad6a;display:flex;align-items:center;justify-content:center;";
  button.innerHTML = '<i class="fa-solid fa-castle"></i>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openBastardhallSheet();
  });
  header.prepend(button);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, ENABLE_SETTING, {
    name: i18nKey("Settings.Campaigns.Bastardhall.Name"),
    hint: i18nKey("Settings.Campaigns.Bastardhall.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      ui.actors?.render?.(true);
      queueReconcile();
    },
  });
  game.settings.register(MODULE_ID, DATA_SETTING, {
    name: "Bastardhall Data",
    scope: "world",
    config: false,
    type: Object,
    default: createDefaultData(),
    onChange: () => {
      Object.values(ui.windows ?? {}).find((app) => app?.id === APP_ID)?.render?.(false);
      queueReconcile();
    },
  });
});

Hooks.on("renderActorDirectory", addActorDirectoryButton);
Hooks.on("renderEffectsPanel", hideManagedEffectPanelIcons);
Hooks.on("updateWorldTime", () => queueReconcile());
Hooks.on("createActor", () => queueReconcile({ forceActors: true }));

Hooks.once("ready", () => {
  game.socket?.on?.(SOCKET_CHANNEL, async (message) => {
    if (!isPrimaryGM() || message?.type !== "bastardhall-deposit" || !message.uuid) return;
    try {
      const item = await fromUuid(message.uuid);
      await depositItem(item, message.senderId);
    } catch (error) {
      console.error(`${MODULE_ID} | Bastardhall deposit failed`, error);
    }
  });

  const module = game.modules?.get(MODULE_ID);
  if (module) {
    module.api = {
      ...(module.api ?? {}),
      openBastardhallSheet,
      reconcileBastardhall: () => queueReconcile({ forceActors: true, forceScenes: true, forceMementos: true }),
    };
  }
  queueReconcile();
});
