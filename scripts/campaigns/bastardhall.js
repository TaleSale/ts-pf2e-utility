import { MODULE_ID, SOCKET_CHANNEL, escapeHtml, i18nKey } from "../core.js";
import {
  BASTION_TEXTURE_PRESET,
  TEXTURE_PRESET_FLAG,
} from "../utility/texture-presets.js?v=20260816-swamp-floor1";

const ENABLE_SETTING = "enableBastardhallSheet";
const DATA_SETTING = "bastardhallData";
const EFFECT_FLAG = "bastardhallEffect";
const DARKNESS_FLAG = "bastardhallDarkness";
const NIGHT_TEXTURE_PRESET_FLAG = "bastardhallNightTexturePreset";
const ACCESS_BLOCK_FLAG = "bastardhallAccess";
const pendingRegionAccessChanges = new WeakMap();
const APP_ID = "tsu-bastardhall-sheet";
const VIEW_SELECTORS = Object.freeze([
  ".bh-tracker-tab",
  ".bh-cooking-view",
  ".bh-inventory-view",
  ".bh-investigation-view",
  ".bh-sidequest-view",
  ".bh-family-tree-view",
  ".bh-config-view",
]);

const FAMILY_TREE_SLOTS = Object.freeze([
  { id: "generation-1-husband", generation: 1, x: 420, y: 215 },
  { id: "generation-1-wife", generation: 1, x: 580, y: 215 },
  { id: "generation-2-son", generation: 2, x: 420, y: 435 },
  { id: "generation-2-wife", generation: 2, x: 580, y: 435 },
  { id: "generation-3-son", generation: 3, x: 420, y: 655 },
  { id: "generation-3-wife", generation: 3, x: 580, y: 655 },
  { id: "generation-4-daughter", generation: 4, x: 210, y: 875 },
  { id: "generation-4-son", generation: 4, x: 410, y: 875, crowned: true },
  { id: "generation-4-son-wife", generation: 4, x: 580, y: 875 },
  { id: "generation-4-unknown", generation: 4, x: 790, y: 875 },
  { id: "generation-5-daughter-son", generation: 5, x: 210, y: 1095 },
  { id: "generation-5-son-son", generation: 5, x: 410, y: 1095 },
  { id: "generation-5-son-daughter", generation: 5, x: 580, y: 1095 },
  { id: "generation-5-unknown-heir", generation: 5, x: 790, y: 1095 },
]);

const FAMILY_TREE_HEIRS = Object.freeze(Array.from({ length: 8 }, (_value, index) => ({
  id: `custom-heir-${index + 1}`,
  x: 200 + ((index % 4) * 200),
  y: index < 4 ? 42 : 252,
})));

const FAMILY_TREE_GENERATIONS = Object.freeze([
  { number: 1, label: "I поколение", shelfY: 382 },
  { number: 2, label: "II поколение", shelfY: 602 },
  { number: 3, label: "III поколение", shelfY: 822 },
  { number: 4, label: "IV поколение", shelfY: 1042 },
  { number: 5, label: "V поколение", shelfY: 1262 },
]);

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

const CLIMATE_STAGE_LABELS = Object.freeze({
  initial: "Береговая Линия",
  phantoms: "Замковые Территории",
  jinnivere: "Подвал",
  augsten: "Приёмные Залы",
  alisendra: "Подземелье",
  dazerien: "Личные Залы",
  raudltz: "Храм",
  ryhasphinea: "Катакомбы",
  irrokcis: "Башни",
});

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

const SERVANT_PHANTOMS = Object.freeze([
  {
    id: "bakers",
    name: "Фантомы-пекари",
    location: "C18. Пекарня",
    description: "Каждый день готовят 2 Пончика поэта. После открытия Храма используют средний рецепт вместо малого.",
  },
  {
    id: "cooks",
    name: "Фантомы-повара",
    location: "C40. Главная кухня",
    description: "Каждый день готовят 1d4 порции следующего блюда из выбранной очереди. Каждый рецепт доступен только один раз.",
  },
  {
    id: "brewers",
    name: "Фантомы-пивовары",
    location: "C46. Пивоварня",
    description: "Каждый день готовят 1d4 порции следующего напитка из выбранной очереди. Каждый рецепт доступен только один раз.",
  },
]);

const SERVANT_RECIPES = Object.freeze({
  cooks: Object.freeze([
    { id: "egg-cream-fizz", name: "Шипучий яичный коктейль", englishName: "Egg Cream Fizz", slug: "egg-cream-fizz" },
    { id: "galvanic-chew", name: "Гальваническая жвачка", englishName: "Galvanic Chew", slug: "galvanic-chew" },
    { id: "cooperative-waffles-greater", name: "Вафли товарищества [Большие]", englishName: "Cooperative Waffles (Greater)", slug: "cooperative-waffles-greater" },
    { id: "diplomats-charcuterie", name: "Шаркутери дипломата", englishName: "Diplomat's Charcuterie", slug: "diplomats-charcuterie" },
  ]),
  brewers: Object.freeze([
    { id: "fury-cocktail-lesser", name: "Коктейль «Ярость» [Малый] — скорбный", englishName: "Fury Cocktail (Lesser) — Mournful", slug: "fury-cocktail-lesser", variant: "mournful", suffix: "Скорбный" },
    { id: "soothing-toddy", name: "Успокаивающий коктейль — виски", englishName: "Soothing Toddy — Whiskey", slug: "soothing-toddy", variant: "whiskey", suffix: "Виски" },
    { id: "silvertongue-mutagen-moderate", name: "Мутаген красноречия [Средний]", englishName: "Silvertongue Mutagen (Moderate)", slug: "silvertongue-mutagen-moderate" },
    { id: "bottled-catharsis-moderate", name: "Катарсис в бутылке [Средний]", englishName: "Bottled Catharsis (Moderate)", slug: "bottled-catharsis-moderate" },
  ]),
});

const SHELYN_BLESSINGS = Object.freeze([
  { id: "tangy", name: "Танцующая Шелин", spell: "Уверенность в ногах / Sure Footing", selector: "acrobatics", check: "проверкам Акробатики" },
  { id: "contemplative", name: "Созерцающая Шелин", spell: "Ясный ум / Clear Mind", selector: "crafting", check: "проверкам Ремесла" },
  { id: "sleeping", name: "Спящая Шелин", spell: "Здоровое тело / Sound Body", selector: "fortitude", check: "спасброскам Стойкости" },
]);

function createDefaultServantPhantoms() {
  return SERVANT_PHANTOMS.map((servant) => ({
    id: servant.id,
    active: false,
    lastGrantedDay: null,
    recipeOrder: (SERVANT_RECIPES[servant.id] ?? []).map((recipe) => recipe.id),
    usedRecipeIds: [],
  }));
}

const LEGACY_RESEARCH_TOPICS = Object.freeze([
  "Бастардхолл",
  "Проклятие",
  "Семья Арудора",
  "Флорин Киндлер",
  ...Array.from({ length: 14 }, (_value, index) => `Тема изыскания ${index + 5}`),
]);

const DEFAULT_RESEARCH_TOPICS = Object.freeze([
  "Семья Арудора",
  "Бастардхолл",
  "Деметрис Арудора",
  "Эрагейл Арудора",
  "Джиннивер Арудора",
  "Ниша Арудора",
  "Тасифини Арудора",
  "Заша Арудора",
  "Аугстен Арудора",
  "Алисендра Арудора",
  "Проклятие",
  "Дазериэн Арудора",
  "Флорин Киндлер",
  "Раудльц Арудора",
  "Рихасфинея Арудора",
  "Кейдсеррис Арудора",
  "Иррокцис Арудора",
  "Великарн",
]);

const RESEARCH_V14_SOURCE_ORDER = Object.freeze([2, 0, 4, 5, 6, 7, 8, 9, 10, 11, 1, 12, 3, 13, 14, 15, 16, 17]);

const RESEARCH_BONUSES = Object.freeze([
  {
    topicIndex: 1,
    threshold: 11,
    description: "Вы получаете бонус обстоятельства +2 к проверкам Восприятия при Поиске потайных дверей или скрытых тайников в замке.",
  },
  {
    topicIndex: 10,
    threshold: 8,
    description: "Вы получаете бонус обстоятельства +2 к проверкам Противодействия против проклятий.",
  },
  {
    topicIndex: 10,
    threshold: 12,
    description: "Вы получаете бонус обстоятельства +1 к спасброскам против проклятий.",
  },
  {
    topicIndex: 10,
    threshold: 21,
    description: "Вы получаете бонус обстоятельства +4 к спасброскам против проклятий.",
  },
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
      bonus: "Все Удары персонажей игроков наносят 1 дополнительный духовный урон до конца Пути Приключений.",
      rules: JSON.stringify([{
        key: "FlatModifier",
        selector: "strike-damage",
        type: "untyped",
        value: 1,
        damageType: "spirit",
        slug: "irrokcis-medallion-damage",
      }], null, 2),
    },
  ];
  return definitions.map((entry) => ({ rules: "[]", wallUuids: "", regionUuids: "", ...entry }));
}

function createDefaultData() {
  return {
    version: 21,
    inventory: [],
    sideQuests: [],
    investigations: [],
    familyTree: {
      crest: { id: "crest", actorUuid: "", name: "", img: "", notes: "" },
      slots: FAMILY_TREE_SLOTS.map(({ id }) => ({ id, actorUuid: "", name: "", img: "", notes: "" })),
      customHeirs: FAMILY_TREE_HEIRS.map(({ id }) => ({ id, actorUuid: "", name: "", img: "", notes: "" })),
    },
    soulhearts: {
      simple: 0,
      greater: 0,
      strong: 0,
      images: { simple: "", greater: "", strong: "" },
      slugs: Object.fromEntries(Object.entries(SOULHEARTS).map(([key, value]) => [key, value.defaultSlugs.join(", ")])),
    },
    collections: { arts: 0, gears: 0, remnants: 0 },
    research: DEFAULT_RESEARCH_TOPICS.map((name, index) => ({ id: `research-${index + 1}`, name, points: -1 })),
    phantoms: PHANTOMS.map((phantom) => ({ ...phantom, found: false, rank: 0, actorUuid: "", bonuses: defaultPhantomBonuses(phantom) })),
    servantPhantoms: createDefaultServantPhantoms(),
    boons: {
      ausken: { lastGrantedDay: null },
      shelyn: { active: false, choice: "tangy", lastGrantedDay: null },
    },
    mementos: createDefaultMementos(),
    accessBlocks: [{ id: "phantoms", wallUuids: "", regionUuids: "" }],
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
        augsten: {
          sunrise: 9,
          sunset: 18,
          description: "Наползает липкий туман. Хотя бриз и порывы ветра утихают, туман едва ли приносит улучшение, покрывая всё вокруг сырым слоем конденсата. Температура остаётся прохладной и свежей, опускаясь снаружи до умеренного холода после наступления темноты.",
          coldWarning: true,
        },
        alisendra: {
          sunrise: 10,
          sunset: 18,
          description: "Дождь срывается порывистой моросью день и ночь, а ветер усиливается. На открытом воздухе проверки Восприятия, основанные на зрении, получают штраф обстоятельства −1 из-за мороси. Температура становится некомфортной и опускается до категории умеренного холода на весь день.",
          perceptionPenalty: -1,
          perceptionVisionOnly: true,
          coldWarning: true,
        },
        dazerien: {
          sunrise: 11,
          sunset: 17,
          description: "Теперь буря разражается в полную силу. Дождь хлещет большую часть дня и ночи, стихая лишь ненадолго. На открытом воздухе во время дождя персонажи получают штраф обстоятельства −2 к проверкам Восприятия, основанным на зрении, из-за ливня, а ветер налагает штраф обстоятельства −1 на дистанционные Удары. Незащищённые маленькие источники открытого огня снаружи гаснут от ветра или дождя. Температура снаружи остаётся в пределах умеренного холода.",
          perceptionPenalty: -2,
          perceptionVisionOnly: true,
          rangedPenalty: -1,
          coldWarning: true,
        },
        raudltz: {
          sunrise: 12,
          sunset: 16,
          description: "Буря набирает силу. Дождь непрерывно хлещет и местами протекает сквозь крышу, оставляя лужи на полу внутри помещений. На открытом воздухе проверки Восприятия, основанные на зрении, получают штраф обстоятельства −3 из-за ливня, а ветер налагает штраф обстоятельства −2 на дистанционные Удары. Незащищённые маленькие источники открытого огня снаружи гаснут от ветра или дождя. Температура снаружи остаётся в пределах умеренного холода.",
          perceptionPenalty: -3,
          perceptionVisionOnly: true,
          rangedPenalty: -2,
          coldWarning: true,
        },
        ryhasphinea: {
          sunrise: 13,
          sunset: 15,
          description: "Дождь льёт потоками, покрывая внутренний двор Бастардхолла водой глубиной в несколько дюймов в отдельных местах. На открытом воздухе проверки Восприятия, основанные на зрении, получают штраф обстоятельства −3 из-за ливня, а ветер налагает штраф обстоятельства −3 на дистанционные Удары. Незащищённые маленькие источники открытого огня снаружи гаснут от ветра или дождя. Температура снаружи остаётся в пределах умеренного холода в течение дня, но опускается до сильного холода в период с 21:00 до 06:00.",
          perceptionPenalty: -3,
          perceptionVisionOnly: true,
          rangedPenalty: -3,
          coldWarning: true,
        },
        irrokcis: {
          sunrise: 14,
          sunset: 14,
          description: "Сила бури превосходит всю прежнюю ярость, превращаясь в полноценный шторм. На открытом воздухе проверки Восприятия и дистанционные Удары получают штраф обстоятельства −4. Температура снаружи всё время остаётся в пределах сильного холода, и время от времени дождь сменяется снегом, но ненадолго, так и не перерастая в настоящую метель или буран. Незащищённые маленькие источники открытого огня снаружи гаснут от ветра и дождя. Солнце всходит в последний раз в 14:00, чтобы тут же зайти; после этого ночь становится вечной.",
          perceptionPenalty: -4,
          rangedPenalty: -4,
          eternalNight: true,
          lightning: true,
        },
      },
      sceneRefs: "",
      excludedNpcRefs: "",
      stormActive: false,
      outdoorPenaltyActive: false,
      coldWarningDate: "",
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

function normalizeText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeSideQuests(entries) {
  return normalizeArray(entries).flatMap((rawQuest, questIndex) => {
    if (!rawQuest || typeof rawQuest !== "object") return [];
    const title = normalizeText(rawQuest.title, 120);
    if (!title) return [];
    const questId = normalizeText(rawQuest.id, 120) || `side-quest-${questIndex + 1}`;
    const notes = normalizeArray(rawQuest.notes).flatMap((rawNote, noteIndex) => {
      if (!rawNote || typeof rawNote !== "object") return [];
      const text = normalizeText(rawNote.text, 4000);
      if (!text) return [];
      return [{
        id: normalizeText(rawNote.id, 120) || `${questId}-note-${noteIndex + 1}`,
        text,
        authorId: normalizeText(rawNote.authorId, 120),
        authorName: normalizeText(rawNote.authorName, 120) || "Неизвестный игрок",
        createdAt: Math.max(0, Number(rawNote.createdAt) || 0),
      }];
    });
    const failed = rawQuest.failed === true;
    const rawSourceSectionIndex = Number(rawQuest.sourceSectionIndex);
    return [{
      id: questId,
      title,
      description: normalizeText(rawQuest.description, 8000),
      hidden: rawQuest.hidden === true,
      completed: !failed && rawQuest.completed === true,
      failed,
      createdBy: normalizeText(rawQuest.createdBy, 120),
      createdAt: Math.max(0, Number(rawQuest.createdAt) || 0),
      sourceUuid: normalizeText(rawQuest.sourceUuid, 500),
      sourceSectionId: normalizeText(rawQuest.sourceSectionId, 120),
      sourceSectionIndex: Number.isFinite(rawSourceSectionIndex) ? Math.max(-1, Math.trunc(rawSourceSectionIndex)) : -1,
      sourceHeading: normalizeText(rawQuest.sourceHeading, 240),
      notes,
    }];
  });
}

function investigationNameKey(value) {
  return normalizeText(value, 160).toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function normalizeInvestigationHtml(value, maxLength = 50000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeInvestigations(entries) {
  return normalizeArray(entries).flatMap((rawInvestigation, investigationIndex) => {
    if (!rawInvestigation || typeof rawInvestigation !== "object") return [];
    const title = normalizeText(rawInvestigation.title, 160);
    const topicName = normalizeText(rawInvestigation.topicName, 160) || title;
    if (!title || !topicName) return [];
    const investigationId = normalizeText(rawInvestigation.id, 120) || `investigation-${investigationIndex + 1}`;
    const sources = normalizeArray(rawInvestigation.sources).flatMap((rawSource, sourceIndex) => {
      if (!rawSource || typeof rawSource !== "object") return [];
      const name = normalizeText(rawSource.name, 240);
      if (!name) return [];
      const maximum = Math.max(0, Math.trunc(Number(rawSource.maxPoints) || 0));
      return [{
        id: normalizeText(rawSource.id, 120) || `${investigationId}-source-${sourceIndex + 1}`,
        name,
        description: normalizeInvestigationHtml(rawSource.description),
        checks: normalizeInvestigationHtml(rawSource.checks),
        maxPoints: maximum,
        points: Math.clamp(Math.trunc(Number(rawSource.points) || 0), 0, maximum),
      }];
    });
    const revelations = normalizeArray(rawInvestigation.revelations).flatMap((rawRevelation) => {
      if (!rawRevelation || typeof rawRevelation !== "object") return [];
      const threshold = Math.max(0, Math.trunc(Number(rawRevelation.threshold) || 0));
      const content = normalizeInvestigationHtml(rawRevelation.content);
      return content ? [{ threshold, content }] : [];
    }).sort((left, right) => left.threshold - right.threshold);
    const rawSourceSectionIndex = Number(rawInvestigation.sourceSectionIndex);
    return [{
      id: investigationId,
      title,
      topicName,
      level: Math.clamp(Math.trunc(Number(rawInvestigation.level) || 0), 0, 30),
      sourceUuid: normalizeText(rawInvestigation.sourceUuid, 500),
      sourceResearchId: normalizeText(rawInvestigation.sourceResearchId, 120),
      sourceSectionIndex: Number.isFinite(rawSourceSectionIndex) ? Math.max(-1, Math.trunc(rawSourceSectionIndex)) : -1,
      sourceHeading: normalizeText(rawInvestigation.sourceHeading, 240),
      createdBy: normalizeText(rawInvestigation.createdBy, 120),
      createdAt: Math.max(0, Number(rawInvestigation.createdAt) || 0),
      sources,
      revelations,
    }];
  });
}

function syncInvestigationResearchPoints(data, resetTopicNames = []) {
  const totals = new Map();
  for (const investigation of normalizeArray(data.investigations)) {
    const key = investigationNameKey(investigation.topicName);
    if (!key) continue;
    const points = normalizeArray(investigation.sources).reduce((total, source) => total + Math.max(0, Number(source.points) || 0), 0);
    totals.set(key, (totals.get(key) ?? 0) + points);
  }
  const resetKeys = new Set(normalizeArray(resetTopicNames).map(investigationNameKey).filter(Boolean));
  for (const topic of normalizeArray(data.research)) {
    const key = investigationNameKey(topic.name);
    if (totals.has(key)) topic.points = totals.get(key);
    else if (resetKeys.has(key)) topic.points = -1;
  }
}

function normalizeFamilySlot(rawSlot, definition) {
  const slot = rawSlot && typeof rawSlot === "object" ? rawSlot : {};
  return {
    id: definition.id,
    actorUuid: normalizeText(slot.actorUuid, 500),
    name: normalizeText(slot.name, 160),
    img: normalizeText(slot.img, 1000),
    notes: normalizeText(slot.notes, 4000),
  };
}

function normalizeFamilyTree(rawTree) {
  const tree = rawTree && typeof rawTree === "object" ? rawTree : {};
  const storedSlots = normalizeArray(tree.slots);
  const storedHeirs = normalizeArray(tree.customHeirs);
  return {
    crest: normalizeFamilySlot(tree.crest, { id: "crest" }),
    slots: FAMILY_TREE_SLOTS.map((definition) => normalizeFamilySlot(
      storedSlots.find((slot) => slot?.id === definition.id),
      definition,
    )),
    customHeirs: FAMILY_TREE_HEIRS.map((definition) => normalizeFamilySlot(
      storedHeirs.find((slot) => slot?.id === definition.id),
      definition,
    )),
  };
}

function migrateResearchTopicsV14(topics) {
  const byLegacyId = new Map(topics.map((topic) => [String(topic?.id ?? ""), topic]));
  return RESEARCH_V14_SOURCE_ORDER.map((sourceIndex, index) => {
    const source = byLegacyId.get(`research-${sourceIndex + 1}`) ?? topics[sourceIndex] ?? {};
    const legacyName = LEGACY_RESEARCH_TOPICS[sourceIndex];
    const name = String(source.name ?? "") === legacyName ? DEFAULT_RESEARCH_TOPICS[index] : source.name;
    return {
      ...source,
      id: `research-${index + 1}`,
      name: String(name ?? DEFAULT_RESEARCH_TOPICS[index]),
    };
  });
}

function normalizeData(raw) {
  const storedVersion = Number(raw?.version ?? 0);
  const data = foundry.utils.mergeObject(createDefaultData(), clone(raw ?? {}), {
    inplace: false,
    recursive: true,
    overwrite: true,
  });
  data.version = 21;
  data.inventory = stackInventoryEntries(data.inventory);
  if (storedVersion < 19) data.investigations = [];
  if (storedVersion < 20) data.mementos = normalizeArray(data.mementos).map((memento) => ({ regionUuids: "", ...memento }));
  if (storedVersion < 21) data.accessBlocks = createDefaultData().accessBlocks;
  if (storedVersion < 8) data.sideQuests = normalizeArray(raw?.sideQuests);
  if (storedVersion < 9) {
    data.sideQuests = normalizeArray(data.sideQuests).map((quest) => ({
      sourcePath: "",
      sourceHash: "",
      importedAt: 0,
      ...quest,
    }));
  }
  if (storedVersion < 10) {
    data.sideQuests = normalizeArray(data.sideQuests).map((quest) => ({
      completed: false,
      ...quest,
    }));
  }
  if (storedVersion < 11) {
    data.sideQuests = normalizeArray(data.sideQuests).map((quest) => ({
      failed: false,
      ...quest,
    }));
  }
  if (storedVersion < 12) {
    data.sideQuests = normalizeArray(data.sideQuests).map((quest) => ({
      ...quest,
      sourceUuid: "",
      sourceSectionId: "",
      sourceSectionIndex: -1,
      sourceHeading: "",
    }));
  }
  if (storedVersion < 13 && (!raw?.familyTree || typeof raw.familyTree !== "object")) {
    data.familyTree = createDefaultData().familyTree;
  }
  data.familyTree = normalizeFamilyTree(data.familyTree);
  data.sideQuests = normalizeSideQuests(data.sideQuests);
  if (storedVersion < 6) {
    data.soulhearts.slugs = Object.fromEntries(Object.entries(SOULHEARTS).map(([key, value]) => [key, value.defaultSlugs.join(", ")]));
  }
  data.research = normalizeArray(data.research).slice(0, 18);
  while (data.research.length < 18) {
    const index = data.research.length;
    data.research.push({ id: `research-${index + 1}`, name: DEFAULT_RESEARCH_TOPICS[index], points: -1 });
  }
  if (storedVersion < 14 && raw?.research) {
    data.research = migrateResearchTopicsV14(data.research);
  }
  if (storedVersion < 15 && data.research[17]?.name === "Великард") {
    data.research[17] = { ...data.research[17], name: "Великарн" };
  }
  if (storedVersion < 16) {
    data.climate.outdoorPenaltyActive = false;
    data.climate.coldWarningDate = "";
  }
  data.climate.outdoorPenaltyActive = data.climate.outdoorPenaltyActive === true;
  data.climate.coldWarningDate = String(data.climate.coldWarningDate ?? "");
  if (storedVersion < 3) {
    data.research = data.research.map((topic) => ({ ...topic, points: Number(topic.points) === 0 ? -1 : Number(topic.points) }));
  }
  data.investigations = normalizeInvestigations(data.investigations);
  syncInvestigationResearchPoints(data);
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
  if (storedVersion < 18) {
    data.servantPhantoms = createDefaultServantPhantoms();
    data.boons = createDefaultData().boons;
  }
  const storedServants = normalizeArray(data.servantPhantoms);
  data.servantPhantoms = SERVANT_PHANTOMS.map((definition) => {
    const stored = storedServants.find((entry) => entry?.id === definition.id) ?? {};
    const recipeIds = (SERVANT_RECIPES[definition.id] ?? []).map((recipe) => recipe.id);
    const storedOrder = [...new Set(normalizeArray(stored.recipeOrder).map(String))];
    const recipeOrder = [...storedOrder.filter((id) => recipeIds.includes(id)), ...recipeIds.filter((id) => !storedOrder.includes(id))];
    return {
      id: definition.id,
      active: stored.active === true,
      lastGrantedDay: stored.lastGrantedDay !== null && stored.lastGrantedDay !== undefined && Number.isInteger(Number(stored.lastGrantedDay)) ? Number(stored.lastGrantedDay) : null,
      recipeOrder,
      usedRecipeIds: [...new Set(normalizeArray(stored.usedRecipeIds).map(String).filter((id) => recipeIds.includes(id)))],
    };
  });
  data.boons = data.boons && typeof data.boons === "object" ? data.boons : {};
  data.boons.ausken = {
    lastGrantedDay: data.boons.ausken?.lastGrantedDay !== null && data.boons.ausken?.lastGrantedDay !== undefined && Number.isInteger(Number(data.boons.ausken.lastGrantedDay)) ? Number(data.boons.ausken.lastGrantedDay) : null,
  };
  data.boons.shelyn = {
    active: data.boons.shelyn?.active === true,
    choice: SHELYN_BLESSINGS.some((entry) => entry.id === data.boons.shelyn?.choice) ? data.boons.shelyn.choice : "tangy",
    lastGrantedDay: data.boons.shelyn?.lastGrantedDay !== null && data.boons.shelyn?.lastGrantedDay !== undefined && Number.isInteger(Number(data.boons.shelyn.lastGrantedDay)) ? Number(data.boons.shelyn.lastGrantedDay) : null,
  };
  data.mementos = normalizeArray(data.mementos);
  const defaults = createDefaultMementos();
  data.mementos = defaults.map((definition) => {
    const stored = data.mementos.find((entry) => entry?.id === definition.id) ?? {};
    const merged = {
      ...definition,
      ...stored,
    };
    merged.wallUuids = String(merged.wallUuids ?? "");
    merged.regionUuids = String(merged.regionUuids ?? "");
    delete merged.regionBehaviorUuids;
    if (storedVersion < 3) {
      merged.foundArea = definition.foundArea;
      merged.area = definition.area;
    }
    if (storedVersion < 4 && ["dazerien-thumbscrew", "raudltz-telescope", "ryhasphinea-hourglass", "irrokcis-medallion"].includes(definition.id)) {
      Object.assign(merged, definition, { wallUuids: stored.wallUuids ?? definition.wallUuids });
    }
    if (storedVersion < 17 && definition.id === "irrokcis-medallion") {
      const legacyBonus = "Все Удары оружием персонажей игроков наносят 1 дополнительный духовный урон до конца Пути Приключений.";
      if (!stored.bonus || stored.bonus === legacyBonus) merged.bonus = definition.bonus;
      const legacyRules = JSON.stringify([{
        key: "FlatModifier",
        selector: "strike-damage",
        type: "untyped",
        value: 1,
        damageType: "spirit",
        slug: "irrokcis-medallion-damage",
        predicate: ["item:type:weapon", { not: "item:category:unarmed" }],
      }], null, 2);
      if (!stored.rules || stored.rules === legacyRules) merged.rules = definition.rules;
    }
    return merged;
  });
  data.accessBlocks = [{ id: "phantoms", wallUuids: "", regionUuids: "" }].map((definition) => {
    const stored = normalizeArray(raw?.accessBlocks).find((entry) => entry?.id === definition.id) ?? {};
    return { ...definition, ...stored, wallUuids: String(stored.wallUuids ?? ""), regionUuids: String(stored.regionUuids ?? "") };
  });
  if (data.homebrew && typeof data.homebrew === "object") {
    delete data.homebrew.medallionUnarmed;
    if (!Object.keys(data.homebrew).length) delete data.homebrew;
  }
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

function mementoReturned(data, id, slug = "") {
  return data.inventory.some((entry) => (
    entry.category === "memento"
    && (entry.mementoId === id || (slug && entry.slug === slug))
  ));
}

function jinnivereReturned(data) {
  return mementoReturned(data, "jinnivere-riding-crop", "jinniveres-riding-crop");
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
  const mementoStages = [
    ["augsten-cudgel", "augstens-cudgel", "augsten", "Приёмные Залы"],
    ["alisendra-fan", "alisendras-fan", "alisendra", "Подземелье"],
    ["dazerien-thumbscrew", "dazeriens-thumbscrew", "dazerien", "Личные Залы"],
    ["raudltz-telescope", "raudltzs-telescope", "raudltz", "Храм"],
    ["ryhasphinea-hourglass", "ryhasphineas-hourglass", "ryhasphinea", "Катакомбы"],
    ["irrokcis-medallion", "irrokciss-medallion", "irrokcis", "Башни"],
  ];
  for (const [mementoId, slug, stageKey, stageLabel] of mementoStages) {
    if (!mementoReturned(data, mementoId, slug)) continue;
    key = stageKey;
    label = stageLabel;
  }
  const defaults = createDefaultData().climate.stages[key];
  const configured = stages[key] ?? defaults;
  const sunrise = normalizeHour(configured.sunrise, defaults.sunrise);
  const sunset = normalizeHour(configured.sunset, defaults.sunset);
  const eternalNight = configured.eternalNight === true;
  const dayDuration = eternalNight ? 0 : (sunrise <= sunset ? sunset - sunrise : (24 - sunrise) + sunset);
  return {
    key,
    label,
    sunrise,
    sunset,
    sunriseLabel: eternalNight ? `${formatHour(sunrise)} (последний)` : formatHour(sunrise),
    sunsetLabel: eternalNight ? "сразу" : formatHour(sunset),
    dayDuration,
    nightDuration: 24 - dayDuration,
    description: String(configured.description ?? defaults.description ?? ""),
    perceptionPenalty: Math.min(0, Number(configured.perceptionPenalty) || 0),
    perceptionVisionOnly: configured.perceptionVisionOnly === true,
    rangedPenalty: Math.min(0, Number(configured.rangedPenalty) || 0),
    coldWarning: configured.coldWarning === true,
    eternalNight,
    lightning: configured.lightning === true,
    dayDurationLabel: Number.isInteger(dayDuration) ? String(dayDuration) : String(dayDuration).replace(".5", "½"),
    nightDurationLabel: Number.isInteger(24 - dayDuration) ? String(24 - dayDuration) : String(24 - dayDuration).replace(".5", "½"),
  };
}

function outdoorPenaltyRules(stage) {
  const rules = [];
  if (stage.perceptionPenalty < 0) {
    rules.push({
      key: "FlatModifier",
      label: "Непогода на улице",
      selector: "perception",
      slug: "bastardhall-outdoor-weather-perception",
      type: "circumstance",
      value: stage.perceptionPenalty,
    });
  }
  if (stage.rangedPenalty < 0) {
    rules.push({
      key: "FlatModifier",
      label: "Непогода на улице",
      selector: "strike-attack-roll",
      slug: "bastardhall-outdoor-weather-ranged",
      type: "circumstance",
      value: stage.rangedPenalty,
      predicate: ["item:ranged"],
    });
  }
  return rules;
}

function outdoorPenaltyDescription(stage) {
  const parts = [];
  if (stage.perceptionPenalty < 0) parts.push(`${stage.perceptionPenalty} к проверкам Восприятия${stage.perceptionVisionOnly ? ", основанным на зрении" : ""}`);
  if (stage.rangedPenalty < 0) parts.push(`${stage.rangedPenalty} к дистанционным Ударам`);
  return `На открытом воздухе: ${parts.join("; ")}.`;
}

function isDaytime(data) {
  const components = currentClockComponents();
  const hour = components
    ? Number(components.hour ?? 0) + (Number(components.minute ?? 0) / 60) + (Number(components.second ?? 0) / 3600)
    : (Number(game.time?.worldTime ?? 0) / 3600) % 24;
  const stage = getClimateStage(data);
  if (stage.eternalNight) return false;
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

function currentWorldDateKey() {
  const pf2eWorldTime = game.pf2e?.worldClock?.worldTime;
  if (typeof pf2eWorldTime?.toISODate === "function") return String(pf2eWorldTime.toISODate());
  const pf2eDateParts = [Number(pf2eWorldTime?.year), Number(pf2eWorldTime?.month), Number(pf2eWorldTime?.day)];
  if (pf2eDateParts.every(Number.isFinite)) return pf2eDateParts.join("-");
  try {
    const date = game.seasonsStars?.api?.getCurrentDate?.();
    const dateParts = [Number(date?.year), Number(date?.month), Number(date?.day)];
    if (dateParts.every(Number.isFinite)) return dateParts.join("-");
  } catch (_error) {
    // Fall through to the currently selected clock components.
  }
  const components = currentClockComponents();
  const year = Number(components?.year);
  const month = Number(components?.month);
  const day = Number(components?.day);
  if ([year, month, day].every(Number.isFinite)) return `${year}-${month}-${day}`;
  return `elapsed-${Math.floor(Number(game.time?.worldTime ?? 0) / 86400)}`;
}

async function postModerateColdWarning(data) {
  const stage = getClimateStage(data);
  if (!stage.coldWarning || stage.eternalNight || isDaytime(data)) return;
  const warningHour = stage.sunset + 4;
  if (warningHour >= 24 || currentWorldHour() < warningHour) return;
  const dateKey = currentWorldDateKey();
  if (data.climate.coldWarningDate === dateKey) return;

  data.climate.coldWarningDate = dateKey;
  await saveData(data);
  await ChatMessage.create({
    user: game.user?.id ?? null,
    speaker: ChatMessage.getSpeaker(),
    content: `<section class="bh-cold-chat-warning"><h3><i class="fa-solid fa-temperature-low"></i> Умеренный холод</h3><p>После заката прошло 4 часа. Если ПИ не защищены одеждой для холодной погоды, способностью переносить холод или подходящим магическим эффектом, они получают состояние @UUID[Compendium.pf2e.conditionitems.Item.HL2l2VRSaQHu9lUw]{Утомление}.</p><p>Утомлённые ПИ не могут использовать действия исследования, включая Поиск предметов и ловушек.</p></section>`,
  });
}

async function postLightningDamage() {
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll");
  if (!DamageRoll) throw new Error("PF2E DamageRoll недоступен.");

  const targets = Array.from(game.user?.targets ?? [])
    .map((token) => token.document?.uuid)
    .filter(Boolean);
  const roll = await new DamageRoll("(10d6)[electricity]").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker(),
    flavor: `<section class="bh-lightning-chat"><h3><i class="fa-solid fa-bolt-lightning"></i><span>Удар молнии</span></h3><p>Молния поражает одного из ПИ снаружи.</p><div class="bh-lightning-save"><i class="fa-solid fa-person-running"></i><span>Базовый Рефлекс</span><strong>КС 30</strong></div></section>`,
    flags: {
      pf2e: { context: { type: "damage-roll", options: ["damaging-effect"] } },
      "pf2e-toolbelt": {
        targetHelper: {
          type: "damage",
          targets,
          options: ["damaging-effect"],
          saveVariants: {
            null: { basic: true, dc: 30, statistic: "reflex" },
          },
        },
      },
    },
  });
  return roll;
}

async function rollTowerLightning() {
  const actor = canvas?.tokens?.controlled?.find?.((token) => token.actor?.type === "character")?.actor
    ?? game.user?.character
    ?? game.actors?.find?.((entry) => entry.type === "character")
    ?? null;
  const Check = game.pf2e?.Check;
  const CheckModifier = game.pf2e?.CheckModifier;
  if (actor && Check?.roll && CheckModifier) {
    const check = new CheckModifier("Удар молнии", { modifiers: [] });
    return Check.roll(check, {
      actor,
      type: "flat-check",
      title: "Удар молнии: избежать разряда",
      dc: { value: 17 },
      skipDialog: true,
    }, null, async (_roll, outcome) => {
      if (!["success", "criticalSuccess"].includes(outcome)) await postLightningDamage();
    });
  }

  const roll = await new Roll("1d20").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "<strong>Удар молнии: чистая проверка Сл 17</strong>",
  });
  if (Number(roll.total) < 17) await postLightningDamage();
  return roll;
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

function researchPoints(data, topicIndex) {
  const points = Number(data.research?.[topicIndex]?.points);
  return Number.isFinite(points) ? points : -1;
}

function researchSearchEffect() {
  return {
    name: "Поиск дверей и тайников",
    description: "Бонус обстоятельства +2 к проверкам Восприятия при Поиске потайных дверей или скрытых тайников в замке. Не применяется к инициативе.",
    rules: [{
      key: "FlatModifier",
      label: "Поиск дверей и тайников",
      selector: "perception",
      slug: "bastardhall-search-doors-and-caches",
      type: "circumstance",
      value: 2,
      hideIfDisabled: false,
      predicate: [{ not: "check:statistic:initiative" }],
    }],
    img: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
  };
}

function researchCurseSaveEffect(points) {
  const value = points >= 21 ? 4 : 1;
  return {
    name: "Защита от проклятий",
    description: `Бонус обстоятельства +${value} к спасброскам против эффектов с трейтом «проклятие».`,
    rules: [{
      key: "FlatModifier",
      label: "Защита от проклятий",
      selector: "saving-throw",
      slug: "bastardhall-curse-saving-throws",
      type: "circumstance",
      value,
      predicate: ["item:trait:curse"],
    }],
    img: "icons/magic/defensive/shield-barrier-flaming-diamond-purple-orange.webp",
  };
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

function mementoBonusText(memento) {
  return String(memento.bonus ?? "");
}

function mementoRules(memento, key) {
  const rules = parseRules(memento.rules, key);
  if (memento.id !== "irrokcis-medallion") return rules;
  return rules.map((rule) => {
    if (rule?.slug !== "irrokcis-medallion-damage") return rule;
    const adjusted = clone(rule);
    delete adjusted.predicate;
    return adjusted;
  });
}

async function reconcileActorEffects(data, nightActive, stormActive, campaignEnabled = true) {
  const hp = totalBonusHp(data);
  const searchResearchPoints = researchPoints(data, 1);
  const curseResearchPoints = researchPoints(data, 10);
  const searchResearch = researchSearchEffect();
  const curseSaveResearch = researchCurseSaveEffect(curseResearchPoints);
  const pcNightActive = pcNightPenaltyActive(data, nightActive);
  const collectedMementoIds = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
  const nightPcRules = parseRules(data.climate.night.pcRules, "night/PC");
  const nightNpcRules = parseRules(data.climate.night.npcRules, "night/NPC");
  const stormPcRules = parseRules(data.climate.storm.pcRules, "storm/PC");
  const stormNpcRules = parseRules(data.climate.storm.npcRules, "storm/NPC");
  const climateStage = getClimateStage(data);
  const weatherRules = outdoorPenaltyRules(climateStage);
  const outdoorPenaltyActive = campaignEnabled && data.climate.outdoorPenaltyActive === true && weatherRules.length > 0;

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
    await syncEffect(actor, "outdoor-weather-pc", playerCharacter && outdoorPenaltyActive, () => effectSource(
      "outdoor-weather-pc",
      "Непогода на улице",
      outdoorPenaltyDescription(climateStage),
      weatherRules,
      "icons/magic/air/weather-clouds-rain.webp",
    ));

    await syncEffect(actor, "research-search", campaignEnabled && playerCharacter && searchResearchPoints >= 11, () => effectSource(
      "research-search",
      `Бастардхолл: ${searchResearch.name}`,
      searchResearch.description,
      searchResearch.rules,
      searchResearch.img,
    ));
    await syncEffect(actor, "research-curse-saves", campaignEnabled && playerCharacter && curseResearchPoints >= 12, () => effectSource(
      "research-curse-saves",
      `Бастардхолл: ${curseSaveResearch.name}`,
      curseSaveResearch.description,
      curseSaveResearch.rules,
      curseSaveResearch.img,
    ));

    for (const memento of data.mementos) {
      const key = `memento-${memento.id}`;
      const active = campaignEnabled && playerCharacter && collectedMementoIds.has(memento.id);
      await syncEffect(actor, key, active, () => effectSource(key, `Бастардхолл: ${memento.name}`, mementoBonusText(memento), mementoRules(memento, key)));
    }

    for (const phantom of data.phantoms) {
      const key = `phantom-${phantom.id}`;
      const support = phantomPermanentEffect(phantom.id, phantom.found ? Number(phantom.rank) || 0 : -1);
      await syncEffect(actor, key, campaignEnabled && playerCharacter && Boolean(support), () => effectSource(key, `Бастардхолл: ${support.name}`, support.description, support.rules, support.img));
    }
    if (!campaignEnabled || phantomRank(data, "ausken") < 1) await syncEffect(actor, "ausken-blessing", false, () => null);
    if (!campaignEnabled || !data.boons.shelyn.active) await syncEffect(actor, "shelyn-grace", false, () => null);
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

function nightTexturePresetScenes(data, { includeManaged = false } = {}) {
  const scenes = new Map();
  for (const ref of splitRefs(data.climate.sceneRefs)) {
    const scene = resolveScene(ref);
    if (scene) scenes.set(scene.id, scene);
  }
  if (includeManaged) {
    for (const scene of game.scenes?.contents ?? []) {
      if (scene.getFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG)) scenes.set(scene.id, scene);
    }
  }
  return [...scenes.values()];
}

async function applyNightTexturePresets(data) {
  for (const scene of nightTexturePresetScenes(data)) {
    if (scene.getFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG)) continue;
    const originalPreset = scene.getFlag(MODULE_ID, TEXTURE_PRESET_FLAG) ?? null;
    await scene.setFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG, { originalPreset });
    if (originalPreset !== BASTION_TEXTURE_PRESET) {
      await scene.setFlag(MODULE_ID, TEXTURE_PRESET_FLAG, BASTION_TEXTURE_PRESET);
    }
  }
}

async function restoreNightTexturePresets(data = getData()) {
  for (const scene of nightTexturePresetScenes(data, { includeManaged: true })) {
    const stored = scene.getFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG);
    if (!stored) continue;
    const currentPreset = scene.getFlag(MODULE_ID, TEXTURE_PRESET_FLAG) ?? null;
    if (currentPreset === BASTION_TEXTURE_PRESET) {
      if (stored.originalPreset == null) await scene.unsetFlag(MODULE_ID, TEXTURE_PRESET_FLAG);
      else await scene.setFlag(MODULE_ID, TEXTURE_PRESET_FLAG, stored.originalPreset);
    }
    await scene.unsetFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG);
  }
}

async function disableMementoWalls(memento) {
  for (const ref of splitRefs(memento.wallUuids)) {
    try {
      const wall = await fromUuid(ref);
      if (wall?.documentName !== "Wall") continue;
      const stored = wall.getFlag(MODULE_ID, "wallTexture") ?? {};
      if (stored.enabled === false) continue;
      
      const originalRestrictions = {
        light: wall.light,
        move: wall.move,
        sight: wall.sight,
        sound: wall.sound,
      };

      await wall.update({
        light: 0,
        move: 0,
        sight: 0,
        sound: 0,
        [`flags.${MODULE_ID}.wallTexture`]: {
          ...stored,
          enabled: false,
          originalRestrictions,
        },
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to disable Bastardhall border ${ref}`, error);
    }
  }
}

async function reconcileMementoRegionBehaviors(memento, collected) {
  for (const ref of splitRefs(memento.regionUuids)) {
    try {
      const region = await fromUuid(ref);
      if (accessDocumentName(region) !== "Region") continue;
      const access = region.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG);
      if (!accessFlagEnabled(access?.enabled) || access.stage !== memento.id) continue;
      const originalDisabled = accessOriginalDisabled(access) ?? {};
      for (const behavior of region.behaviors?.contents ?? []) {
        if (collected) await behavior.update({ disabled: false });
        else {
          const disabled = originalDisabled[behavior.uuid];
          if (disabled !== undefined && behavior.disabled !== disabled) await behavior.update({ disabled });
        }
      }
      if (collected) {
        if (region.color !== "#16a298") await region.update({ color: "#16a298" });
      } else if (access.originalColor !== undefined && region.color !== access.originalColor) {
        await region.update({ color: access.originalColor });
      }
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to reconcile Bastardhall region behavior ${ref}`, error);
    }
  }
}

async function restoreMementoRegionBehaviors(data) {
  for (const memento of accessBlockEntries(data)) {
    for (const ref of splitRefs(memento.regionUuids)) {
      try {
        const region = await fromUuid(ref);
        const access = region?.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG);
        const originalDisabled = accessOriginalDisabled(access) ?? {};
        for (const behavior of region?.behaviors?.contents ?? []) {
          const disabled = originalDisabled[behavior.uuid];
          if (disabled !== undefined && behavior.disabled !== disabled) await behavior.update({ disabled });
        }
        if (access?.originalColor !== undefined && region.color !== access.originalColor) {
          await region.update({ color: access.originalColor });
        }
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to restore Bastardhall region behavior ${ref}`, error);
      }
    }
  }
}

async function restoreAccessRegion(region) {
  if (accessBlockStage(region)) return;
  const access = region?.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG);
  const originalDisabled = accessOriginalDisabled(access) ?? {};
  for (const behavior of region?.behaviors?.contents ?? []) {
    const disabled = originalDisabled[behavior.uuid];
    if (disabled !== undefined && behavior.disabled !== disabled) await behavior.update({ disabled });
  }
  if (access?.originalColor !== undefined && region.color !== access.originalColor) {
    await region.update({ color: access.originalColor });
  }
}

async function restoreMementoWalls(data) {
  for (const memento of accessBlockEntries(data)) {
    for (const ref of splitRefs(memento.wallUuids)) {
      try {
        const wall = await fromUuid(ref);
        if (wall?.documentName !== "Wall") continue;
        const stored = wall.getFlag(MODULE_ID, "wallTexture");
        if (stored?.enabled !== false) continue;

        const restrictions = stored.originalRestrictions ?? {};
        const updates = {
          [`flags.${MODULE_ID}.wallTexture`]: {
            ...stored,
            enabled: true,
            "-=originalRestrictions": null,
          }
        };

        if (restrictions.light !== undefined) updates.light = restrictions.light;
        if (restrictions.move !== undefined) updates.move = restrictions.move;
        if (restrictions.sight !== undefined) updates.sight = restrictions.sight;
        if (restrictions.sound !== undefined) updates.sound = restrictions.sound;

        await wall.update(updates);
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
  await restoreMementoRegionBehaviors(previous);
  await restoreNightTexturePresets(previous);
  for (const actor of game.actors?.contents ?? []) {
    if (actor.getFlag?.(MODULE_ID, "phantomDaily")) await actor.unsetFlag(MODULE_ID, "phantomDaily");
    const dailyEffects = [
      ...managedEffects(actor, "ausken-blessing"),
      ...managedEffects(actor, "shelyn-grace"),
    ];
    if (dailyEffects.length) await actor.deleteEmbeddedDocuments("Item", [...new Set(dailyEffects.map((item) => item.id))]);
  }
  const resetData = createDefaultData();
  resetData.inventory = [];
  resetData.sideQuests = [];
  resetData.investigations = [];
  await game.settings.set(MODULE_ID, DATA_SETTING, resetData);
  await rebuildAccessBlockLinks();

  // Foundry can retain an indexed array when replacing an Object setting in some
  // versions. Verify the persisted value and explicitly remove inventory keys.
  const persisted = clone(game.settings.get(MODULE_ID, DATA_SETTING) ?? {});
  if (normalizeArray(persisted.inventory).length) {
    persisted.inventory = [];
    await game.settings.set(MODULE_ID, DATA_SETTING, persisted);
  }

  const normalized = getData();
  const remaining = normalized.inventory.length;
  if (remaining) throw new Error(`Не удалось очистить инвентарь: осталось предметов — ${remaining}.`);
  if (normalized.sideQuests.length) throw new Error("Не удалось очистить список сайд-квестов.");
  if (normalized.investigations.length) throw new Error("Не удалось очистить список изысканий.");
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
      stage: getClimateStage(data),
      outdoorPenaltyActive: data.climate.outdoorPenaltyActive,
      nightRules: { pc: data.climate.night.pcRules, npc: data.climate.night.npcRules },
      stormRules: { pc: data.climate.storm.pcRules, npc: data.climate.storm.npcRules },
    },
    collectedMementos,
    research: data.research.map(({ id, points }) => ({ id, points })),
    mementos: data.mementos.map(({ id, name, bonus, rules }) => ({ id, name, bonus, rules })),
    phantoms: data.phantoms.map(({ id, name, found, rank, actorUuid }) => ({ id, name, found, rank, actorUuid })),
    dailyBoons: { shelynActive: data.boons.shelyn.active },
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
    allPhantomsFound: allPhantomsFound(data),
    walls: accessBlockEntries(data).map(({ id, wallUuids, regionUuids }) => ({ id, wallUuids, regionUuids })),
  });
}

let activeReconcile = null;
let pendingReconcile = null;
let lastActorSignature = null;
let lastSceneSignature = null;
let lastMementoSignature = null;
let lastObservedNightActive = null;

async function runReconcile(request) {
  const data = getData();
  const enabled = Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING));
  const nightActive = enabled && !isDaytime(data);
  const stormActive = enabled && Boolean(data.climate.stormActive);

  if (request.observeNightTransition) {
    const previousNightActive = lastObservedNightActive;
    lastObservedNightActive = nightActive;
    if (previousNightActive === false && nightActive) await applyNightTexturePresets(data);
    else if (previousNightActive === true && !nightActive) await restoreNightTexturePresets(data);
    if (enabled) await postModerateColdWarning(data);
  }
  if (request.restoreNightPresets || (!enabled && nightTexturePresetScenes(data, { includeManaged: true }).some((scene) => scene.getFlag(MODULE_ID, NIGHT_TEXTURE_PRESET_FLAG)))) {
    await restoreNightTexturePresets(data);
    lastObservedNightActive = nightActive;
  }

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
      if (enabled) {
        for (const memento of accessBlockEntries(data)) {
          const open = accessBlockIsOpen(data, memento);
          if (open) await disableMementoWalls(memento);
          await reconcileMementoRegionBehaviors(memento, open);
        }
    }
    lastMementoSignature = mementoSignature;
  }
}

function queueReconcile({ forceActors = false, forceScenes = false, forceMementos = false, observeNightTransition = false, restoreNightPresets = false } = {}) {
  if (!isPrimaryGM()) return activeReconcile;
  pendingReconcile ??= { forceActors: false, forceScenes: false, forceMementos: false, observeNightTransition: false, restoreNightPresets: false };
  pendingReconcile.forceActors ||= forceActors;
  pendingReconcile.forceScenes ||= forceScenes;
  pendingReconcile.forceMementos ||= forceMementos;
  pendingReconcile.observeNightTransition ||= observeNightTransition;
  pendingReconcile.restoreNightPresets ||= restoreNightPresets;
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

function plainTextFromHtml(value) {
  if (value && typeof value === "object") return "";
  const raw = String(value ?? "");
  if (!raw) return "";
  const container = document.createElement("div");
  container.innerHTML = raw.replace(/<(?:br\s*\/?|\/p|\/div|\/li)>/gi, "\n");
  return normalizeText((container.textContent ?? "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n"), 4000);
}

function actorFamilyNotes(actor) {
  const candidates = [
    foundry.utils.getProperty(actor, "system.details.publicNotes"),
    foundry.utils.getProperty(actor, "system.details.biography.value"),
    foundry.utils.getProperty(actor, "system.details.biography"),
    foundry.utils.getProperty(actor, "system.description.value"),
  ];
  return candidates.map(plainTextFromHtml).find(Boolean) ?? "";
}

function familySlotView(slot, definition) {
  const actor = resolveActor(slot.actorUuid);
  const assigned = Boolean(slot.actorUuid);
  return {
    ...definition,
    ...slot,
    assigned,
    name: actor?.name ?? slot.name,
    img: actor?.img ?? slot.img,
    notes: actor ? actorFamilyNotes(actor) : slot.notes,
    xPercent: Number(definition.x ?? 500) / 10,
  };
}

function storedFamilySlot(data, section, id) {
  if (section === "crest") return data.familyTree.crest;
  const collection = section === "customHeirs" ? data.familyTree.customHeirs : data.familyTree.slots;
  return collection.find((slot) => slot.id === id) ?? null;
}

function assignFamilyActor(slot, actor) {
  slot.actorUuid = actor.uuid;
  slot.name = normalizeText(actor.name, 160);
  slot.img = normalizeText(actor.img, 1000);
  slot.notes = actorFamilyNotes(actor);
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

async function equipmentItemBySlug(slug) {
  const { pack, entries } = await equipmentIndex();
  const entry = entries.find((candidate) => indexedSlug(candidate) === String(slug ?? "").toLowerCase());
  return entry && pack ? fromUuid(`Compendium.${pack.collection}.${entry._id}`) : null;
}

async function givePreparedItem(actor, recipe, quantity, { infused = false } = {}) {
  const item = await equipmentItemBySlug(recipe.slug);
  if (!item || item.documentName !== "Item") throw new Error(`В pf2e.equipment-srd не найден предмет со slug «${recipe.slug}».`);
  const source = item.toObject();
  delete source._id;
  foundry.utils.setProperty(source, "system.quantity", Math.max(1, Math.trunc(Number(quantity) || 1)));
  if (infused) {
    const traits = normalizeArray(source.system?.traits?.value);
    if (!traits.includes("infused")) traits.push("infused");
    foundry.utils.setProperty(source, "system.traits.value", traits);
  }
  if (recipe.suffix) source.name = `${source.name} (${recipe.suffix})`;
  if (recipe.variant) {
    const variantText = recipe.variant === "mournful" ? "Вариант приготовления: Скорбный." : "Вариант приготовления: Виски.";
    const description = String(source.system?.description?.value ?? "");
    foundry.utils.setProperty(source, "system.description.value", `<p><strong>${variantText}</strong></p>${description}`);
  }
  foundry.utils.setProperty(source, `flags.${MODULE_ID}.bastardhallPreparation`, {
    recipeId: recipe.id,
    variant: recipe.variant ?? "",
    createdDay: currentWorldDay(),
  });
  await actor.createEmbeddedDocuments("Item", [source]);
  return source;
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

function unlockedArea(data, areaName) {
  if (areaName === "Береговая Линия") return true;
  if (areaName === "Замковые Территории") return allPhantomsFound(data);
  const collected = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
  return data.mementos.some((memento) => memento.area === areaName && collected.has(memento.id));
}

function servantState(data, id) {
  return data.servantPhantoms.find((entry) => entry.id === id) ?? null;
}

function remainingServantRecipes(servant) {
  const used = new Set(servant?.usedRecipeIds ?? []);
  return normalizeArray(servant?.recipeOrder).filter((id) => !used.has(id));
}

function actorAllowedForUser(actor, user) {
  return Boolean(actor?.type === "character" && user && (user.isGM || actor.testUserPermission?.(user, "OWNER") || user.character?.id === actor.id));
}

function requestedActor(actorId, user) {
  const actor = game.actors?.get(normalizeText(actorId, 120));
  return actorAllowedForUser(actor, user) ? actor : null;
}

function emitDailyResult(recipientId, message, level = "info") {
  const payload = {
    type: "bastardhall-daily-result",
    id: randomId(),
    recipientId,
    message: normalizeText(message, 1000),
    level: ["info", "warn", "error"].includes(level) ? level : "info",
  };
  if (recipientId === game.user?.id) ui.notifications?.[payload.level]?.(payload.message);
  else game.socket?.emit?.(SOCKET_CHANNEL, payload);
}

async function rollServantQuantity(label) {
  const roll = await new Roll("1d4").evaluate();
  await roll.toMessage({ flavor: `<b>${escapeHtml(label)}</b><br>Количество приготовленных порций.` });
  return Math.max(1, Number(roll.total) || 1);
}

async function grantDailyCooking(request = {}, userId = game.user?.id) {
  if (!isPrimaryGM()) return;
  const user = game.users?.get(userId);
  if (!user) return;
  const data = getData();
  const today = currentWorldDay();
  const results = [];
  const errors = [];
  let changed = false;

  const aron = data.phantoms.find((entry) => entry.id === "aron");
  const aronRank = aron?.found ? Number(aron.rank) || 0 : -1;
  const aronActor = requestedActor(request.targets?.aron, user);
  if (aronRank >= 1 && aronActor) {
    try {
      const max = aronRank >= 3 ? 3 : 2;
      const usedByGroup = playerCharacters().reduce((used, character) => used + dailyUses(character, "aronDrinks"), 0);
      const remaining = Math.max(0, max - usedByGroup);
      const allowed = new Set((await phantomItemOptions("drinks", aronRank)).map((entry) => entry.uuid));
      const uuids = normalizeArray(request.aronItems).map(String).filter((uuid) => allowed.has(uuid)).slice(0, remaining);
      if (!remaining) results.push("Напитки Арона сегодня уже выданы.");
      else if (!uuids.length) results.push("Для Арона не выбраны напитки.");
      else {
        const count = await giveItems(aronActor, uuids, { infused: true });
        if (count) {
          await addDailyUses(aronActor, "aronDrinks", count);
          results.push(`${aronActor.name} получает напитки Арона ×${count}.`);
        }
      }
    } catch (error) {
      errors.push(`Арон: ${error.message}`);
    }
  }

  for (const definition of SERVANT_PHANTOMS) {
    const servant = servantState(data, definition.id);
    const actor = requestedActor(request.targets?.[definition.id], user);
    if (!servant?.active || !actor) continue;
    if (servant.lastGrantedDay === today) {
      results.push(`${definition.name} сегодня уже выдали свою готовку.`);
      continue;
    }
    try {
      if (definition.id === "bakers") {
        const moderate = unlockedArea(data, "Храм");
        const recipe = {
          id: moderate ? "poets-fritter-moderate" : "poets-fritter-lesser",
          slug: moderate ? "poets-fritter-moderate" : "poets-fritter-lesser",
        };
        await givePreparedItem(actor, recipe, 2, { infused: true });
        servant.lastGrantedDay = today;
        changed = true;
        results.push(`${actor.name} получает Пончик поэта ${moderate ? "[Средний]" : "[Малый]"} ×2 (насыщенные).`);
        continue;
      }

      const nextRecipeId = remainingServantRecipes(servant)[0];
      const recipe = SERVANT_RECIPES[definition.id]?.find((entry) => entry.id === nextRecipeId);
      if (!recipe) {
        results.push(`У ${definition.id === "cooks" ? "поваров" : "пивоваров"} закончились ингредиенты.`);
        continue;
      }
      const quantity = await rollServantQuantity(definition.name);
      await givePreparedItem(actor, recipe, quantity);
      servant.usedRecipeIds.push(recipe.id);
      servant.lastGrantedDay = today;
      changed = true;
      results.push(`${actor.name} получает «${recipe.name}» ×${quantity}.`);
    } catch (error) {
      errors.push(`${definition.name}: ${error.message}`);
    }
  }

  if (changed) await saveData(data);
  const message = [...results, ...errors].join(" ") || "Не выбраны доступные получатели ежедневной готовки.";
  emitDailyResult(user.id, message, errors.length ? "warn" : "info");
}

function shelynDaylightEffect(data, blessing) {
  const remainingHours = Math.max(0, Number(getClimateStage(data).sunset) - currentWorldHour());
  const minutes = Math.max(1, Math.ceil(remainingHours * 60));
  const source = effectSource(
    "shelyn-grace",
    `Бастардхолл: ${blessing.name}`,
    `${blessing.spell}: бонус предмета +1 к ${blessing.check} до сегодняшнего заката.`,
    [{ key: "FlatModifier", selector: blessing.selector, type: "item", value: 1 }],
    "icons/magic/holy/prayer-hands-glowing-yellow-green.webp",
  );
  source.system.duration = { value: minutes, unit: "minutes", expiry: "turn-start", sustained: false };
  return source;
}

async function grantAuskenBlessing(actors, rank) {
  const rules = [{ key: "FlatModifier", selector: "saving-throw", type: "status", value: 1, predicate: ["item:trait:fear"] }];
  if (rank >= 2) rules.push({ key: "AdjustDegreeOfSuccess", selector: "saving-throw", adjustment: { success: "one-degree-better" }, predicate: ["item:trait:fear"] });
  const description = rank >= 2
    ? "На 24 часа: бонус состояния +1 к спасброскам против страха; успех против страха считается критическим успехом. При получении Испуга его значение уменьшается на 1 вручную."
    : "На 24 часа: бонус состояния +1 к спасброскам против страха. При получении Испуга его значение уменьшается на 1 вручную.";
  for (const actor of actors) {
    await replaceManagedEffect(actor, "ausken-blessing", temporaryEffectSource("ausken-blessing", "Бастардхолл: Благословение шерифа", description, rules, "icons/symbols/star-yellow.webp"));
  }
}

async function grantDailyBoons(request = {}, userId = game.user?.id) {
  if (!isPrimaryGM()) return;
  const user = game.users?.get(userId);
  if (!user) return;
  const data = getData();
  const today = currentWorldDay();
  const results = [];
  const errors = [];
  let changed = false;

  const auskenRank = phantomRank(data, "ausken");
  if (auskenRank >= 1) {
    const maxTargets = auskenRank >= 3 ? 2 : 1;
    const actors = [...new Set(normalizeArray(request.auskenActorIds).map((id) => requestedActor(id, user)).filter(Boolean))].slice(0, maxTargets);
    if (data.boons.ausken.lastGrantedDay === today) results.push("Благословение шерифа сегодня уже выдано.");
    else if (actors.length) {
      try {
        await grantAuskenBlessing(actors, auskenRank);
        data.boons.ausken.lastGrantedDay = today;
        changed = true;
        results.push(`Благословение шерифа получили: ${actors.map((actor) => actor.name).join(", ")}.`);
      } catch (error) {
        errors.push(`Благословение шерифа: ${error.message}`);
      }
    }
  }

  if (data.boons.shelyn.active) {
    const actors = playerCharacters();
    const blessing = SHELYN_BLESSINGS.find((entry) => entry.id === request.shelynChoice) ?? SHELYN_BLESSINGS[0];
    if (data.boons.shelyn.lastGrantedDay === today) results.push("Благодать Шелин сегодня уже выдана.");
    else if (!isDaytime(data)) results.push("Благодать Шелин можно выдать только в дневное время.");
    else if (!actors.length) results.push("В мире нет персонажей игроков для Благодати Шелин.");
    else if (actors.length) {
      try {
        for (const actor of actors) await replaceManagedEffect(actor, "shelyn-grace", shelynDaylightEffect(data, blessing));
        data.boons.shelyn.choice = blessing.id;
        data.boons.shelyn.lastGrantedDay = today;
        changed = true;
        results.push(`${blessing.name}: благо до заката получили ${actors.map((actor) => actor.name).join(", ")}.`);
      } catch (error) {
        errors.push(`Благодать Шелин: ${error.message}`);
      }
    }
  }

  if (changed) await saveData(data);
  const message = [...results, ...errors].join(" ") || "Не выбраны доступные получатели ежедневных благ.";
  emitDailyResult(user.id, message, errors.length ? "warn" : "info");
}

async function moveServantRecipe(serviceId, recipeId, direction, userId = game.user?.id) {
  if (!isPrimaryGM()) return;
  const user = game.users?.get(userId);
  if (!user) return;
  const data = getData();
  const servant = servantState(data, normalizeText(serviceId, 40));
  if (!servant || (!servant.active && !user.isGM)) return;
  const remaining = remainingServantRecipes(servant);
  const from = remaining.indexOf(normalizeText(recipeId, 80));
  const to = from + Math.sign(Number(direction) || 0);
  if (from < 0 || to < 0 || to >= remaining.length) return;
  const leftIndex = servant.recipeOrder.indexOf(remaining[from]);
  const rightIndex = servant.recipeOrder.indexOf(remaining[to]);
  [servant.recipeOrder[leftIndex], servant.recipeOrder[rightIndex]] = [servant.recipeOrder[rightIndex], servant.recipeOrder[leftIndex]];
  await saveData(data);
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

function normalizeUuidLinkSyntax(value) {
  return String(value ?? "").replace(/@UUID\[([^\]]+)\]\{\\\s*/g, "@UUID[$1]{");
}

async function enrichInvestigationLinks(root) {
  if (!globalThis.TextEditor?.enrichHTML) return;
  const elements = root?.querySelectorAll?.(".bh-investigation-description, .bh-investigation-checks, .bh-investigation-revelation-list, .bh-investigation-detail h2, .bh-investigation-sources h3, .bh-investigation-select strong") ?? [];
  await Promise.all([...elements].map(async (element) => {
    const content = normalizeUuidLinkSyntax(element.innerHTML);
    if (!content.includes("@UUID[")) return;
    const enriched = await TextEditor.enrichHTML(content, { async: true });
    if (element.isConnected) element.innerHTML = enriched;
  }));
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
    if (path === "stormActive") value = rawValue === "true" || rawValue === "on";
    if (/^phantoms\.\d+\.found$/.test(path)) value = rawValue === "true";
    if (/^research\.\d+\.points$/.test(path) || /^phantoms\.\d+\.rank$/.test(path)) value = parseNumber(rawValue);
    setPath(data, path, value);
  }
  return data;
}

function accessBlockOptions() {
  return [
    { id: "phantoms", label: "Замковые территории — найдены все фантомы Майсерин" },
    ...createDefaultMementos().map((memento) => ({ id: memento.id, label: `${memento.name} — открывает ${memento.area}` })),
  ];
}

function isBastardhallEnabled() {
  const value = game.settings.get(MODULE_ID, ENABLE_SETTING);
  return value === true || value === "true" || value === 1 || value === "1";
}

function createAccessBlockFieldset(doc) {
  const fieldset = globalThis.document.createElement("fieldset");
  fieldset.className = "tsu-wall-texture-config tsu-bastardhall-access-block";
  let originalDisabledInput = null;
  let originalColorInput = null;
  if (accessDocumentName(doc) === "Region") {
    const access = doc.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG) ?? {};
    const originalDisabled = accessOriginalDisabled(access) ?? Object.fromEntries(
      (doc.behaviors?.contents ?? []).map((behavior) => [behavior.uuid, behavior.disabled === true]),
    );
    originalDisabledInput = globalThis.document.createElement("input");
    originalDisabledInput.type = "hidden";
    originalDisabledInput.name = `flags.${MODULE_ID}.${ACCESS_BLOCK_FLAG}.originalDisabled`;
    originalDisabledInput.value = JSON.stringify(originalDisabled);
    originalColorInput = globalThis.document.createElement("input");
    originalColorInput.type = "hidden";
    originalColorInput.name = `flags.${MODULE_ID}.${ACCESS_BLOCK_FLAG}.originalColor`;
    originalColorInput.value = String(access.originalColor ?? doc.color ?? "");
    fieldset.append(originalDisabledInput, originalColorInput);
  }
  const legend = globalThis.document.createElement("legend");
  legend.textContent = "Блок доступа Бастардхолла";

  const enabledGroup = globalThis.document.createElement("div");
  enabledGroup.className = "form-group";
  const enabledLabel = globalThis.document.createElement("label");
  enabledLabel.textContent = "Включить";
  const enabledFields = globalThis.document.createElement("div");
  enabledFields.className = "form-fields";
  const enabledInput = globalThis.document.createElement("input");
  enabledInput.type = "hidden";
  enabledInput.name = `flags.${MODULE_ID}.${ACCESS_BLOCK_FLAG}.enabled`;
  enabledInput.dataset.dtype = "Boolean";
  const enabled = globalThis.document.createElement("input");
  enabled.type = "checkbox";
  enabled.value = "true";
  enabled.title = "Включить блок доступа";
  enabled.setAttribute("aria-label", "Включить блок доступа");
  const currentAccess = doc.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG) ?? {};
  const currentEnabled = accessFlagEnabled(currentAccess.enabled);
  enabledInput.value = currentEnabled ? "true" : "false";
  enabled.checked = currentEnabled;
  enabled.addEventListener("change", () => {
    const wasEnabled = enabledInput.value === "true";
    if (enabled.checked && !wasEnabled && originalDisabledInput && originalColorInput) {
      originalDisabledInput.value = JSON.stringify(Object.fromEntries(
        (doc.behaviors?.contents ?? []).map((behavior) => [behavior.uuid, behavior.disabled === true]),
      ));
      originalColorInput.value = String(doc.color ?? "");
    }
    enabledInput.value = enabled.checked ? "true" : "false";
  });
  enabledFields.append(enabledInput, enabled);
  enabledGroup.append(enabledLabel, enabledFields);

  const stageGroup = globalThis.document.createElement("div");
  stageGroup.className = "form-group";
  const stageLabel = globalThis.document.createElement("label");
  stageLabel.textContent = "Этап";
  const stageFields = globalThis.document.createElement("div");
  stageFields.className = "form-fields";
  const stage = globalThis.document.createElement("select");
  stage.name = `flags.${MODULE_ID}.${ACCESS_BLOCK_FLAG}.stage`;
  const currentStage = String(doc.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG)?.stage ?? "");
  const empty = globalThis.document.createElement("option");
  empty.value = "";
  empty.textContent = "— не выбран —";
  stage.append(empty);
  for (const option of accessBlockOptions()) {
    const element = globalThis.document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    element.selected = option.id === currentStage;
    stage.append(element);
  }
  stage.addEventListener("change", () => {
    const wasEnabled = enabledInput.value === "true";
    if (stage.value && !wasEnabled && originalDisabledInput && originalColorInput) {
      originalDisabledInput.value = JSON.stringify(Object.fromEntries(
        (doc.behaviors?.contents ?? []).map((behavior) => [behavior.uuid, behavior.disabled === true]),
      ));
      originalColorInput.value = String(doc.color ?? "");
    }
    enabled.checked = Boolean(stage.value);
    enabledInput.value = enabled.checked ? "true" : "false";
  });
  stageFields.append(stage);
  stageGroup.append(stageLabel, stageFields);
  const hint = globalThis.document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Документ будет автоматически добавлен в настройку памятной вещи на листе Бастардхолла.";
  fieldset.append(legend, enabledGroup, stageGroup, hint);
  return fieldset;
}

function injectAccessBlockConfig(app, element) {
  if (!isBastardhallEnabled()) return;
  const root = getFormRoot(element);
  const document = app?.document ?? app?.object;
  const documentName = accessDocumentName(document);
  if (!root || !document || !["Wall", "Region"].includes(documentName)) return;
  if (root.querySelector(".tsu-bastardhall-access-block")) return;
  const form = root.matches?.("form") ? root : root.querySelector("form");
  const accessBlock = createAccessBlockFieldset(document);
  const textureBlock = root.querySelector(".tsu-wall-texture-config");
  if (textureBlock?.parentElement) {
    textureBlock.parentElement.insertBefore(accessBlock, textureBlock.nextSibling);
  } else {
    const submitButton = root.querySelector("button[type='submit'], input[type='submit']");
    if (submitButton) submitButton.before(accessBlock);
    else form?.append(accessBlock);
  }
  app.setPosition?.({ height: "auto" });
}

function accessDocumentName(document) {
  return document?.documentName ?? document?.constructor?.documentName ?? "";
}

function accessFlagEnabled(value) {
  return value === true
    || value === "true"
    || value === "on"
    || (Array.isArray(value) && value.some((entry) => entry === true || entry === "true" || entry === "on"));
}

function accessOriginalDisabled(access) {
  if (access?.originalDisabled && typeof access.originalDisabled === "object") return access.originalDisabled;
  if (typeof access?.originalDisabled !== "string") return null;
  try {
    const parsed = JSON.parse(access.originalDisabled);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function accessBlockStage(document) {
  const access = document?.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG);
  return accessFlagEnabled(access?.enabled) ? String(access.stage ?? "") : "";
}

function accessBlockEntries(data) {
  return [...data.mementos, ...(data.accessBlocks ?? [])];
}

function accessBlockIsOpen(data, entry) {
  return entry.id === "phantoms" ? allPhantomsFound(data) : data.inventory.some((item) => item.category === "memento" && item.mementoId === entry.id);
}

async function syncAccessBlockDocument(document) {
  const documentName = accessDocumentName(document);
  if (!isPrimaryGM() || !isBastardhallEnabled() || !document?.uuid || !["Wall", "Region"].includes(documentName)) return;
  const stage = accessBlockStage(document);
  const data = getData();
  let changed = false;
  for (const memento of accessBlockEntries(data)) {
    const references = [[documentName === "Wall" ? "wallUuids" : "regionUuids", document.uuid]];
    for (const [property, reference] of references) {
      if (!reference) continue;
      const previous = String(memento[property] ?? "");
      const refs = splitRefs(memento[property]);
      const next = refs.filter((ref) => ref !== reference);
      if (stage === memento.id) next.push(reference);
      memento[property] = [...new Set(next)].join("\n");
      if (memento[property] !== previous) changed = true;
    }
  }
  if (changed) await saveData(data);
}

async function removeAccessBlockDocument(document) {
  if (!isPrimaryGM() || !document?.uuid) return;
  const data = getData();
  let changed = false;
  const documentName = accessDocumentName(document);
  const references = [[documentName === "Wall" ? "wallUuids" : "regionUuids", document.uuid]];
  for (const memento of data.mementos) {
    for (const [property, reference] of references) {
      if (!reference) continue;
      const next = splitRefs(memento[property]).filter((ref) => ref !== reference);
      if (next.join("\n") !== memento[property]) {
        memento[property] = next.join("\n");
        changed = true;
      }
    }
  }
  if (changed) await saveData(data);
}

async function restoreAccessWall(wall) {
  if (accessBlockStage(wall)) return;
  const stored = wall?.getFlag?.(MODULE_ID, "wallTexture");
  if (stored?.enabled !== false) return;
  const restrictions = stored.originalRestrictions ?? {};
  const update = {
    [`flags.${MODULE_ID}.wallTexture`]: {
      ...stored,
      enabled: true,
      "-=originalRestrictions": null,
    },
  };
  for (const property of ["light", "move", "sight", "sound"]) {
    if (restrictions[property] !== undefined) update[property] = restrictions[property];
  }
  await wall.update(update);
}

async function rebuildAccessBlockLinks() {
  if (!isPrimaryGM() || !isBastardhallEnabled()) return;
  const data = getData();
  const links = new Map(accessBlockEntries(data).map((memento) => [memento.id, { walls: [], regions: [] }]));
  for (const scene of game.scenes?.contents ?? []) {
    for (const document of [...(scene.walls?.contents ?? []), ...(scene.regions?.contents ?? [])]) {
      const stage = accessBlockStage(document);
      const entry = links.get(stage);
      if (!entry) continue;
      if (accessDocumentName(document) === "Wall") entry.walls.push(document.uuid);
      else {
        entry.regions.push(document.uuid);
      }
    }
  }
  let changed = false;
  for (const memento of accessBlockEntries(data)) {
    const link = links.get(memento.id);
    const wallUuids = link.walls.join("\n");
    const regionUuids = link.regions.join("\n");
    if (memento.wallUuids !== wallUuids || memento.regionUuids !== regionUuids) changed = true;
    memento.wallUuids = wallUuids;
    memento.regionUuids = regionUuids;
  }
  if (changed) await saveData(data);
}

function captureRegionAccessState(region, changed) {
  if (accessDocumentName(region) !== "Region") return;
  const path = `flags.${MODULE_ID}.${ACCESS_BLOCK_FLAG}`;
  const access = foundry.utils.getProperty(changed, path);
  if (!access || typeof access !== "object") return;
  const previousEnabled = accessFlagEnabled(region.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG)?.enabled);
  const nextEnabled = accessFlagEnabled(access.enabled);
  pendingRegionAccessChanges.set(region, { changed: previousEnabled !== nextEnabled, enabled: nextEnabled });
  if (!nextEnabled) return;
  const current = region.getFlag?.(MODULE_ID, ACCESS_BLOCK_FLAG) ?? {};
  if (current.originalDisabled === undefined && access.originalDisabled === undefined) {
    foundry.utils.setProperty(changed, `${path}.originalDisabled`, Object.fromEntries(
      (region.behaviors?.contents ?? []).map((behavior) => [behavior.uuid, behavior.disabled === true]),
    ));
  }
  if (current.originalColor === undefined && access.originalColor === undefined) {
    foundry.utils.setProperty(changed, `${path}.originalColor`, String(region.color ?? ""));
  }
}

function randomId() {
  return foundry.utils.randomID?.() ?? crypto.randomUUID();
}

function dialogRoot(html) {
  return html?.[0] ?? html;
}

async function promptSideQuest(quest = null, { allowHidden = game.user?.isGM } = {}) {
  const title = escapeHtml(quest?.title ?? "");
  const description = escapeHtml(quest?.description ?? "");
  return Dialog.prompt({
    title: quest ? "Редактировать сайд-квест" : "Новый сайд-квест",
    content: `<form class="bh-sidequest-dialog">
      <div class="form-group"><label>Название</label><div class="form-fields"><input type="text" name="title" maxlength="120" value="${title}" autofocus></div></div>
      <div class="form-group"><label>Описание</label><div class="form-fields"><textarea name="description" rows="8" maxlength="8000">${description}</textarea></div></div>
      ${allowHidden ? `<div class="form-group"><label>Скрыть от игроков</label><div class="form-fields"><input type="checkbox" name="hidden" ${quest?.hidden ? "checked" : ""}></div></div>` : ""}
    </form>`,
    label: quest ? "Сохранить" : "Добавить",
    callback: (html) => {
      const root = dialogRoot(html);
      return {
        title: normalizeText(root?.querySelector?.('[name="title"]')?.value, 120),
        description: normalizeText(root?.querySelector?.('[name="description"]')?.value, 8000),
        hidden: allowHidden && Boolean(root?.querySelector?.('[name="hidden"]')?.checked),
      };
    },
    rejectClose: false,
  });
}

async function createSideQuest(draft, userId = game.user?.id) {
  if (!isPrimaryGM()) return null;
  const user = game.users?.get(userId);
  const title = normalizeText(draft?.title, 120);
  if (!user || !title) return null;

  const data = getData();
  const quest = {
    id: randomId(),
    title,
    description: normalizeText(draft?.description, 8000),
    hidden: user.isGM && draft?.hidden === true,
    completed: false,
    failed: false,
    createdBy: user.id,
    createdAt: Date.now(),
    notes: [],
  };
  data.sideQuests.push(quest);
  await saveData(data);
  return quest;
}

function emitSideQuestCreate(draft) {
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-sidequest-create",
    title: normalizeText(draft?.title, 120),
    description: normalizeText(draft?.description, 8000),
    senderId: game.user?.id,
  });
}

async function setSideQuestCompleted(questId, completed, userId = game.user?.id) {
  if (!isPrimaryGM()) return false;
  const user = game.users?.get(userId);
  if (!user) return false;
  const data = getData();
  const quest = data.sideQuests.find((entry) => entry.id === normalizeText(questId, 120));
  if (!quest || (quest.hidden && !user.isGM)) return false;
  const becameCompleted = completed === true && !quest.completed;
  quest.completed = completed === true;
  if (quest.completed) quest.failed = false;
  await saveData(data);
  if (becameCompleted && !quest.hidden) broadcastSideQuestBanner("completed", quest.title);
  return true;
}

function emitSideQuestCompleted(questId, completed) {
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-sidequest-completed",
    questId: normalizeText(questId, 120),
    completed: completed === true,
    senderId: game.user?.id,
  });
}

async function setSideQuestFailed(questId, failed, userId = game.user?.id) {
  if (!isPrimaryGM()) return false;
  const user = game.users?.get(userId);
  if (!user) return false;
  const data = getData();
  const quest = data.sideQuests.find((entry) => entry.id === normalizeText(questId, 120));
  if (!quest || (quest.hidden && !user.isGM)) return false;
  const becameFailed = failed === true && !quest.failed;
  quest.failed = failed === true;
  if (quest.failed) quest.completed = false;
  await saveData(data);
  if (becameFailed && !quest.hidden) broadcastSideQuestBanner("failed", quest.title);
  return true;
}

function emitSideQuestFailed(questId, failed) {
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-sidequest-failed",
    questId: normalizeText(questId, 120),
    failed: failed === true,
    senderId: game.user?.id,
  });
}

async function promptSideQuestNote() {
  return Dialog.prompt({
    title: "Добавить заметку",
    content: `<form class="bh-sidequest-dialog"><div class="form-group"><label>Заметка</label><div class="form-fields"><textarea name="note" rows="6" maxlength="4000" autofocus></textarea></div></div></form>`,
    label: "Добавить",
    callback: (html) => normalizeText(dialogRoot(html)?.querySelector?.('[name="note"]')?.value, 4000),
    rejectClose: false,
  });
}

async function addSideQuestNote(questId, text, userId = game.user?.id) {
  if (!isPrimaryGM()) return;
  const noteText = normalizeText(text, 4000);
  if (!noteText) return;
  const user = game.users?.get(userId);
  if (!user) return;
  const data = getData();
  const quest = data.sideQuests.find((entry) => entry.id === questId);
  if (!quest || (quest.hidden && !user.isGM)) return;
  quest.notes.push({
    id: randomId(),
    text: noteText,
    authorId: user.id,
    authorName: user.name,
    createdAt: Date.now(),
  });
  await saveData(data);
}

function emitSideQuestNote(questId, text) {
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-sidequest-note",
    questId,
    text: normalizeText(text, 4000),
    senderId: game.user?.id,
  });
}

function formatSideQuestDate(timestamp) {
  if (!Number(timestamp)) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp));
  } catch (_error) {
    return "";
  }
}

function parseJournalSideQuestPage(page, reference = {}) {
  const content = String(page?.text?.content ?? "");
  if (!content) throw new Error("Страница журнала не содержит текста.");
  const template = document.createElement("template");
  template.innerHTML = content;
  const sections = Array.from(template.content.querySelectorAll("section.side-quest"));
  const requestedIndex = Math.trunc(Number(reference.sourceSectionIndex));
  const sourceSectionId = normalizeText(reference.sourceSectionId, 120);
  let section = sourceSectionId
    ? sections.find((candidate) => candidate.dataset.sideQuestId === sourceSectionId)
    : null;
  section ??= Number.isInteger(requestedIndex) && requestedIndex >= 0 ? sections[requestedIndex] : null;
  if (!section && reference.sourceHeading) {
    section = sections.find((candidate) => normalizeText(candidate.querySelector("h1, h2, h3, h4, h5, h6")?.textContent, 240) === normalizeText(reference.sourceHeading, 240));
  }
  if (!(section instanceof HTMLElement)) throw new Error("Связанная секция side-quest не найдена.");
  const sectionIndex = sections.indexOf(section);
  const title = normalizeText(section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent, 120);
  if (!title) throw new Error("У секции side-quest нет заголовка.");
  return {
    title,
    description: normalizeText(section.querySelector("p")?.textContent, 8000),
    sourceUuid: page.uuid,
    sourceSectionId: normalizeText(section.dataset.sideQuestId, 120),
    sourceSectionIndex: sectionIndex,
    sourceHeading: title,
  };
}

async function resolveJournalSideQuest(reference) {
  const sourceUuid = normalizeText(reference?.sourceUuid, 500);
  const page = sourceUuid ? await fromUuid(sourceUuid) : null;
  if (page?.documentName !== "JournalEntryPage") throw new Error("Связанная страница журнала недоступна.");
  return { page, source: parseJournalSideQuestPage(page, reference) };
}

async function addJournalSideQuest(reference, userId = game.user?.id) {
  if (!isPrimaryGM() || !game.settings.get(MODULE_ID, ENABLE_SETTING)) return null;
  const user = game.users?.get(userId);
  if (!user) return null;
  const { source } = await resolveJournalSideQuest(reference);
  const data = getData();
  const existing = data.sideQuests.find((quest) => (
    quest.sourceUuid === source.sourceUuid
    && (
      source.sourceSectionId && quest.sourceSectionId === source.sourceSectionId
      || !source.sourceSectionId && quest.sourceSectionIndex === source.sourceSectionIndex
    )
  ));
  if (existing) {
    Object.assign(existing, source);
    await saveData(data);
    return { updated: true, questId: existing.id };
  }

  const quest = {
    id: randomId(),
    ...source,
    hidden: false,
    completed: false,
    failed: false,
    createdBy: user.id,
    createdAt: Date.now(),
    notes: [],
  };
  data.sideQuests.push(quest);
  await saveData(data);
  broadcastSideQuestBanner("received", quest.title);
  return { added: true, questId: quest.id };
}

function requestJournalSideQuest(reference) {
  if (isPrimaryGM()) return addJournalSideQuest(reference);
  const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
  if (!activeGM) {
    ui.notifications?.warn?.("Для добавления сайд-квеста мастер должен быть в сети.");
    return Promise.resolve(null);
  }
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-sidequest-journal-create",
    reference,
    senderId: game.user?.id,
  });
  return Promise.resolve({ queued: true });
}

async function refreshJournalSideQuests() {
  if (!isPrimaryGM()) return { updated: 0, errors: [] };
  const data = getData();
  let updated = 0;
  const errors = [];
  for (const quest of data.sideQuests.filter((entry) => entry.sourceUuid)) {
    try {
      const { source } = await resolveJournalSideQuest(quest);
      if (quest.title !== source.title || quest.description !== source.description || quest.sourceSectionIndex !== source.sourceSectionIndex || quest.sourceHeading !== source.sourceHeading) {
        Object.assign(quest, source);
        updated += 1;
      }
    } catch (error) {
      errors.push(`${quest.title}: ${error.message}`);
    }
  }
  if (updated) await saveData(data);
  if (errors.length) console.warn(`${MODULE_ID} | Ошибки обновления сайд-квестов из журналов:\n${errors.join("\n")}`);
  return { updated, errors };
}

async function openJournalSideQuest(quest) {
  const { page, source } = await resolveJournalSideQuest(quest);
  const journal = page.parent;
  const sheet = journal?.sheet;
  if (!sheet) throw new Error("Не удалось открыть журнал.");
  await sheet.render(true, { pageId: page.id });
  sheet.goToPage?.(page.id);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const root = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
  const pageElement = root?.querySelector?.(`.journal-entry-page[data-page-id="${page.id}"]`) ?? root;
  const sections = Array.from(pageElement?.querySelectorAll?.(".journal-page-content section.side-quest") ?? []);
  const section = source.sourceSectionId
    ? sections.find((candidate) => candidate.dataset.sideQuestId === source.sourceSectionId)
    : sections[source.sourceSectionIndex];
  (section ?? pageElement)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

function investigationHeadingParts(value) {
  const heading = normalizeText(value, 240);
  const match = heading.match(/^(.*?)\s*\/\s*Изыскани(?:е|я)\s*(\d+)\s*$/iu);
  const topicName = normalizeText(match?.[1] ?? heading, 160);
  return {
    heading,
    topicName,
    title: topicName,
    level: Math.clamp(Math.trunc(Number(match?.[2]) || 0), 0, 30),
  };
}

function directChildHtml(nodes) {
  return nodes.map((node) => node.outerHTML ?? node.textContent ?? "").join("\n").trim();
}

async function enrichInvestigationHtml(html) {
  const content = normalizeInvestigationHtml(normalizeUuidLinkSyntax(html));
  if (!content) return "";
  return normalizeInvestigationHtml(await TextEditor.enrichHTML(content, { async: true }));
}

async function parseJournalInvestigationPage(page, reference = {}, existingInvestigation = null) {
  const content = String(page?.text?.content ?? "");
  if (!content) throw new Error("Страница журнала не содержит текста.");
  const template = document.createElement("template");
  template.innerHTML = content;
  const sections = Array.from(template.content.querySelectorAll("section.research"));
  const requestedIndex = Math.trunc(Number(reference.sourceSectionIndex));
  const sourceResearchId = normalizeText(reference.sourceResearchId, 120);
  let section = sourceResearchId
    ? sections.find((candidate) => candidate.dataset.researchId === sourceResearchId)
    : null;
  section ??= Number.isInteger(requestedIndex) && requestedIndex >= 0 ? sections[requestedIndex] : null;
  if (!section && reference.sourceHeading) {
    section = sections.find((candidate) => normalizeText(candidate.querySelector("h1, h2, h3, h4, h5, h6")?.textContent, 240) === normalizeText(reference.sourceHeading, 240));
  }
  if (!(section instanceof HTMLElement)) throw new Error("Связанная секция research не найдена.");

  const headingParts = investigationHeadingParts(section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent);
  if (!headingParts.topicName) throw new Error("У секции research нет заголовка.");
  const previousSources = normalizeArray(existingInvestigation?.sources);
  const sourceSections = Array.from(section.querySelectorAll(":scope > section.read"));
  const sources = [];
  for (const [sourceIndex, sourceSection] of sourceSections.entries()) {
    const sourceName = normalizeText(sourceSection.querySelector("h1, h2, h3, h4, h5, h6")?.textContent, 240);
    if (!sourceName) continue;
    const childNodes = Array.from(sourceSection.childNodes);
    const maximumNode = childNodes.find((node) => node instanceof HTMLElement && /Максимум\s+ОИ/iu.test(node.textContent ?? ""));
    const checksNode = childNodes.find((node) => node instanceof HTMLElement && /Проверки\s+Изысканий/iu.test(node.textContent ?? ""));
    const maximumMatch = String(maximumNode?.textContent ?? "").match(/Максимум\s+ОИ\s*:\s*(\d+)/iu);
    const maxPoints = Math.max(0, Math.trunc(Number(maximumMatch?.[1]) || 0));
    const checksIndex = checksNode ? childNodes.indexOf(checksNode) : -1;
    const contentNodes = childNodes.filter((node) => {
      if (node === maximumNode || node === checksNode) return false;
      return !(node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName));
    });
    const descriptionNodes = checksIndex < 0 ? contentNodes : contentNodes.filter((node) => childNodes.indexOf(node) < checksIndex);
    const checkNodes = checksIndex < 0 ? [] : contentNodes.filter((node) => childNodes.indexOf(node) > checksIndex);
    const previous = previousSources.find((entry) => investigationNameKey(entry.name) === investigationNameKey(sourceName))
      ?? previousSources[sourceIndex];
    sources.push({
      id: previous?.id || randomId(),
      name: sourceName,
      description: await enrichInvestigationHtml(directChildHtml(descriptionNodes)),
      checks: await enrichInvestigationHtml(directChildHtml(checkNodes)),
      maxPoints,
      points: Math.clamp(Math.trunc(Number(previous?.points) || 0), 0, maxPoints),
    });
  }

  const revelations = [];
  const revelationTable = section.querySelector(":scope > table");
  for (const row of revelationTable?.querySelectorAll?.("tbody tr") ?? []) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;
    const thresholdMatch = String(cells[0].textContent ?? "").match(/\d+/u);
    if (!thresholdMatch) continue;
    const revelationContent = await enrichInvestigationHtml(cells[1].innerHTML);
    if (revelationContent) revelations.push({ threshold: Math.max(0, Number(thresholdMatch[0]) || 0), content: revelationContent });
  }

  return {
    ...headingParts,
    sourceUuid: page.uuid,
    sourceResearchId: normalizeText(section.dataset.researchId, 120),
    sourceSectionIndex: sections.indexOf(section),
    sourceHeading: headingParts.heading,
    sources,
    revelations,
  };
}

async function resolveJournalInvestigation(reference, existingInvestigation = null) {
  const sourceUuid = normalizeText(reference?.sourceUuid, 500);
  const page = sourceUuid ? await fromUuid(sourceUuid) : null;
  if (page?.documentName !== "JournalEntryPage") throw new Error("Связанная страница журнала недоступна.");
  return { page, source: await parseJournalInvestigationPage(page, reference, existingInvestigation) };
}

async function addJournalInvestigation(reference, userId = game.user?.id) {
  if (!isPrimaryGM() || !game.settings.get(MODULE_ID, ENABLE_SETTING)) return null;
  const user = game.users?.get(userId);
  if (!user) return null;
  const data = getData();
  const existing = data.investigations.find((investigation) => (
    investigation.sourceUuid === normalizeText(reference?.sourceUuid, 500)
    && (
      reference?.sourceResearchId && investigation.sourceResearchId === normalizeText(reference.sourceResearchId, 120)
      || investigation.sourceSectionIndex === Math.trunc(Number(reference?.sourceSectionIndex))
    )
  ));
  const oldTopicName = existing?.topicName;
  const { source } = await resolveJournalInvestigation(reference, existing);
  if (existing) {
    Object.assign(existing, source);
    syncInvestigationResearchPoints(data, oldTopicName && oldTopicName !== source.topicName ? [oldTopicName] : []);
    await saveData(data);
    return { updated: true, investigationId: existing.id };
  }

  const investigation = {
    id: randomId(),
    ...source,
    createdBy: user.id,
    createdAt: Date.now(),
  };
  data.investigations.push(investigation);
  syncInvestigationResearchPoints(data);
  await saveData(data);
  broadcastResearchBanner(investigation.title);
  return { added: true, investigationId: investigation.id };
}

function requestJournalInvestigation(reference) {
  if (isPrimaryGM()) return addJournalInvestigation(reference);
  const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
  if (!activeGM) {
    ui.notifications?.warn?.("Для добавления изыскания мастер должен быть в сети.");
    return Promise.resolve(null);
  }
  game.socket?.emit?.(SOCKET_CHANNEL, {
    type: "bastardhall-research-journal-create",
    reference,
    senderId: game.user?.id,
  });
  return Promise.resolve({ queued: true });
}

async function refreshJournalInvestigations() {
  if (!isPrimaryGM()) return { updated: 0, errors: [] };
  const data = getData();
  let updated = 0;
  const errors = [];
  const resetTopicNames = [];
  for (const investigation of data.investigations.filter((entry) => entry.sourceUuid)) {
    try {
      const oldTopicName = investigation.topicName;
      const { source } = await resolveJournalInvestigation(investigation, investigation);
      const before = JSON.stringify(investigation);
      Object.assign(investigation, source);
      if (oldTopicName !== source.topicName) resetTopicNames.push(oldTopicName);
      if (before !== JSON.stringify(investigation)) updated += 1;
    } catch (error) {
      errors.push(`${investigation.title}: ${error.message}`);
    }
  }
  syncInvestigationResearchPoints(data, resetTopicNames);
  if (updated || resetTopicNames.length) await saveData(data);
  if (errors.length) console.warn(`${MODULE_ID} | Ошибки обновления изысканий из журналов:\n${errors.join("\n")}`);
  return { updated, errors };
}

async function openJournalInvestigation(investigation) {
  const { page, source } = await resolveJournalInvestigation(investigation, investigation);
  const journal = page.parent;
  const sheet = journal?.sheet;
  if (!sheet) throw new Error("Не удалось открыть журнал.");
  await sheet.render(true, { pageId: page.id });
  sheet.goToPage?.(page.id);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const root = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
  const pageElement = root?.querySelector?.(`.journal-entry-page[data-page-id="${page.id}"]`) ?? root;
  const sections = Array.from(pageElement?.querySelectorAll?.(".journal-page-content section.research") ?? []);
  const section = source.sourceResearchId
    ? sections.find((candidate) => candidate.dataset.researchId === source.sourceResearchId)
    : sections[source.sourceSectionIndex];
  (section ?? pageElement)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

const shownResearchBanners = new Set();

function showResearchBanner(message = {}) {
  const id = normalizeText(message.id, 120);
  if (!id || shownResearchBanners.has(id)) return;
  shownResearchBanners.add(id);
  const title = normalizeText(message.title, 160);
  if (!title) return;
  let layer = document.querySelector(".tsu-sidequest-banner-layer");
  if (!(layer instanceof HTMLElement)) {
    layer = document.createElement("div");
    layer.className = "tsu-sidequest-banner-layer";
    document.body.append(layer);
  }
  const banner = document.createElement("div");
  banner.className = "tsu-sidequest-banner tsu-research-banner is-received";
  banner.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i><span>Открыто новое Изыскание: <strong>${escapeHtml(title)}</strong></span>`;
  layer.append(banner);
  requestAnimationFrame(() => banner.classList.add("is-visible"));
  setTimeout(() => banner.classList.remove("is-visible"), 4200);
  setTimeout(() => {
    banner.remove();
    shownResearchBanners.delete(id);
    if (!layer.childElementCount) layer.remove();
  }, 5200);
}

function broadcastResearchBanner(title) {
  const message = { type: "bastardhall-research-banner", id: randomId(), title: normalizeText(title, 160) };
  showResearchBanner(message);
  game.socket?.emit?.(SOCKET_CHANNEL, message);
}

const shownSideQuestBanners = new Set();

function showSideQuestBanner(message = {}) {
  const id = normalizeText(message.id, 120);
  if (!id || shownSideQuestBanners.has(id)) return;
  shownSideQuestBanners.add(id);
  const title = normalizeText(message.title, 120);
  const labels = { received: "получен", completed: "завершен", failed: "провален" };
  const outcome = labels[message.outcome];
  if (!title || !outcome) return;

  let layer = document.querySelector(".tsu-sidequest-banner-layer");
  if (!(layer instanceof HTMLElement)) {
    layer = document.createElement("div");
    layer.className = "tsu-sidequest-banner-layer";
    document.body.append(layer);
  }
  const banner = document.createElement("div");
  banner.className = `tsu-sidequest-banner is-${message.outcome}`;
  banner.innerHTML = `<i class="fa-solid fa-book-open"></i><span>Саб-квест: <strong>${escapeHtml(title)}</strong> ${outcome}</span>`;
  layer.append(banner);
  requestAnimationFrame(() => banner.classList.add("is-visible"));
  setTimeout(() => banner.classList.remove("is-visible"), 4200);
  setTimeout(() => {
    banner.remove();
    shownSideQuestBanners.delete(id);
    if (!layer.childElementCount) layer.remove();
  }, 5200);
}

function broadcastSideQuestBanner(outcome, title) {
  const message = { type: "bastardhall-sidequest-banner", id: randomId(), outcome, title: normalizeText(title, 120) };
  showSideQuestBanner(message);
  game.socket?.emit?.(SOCKET_CHANNEL, message);
}

function closestDropTarget(event) {
  const target = event?.target;
  return target instanceof Element
    ? target.closest(".bh-inventory-drop, [data-drop-kind], [data-rule-path]")
    : null;
}

function refreshClimateDisplay(root) {
  if (!root?.isConnected) return;
  const data = getData();
  const daytime = isDaytime(data);
  const stage = getClimateStage(data);
  const label = stage.eternalNight
    ? "Вечная ночь"
    : (data.climate.stormActive ? (daytime ? "Шторм" : "Штормовая ночь") : (daytime ? "День" : "Ночь"));

  const badge = root.querySelector(".bh-climate-badge");
  if (badge) {
    badge.classList.toggle("is-night", !daytime);
    const icon = badge.querySelector("i");
    if (icon) icon.className = `fa-solid ${daytime ? "fa-sun" : "fa-moon"}`;
    const labelElement = badge.querySelector("span");
    if (labelElement) labelElement.textContent = label;
    const timeElement = badge.querySelector("small");
    if (timeElement) timeElement.textContent = currentWorldTimeLabel();
  }

  const weatherStatus = root.querySelector(".bh-weather-status");
  if (weatherStatus) {
    const icon = weatherStatus.querySelector("i");
    if (icon) icon.className = `fa-solid ${daytime ? "fa-sun" : "fa-moon"}`;
    const labelElement = weatherStatus.querySelector("strong");
    if (labelElement) labelElement.textContent = label;
  }
}

export class BastardhallSheet extends FormApplication {
  constructor(...args) {
    super(...args);
    this._view = "main";
    this._clockInterval = null;
    this._sideQuestId = null;
    this._investigationId = null;
    this._viewRefreshPending = false;
    this._viewRefreshPromise = null;
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
      width: 1180,
      height: 900,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  getData() {
    const data = getData();
    const isGM = Boolean(game.user?.isGM);
    const canEditFamilyTree = isPrimaryGM();
    const collectedMementos = new Set(data.inventory.filter((entry) => entry.category === "memento").map((entry) => entry.mementoId));
    const unlockedAreas = new Set(["Береговая Линия"]);
    if (allPhantomsFound(data)) unlockedAreas.add("Замковые Территории");
    for (const memento of data.mementos) {
      if (collectedMementos.has(memento.id)) unlockedAreas.add(memento.area);
    }

    const research = data.research.map((topic, index) => {
      const points = Number(topic.points);
      const unknown = !Number.isFinite(points) || points < 0;
      const managedByInvestigation = data.investigations.some((investigation) => investigationNameKey(investigation.topicName) === investigationNameKey(topic.name));
      return {
        ...topic,
        index,
        displayIndex: index + 1,
        unknown,
        managedByInvestigation,
        displayName: unknown && !isGM ? "Неизвестное изыскание" : topic.name,
        pointsLabel: unknown ? "-" : points,
      };
    });
    const researchBonuses = RESEARCH_BONUSES.flatMap((bonus) => {
      const topic = research[bonus.topicIndex];
      if (!topic || topic.unknown || Number(topic.points) < bonus.threshold) return [];
      return [{ ...bonus, topicName: topic.name }];
    });
    const phantoms = data.phantoms.map((phantom, phantomIndex) => {
      const linkedActor = resolveActor(phantom.actorUuid);
      const rank = Number(phantom.rank) || 0;
      return {
        ...phantom,
        phantomIndex,
        canAuskenRunes: phantom.id === "ausken" && rank >= 1,
        canEsmiraBooks: phantom.id === "esmira" && rank >= 3,
        aronDrinkLimit: rank >= 3 ? 3 : 2,
        auskenRuneLimit: Math.clamp(rank + 1, 2, 4),
        auskenBlessingTargets: rank >= 3 ? 2 : 1,
        linkedActorName: linkedActor?.name ?? "",
        linkedActorImg: linkedActor?.img ?? "",
        rankRows: Array.from({ length: 4 }, (_value, rowRank) => ({
          rank: rowRank,
          achieved: rowRank > 0 && phantom.rank >= rowRank,
          current: phantom.rank === rowRank,
          bonus: phantom.bonuses[rowRank] ?? "",
          tier: rowRank === 1 ? "simple" : rowRank === 2 ? "greater" : rowRank === 3 ? "strong" : "",
          img: rowRank === 1 ? data.soulhearts.images.simple : rowRank === 2 ? data.soulhearts.images.greater : rowRank === 3 ? data.soulhearts.images.strong : "",
        })).filter((row) => isGM || row.rank <= rank),
      };
    });
    const mementos = data.mementos.map((memento, index) => ({
      ...memento,
      index,
      displayIndex: index + 1,
      collected: collectedMementos.has(memento.id),
      displayBonus: mementoBonusText(memento),
    }));
    const collectedMementoRows = mementos.filter((memento) => memento.collected);
    const inventory = data.inventory.slice().reverse();
    const currentTime = currentWorldTimeLabel();
    const daytime = isDaytime(data);
    const climateStage = getClimateStage(data);
    const weatherRules = outdoorPenaltyRules(climateStage);
    const climateStages = Object.entries(CLIMATE_STAGE_LABELS).map(([key, label]) => ({
      key,
      label,
      ...(data.climate.stages[key] ?? createDefaultData().climate.stages[key]),
    }));
    const visibleSideQuests = data.sideQuests.filter((quest) => isGM || !quest.hidden);
    const journalSideQuests = visibleSideQuests.filter((quest) => !quest.completed && !quest.failed && Boolean(quest.sourceUuid));
    const manualSideQuests = visibleSideQuests.filter((quest) => !quest.completed && !quest.failed && !quest.sourceUuid);
    const completedSideQuests = visibleSideQuests.filter((quest) => quest.completed || quest.failed);
    const activeSideQuests = [...journalSideQuests, ...manualSideQuests];
    const orderedSideQuests = [...activeSideQuests, ...completedSideQuests];
    const dividerIndexes = new Set();
    if (journalSideQuests.length > 0 && manualSideQuests.length > 0) {
      dividerIndexes.add(journalSideQuests.length);
    }
    if (completedSideQuests.length > 0) dividerIndexes.add(activeSideQuests.length);
    if (!orderedSideQuests.some((quest) => quest.id === this._sideQuestId)) this._sideQuestId = orderedSideQuests[0]?.id ?? null;
    const sideQuests = orderedSideQuests.map((quest, index) => ({
      ...quest,
      selected: quest.id === this._sideQuestId,
      noteCount: quest.notes.length,
      hasDividerBefore: dividerIndexes.has(index),
    }));
    const selectedSideQuest = sideQuests.find((quest) => quest.selected);
    if (selectedSideQuest) {
      selectedSideQuest.notes = selectedSideQuest.notes.map((note) => ({
        ...note,
        createdLabel: formatSideQuestDate(note.createdAt),
      }));
    }
    if (!data.investigations.some((investigation) => investigation.id === this._investigationId)) {
      this._investigationId = data.investigations[0]?.id ?? null;
    }
    const investigations = data.investigations.map((investigation) => {
      const totalPoints = investigation.sources.reduce((total, source) => total + Math.max(0, Number(source.points) || 0), 0);
      const maxPoints = investigation.sources.reduce((total, source) => total + Math.max(0, Number(source.maxPoints) || 0), 0);
      const selected = investigation.id === this._investigationId;
      const sources = investigation.sources.map((source) => ({
        ...source,
        canDecrease: isGM && source.points > 0,
        canIncrease: isGM && source.points < source.maxPoints,
      }));
      const revelations = investigation.revelations
        .map((revelation) => ({ ...revelation, unlocked: totalPoints >= revelation.threshold }))
        .filter((revelation) => isGM || revelation.unlocked);
      return {
        ...investigation,
        selected,
        sources,
        revelations,
        totalPoints,
        maxPoints,
        hasLevel: investigation.level > 0,
      };
    });
    const selectedInvestigation = investigations.find((investigation) => investigation.selected);
    const familyTreeSlots = FAMILY_TREE_SLOTS.map((definition) => familySlotView(
      data.familyTree.slots.find((slot) => slot.id === definition.id),
      definition,
    ));
    const familyTreeHeirs = FAMILY_TREE_HEIRS.map((definition) => familySlotView(
      data.familyTree.customHeirs.find((slot) => slot.id === definition.id),
      definition,
    )).filter((slot) => isGM || slot.assigned);
    const today = currentWorldDay();
    const servantPhantoms = SERVANT_PHANTOMS.map((definition, servantIndex) => {
      const stored = servantState(data, definition.id);
      const remainingIds = remainingServantRecipes(stored);
      const recipeRows = remainingIds.map((recipeId, index) => ({
        ...(SERVANT_RECIPES[definition.id]?.find((recipe) => recipe.id === recipeId) ?? { id: recipeId, name: recipeId, englishName: "" }),
        canMoveUp: index > 0,
        canMoveDown: index < remainingIds.length - 1,
      }));
      return {
        ...definition,
        ...stored,
        servantIndex,
        recipeRows,
        exhausted: definition.id !== "bakers" && recipeRows.length === 0,
        emptyLabel: definition.id === "cooks" ? "поваров" : "пивоваров",
        grantedToday: stored?.lastGrantedDay === today,
        currentProduct: definition.id === "bakers"
          ? `Пончик поэта ${unlockedAreas.has("Храм") ? "[Средний]" : "[Малый]"} ×2`
          : "",
      };
    });
    const visibleServantPhantoms = servantPhantoms.filter((servant) => isGM || servant.active);
    const hasActiveServants = servantPhantoms.some((servant) => servant.active);
    const aronPhantom = phantoms.find((phantom) => phantom.id === "aron");
    const aronCooking = aronPhantom?.found ? {
      active: true,
      rank: aronPhantom.rank,
      canDrinks: aronPhantom.rank >= 1,
      canCounteract: aronPhantom.rank >= 3,
      limit: aronPhantom.aronDrinkLimit,
      selections: aronPhantom.rank >= 1 ? Array.from({ length: aronPhantom.aronDrinkLimit }, (_value, index) => ({ index: index + 1 })) : [],
    } : null;
    const auskenPhantom = phantoms.find((phantom) => phantom.id === "ausken");
    const auskenBoon = auskenPhantom?.found && auskenPhantom.rank >= 1 ? {
      active: true,
      rank: auskenPhantom.rank,
      maxTargets: auskenPhantom.auskenBlessingTargets,
      grantedToday: data.boons.ausken.lastGrantedDay === today,
    } : null;
    const recipientCharacters = playerCharacters()
      .filter((actor) => actorAllowedForUser(actor, game.user))
      .map((actor) => ({ id: actor.id, name: actor.name }));
    const showCookingTab = isGM || Boolean(aronCooking) || hasActiveServants || Boolean(auskenBoon) || data.boons.shelyn.active;
    if (this._view === "cooking" && !showCookingTab) this._view = "main";

    return {
      data,
      isGM,
      canEditFamilyTree,
      bonusHp: totalBonusHp(data),
      areas: AREA_NAMES.map((name, index) => ({ name, unlocked: unlockedAreas.has(name), wide: index === 0 })),
      collections: Object.entries(COLLECTIONS).map(([key, definition]) => ({ key, label: definition.label, count: Number(data.collections[key]) || 0 })),
      hearts: Object.entries(SOULHEARTS).map(([key, definition]) => ({ key, ...definition, count: Number(data.soulhearts[key]) || 0, img: data.soulhearts.images[key] })),
      research,
      researchBonuses,
      phantoms,
      visiblePhantoms: phantoms.filter((phantom) => phantom.found),
      servantPhantoms,
      visibleServantPhantoms,
      showServantBlock: isGM || hasActiveServants,
      hasActiveServants,
      showCookingTab,
      hasCookingProviders: Boolean(aronCooking?.canDrinks) || hasActiveServants,
      aronCooking,
      auskenBoon,
      showShelynBoon: isGM || data.boons.shelyn.active,
      hasBoonProviders: Boolean(auskenBoon) || data.boons.shelyn.active,
      shelynBlessings: SHELYN_BLESSINGS.map((entry) => ({ ...entry, selected: entry.id === data.boons.shelyn.choice })),
      shelynGrantedToday: data.boons.shelyn.lastGrantedDay === today,
      recipientCharacters,
      mementos,
      accessBlocks: data.accessBlocks.map((block) => ({
        ...block,
        label: "Замковые территории",
        open: accessBlockIsOpen(data, block),
      })),
      collectedMementos: collectedMementoRows,
      inventory,
      sideQuests,
      selectedSideQuest,
      investigations,
      selectedInvestigation,
      familyTreeSlots,
      familyTreeHeirs,
      familyTreeGenerations: FAMILY_TREE_GENERATIONS,
      currentTime,
      daytime,
      climateStage,
      climateStages,
      hasOutdoorPenalty: weatherRules.length > 0,
      outdoorPenaltyDescription: outdoorPenaltyDescription(climateStage),
      allPhantomsFound: allPhantomsFound(data),
      climateLabel: climateStage.eternalNight
        ? "Вечная ночь"
        : (data.climate.stormActive ? (daytime ? "Шторм" : "Штормовая ночь") : (daytime ? "День" : "Ночь")),
      showMain: this._view === "main" || (this._view === "config" && !isGM),
      showCooking: this._view === "cooking",
      showInventory: this._view === "inventory",
      showFamilyTree: this._view === "family-tree",
      showInvestigations: this._view === "investigations",
      showSideQuests: this._view === "side-quests",
      showConfig: this._view === "config" && isGM,
      sceneRefs: splitRefs(data.climate.sceneRefs).map((ref, index) => {
        const scene = resolveScene(ref);
        return { index, ref, name: scene?.name ?? ref, img: scene?.background?.src ?? scene?.thumb ?? "" };
      }),
    };
  }

  async refreshCurrentView() {
    this._viewRefreshPending = true;
    if (this._viewRefreshPromise) return this._viewRefreshPromise;

    this._viewRefreshPromise = (async () => {
      while (this._viewRefreshPending) {
        this._viewRefreshPending = false;
        const root = getFormRoot(this.element);
        const body = root?.querySelector?.(".bh-body");
        const selector = VIEW_SELECTORS.find((candidate) => body?.querySelector?.(candidate));
        const currentView = selector ? body.querySelector(selector) : null;
        if (!body || !currentView) return;

        const scrollTop = body.scrollTop;
        const rendered = await foundry.applications.handlebars.renderTemplate(this.options.template, this.getData());
        if (!currentView.isConnected) continue;
        const template = document.createElement("template");
        template.innerHTML = String(rendered).trim();
        const nextView = template.content.querySelector(`.bh-body ${selector}`);
        if (!nextView) return;

        currentView.replaceWith(nextView);
        body.scrollTop = scrollTop;
        const listenerRoot = globalThis.jQuery ? globalThis.jQuery(nextView) : nextView;
        this.activateListeners(listenerRoot);
      }
    })().catch((error) => {
      console.error(`${MODULE_ID} | Partial Bastardhall view refresh failed`, error);
      if (this.rendered) this.render(false);
    }).finally(() => {
      this._viewRefreshPromise = null;
    });

    return this._viewRefreshPromise;
  }

  activateListeners(html) {
    const root = getFormRoot(html);
    if (!root) return;
    void enrichInvestigationLinks(root);

    const partialView = VIEW_SELECTORS.some((selector) => root.matches?.(selector));
    if (!partialView) super.activateListeners(html);
    if (!partialView) {
      if (this._clockInterval) clearInterval(this._clockInterval);
      const refreshClock = () => refreshClimateDisplay(root);
      refreshClock();
      this._clockInterval = setInterval(refreshClock, 1000);
    }

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
        content: "<p>Будут удалены собранные предметы, ранги фантомов, изыскания из журналов, очки исследований, связи семейного древа и настройки листа. Зелёный туман вернётся на настроенные бордюры.</p><p><b>Это действие нельзя отменить.</b></p>",
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
        if (!new Set(["main", "cooking", "inventory", "investigations", "side-quests", "family-tree"]).has(view)) return;
        this._view = view;
        this.render(false);
      });
    });

    root.querySelector("[data-action='refresh-investigations']")?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      const refreshButton = event.currentTarget;
      refreshButton.disabled = true;
      refreshButton.classList.add("is-spinning");
      try {
        const result = await refreshJournalInvestigations();
        if (result.errors.length) {
          ui.notifications?.warn?.(`Обновление изысканий завершено с ошибками: ${result.errors.length}. Подробности в консоли.`);
        } else if (result.updated) {
          ui.notifications?.info?.(`Изыскания обновлены из журналов: ${result.updated}. Очки источников сохранены.`);
        } else {
          ui.notifications?.info?.("Связанные журнальные изыскания уже актуальны.");
        }
      } finally {
        if (refreshButton.isConnected) {
          refreshButton.disabled = false;
          refreshButton.classList.remove("is-spinning");
        }
      }
    });

    root.querySelectorAll("[data-action='select-investigation']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this._investigationId = button.dataset.investigationId;
        void this.refreshCurrentView();
      });
    });

    root.querySelectorAll("[data-action='step-investigation-source']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isPrimaryGM()) return;
        const stepButton = event.currentTarget;
        stepButton.disabled = true;
        try {
          const data = getData();
          const investigation = data.investigations.find((entry) => entry.id === stepButton.dataset.investigationId);
          const source = investigation?.sources.find((entry) => entry.id === stepButton.dataset.sourceId);
          if (!investigation || !source) return;
          const delta = Math.sign(Number(stepButton.dataset.step) || 0);
          source.points = Math.clamp((Number(source.points) || 0) + delta, 0, Number(source.maxPoints) || 0);
          syncInvestigationResearchPoints(data);
          this._investigationId = investigation.id;
          await saveData(data);
        } finally {
          if (stepButton.isConnected) stepButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='open-investigation-source']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceButton = event.currentTarget;
        const investigation = getData().investigations.find((entry) => entry.id === sourceButton.dataset.investigationId);
        if (!investigation?.sourceUuid) return;
        sourceButton.disabled = true;
        try {
          await openJournalInvestigation(investigation);
        } catch (error) {
          console.warn(`${MODULE_ID} | Не удалось открыть источник изыскания`, error);
          ui.notifications?.warn?.(`Не удалось открыть журнал: ${error.message}`);
        } finally {
          if (sourceButton.isConnected) sourceButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='delete-investigation']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isPrimaryGM()) return;
        const deleteButton = event.currentTarget;
        const investigationId = deleteButton.dataset.investigationId;
        const investigation = getData().investigations.find((entry) => entry.id === investigationId);
        if (!investigation) return;
        const confirmed = await Dialog.confirm({
          title: "Удалить изыскание?",
          content: `<p>Удалить изыскание <b>${escapeHtml(investigation.title)}</b> и все очки его источников?</p><p><b>Это действие нельзя отменить.</b></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false,
        });
        if (!confirmed) return;
        deleteButton.disabled = true;
        try {
          const data = getData();
          const index = data.investigations.findIndex((entry) => entry.id === investigationId);
          if (index < 0) return;
          const [removed] = data.investigations.splice(index, 1);
          syncInvestigationResearchPoints(data, [removed.topicName]);
          if (this._investigationId === investigationId) this._investigationId = null;
          await saveData(data);
        } finally {
          if (deleteButton.isConnected) deleteButton.disabled = false;
        }
      });
    });

    const aronItemSelects = [...root.querySelectorAll("[data-aron-item]")];
    if (aronItemSelects.length) {
      const aronRank = phantomRank(getData(), "aron");
      void phantomItemOptions("drinks", aronRank).then((options) => {
        for (const select of aronItemSelects) {
          if (!select.isConnected) continue;
          select.replaceChildren();
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = "— не брать —";
          select.append(empty);
          for (const entry of options) {
            const option = document.createElement("option");
            option.value = entry.uuid;
            option.textContent = `${entry.name} (ур. ${entry.level})`;
            select.append(option);
          }
        }
      }).catch((error) => {
        console.warn(`${MODULE_ID} | Не удалось загрузить напитки Арона`, error);
        for (const select of aronItemSelects) if (select.isConnected) select.innerHTML = '<option value="">Список недоступен</option>';
      });
    }

    root.querySelectorAll('[data-action="toggle-servant"]').forEach((checkbox) => {
      checkbox.addEventListener("change", async (event) => {
        if (!isPrimaryGM()) return;
        const input = event.currentTarget;
        input.disabled = true;
        try {
          const data = getData();
          const servant = servantState(data, input.dataset.servant);
          if (!servant) return;
          servant.active = Boolean(input.checked);
          await saveData(data);
        } finally {
          if (input.isConnected) input.disabled = false;
        }
      });
    });

    root.querySelector('[data-action="toggle-shelyn"]')?.addEventListener("change", async (event) => {
      if (!isPrimaryGM()) return;
      const input = event.currentTarget;
      input.disabled = true;
      try {
        const data = getData();
        data.boons.shelyn.active = Boolean(input.checked);
        await saveData(data);
      } finally {
        if (input.isConnected) input.disabled = false;
      }
    });

    root.querySelectorAll('[data-action="move-recipe"]').forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const moveButton = event.currentTarget;
        moveButton.disabled = true;
        const request = {
          serviceId: moveButton.dataset.servant,
          recipeId: moveButton.dataset.recipe,
          direction: Number(moveButton.dataset.direction),
          senderId: game.user?.id,
        };
        try {
          if (isPrimaryGM()) await moveServantRecipe(request.serviceId, request.recipeId, request.direction, request.senderId);
          else game.socket?.emit?.(SOCKET_CHANNEL, { type: "bastardhall-servant-order", ...request });
        } finally {
          if (moveButton.isConnected) moveButton.disabled = false;
        }
      });
    });

    root.querySelectorAll('[data-action="reset-servant-recipes"]').forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!isPrimaryGM()) return;
        const resetButton = event.currentTarget;
        resetButton.disabled = true;
        try {
          const data = getData();
          const servant = servantState(data, resetButton.dataset.servant);
          if (!servant) return;
          servant.usedRecipeIds = [];
          await saveData(data);
          ui.notifications?.info?.(`Запас ингредиентов для «${SERVANT_PHANTOMS.find((entry) => entry.id === servant.id)?.name ?? servant.id}» восстановлен.`);
        } finally {
          if (resetButton.isConnected) resetButton.disabled = false;
        }
      });
    });

    root.querySelector('[data-action="grant-daily-cooking"]')?.addEventListener("click", async (event) => {
      event.preventDefault();
      const grantButton = event.currentTarget;
      const targets = Object.fromEntries([...root.querySelectorAll("[data-preparation-target]")].map((select) => [select.dataset.preparationTarget, select.value]));
      const request = {
        targets,
        aronItems: [...root.querySelectorAll("[data-aron-item]")].map((select) => select.value).filter(Boolean),
        senderId: game.user?.id,
      };
      grantButton.disabled = true;
      try {
        if (isPrimaryGM()) await grantDailyCooking(request, request.senderId);
        else game.socket?.emit?.(SOCKET_CHANNEL, { type: "bastardhall-daily-cooking", ...request });
      } finally {
        if (grantButton.isConnected) grantButton.disabled = false;
      }
    });

    root.querySelectorAll('[data-recipient-group="ausken"] input').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const limit = Number(checkbox.closest("[data-recipient-group]")?.dataset.maxTargets) || 1;
        const checked = [...root.querySelectorAll('[data-recipient-group="ausken"] input:checked')];
        if (checked.length > limit) {
          checkbox.checked = false;
          ui.notifications?.warn?.(`Аускен может благословить не более ${limit} персонажей.`);
        }
      });
    });

    root.querySelector('[data-action="grant-daily-boons"]')?.addEventListener("click", async (event) => {
      event.preventDefault();
      const grantButton = event.currentTarget;
      const checkedIds = (group) => [...root.querySelectorAll(`[data-recipient-group="${group}"] input:checked`)].map((input) => input.value);
      const request = {
        auskenActorIds: checkedIds("ausken"),
        shelynChoice: root.querySelector("[data-shelyn-choice]")?.value ?? "tangy",
        senderId: game.user?.id,
      };
      grantButton.disabled = true;
      try {
        if (isPrimaryGM()) await grantDailyBoons(request, request.senderId);
        else game.socket?.emit?.(SOCKET_CHANNEL, { type: "bastardhall-daily-boons", ...request });
      } finally {
        if (grantButton.isConnected) grantButton.disabled = false;
      }
    });

    root.querySelector("[data-action='add-side-quest']")?.addEventListener("click", async (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const draft = await promptSideQuest();
        if (!draft?.title) return;
        if (isPrimaryGM()) {
          const quest = await createSideQuest(draft);
          if (quest) this._sideQuestId = quest.id;
        } else {
          const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
          if (!activeGM) {
            ui.notifications?.warn?.("Для создания квеста мастер должен быть в сети.");
            return;
          }
          emitSideQuestCreate(draft);
          ui.notifications?.info?.("Квест отправлен мастеру и появится в общем списке.");
        }
      } finally {
        button.disabled = false;
      }
    });

    root.querySelector("[data-action='refresh-side-quests']")?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      const refreshButton = event.currentTarget;
      refreshButton.disabled = true;
      refreshButton.classList.add("is-spinning");
      try {
        const result = await refreshJournalSideQuests();
        if (result.errors.length) {
          ui.notifications?.warn?.(`Обновление завершено с ошибками: ${result.errors.length}. Подробности в консоли.`);
        } else if (result.updated) {
          ui.notifications?.info?.(`Сайд-квесты обновлены из журналов: ${result.updated}. Заметки и статусы сохранены.`);
        } else {
          ui.notifications?.info?.("Связанные журнальные сайд-квесты уже актуальны.");
        }
      } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove("is-spinning");
      }
    });

    root.querySelectorAll(".bh-sidequest-list-item[data-quest-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest(".bh-sidequest-actions button")) return;
        event.preventDefault();
        this._sideQuestId = card.dataset.questId;
        void this.refreshCurrentView();
      });
    });

    root.querySelectorAll("[data-action='open-side-quest-source']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceButton = event.currentTarget;
        const quest = getData().sideQuests.find((entry) => entry.id === sourceButton.dataset.questId);
        if (!quest?.sourceUuid) return;
        sourceButton.disabled = true;
        try {
          await openJournalSideQuest(quest);
        } catch (error) {
          console.warn(`${MODULE_ID} | Не удалось открыть источник сайд-квеста`, error);
          ui.notifications?.warn?.(`Не удалось открыть журнал: ${error.message}`);
        } finally {
          sourceButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='edit-side-quest']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!game.user?.isGM) return;
        const editButton = event.currentTarget;
        const questId = editButton.dataset.questId;
        const quest = getData().sideQuests.find((entry) => entry.id === questId);
        if (!quest) return;
        editButton.disabled = true;
        try {
          const draft = await promptSideQuest(quest);
          if (!draft?.title) return;
          const data = getData();
          const stored = data.sideQuests.find((entry) => entry.id === questId);
          if (!stored) return;
          Object.assign(stored, draft);
          this._sideQuestId = stored.id;
          await saveData(data);
        } finally {
          editButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='delete-side-quest']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!game.user?.isGM) return;
        const deleteButton = event.currentTarget;
        const questId = deleteButton.dataset.questId;
        const quest = getData().sideQuests.find((entry) => entry.id === questId);
        if (!quest) return;
        const confirmed = await Dialog.confirm({
          title: "Удалить сайд-квест?",
          content: `<p>Удалить сайд-квест <b>${escapeHtml(quest.title)}</b> вместе со всеми заметками?</p><p><b>Это действие нельзя отменить.</b></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false,
        });
        if (!confirmed) return;
        deleteButton.disabled = true;
        try {
          const data = getData();
          const questIndex = data.sideQuests.findIndex((entry) => entry.id === questId);
          if (questIndex < 0) return;
          data.sideQuests.splice(questIndex, 1);
          if (this._sideQuestId === questId) this._sideQuestId = null;
          await saveData(data);
        } finally {
          deleteButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='toggle-side-quest-visibility']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!game.user?.isGM) return;
        const visibilityButton = event.currentTarget;
        const questId = visibilityButton.dataset.questId;
        visibilityButton.disabled = true;
        try {
          const data = getData();
          const quest = data.sideQuests.find((entry) => entry.id === questId);
          if (!quest) return;
          quest.hidden = !quest.hidden;
          this._sideQuestId = quest.id;
          await saveData(data);
        } finally {
          visibilityButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='toggle-side-quest-completed']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const completedButton = event.currentTarget;
        const questId = completedButton.dataset.questId;
        const completed = completedButton.dataset.completed !== "true";
        completedButton.disabled = true;
        try {
          if (isPrimaryGM()) {
            if (await setSideQuestCompleted(questId, completed)) this._sideQuestId = questId;
          } else {
            const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
            if (!activeGM) {
              ui.notifications?.warn?.("Для изменения квеста мастер должен быть в сети.");
              return;
            }
            emitSideQuestCompleted(questId, completed);
          }
        } finally {
          completedButton.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='toggle-side-quest-failed']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const failedButton = event.currentTarget;
        const questId = failedButton.dataset.questId;
        const failed = failedButton.dataset.failed !== "true";
        failedButton.disabled = true;
        try {
          if (isPrimaryGM()) {
            if (await setSideQuestFailed(questId, failed)) this._sideQuestId = questId;
          } else {
            const activeGM = game.users?.activeGM ?? game.users?.find?.((user) => user.isGM && user.active);
            if (!activeGM) {
              ui.notifications?.warn?.("Для изменения квеста мастер должен быть в сети.");
              return;
            }
            emitSideQuestFailed(questId, failed);
          }
        } finally {
          failedButton.disabled = false;
        }
      });
    });

    root.querySelector("[data-action='add-side-quest-note']")?.addEventListener("click", async (event) => {
      event.preventDefault();
      const noteButton = event.currentTarget;
      const questId = noteButton.dataset.questId;
      noteButton.disabled = true;
      try {
        const text = await promptSideQuestNote();
        if (!text) return;
        if (isPrimaryGM()) await addSideQuestNote(questId, text);
        else {
          emitSideQuestNote(questId, text);
          ui.notifications?.info?.("Заметка отправлена мастеру.");
        }
      } finally {
        noteButton.disabled = false;
      }
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
        const currentPoints = Number(topic.points);
        topic.points = Math.max(-1, (Number.isFinite(currentPoints) ? currentPoints : -1) + delta);
        await saveData(data);
      });
    });

    root.querySelector('[name="outdoorPenaltyActive"]')?.addEventListener("change", async (event) => {
      if (!isPrimaryGM()) return;
      const checkbox = event.currentTarget;
      checkbox.disabled = true;
      try {
        const data = getData();
        data.climate.outdoorPenaltyActive = Boolean(checkbox.checked);
        await saveData(data);
      } finally {
        if (checkbox.isConnected) checkbox.disabled = false;
      }
    });

    root.querySelector('[data-action="tower-lightning"]')?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!isPrimaryGM()) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await rollTowerLightning();
      } catch (error) {
        console.error(`${MODULE_ID} | Tower lightning roll failed`, error);
        ui.notifications?.error?.(`Не удалось выполнить проверку молнии: ${error.message}`);
      } finally {
        if (button.isConnected) button.disabled = false;
      }
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

    root.querySelectorAll("[data-action='clear-family-slot']").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isPrimaryGM()) return;
        const clearButton = event.currentTarget;
        const data = getData();
        const slot = storedFamilySlot(data, clearButton.dataset.familySection, clearButton.dataset.slotId);
        if (!slot) return;
        Object.assign(slot, { actorUuid: "", name: "", img: "", notes: "" });
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

    if (target?.dataset.dropKind === "family-tree") {
      if (!isPrimaryGM() || document?.documentName !== "Actor") {
        ui.notifications?.warn?.("Перетащите сюда актёра из каталога актёров. Изменять семейное древо может только мастер.");
        return;
      }
      const data = getData();
      const section = target.dataset.familySection;
      const slot = storedFamilySlot(data, section, target.dataset.slotId);
      if (!slot) return;
      assignFamilyActor(slot, document);
      await saveData(data);
      ui.notifications?.info?.(`«${document.name}» добавлен в семейное древо Арудора.`);
      return;
    }

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
    onChange: (enabled) => {
      ui.actors?.render?.(true);
      lastObservedNightActive = Boolean(enabled) && !isDaytime(getData());
      queueReconcile({ restoreNightPresets: !enabled });
      void rebuildAccessBlockLinks();
    },
  });
  game.settings.register(MODULE_ID, DATA_SETTING, {
    name: "Bastardhall Data",
    scope: "world",
    config: false,
    type: Object,
    default: createDefaultData(),
    onChange: () => {
      const app = Object.values(ui.windows ?? {}).find((windowApp) => windowApp?.id === APP_ID);
      if (typeof app?.refreshCurrentView === "function") void app.refreshCurrentView();
      else app?.render?.(false);
      queueReconcile();
    },
  });
});

Hooks.on("renderActorDirectory", addActorDirectoryButton);
Hooks.on("renderWallConfig", (app, element) => setTimeout(() => injectAccessBlockConfig(app, element), 0));
Hooks.on("renderRegionConfig", (app, element) => setTimeout(() => injectAccessBlockConfig(app, element), 0));
Hooks.on("renderEffectsPanel", hideManagedEffectPanelIcons);
Hooks.on("updateWorldTime", () => {
  queueReconcile({ observeNightTransition: true });
  const app = Object.values(ui.windows ?? {}).find((windowApp) => windowApp?.id === APP_ID);
  const root = getFormRoot(app?.element);
  if (root) refreshClimateDisplay(root);
  if (app?._view === "cooking" && typeof app.refreshCurrentView === "function") void app.refreshCurrentView();
});
Hooks.on("createActor", () => queueReconcile({ forceActors: true }));
Hooks.on("updateWall", (document) => void (async () => {
  await syncAccessBlockDocument(document);
  await restoreAccessWall(document);
})());
Hooks.on("updateRegion", (document, changed) => void (async () => {
  await syncAccessBlockDocument(document);
  const accessChange = pendingRegionAccessChanges.get(document);
  pendingRegionAccessChanges.delete(document);
  if (!accessChange?.changed) return;
  if (accessChange.enabled) queueReconcile({ forceMementos: true });
  else await restoreAccessRegion(document);
})());
Hooks.on("preUpdateRegion", (document, changed) => captureRegionAccessState(document, changed));
Hooks.on("deleteWall", (document) => void removeAccessBlockDocument(document));
Hooks.on("deleteRegion", (document) => void removeAccessBlockDocument(document));

Hooks.once("ready", async () => {
  game.socket?.on?.(SOCKET_CHANNEL, async (message) => {
    if (message?.type === "bastardhall-daily-result") {
      if (message.recipientId === game.user?.id && message.message) {
        const level = ["info", "warn", "error"].includes(message.level) ? message.level : "info";
        ui.notifications?.[level]?.(message.message);
      }
      return;
    }
    if (message?.type === "bastardhall-sidequest-banner") {
      showSideQuestBanner(message);
      return;
    }
    if (message?.type === "bastardhall-research-banner") {
      showResearchBanner(message);
      return;
    }
    if (!isPrimaryGM()) return;
    try {
      if (message?.type === "bastardhall-servant-order" && message.serviceId && message.recipeId) {
        await moveServantRecipe(message.serviceId, message.recipeId, message.direction, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-daily-cooking") {
        await grantDailyCooking(message, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-daily-boons") {
        await grantDailyBoons(message, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-sidequest-note" && message.questId && message.text) {
        await addSideQuestNote(message.questId, message.text, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-sidequest-create" && message.title) {
        await createSideQuest({ title: message.title, description: message.description }, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-sidequest-completed" && message.questId) {
        await setSideQuestCompleted(message.questId, message.completed, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-sidequest-failed" && message.questId) {
        await setSideQuestFailed(message.questId, message.failed, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-sidequest-journal-create" && message.reference) {
        await addJournalSideQuest(message.reference, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-research-journal-create" && message.reference) {
        await addJournalInvestigation(message.reference, message.senderId);
        return;
      }
      if (message?.type === "bastardhall-deposit" && message.uuid) {
        const item = await fromUuid(message.uuid);
        await depositItem(item, message.senderId);
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Bastardhall socket action failed`, error);
    }
  });

  const module = game.modules?.get(MODULE_ID);
  if (module) {
    const sideQuestSheets = Array.from(module.api?.sideQuestSheets ?? []).filter((entry) => entry?.id !== "bastardhall");
    sideQuestSheets.push({
      id: "bastardhall",
      label: "Бастардхолл",
      isActive: () => Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING)),
      addFromJournal: requestJournalSideQuest,
    });
    const researchSheets = Array.from(module.api?.researchSheets ?? []).filter((entry) => entry?.id !== "bastardhall");
    researchSheets.push({
      id: "bastardhall",
      label: "Бастардхолл",
      isActive: () => Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING)),
      addFromJournal: requestJournalInvestigation,
    });
    module.api = {
      ...(module.api ?? {}),
      openBastardhallSheet,
      refreshBastardhallJournalSideQuests: refreshJournalSideQuests,
      refreshBastardhallJournalInvestigations: refreshJournalInvestigations,
      sideQuestSheets,
      researchSheets,
      reconcileBastardhall: () => queueReconcile({ forceActors: true, forceScenes: true, forceMementos: true }),
    };
  }
  const data = getData();
  await rebuildAccessBlockLinks();
  const enabled = Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING));
  lastObservedNightActive = enabled && !isDaytime(data);
  queueReconcile({ restoreNightPresets: !lastObservedNightActive });
});
