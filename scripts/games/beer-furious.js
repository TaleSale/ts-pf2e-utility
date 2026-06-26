import {
  comparePlayerEntriesForDisplay,
  escapeHtml,
  formatSignedNumber,
  getActorLoreModifier,
  getActorUuidFromDropData,
  getDroppedActors,
  getGameState,
  getNonGmCharacters,
  getPinnedPlayerActorIdForDisplay,
  gt,
  gtf,
  MODULE_ID,
  patchApplicationRegions,
  randomChoice,
  requestGameAction,
  userCanControlActor,
} from "../core.js";

const GAME_ID = "beer-furious";
const APP_ID = `${MODULE_ID}-${GAME_ID}`;
const I18N_ROOT = "Games.BeerFurious";
const GAME_TITLE = "Tipsy Dash";
const DEFAULT_IMG = "icons/svg/mystery-man.svg";
const ALCOHOL_LORE_SELECTOR = ["alcohol", "beer", "ale", "drink", "drinking", "алког", "пив", "хмел"];
const PF2E_DC_BY_LEVEL = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];
const AUTO_SUPPORT_DC_OFFSETS = Object.freeze([-2, 2, 6]);
const MANUAL_SUPPORT_DC_OFFSETS = Object.freeze([-2, 2, 6]);
const ROUND_RULES = Object.freeze({
  1: { gainOnSuccess: 0, gainOnFailure: 1, dcAdd: 0 },
  2: { gainOnSuccess: 1, gainOnFailure: 2, dcAdd: 3 },
  3: { gainOnSuccess: 2, gainOnFailure: 3, dcAdd: 6 },
});
const TECHNIQUES = Object.freeze({
  ath: {
    name: "Атлетика",
    icon: "fa-running",
    skillType: "skill",
    skillSlug: "athletics",
    successText: "Следующий раунд: КС -2.",
    failureText: "Следующий раунд: КС +2.",
    flavorSuccess: "{n} опрокидывает кружку одним мощным рывком.",
    flavorFailure: "{n} недооценил вес пенного снаряда.",
  },
  acr: {
    name: "Акробатика",
    icon: "fa-child",
    skillType: "skill",
    skillSlug: "acrobatics",
    successText: "Случайный соперник получает только 2 карты.",
    failureText: "Вы получаете только 2 карты.",
    flavorSuccess: "{n} отпивает так ловко, будто это цирковой номер.",
    flavorFailure: "{n} сбивается с ритма и теряет темп.",
  },
  thi: {
    name: "Воровство",
    icon: "fa-mask",
    skillType: "skill",
    skillSlug: "thievery",
    successText: "Случайный соперник получает +1 ОО.",
    failureText: "Вы получаете +1 ОО.",
    flavorSuccess: "{n} незаметно подменяет кружки в общей суматохе.",
    flavorFailure: "{n} сам оказывается жертвой собственного мухлежа.",
  },
  ste: {
    name: "Скрытность",
    icon: "fa-user-ninja",
    skillType: "skill",
    skillSlug: "stealth",
    successText: "Иммунитет к чужому допингу до конца раунда.",
    failureText: "Чужой допинг по вам действует вдвое сильнее.",
    flavorSuccess: "{n} скрывает хмель за ледяным спокойствием.",
    flavorFailure: "{n} слишком заметно тянется к кружке.",
  },
  arc: {
    name: "Аркана",
    icon: "fa-magic",
    skillType: "skill",
    skillSlug: "arcana",
    successText: "Следующий раунд: Удача.",
    failureText: "Случайный соперник получает Удачу.",
    flavorSuccess: "{n} шепчет заклинание удачного глотка.",
    flavorFailure: "{n} выпускает магию прямо в чужую кружку.",
  },
  occ: {
    name: "Оккультизм",
    icon: "fa-eye",
    skillType: "skill",
    skillSlug: "occultism",
    successText: "Следующий результат даёт на 1 ОО меньше.",
    failureText: "Следующий раунд: только 1 карта.",
    flavorSuccess: "{n} пьёт так, будто заключил сделку с тенью стойки.",
    flavorFailure: "{n} слишком пристально всматривается в пену и путается.",
  },
  rel: {
    name: "Религия",
    icon: "fa-pray",
    skillType: "skill",
    skillSlug: "religion",
    successText: "Постоянный КС -1.",
    failureText: "Постоянный КС +1.",
    flavorSuccess: "{n} получает благословение покровителей хмеля.",
    flavorFailure: "{n} слышит в кружке неодобрительный шёпот богов.",
  },
  nat: {
    name: "Природа",
    icon: "fa-leaf",
    skillType: "skill",
    skillSlug: "nature",
    successText: "Немедленно -1 ОО.",
    failureText: "Немедленно +1 ОО.",
    flavorSuccess: "{n} гасит удар солода природной закалкой.",
    flavorFailure: "{n} не справляется с дикостью напитка.",
  },
  soc: {
    name: "Общество",
    icon: "fa-users",
    skillType: "skill",
    skillSlug: "society",
    successText: "Всем соперникам КС +1.",
    failureText: "Ваш следующий КС +2.",
    flavorSuccess: "{n} произносит тост так убедительно, что соперники мнутся.",
    flavorFailure: "{n} затягивает речь и сам теряет концентрацию.",
  },
  dec: {
    name: "Обман",
    icon: "fa-comment-slash",
    skillType: "skill",
    skillSlug: "deception",
    successText: "Случайный соперник теряет 1 допинг.",
    failureText: "Вы теряете 1 допинг.",
    flavorSuccess: "{n} делает вид, что пьёт, а сам портит чужие планы.",
    flavorFailure: "{n} переигрывает и выдаёт себя с головой.",
  },
  dip: {
    name: "Дипломатия",
    icon: "fa-comments",
    skillType: "skill",
    skillSlug: "diplomacy",
    successText: "Вы и случайный соперник теряете 1 ОО.",
    failureText: "Последняя цель вашего допинга получает +1 допинг.",
    flavorSuccess: "{n} сглаживает углы даже за самым шумным столом.",
    flavorFailure: "{n} мирится слишком поздно и кормит чужую уверенность.",
  },
  itm: {
    name: "Запугивание",
    icon: "fa-skull",
    skillType: "skill",
    skillSlug: "intimidation",
    successText: "Передаёте 1 ОО случайному сопернику.",
    failureText: "Забираете 1 ОО у случайного соперника.",
    flavorSuccess: "{n} так давит взглядом, что соперник бледнеет раньше пива.",
    flavorFailure: "{n} перегибает и сам оказывается под прицелом.",
  },
  per: {
    name: "Выступление",
    icon: "fa-guitar",
    skillType: "skill",
    skillSlug: "performance",
    successText: "+2 допинга.",
    failureText: "Вы теряете весь допинг.",
    flavorSuccess: "{n} превращает глоток в бурный номер трактирной сцены.",
    flavorFailure: "{n} срывает выступление и проливает весь кураж.",
  },
  med: {
    name: "Медицина",
    icon: "fa-first-aid",
    skillType: "skill",
    skillSlug: "medicine",
    successText: "Немедленно -1 ОО.",
    failureText: "Немедленно +1 ОО.",
    flavorSuccess: "{n} знает, как пережить ещё одну кружку.",
    flavorFailure: "{n} путает лечение с добавкой.",
  },
  sur: {
    name: "Выживание",
    icon: "fa-campground",
    skillType: "skill",
    skillSlug: "survival",
    successText: "Лимит ОО +1.",
    failureText: "Лимит ОО -1.",
    flavorSuccess: "{n} держится так, будто это не эль, а болотная вода.",
    flavorFailure: "{n} понимает, что организм уже не тот.",
  },
  crf: {
    name: "Ремесло",
    icon: "fa-hammer",
    skillType: "skill",
    skillSlug: "crafting",
    successText: "Следующий допинг усиливается до 3.",
    failureText: "Следующий допинг искажается на 3.",
    flavorSuccess: "{n} тонко настраивает химический баланс кружки.",
    flavorFailure: "{n} что-то путает в формуле и получает странный коктейль.",
  },
  prc: {
    name: "Внимательность",
    icon: "fa-search",
    skillType: "perception",
    successText: "Случайный соперник получает Неудачу.",
    failureText: "Вы получаете Неудачу.",
    flavorSuccess: "{n} видит каждый лишний пузырёк в чужом стакане.",
    flavorFailure: "{n} моргает не вовремя и мир расплывается.",
  },
  lor: {
    name: "Alcohol Lore",
    icon: "fa-beer",
    skillType: "lore",
    successText: "-1 ОО и +1 допинг.",
    failureText: "Следующий провал даёт +2 ОО.",
    flavorSuccess: "{n} узнаёт сорт по одному запаху и ловит кураж.",
    flavorFailure: "{n} с важным видом объявляет шедевр дешёвой сивухой.",
  },
});
const TECHNIQUES_EN = Object.freeze({
  ath: {
    name: "Athletics",
    successText: "Next round: DC -2.",
    failureText: "Next round: DC +2.",
    flavorSuccess: "{n} flips the mug in one powerful pull.",
    flavorFailure: "{n} underestimated the weight of the foamy projectile.",
  },
  acr: {
    name: "Acrobatics",
    successText: "A random opponent draws only 2 cards.",
    failureText: "You draw only 2 cards.",
    flavorSuccess: "{n} drinks so deftly it looks like a circus act.",
    flavorFailure: "{n} loses the rhythm and gives up the pace.",
  },
  thi: {
    name: "Thievery",
    successText: "A random opponent gains +1 IP.",
    failureText: "You gain +1 IP.",
    flavorSuccess: "{n} quietly swaps mugs in the middle of the commotion.",
    flavorFailure: "{n} becomes the victim of their own scam.",
  },
  ste: {
    name: "Stealth",
    successText: "Immune to hostile doping until the round ends.",
    failureText: "Enemy doping affects you twice as much.",
    flavorSuccess: "{n} hides the buzz behind icy calm.",
    flavorFailure: "{n} reaches for the mug far too obviously.",
  },
  arc: {
    name: "Arcana",
    successText: "Next round: Fortune.",
    failureText: "A random opponent gains Fortune.",
    flavorSuccess: "{n} whispers a spell for a lucky gulp.",
    flavorFailure: "{n} sends the magic straight into someone else's mug.",
  },
  occ: {
    name: "Occultism",
    successText: "Your next result gives 1 less IP.",
    failureText: "Next round: only 1 card.",
    flavorSuccess: "{n} drinks like they made a pact with the shadow of the bar.",
    flavorFailure: "{n} stares into the foam for too long and loses the thread.",
  },
  rel: {
    name: "Religion",
    successText: "Permanent DC -1.",
    failureText: "Permanent DC +1.",
    flavorSuccess: "{n} earns the blessing of the patrons of hops.",
    flavorFailure: "{n} hears an angry whisper from the gods in the mug.",
  },
  nat: {
    name: "Nature",
    successText: "Immediate -1 IP.",
    failureText: "Immediate +1 IP.",
    flavorSuccess: "{n} absorbs the malt hit with raw natural grit.",
    flavorFailure: "{n} cannot handle the wild nature of the drink.",
  },
  soc: {
    name: "Society",
    successText: "All opponents gain DC +1.",
    failureText: "Your next DC is +2.",
    flavorSuccess: "{n} delivers a toast so convincingly that the rivals hesitate.",
    flavorFailure: "{n} drags the speech out and loses focus.",
  },
  dec: {
    name: "Deception",
    successText: "A random opponent loses 1 doping.",
    failureText: "You lose 1 doping.",
    flavorSuccess: "{n} pretends to drink while ruining everyone else's plans.",
    flavorFailure: "{n} overacts and gives the trick away.",
  },
  dip: {
    name: "Diplomacy",
    successText: "You and a random opponent lose 1 IP.",
    failureText: "The last target of your doping gains +1 doping.",
    flavorSuccess: "{n} smooths things over even at the loudest table.",
    flavorFailure: "{n} makes peace too late and feeds someone else's confidence.",
  },
  itm: {
    name: "Intimidation",
    successText: "Transfer 1 IP to a random opponent.",
    failureText: "Take 1 IP from a random opponent.",
    flavorSuccess: "{n} presses so hard with a stare that the rival pales before the beer does.",
    flavorFailure: "{n} pushes too hard and becomes the target instead.",
  },
  per: {
    name: "Performance",
    successText: "+2 doping.",
    failureText: "You lose all doping.",
    flavorSuccess: "{n} turns a single gulp into a roaring tavern performance.",
    flavorFailure: "{n} ruins the show and spills all the bravado.",
  },
  med: {
    name: "Medicine",
    successText: "Immediate -1 IP.",
    failureText: "Immediate +1 IP.",
    flavorSuccess: "{n} knows exactly how to survive one more mug.",
    flavorFailure: "{n} confuses treatment with an extra dose.",
  },
  sur: {
    name: "Survival",
    successText: "IP limit +1.",
    failureText: "IP limit -1.",
    flavorSuccess: "{n} endures as if this were swamp water instead of ale.",
    flavorFailure: "{n} realizes the body is no longer what it used to be.",
  },
  crf: {
    name: "Crafting",
    successText: "Your next doping is boosted to 3.",
    failureText: "Your next doping is twisted by 3.",
    flavorSuccess: "{n} fine-tunes the chemical balance of the mug.",
    flavorFailure: "{n} mixes up the formula and gets a very strange cocktail.",
  },
  prc: {
    name: "Perception",
    successText: "A random opponent gains Misfortune.",
    failureText: "You gain Misfortune.",
    flavorSuccess: "{n} notices every extra bubble in a rival's glass.",
    flavorFailure: "{n} blinks at the wrong moment and the whole room smears.",
  },
  lor: {
    name: "Alcohol Lore",
    successText: "-1 IP and +1 doping.",
    failureText: "Your next failure gives +2 IP.",
    flavorSuccess: "{n} identifies the brew by smell alone and catches the rush.",
    flavorFailure: "{n} solemnly calls a masterpiece cheap swill.",
  },
});
const TEXT = Object.freeze({
  OutcomeCriticalSuccess: { ru: "Крит. успех", en: "Critical success" },
  OutcomeSuccess: { ru: "Успех", en: "Success" },
  OutcomeFailure: { ru: "Провал", en: "Failure" },
  OutcomeCriticalFailure: { ru: "Крит. провал", en: "Critical failure" },
  RoundDivider: { ru: "🍺 Раунд {round} · Базовый КС {dc}", en: "🍺 Round {round} · Base DC {dc}" },
  EliminationLog: { ru: "💀 <b>{name}</b> в отключке. Лимит: <b>{limit} ОО</b>.", en: "💀 <b>{name}</b> blacks out. Limit: <b>{limit} IP</b>." },
  DopingLog: { ru: "🧪 <b>{source}</b> вливает допинг в <b>{target}</b>: {modifier} КС.", en: "🧪 <b>{source}</b> pumps doping into <b>{target}</b>: {modifier} DC." },
  DopingImmuneLog: { ru: "🛡️ <b>{name}</b> игнорирует чужой допинг.", en: "🛡️ <b>{name}</b> ignores foreign doping." },
  RollLine: { ru: "<b>{rollType}</b>: [{dice}] → <b>{d20}</b> {modifier} = <b>{total}</b> против <b>КС {dc}</b>", en: "<b>{rollType}</b>: [{dice}] → <b>{d20}</b> {modifier} = <b>{total}</b> vs <b>DC {dc}</b>" },
  GainLine: { ru: "<b>{result}</b> · +{gain} ОО · ОО: {oldOo} → <b>{newOo}</b> / {limit}", en: "<b>{result}</b> · +{gain} IP · IP: {oldOo} → <b>{newOo}</b> / {limit}" },
  DopingLine: { ru: "Допинг: {oldDoping} → <b>{newDoping}</b>{extra}", en: "Doping: {oldDoping} → <b>{newDoping}</b>{extra}" },
  DcBase: { ru: "База {value}", en: "Base {value}" },
  DcReligion: { ru: "{value} религия", en: "{value} religion" },
  DcDoping: { ru: "{value} допинг", en: "{value} doping" },
  DcEffect: { ru: "{value} эффект", en: "{value} effect" },
  EffectOpponentHand: { ru: "{name}: -1 карта", en: "{name}: -1 card" },
  EffectOpponentOoPlus: { ru: "{name}: +1 ОО", en: "{name}: +1 IP" },
  EffectOpponentFortune: { ru: "{name}: Удача", en: "{name}: Fortune" },
  EffectAllOpponentsDc: { ru: "всем соперникам +1 КС", en: "all opponents gain +1 DC" },
  EffectOpponentDopingMinus: { ru: "{name}: -1 допинг", en: "{name}: -1 doping" },
  EffectOpponentOoMinus: { ru: "{name}: -1 ОО", en: "{name}: -1 IP" },
  EffectOpponentDopingPlus: { ru: "{name}: +1 допинг", en: "{name}: +1 doping" },
  EffectOpponentGetsOo: { ru: "{name}: получает 1 ОО", en: "{name}: gains 1 IP" },
  EffectOpponentLosesOo: { ru: "{name}: теряет 1 ОО", en: "{name}: loses 1 IP" },
  EffectOpponentMisfortune: { ru: "{name}: Неудача", en: "{name}: Misfortune" },
  HelpIntro: { ru: "{title} — трёхраундовая гонка на стойкость. Каждый раунд игрок выбирает одну из техник, делает проверку и получает очки опьянения.", en: "{title} is a three-round endurance race. Each round, a player chooses one technique, rolls a check, and gains intoxication points." },
  HelpGoal: { ru: "<b>Цель:</b> не вылететь по лимиту ОО и закончить игру с наименьшим количеством ОО.", en: "<b>Goal:</b> stay under your IP limit and finish the game with the fewest IP." },
  HelpCrits: { ru: "<b>Критический успех</b> уменьшает рост ОО и даёт 1 допинг. <b>Критический провал</b> усиливает рост ОО и отнимает 1 допинг.", en: "<b>Critical success</b> reduces IP gain and grants 1 doping. <b>Critical failure</b> increases IP gain and removes 1 doping." },
  HelpTechniques: { ru: "Техники", en: "Techniques" },
  HelpSuccess: { ru: "Успех", en: "Success" },
  HelpFailure: { ru: "Провал", en: "Failure" },
  UiSuccess: { ru: "Успех:", en: "Success:" },
  UiFailure: { ru: "Провал:", en: "Failure:" },
  FooterMain: { ru: "Раунд", en: "Round" },
  FooterClear: { ru: "Очистить", en: "Clear" },
  FooterReset: { ru: "Сброс", en: "Reset" },
  BadgeFortune: { ru: "Удача", en: "Fortune" },
  BadgeMisfortune: { ru: "Неудача", en: "Misfortune" },
  BadgeImmune: { ru: "Иммунитет", en: "Immune" },
  BadgeDopingX2: { ru: "×2 допинг", en: "×2 doping" },
  OoBadge: { ru: "{current} / {limit} ОО", en: "{current} / {limit} IP" },
  DopingBadge: { ru: "{count} допинг", en: "{count} doping" },
  RuleRound1: { ru: "Успех 0 ОО / Провал 1 ОО", en: "Success 0 IP / Failure 1 IP" },
  RuleRound2: { ru: "Успех 1 ОО / Провал 2 ОО", en: "Success 1 IP / Failure 2 IP" },
  RuleRound3: { ru: "Успех 2 ОО / Провал 3 ОО", en: "Success 2 IP / Failure 3 IP" },
  RuleLimitLabel: { ru: "Лимит", en: "Limit" },
  RuleHandLabel: { ru: "Колода", en: "Hand" },
  RuleWinLabel: { ru: "Победа", en: "Victory" },
});

const TECHNIQUE_ORDER = Object.keys(TECHNIQUES);

function isRussianLocale() {
  return String(game.i18n?.lang ?? "en").startsWith("ru");
}

function tx(key) {
  const fallback = TEXT[key] ? (isRussianLocale() ? TEXT[key].ru : TEXT[key].en) : key;
  return gt(definition, `Text.${key}`, fallback);
}

function tf(key, data = {}) {
  const fallback = TEXT[key] ? (isRussianLocale() ? TEXT[key].ru : TEXT[key].en) : key;
  return gtf(definition, `Text.${key}`, data, () => fallback.replace(/\{(\w+)\}/g, (_match, token) => String(data[token] ?? "")));
}

function getRawTranslation(key, fallback) {
  const paths = [
    `${MODULE_ID}.${I18N_ROOT}.${key}`,
    `TS_PF2E_UTILITY.${I18N_ROOT}.${key}`,
  ];
  for (const path of paths) {
    const parts = path.split(".");
    let value = game.i18n?.translations;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}

function getTechniqueData(key) {
  const base = TECHNIQUES[key];
  if (!base) return null;
  const fallback = isRussianLocale() ? base : { ...base, ...(TECHNIQUES_EN[key] ?? {}) };
  return {
    ...base,
    name: gt(definition, `Techniques.${key}.name`, fallback.name),
    successText: gt(definition, `Techniques.${key}.successText`, fallback.successText),
    failureText: gt(definition, `Techniques.${key}.failureText`, fallback.failureText),
    flavorSuccess: getRawTranslation(`Techniques.${key}.flavorSuccess`, fallback.flavorSuccess),
    flavorFailure: getRawTranslation(`Techniques.${key}.flavorFailure`, fallback.flavorFailure),
  };
}

function createInitialState() {
  return {
    players: {},
    excludedPlayers: {},
    round: 1,
    phase: "join",
    roundStage: "technique",
    log: [],
    results: null,
    debugMode: false,
    supportDcOverride: null,
    suppressDefaultPlayers: false,
    openSignal: null,
  };
}

function replaceStateContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function normalizeRoundStage(state) {
  state.roundStage = "technique";
}

function getActorLevel(actor) {
  return actor?.level || actor?.system?.details?.level?.value || 0;
}

function getPlayerLimit(actor) {
  const constitution = actor?.system?.abilities?.con?.mod || 0;
  return Math.max(2, constitution * 2);
}

function createPlayerState(actor, { isParticipating = false, source = "manual" } = {}) {
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img || DEFAULT_IMG,
    level: getActorLevel(actor),
    oo: 0,
    limit: getPlayerLimit(actor),
    doping: 1,
    signature: "",
    isParticipating,
    currentDCMod: 0,
    permDCMod: 0,
    roundPool: [],
    hand: [],
    selectedTech: "",
    isConfirmed: false,
    nextRoundEffects: {},
    isEliminated: false,
    lastDopingTarget: "",
    nextDopingPower: 1,
    dopingEffectX2: false,
    isDopingImmune: false,
    isLorePenalty: false,
    source,
  };
}

function normalizePlayerState(playerData, actor) {
  playerData.name = actor?.name || playerData.name || "";
  playerData.img = actor?.img || playerData.img || DEFAULT_IMG;
  playerData.level = getActorLevel(actor) || playerData.level || 0;
  playerData.limit = Math.max(1, Number(playerData.limit) || getPlayerLimit(actor));
  playerData.oo = Math.max(0, Number(playerData.oo) || 0);
  playerData.doping = Math.max(0, Number(playerData.doping) || 0);
  playerData.signature = typeof playerData.signature === "string" ? playerData.signature : "";
  if (!TECHNIQUES[playerData.signature]) playerData.signature = "";
  playerData.isParticipating = Boolean(playerData.isParticipating);
  playerData.currentDCMod = Number(playerData.currentDCMod) || 0;
  playerData.permDCMod = Number(playerData.permDCMod) || 0;
  playerData.roundPool = Array.isArray(playerData.roundPool) ? playerData.roundPool.filter((id) => TECHNIQUES[id]) : [];
  playerData.hand = Array.isArray(playerData.hand) ? playerData.hand.filter((id) => TECHNIQUES[id]) : [];
  playerData.selectedTech = TECHNIQUES[playerData.selectedTech] ? playerData.selectedTech : "";
  playerData.isConfirmed = Boolean(playerData.isConfirmed);
  playerData.nextRoundEffects = (playerData.nextRoundEffects && typeof playerData.nextRoundEffects === "object") ? playerData.nextRoundEffects : {};
  playerData.isEliminated = Boolean(playerData.isEliminated);
  playerData.lastDopingTarget = typeof playerData.lastDopingTarget === "string" ? playerData.lastDopingTarget : "";
  playerData.nextDopingPower = Number(playerData.nextDopingPower) || 1;
  playerData.dopingEffectX2 = Boolean(playerData.dopingEffectX2);
  playerData.isDopingImmune = Boolean(playerData.isDopingImmune);
  playerData.isLorePenalty = Boolean(playerData.isLorePenalty);
  playerData.source = playerData.source || "manual";
}

async function addActorToState(state, actor, { isParticipating = false, source = "manual" } = {}) {
  if (!actor || state.players[actor.id]) return;
  state.players[actor.id] = createPlayerState(actor, { isParticipating, source });
}

async function ensureDefaultPlayers(state) {
  for (const actor of getNonGmCharacters()) {
    await addActorToState(state, actor, { isParticipating: false, source: "auto" });
  }
}

async function syncDefaultPlayers(state) {
  const defaultActors = getNonGmCharacters();
  const defaultIds = new Set(defaultActors.map((actor) => actor.id));
  state.excludedPlayers ||= {};

  for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
    const actor = game.actors.get(actorId);
    const source = playerData.source ?? "auto";
    if (source === "manual") {
      normalizePlayerState(playerData, actor);
      continue;
    }
    if (actor?.type === "character" && !defaultIds.has(actorId)) {
      delete state.players[actorId];
      continue;
    }
    playerData.source = "auto";
    normalizePlayerState(playerData, actor);
  }

  for (const actor of defaultActors) {
    if (state.excludedPlayers[actor.id]) continue;
    if (!state.players[actor.id]) {
      await addActorToState(state, actor, { isParticipating: false, source: "auto" });
      continue;
    }
    state.players[actor.id].source = "auto";
    normalizePlayerState(state.players[actor.id], actor);
  }
}

function canSenderToggleJoin(actorId, senderId, canUserControlActor) {
  const sender = game.users?.get(senderId);
  if (!sender) return false;
  if (sender.isGM) return true;
  return canUserControlActor(actorId, senderId);
}

function canSenderOperateActor(actorId, senderId, state, canUserControlActor) {
  const sender = game.users?.get(senderId);
  const actor = game.actors?.get(actorId);
  if (!sender || !actor) return false;
  if (sender.isGM) return Boolean(state?.debugMode) || actor.type === "npc";
  return canUserControlActor(actorId, senderId);
}

function canCurrentUserOperateActor(actor, state) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return Boolean(state?.debugMode) || actor.type === "npc";
  return userCanControlActor(actor, game.user);
}

function getTechniqueModifier(actor, technique) {
  if (!actor || !technique) return 0;
  if (technique.skillType === "perception") {
    return actor.perception?.mod || actor.system?.perception?.mod || 0;
  }
  if (technique.skillType === "lore") {
    return getActorLoreModifier(actor, ALCOHOL_LORE_SELECTOR);
  }
  return actor.skills?.[technique.skillSlug]?.mod
    || actor.system?.skills?.[technique.skillSlug]?.mod
    || actor.system?.skills?.[technique.skillSlug]?.base
    || 0;
}

function getActivePlayerIds(state) {
  return Object.keys(state.players ?? {}).filter((actorId) => {
    const playerData = state.players?.[actorId];
    return playerData?.isParticipating && !playerData?.isEliminated;
  });
}

function getSupportDcOffset(offsets, round) {
  const roundIndex = Math.max(0, Math.min(offsets.length - 1, (Math.trunc(Number(round) || 1) - 1)));
  return offsets[roundIndex] ?? offsets[0] ?? 0;
}

function getSuggestedSupportDcRoundOne(state) {
  const sourceIds = Object.keys(state.players ?? {}).filter((actorId) => state.players?.[actorId]?.isParticipating);
  const levels = sourceIds.map((actorId) => {
    const actor = game.actors?.get(actorId);
    const storedLevel = Math.trunc(Number(state.players?.[actorId]?.level) || 0);
    const actorLevel = Math.trunc(Number(actor?.level ?? actor?.system?.details?.level?.value ?? Number.NaN));
    const level = Number.isFinite(actorLevel) ? actorLevel : (Number.isFinite(storedLevel) ? storedLevel : 0);
    if (state.players?.[actorId]) state.players[actorId].level = level;
    return level;
  });
  const minLevel = levels.length ? Math.min(...levels) : 0;
  const safeLevel = Math.max(0, Math.min(PF2E_DC_BY_LEVEL.length - 1, minLevel));
  return PF2E_DC_BY_LEVEL[safeLevel] || PF2E_DC_BY_LEVEL[0];
}

function getManualSupportDcRoundOne(state) {
  const override = Math.trunc(Number(state?.supportDcOverride));
  return Number.isFinite(override) && override > 0 ? override : null;
}

function hasManualSupportDcOverride(state) {
  const override = getManualSupportDcRoundOne(state);
  return Number.isFinite(override) && override > 0;
}

function getRoundBaseDc(state, round = state?.round) {
  const manualBaseDc = getManualSupportDcRoundOne(state);
  if (Number.isFinite(manualBaseDc) && manualBaseDc > 0) {
    return manualBaseDc + getSupportDcOffset(MANUAL_SUPPORT_DC_OFFSETS, round);
  }
  return getSuggestedSupportDcRoundOne(state) + getSupportDcOffset(AUTO_SUPPORT_DC_OFFSETS, round);
}

function createShuffledTechniquePool() {
  const pool = [...TECHNIQUE_ORDER];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function buildHandFromRoundPool(playerData, round) {
  const handSize = Math.max(1, Number(playerData.nextRoundEffects?.handSize) || 3);
  const signature = (round === 1 || round === 3) && TECHNIQUES[playerData.signature] ? playerData.signature : "";
  const hand = [];

  if (signature) hand.push(signature);

  const seen = new Set(hand);
  if (!Array.isArray(playerData.roundPool) || !playerData.roundPool.length) {
    playerData.roundPool = createShuffledTechniquePool();
  }
  const pool = playerData.roundPool;

  for (const techId of pool) {
    if (hand.length >= handSize) break;
    if (!TECHNIQUES[techId] || seen.has(techId)) continue;
    hand.push(techId);
    seen.add(techId);
  }

  return hand;
}

function refreshPlayerHand(playerData, round, { preserveSelection = true } = {}) {
  playerData.hand = buildHandFromRoundPool(playerData, round);
  if (!preserveSelection || !playerData.hand.includes(playerData.selectedTech)) {
    playerData.selectedTech = "";
  }
  if (playerData.hand.length === 1) playerData.selectedTech = playerData.hand[0];
}

function pushLog(state, html) {
  state.log.unshift(html);
}

function getOutcomeData(rank) {
  if (rank === 4) return { label: tx("OutcomeCriticalSuccess"), css: "critical-success" };
  if (rank === 3) return { label: tx("OutcomeSuccess"), css: "success" };
  if (rank === 2) return { label: tx("OutcomeFailure"), css: "failure" };
  return { label: tx("OutcomeCriticalFailure"), css: "critical-failure" };
}

function buildRoundDivider(round, baseDc) {
  return `<div class="tsu-log-entry bf-log-divider">${escapeHtml(tf("RoundDivider", { round, dc: baseDc }))}</div>`;
}

function buildEliminationLog(name, limit) {
  return `<div class="tsu-log-entry bf-log-elimination">${tf("EliminationLog", { name: escapeHtml(name), limit })}</div>`;
}

function buildDopingLog(sourceName, targetName, modifier) {
  const sign = modifier > 0 ? "+" : "";
  return `<div class="tsu-log-entry bf-log-doping">${tf("DopingLog", {
    source: escapeHtml(sourceName),
    target: escapeHtml(targetName),
    modifier: `${sign}${modifier}`,
  })}</div>`;
}

function buildDopingImmuneLog(targetName) {
  return `<div class="tsu-log-entry bf-log-warning">${tf("DopingImmuneLog", { name: escapeHtml(targetName) })}</div>`;
}

function buildTechniqueLog(playerData, technique, result, details) {
  const extraText = details.extra ? ` · ${escapeHtml(details.extra)}` : "";
  const rollLine = tf("RollLine", {
    rollType: escapeHtml(details.rollType),
    dice: details.dice.join(", "),
    d20: details.d20,
    modifier: formatSignedNumber(details.modifier),
    total: details.total,
    dc: details.dc,
  });
  const gainLine = tf("GainLine", {
    result: escapeHtml(result.label),
    gain: details.gain,
    oldOo: details.oldOo,
    newOo: playerData.oo,
    limit: playerData.limit,
  });
  const dopingLine = tf("DopingLine", {
    oldDoping: details.oldDoping,
    newDoping: playerData.doping,
    extra: extraText,
  });
  return `
    <div class="tsu-log-entry bf-log-entry bf-log-entry--${result.css}">
      <div class="bf-log-entry__head">
        <span class="bf-log-entry__name">${escapeHtml(playerData.name)}</span>
        <span class="bf-log-entry__tech"><i class="fas ${technique.icon}"></i> ${escapeHtml(technique.name)}</span>
      </div>
      <div class="bf-log-entry__body">
        <div>${rollLine}</div>
        <div class="bf-log-entry__calc">${escapeHtml(details.dcCalc)}</div>
        <div>${gainLine}</div>
        <div>${dopingLine}</div>
      </div>
      <div class="bf-log-entry__flavor">${details.flavor}<span class="bf-log-entry__effect">${escapeHtml(details.effect)}</span></div>
    </div>
  `;
}

function getStatusLine(state, baseDc) {
  if (state.phase === "play") {
    if (state.roundStage === "signature") {
      return gtf(definition, "Status.Signature", { round: state.round }, ({ round }) => `Раунд ${round} · Выбор коронной техники`);
    }
    return gtf(definition, "Status.Round", { round: state.round, dc: baseDc }, ({ round, dc }) => `Раунд ${round} · Базовый КС ${dc}`);
  }
  return state.phase === "results"
    ? gt(definition, "Status.Results", "Итоги")
    : gt(definition, "Status.Join", "Подготовка");
}

function getDisplayStatusLine(state, baseDc) {
  if (state.phase === "play") return gtf(definition, "Status.Round", { round: state.round, dc: baseDc }, ({ round, dc }) => `Раунд ${round} · Базовый КС ${dc}`);
  return state.phase === "results"
    ? gt(definition, "Status.Results", "Итоги")
    : gt(definition, "Status.Join", "Подготовка");
}

function getRandomOpponentId(state, actorId) {
  const pool = getActivePlayerIds(state).filter((id) => id !== actorId);
  return pool.length ? randomChoice(pool, "") : "";
}

function setupRound(state) {
  const baseDc = getRoundBaseDc(state);
  state.roundStage = "technique";
  pushLog(state, buildRoundDivider(state.round, baseDc));

  for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
    if (!playerData.isParticipating || playerData.isEliminated) {
      playerData.roundPool = [];
      playerData.hand = [];
      playerData.selectedTech = "";
      playerData.isConfirmed = false;
      continue;
    }

    playerData.isConfirmed = false;
    playerData.selectedTech = "";
    playerData.currentDCMod = 0;
    playerData.isDopingImmune = false;
    playerData.roundPool = createShuffledTechniquePool();
    refreshPlayerHand(playerData, state.round, { preserveSelection: false });
  }
}

function computeResults(state) {
  const activeEntries = Object.entries(state.players ?? {}).filter(([, playerData]) => playerData.isParticipating);
  const aliveEntries = activeEntries.filter(([, playerData]) => !playerData.isEliminated);
  if (!aliveEntries.length) {
    return {
      winners: [],
      message: gt(definition, "Results.AllOut", "Все в отключке. Ничья."),
    };
  }

  const bestOo = Math.min(...aliveEntries.map(([, playerData]) => playerData.oo));
  const winners = aliveEntries.filter(([, playerData]) => playerData.oo === bestOo).map(([actorId]) => actorId);
  const winnerNames = winners.map((actorId) => state.players?.[actorId]?.name).filter(Boolean).join(", ");
  return {
    winners,
    message: winners.length === 1
      ? gtf(definition, "Results.Winner", { names: winnerNames }, ({ names }) => `Победитель: ${names}.`)
      : gtf(definition, "Results.Tie", { names: winnerNames }, ({ names }) => `Ничья: ${names}.`),
  };
}

function finalizeGame(state) {
  state.results = computeResults(state);
  pushLog(state, `<div class="tsu-log-entry bf-log-finale">🏆 ${escapeHtml(state.results.message)}</div>`);
}

function checkEliminations(state) {
  for (const playerData of Object.values(state.players ?? {})) {
    if (!playerData.isParticipating || playerData.isEliminated || playerData.oo < playerData.limit) continue;
    playerData.isEliminated = true;
    pushLog(state, buildEliminationLog(playerData.name, playerData.limit));
  }
}

async function processRound(state) {
  const rules = ROUND_RULES[state.round] || ROUND_RULES[1];
  const baseDc = getRoundBaseDc(state);
  const activeIds = getActivePlayerIds(state);

  for (const actorId of activeIds) {
    const playerData = state.players[actorId];
    const actor = game.actors?.get(actorId);
    if (!actor) continue;

    normalizePlayerState(playerData, actor);

    const techId = playerData.selectedTech || playerData.hand[0] || "ath";
    const technique = getTechniqueData(techId) ?? getTechniqueData("ath");
    const modifier = getTechniqueModifier(actor, technique);
    const effectDcMod = Number(playerData.nextRoundEffects?.dcMod) || 0;
    const dc = baseDc + playerData.permDCMod + playerData.currentDCMod + effectDcMod;
    const dcParts = [tf("DcBase", { value: baseDc })];
    if (playerData.permDCMod) dcParts.push(tf("DcReligion", { value: formatSignedNumber(playerData.permDCMod) }));
    if (playerData.currentDCMod) dcParts.push(tf("DcDoping", { value: formatSignedNumber(playerData.currentDCMod) }));
    if (effectDcMod) dcParts.push(tf("DcEffect", { value: formatSignedNumber(effectDcMod) }));

    const rollFormula = playerData.nextRoundEffects?.fortune ? "2d20kh" : (playerData.nextRoundEffects?.misfortune ? "2d20kl" : "1d20");
    const rollType = playerData.nextRoundEffects?.fortune
      ? gt(definition, "Rolls.Fortune", "Удача")
      : (playerData.nextRoundEffects?.misfortune ? gt(definition, "Rolls.Misfortune", "Неудача") : gt(definition, "Rolls.Normal", "Бросок"));
    const roll = await (new Roll(`${rollFormula} + ${modifier}`)).evaluate({ async: true });
    const dice = roll.dice?.[0]?.results?.map((result) => result.result) ?? [];
    const d20 = roll.total - modifier;

    let outcomeRank = 2;
    if (roll.total >= dc + 10) outcomeRank = 4;
    else if (roll.total >= dc) outcomeRank = 3;
    else if (roll.total <= dc - 10) outcomeRank = 1;
    if (d20 === 20) outcomeRank = Math.min(4, outcomeRank + 1);
    if (d20 === 1) outcomeRank = Math.max(1, outcomeRank - 1);

    const baseGain = outcomeRank >= 3 ? rules.gainOnSuccess : rules.gainOnFailure;
    const critAdjust = outcomeRank === 4 ? -2 : (outcomeRank === 1 ? 1 : 0);
    let gain = Math.max(0, baseGain + critAdjust);
    const oldDoping = playerData.doping;
    const oldOo = playerData.oo;

    if (outcomeRank === 4) playerData.doping += 1;
    if (outcomeRank === 1) playerData.doping = Math.max(0, playerData.doping - 1);
    if (playerData.nextRoundEffects?.ooReduction) gain = Math.max(0, gain - 1);
    if (playerData.isLorePenalty) {
      gain += 2;
      playerData.isLorePenalty = false;
    }

    playerData.oo += gain;

    playerData.nextRoundEffects = {};
    playerData.nextDopingPower = 1;

    const success = outcomeRank >= 3;
    const effectText = success ? technique.successText : technique.failureText;
    const flavorPool = success ? technique.flavorSuccess : technique.flavorFailure;
    const flavorTemplate = Array.isArray(flavorPool) ? randomChoice(flavorPool, "") : flavorPool;
    const flavorText = String(flavorTemplate || "").replace("{n}", `<b>${escapeHtml(playerData.name)}</b>`);
    let extra = "";
    const randomOpponentId = getRandomOpponentId(state, actorId);
    const randomOpponent = randomOpponentId ? state.players?.[randomOpponentId] : null;

    switch (techId) {
      case "ath":
        playerData.nextRoundEffects.dcMod = success ? -2 : 2;
        break;
      case "acr":
        if (success && randomOpponent) {
          randomOpponent.nextRoundEffects.handSize = 2;
          extra = tf("EffectOpponentHand", { name: randomOpponent.name });
        } else if (!success) {
          playerData.nextRoundEffects.handSize = 2;
        }
        break;
      case "thi":
        if (success && randomOpponent) {
          randomOpponent.oo += 1;
          extra = tf("EffectOpponentOoPlus", { name: randomOpponent.name });
        } else if (!success) {
          playerData.oo += 1;
        }
        break;
      case "ste":
        if (success) playerData.isDopingImmune = true;
        else playerData.dopingEffectX2 = true;
        break;
      case "arc":
        if (success) playerData.nextRoundEffects.fortune = true;
        else if (randomOpponent) {
          randomOpponent.nextRoundEffects.fortune = true;
          extra = tf("EffectOpponentFortune", { name: randomOpponent.name });
        }
        break;
      case "occ":
        if (success) playerData.nextRoundEffects.ooReduction = true;
        else playerData.nextRoundEffects.handSize = 1;
        break;
      case "rel":
        playerData.permDCMod += success ? -1 : 1;
        break;
      case "nat":
        playerData.oo = Math.max(0, playerData.oo + (success ? -1 : 1));
        break;
      case "soc":
        if (success) {
          for (const otherId of activeIds) {
            if (otherId === actorId) continue;
            state.players[otherId].nextRoundEffects.dcMod = 1;
          }
          extra = tx("EffectAllOpponentsDc");
        } else {
          playerData.nextRoundEffects.dcMod = 2;
        }
        break;
      case "dec":
        if (success && randomOpponent) {
          randomOpponent.doping = Math.max(0, randomOpponent.doping - 1);
          extra = tf("EffectOpponentDopingMinus", { name: randomOpponent.name });
        } else if (!success) {
          playerData.doping = Math.max(0, playerData.doping - 1);
        }
        break;
      case "dip":
        if (success) {
          playerData.oo = Math.max(0, playerData.oo - 1);
          if (randomOpponent) {
            randomOpponent.oo = Math.max(0, randomOpponent.oo - 1);
            extra = tf("EffectOpponentOoMinus", { name: randomOpponent.name });
          }
        } else if (playerData.lastDopingTarget && state.players?.[playerData.lastDopingTarget]) {
          state.players[playerData.lastDopingTarget].doping += 1;
          extra = tf("EffectOpponentDopingPlus", { name: state.players[playerData.lastDopingTarget].name });
        }
        break;
      case "itm":
        if (success && randomOpponent && playerData.oo > 0) {
          playerData.oo -= 1;
          randomOpponent.oo += 1;
          extra = tf("EffectOpponentGetsOo", { name: randomOpponent.name });
        } else if (!success && randomOpponent && randomOpponent.oo > 0) {
          randomOpponent.oo -= 1;
          playerData.oo += 1;
          extra = tf("EffectOpponentLosesOo", { name: randomOpponent.name });
        }
        break;
      case "per":
        if (success) playerData.doping += 2;
        else playerData.doping = 0;
        break;
      case "med":
        playerData.oo = Math.max(0, playerData.oo + (success ? -1 : 1));
        break;
      case "sur":
        playerData.limit = Math.max(1, playerData.limit + (success ? 1 : -1));
        break;
      case "crf":
        playerData.nextDopingPower = success ? 3 : -3;
        break;
      case "prc":
        if (success && randomOpponent) {
          randomOpponent.nextRoundEffects.misfortune = true;
          extra = tf("EffectOpponentMisfortune", { name: randomOpponent.name });
        } else if (!success) {
          playerData.nextRoundEffects.misfortune = true;
        }
        break;
      case "lor":
        if (success) {
          playerData.oo = Math.max(0, playerData.oo - 1);
          playerData.doping += 1;
        } else {
          playerData.isLorePenalty = true;
        }
        break;
      default:
        break;
    }

    const outcome = getOutcomeData(outcomeRank);
    pushLog(state, buildTechniqueLog(playerData, technique, outcome, {
      rollType,
      dice,
      d20,
      modifier,
      total: roll.total,
      dc,
      dcCalc: dcParts.join(" · "),
      gain,
      oldOo,
      oldDoping,
      extra,
      flavor: flavorText,
      effect: `${effectText}${extra ? ` | ${extra}` : ""}`,
    }));
  }
}

function allActivePlayersConfirmed(state) {
  const activeIds = getActivePlayerIds(state);
  if (!activeIds.length) return false;
  return activeIds.every((actorId) => {
    const playerData = state.players?.[actorId];
    return playerData?.isConfirmed && TECHNIQUES[playerData?.selectedTech || playerData?.hand?.[0]];
  });
}

function clearPlayerForNewGame(playerData, actor) {
  const fresh = createPlayerState(actor || { id: playerData.id, name: playerData.name, img: playerData.img }, {
    isParticipating: playerData.isParticipating,
    source: playerData.source ?? "manual",
  });
  playerData.name = fresh.name;
  playerData.img = fresh.img;
  playerData.level = fresh.level;
  playerData.oo = 0;
  playerData.limit = fresh.limit;
  playerData.doping = 1;
  playerData.signature = "";
  playerData.currentDCMod = 0;
  playerData.permDCMod = 0;
  playerData.roundPool = [];
  playerData.hand = [];
  playerData.selectedTech = "";
  playerData.isConfirmed = false;
  playerData.nextRoundEffects = {};
  playerData.isEliminated = false;
  playerData.lastDopingTarget = "";
  playerData.nextDopingPower = 1;
  playerData.dopingEffectX2 = false;
  playerData.isDopingImmune = false;
  playerData.isLorePenalty = false;
}

function buildRulesSections(state) {
  const round1Dc = getRoundBaseDc(state, 1);
  const round2Dc = getRoundBaseDc(state, 2);
  const round3Dc = getRoundBaseDc(state, 3);
  return [
    {
      title: gt(definition, "Rules.RoundTitle", "Раунды"),
      items: [
        { label: "R1", copy: `${isRussianLocale() ? "КС" : "DC"} ${round1Dc} · ${tx("RuleRound1")}` },
        { label: "R2", copy: `${isRussianLocale() ? "КС" : "DC"} ${round2Dc} · ${tx("RuleRound2")}` },
        { label: "R3", copy: `${isRussianLocale() ? "КС" : "DC"} ${round3Dc} · ${tx("RuleRound3")}` },
      ],
    },
    {
      title: gt(definition, "Rules.CoreTitle", "Основа"),
      items: [
        { label: tx("RuleLimitLabel"), copy: gt(definition, "Rules.Limit", "Телосложение × 2, минимум 2") },
        { label: tx("RuleHandLabel"), copy: gt(definition, "Rules.Hand", "Обычно 3 техники. Перед забегом можно выбрать коронную технику, и в руку она войдёт только в 1 и 3 раунде.") },
        { label: tx("RuleWinLabel"), copy: gt(definition, "Rules.Win", "Последний на ногах или наименьшие ОО после 3 раунда.") },
      ],
    },
    {
      title: gt(definition, "Rules.DopingTitle", "Допинг"),
      items: [
        { label: "🧪", copy: gt(definition, "Rules.Doping", "Нажмите «Допинг» на своей карточке, затем выберите цель. На себя он уменьшает КС, на соперника — повышает.") },
      ],
    },
  ];
}

function buildHelpHtml() {
  const techniqueItems = TECHNIQUE_ORDER.map((techId) => {
    const technique = getTechniqueData(techId);
    return `
      <div class="bf-help-tech">
        <div class="bf-help-tech__head"><i class="fas ${technique.icon}"></i> <b>${escapeHtml(technique.name)}</b></div>
        <div>${escapeHtml(tx("UiSuccess"))} ${escapeHtml(technique.successText)}</div>
        <div>${escapeHtml(tx("UiFailure"))} ${escapeHtml(technique.failureText)}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="tsu-dialog-content bf-help">
      <p>${tf("HelpIntro", { title: `<b>${escapeHtml(gt(definition, "Title", GAME_TITLE))}</b>` })}</p>
      <p>${tx("HelpGoal")}</p>
      <p>${tx("HelpCrits")}</p>
      <h3>${escapeHtml(tx("HelpTechniques"))}</h3>
      ${techniqueItems}
    </div>
  `;
}

const template = `
<div class="tsu-game tsu-beer-furious {{#if isDopingMode}}bf-is-doping{{/if}}" id="beer-furious-app">
  <section class="tsu-panel tsu-panel--rules bf-col-rules">
    <div class="tsu-panel-title bf-rule-headline">
      <span>{{ui.rulesTitle}}</span>
      {{#if isGM}}<input type="number" class="bf-dc-input" min="1" max="99" step="1" value="{{dcInputValue}}" placeholder="{{dcPlaceholder}}">{{/if}}
      <button type="button" class="tsu-help-button bf-rules-help" data-action="help">?</button>
    </div>
    {{#each ui.ruleSections}}
      <div class="tsu-rule-block">
        <h3 class="tsu-rule-header">{{title}}</h3>
        <div class="tsu-rule-list">
          {{#each items}}
            <div class="tsu-rule-item bf-rule-item">
              <div class="bf-rule-item__label">{{label}}</div>
              <div class="bf-rule-item__copy">{{copy}}</div>
            </div>
          {{/each}}
        </div>
      </div>
    {{/each}}
  </section>

  <section class="tsu-panel tsu-panel--main bf-col-main" id="bf-main-area">
    <div class="tsu-game-header bf-header">
      <h2>{{ui.title}}</h2>
      {{#if statusLine}}<div class="tsu-status-line">{{statusLine}}</div>{{/if}}
    </div>
    {{#if showEmptyState}}<div class="tsu-empty-state bf-empty-state">{{emptyState}}</div>{{/if}}
    <div class="tsu-player-list">
      {{#each players}}
        <article class="tsu-player-card bf-player-card {{classes}}" data-actor-card="{{id}}">
          <div class="bf-card-headrail">
            {{#if showConfirmButton}}
              <button type="button" class="tsu-button bf-confirm-btn {{confirmClasses}}" data-action="confirm-choice" data-actor-id="{{id}}" {{#if confirmDisabled}}disabled{{/if}}>{{confirmLabel}}</button>
            {{/if}}
            <div class="tsu-badge bf-oo-badge">{{ooBadge}}</div>
          </div>
          {{#if showRemove}}
            <button type="button" class="tsu-icon-button bf-remove-btn {{#if removeDisabled}}is-disabled disabled{{/if}}" data-action="remove-player" data-actor-id="{{id}}" {{#if removeDisabled}}disabled{{/if}}><i class="fas fa-times"></i></button>
          {{/if}}
          <div class="tsu-player-card-top">
            <img class="tsu-avatar" src="{{img}}" alt="{{name}}">
            <div class="tsu-player-meta">
              <div class="tsu-player-name">{{name}}</div>
              <div class="tsu-player-subline">
                {{#if joinCheckbox}}
                  <label class="tsu-checkbox bf-join-label"><input type="checkbox" class="tsu-join-toggle" data-actor-id="{{id}}" {{#if isParticipating}}checked{{/if}}> <span>{{joinLabel}}</span></label>
                {{/if}}
                {{#if spectatorLabel}}<span class="tsu-chip bf-chip">{{spectatorLabel}}</span>{{/if}}
                {{#if statusText}}<span class="tsu-chip bf-chip">{{statusText}}</span>{{/if}}
                <span class="tsu-chip bf-chip">🍺 {{dopingLabel}}</span>
                {{#each statusBadges}}<span class="tsu-chip bf-chip {{classes}}">{{label}}</span>{{/each}}
              </div>
            </div>
          </div>

          <div class="bf-bar">
            <div class="bf-bar__fill" style="width:{{ooPct}}%;"></div>
          </div>

          {{#if showSignatureControls}}
            <div class="bf-signature-row">
              <span>{{signatureLabel}}</span>
              <select class="bf-signature-select" data-actor-id="{{id}}">
                {{#each signatureOptions}}
                  <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
                {{/each}}
              </select>
            </div>
          {{/if}}

          {{#if showSignatureWaitingText}}
            <div class="bf-waiting">{{signatureWaitingText}}</div>
          {{/if}}

          {{#if showActionArea}}
            {{#if showWaitingText}}
              <div class="bf-waiting">{{waitingText}}</div>
            {{else}}
              {{#if selectedTechnique}}
                <div class="bf-tech-preview">
                  <div class="bf-tech-preview__title"><i class="fas {{selectedTechnique.icon}}"></i> {{selectedTechnique.name}}</div>
                  <div class="bf-tech-preview__copy">
                    <div><b>{{selectedTechnique.successLabel}}</b> {{selectedTechnique.successText}}</div>
                    <div><b>{{selectedTechnique.failureLabel}}</b> {{selectedTechnique.failureText}}</div>
                  </div>
                </div>
              {{/if}}
              {{#if handButtons.length}}
                <div class="tsu-grid-buttons tsu-grid-buttons--3 bf-tech-grid">
                  {{#each handButtons}}
                    <button type="button" class="tsu-chip bf-tech-btn {{classes}}" data-action="select-technique" data-actor-id="{{../id}}" data-tech-id="{{id}}" {{#if disabled}}disabled{{/if}}>
                      <i class="fas {{icon}}"></i>
                      <span>{{name}}</span>
                      <small>{{modLabel}}</small>
                    </button>
                  {{/each}}
                </div>
              {{/if}}
            {{/if}}
          {{/if}}

          {{#if showDopingButton}}
            <div class="bf-doping-row">
              <button type="button" class="tsu-small-button bf-doping-btn {{dopingButtonClasses}}" data-action="prepare-doping" data-actor-id="{{id}}" {{#if dopingButtonDisabled}}disabled{{/if}}>
                {{dopingButtonLabel}}
              </button>
            </div>
          {{/if}}
        </article>
      {{/each}}
    </div>
  </section>

  <section class="tsu-panel tsu-panel--log bf-col-log" id="bf-log-area">
    <h3 class="tsu-panel-title">{{ui.logTitle}}</h3>
    <div class="tsu-log-list">
      {{#each state.log}}
        {{{this}}}
      {{/each}}
    </div>
  </section>

  <div class="tsu-footer bf-footer">
    <div class="bf-footer-settings">
      {{#if isGM}}
        <label class="tsu-checkbox bf-debug-label"><input type="checkbox" id="bf-debug-mode" {{#if state.debugMode}}checked{{/if}}> {{ui.debugLabel}}</label>
      {{/if}}
      {{#if dopingModeText}}<span class="bf-doping-mode">{{dopingModeText}}</span>{{/if}}
    </div>
    <div class="tsu-footer-actions">
      {{#each footerButtons}}
        <button type="button" class="tsu-button bf-btn {{classes}}" data-action="{{action}}" {{#if disabled}}disabled{{/if}}>
          {{label}}
        </button>
      {{/each}}
    </div>
  </div>
</div>`;

class BeerFuriousApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      classes: ["tsu-window"],
      title: gt(definition, "Title", GAME_TITLE),
      width: 1460,
      height: 860,
      resizable: true,
      popOut: true,
      dragDrop: [{ dragSelector: null, dropSelector: ".window-content" }],
    });
  }

  constructor(...args) {
    super(...args);
    this.pendingDopingSource = "";
  }

  _canDragDrop(_selector) {
    return true;
  }

  getState() {
    return getGameState(GAME_ID) ?? createInitialState();
  }

  async _renderInner(data) {
    return $(Handlebars.compile(template)(data));
  }

  async refresh() {
    if (!this.rendered || !this.element?.length) return;
    const nextRoot = await this._renderInner(this.getData());
    const patched = patchApplicationRegions(this, "#beer-furious-app", [
      ".bf-col-rules",
      "#bf-main-area",
      "#bf-log-area",
      ".bf-footer",
    ], nextRoot);
    if (!patched) {
      this.render(false);
      return;
    }
    this.applyLocalizedPreviewLabels(this.element);
  }

  getData() {
    const state = this.getState();
    normalizeRoundStage(state);
    const entries = Object.entries(state.players ?? {});
    for (const [actorId, playerData] of entries) {
      normalizePlayerState(playerData, game.actors?.get(actorId));
    }

    const activeIds = getActivePlayerIds(state);
    const baseDc = getRoundBaseDc(state);
    const pinnedActorId = getPinnedPlayerActorIdForDisplay(entries, game.user);
    const players = entries
      .filter(([actorId, playerData]) => !state.excludedPlayers?.[actorId] || playerData?.source === "manual")
      .sort((left, right) => comparePlayerEntriesForDisplay(left, right, { state, user: game.user, locale: game.i18n?.lang || "en", pinnedActorId }))
      .map(([actorId, playerData]) => this.createPlayerPresentation(state, actorId, playerData));

    const footerButtons = [];
    if (game.user?.isGM) {
      const mainButton = {
        action: "advance-phase",
        label: tx("FooterMain"),
        classes: "is-main",
        disabled: false,
      };

      if (state.phase === "play") {
        mainButton.disabled = !allActivePlayersConfirmed(state);
      } else {
        mainButton.disabled = activeIds.length === 0;
      }
      if (state.phase === "results") {
        mainButton.disabled = true;
      }

      footerButtons.push(mainButton);
      footerButtons.push({
        action: "clear",
        label: tx("FooterClear"),
        classes: "is-clear",
        disabled: false,
      });
      footerButtons.push({
        action: "reset-game",
        label: tx("FooterReset"),
        classes: "is-reset",
      });
    }

    for (const button of footerButtons) {
      if (button.action === "advance-phase") {
        if (state.phase === "join") button.label = gt(definition, "Buttons.Start", isRussianLocale() ? "Начать" : "Start");
        else button.label = tx("FooterMain");
      }
      if (button.action === "clear") button.label = tx("FooterClear");
      if (button.action === "reset-game") button.label = tx("FooterReset");
    }
    const showEmptyState = players.length === 0;
    const ruleSections = buildRulesSections(state);
    if (ruleSections[0]?.items?.length > 3) ruleSections[0].items = ruleSections[0].items.slice(-3);
    const emptyState = gt(definition, "Empty.Join", "Добавьте игроков перетаскиванием или включите их участие перед стартом.");
    return {
      state,
      players,
      ui: {
        successLabel: tx("UiSuccess"),
        failureLabel: tx("UiFailure"),
        title: gt(definition, "Title", GAME_TITLE),
        rulesTitle: gt(definition, "Rules.PanelTitle", "Правила"),
        ruleSections,
        logTitle: gt(definition, "Log.Title", "Хроника"),
        debugLabel: gt(definition, "DebugMode", "Режим ГМ"),
      },
      statusLine: state.phase === "play"
        ? gtf(definition, "Status.Round", { round: state.round, dc: baseDc }, ({ round, dc }) => `Раунд ${round} · Базовый КС ${dc}`)
        : (state.phase === "results" ? gt(definition, "Status.Results", "Итоги") : gt(definition, "Status.Join", "Подготовка")),
      showEmptyState,
      emptyState,
      dcInputValue: hasManualSupportDcOverride(state) ? `${getManualSupportDcRoundOne(state)}` : "",
      dcPlaceholder: isRussianLocale() ? `КС ${getSuggestedSupportDcRoundOne(state)}` : `DC ${getSuggestedSupportDcRoundOne(state)}`,
      isGM: game.user?.isGM,
      isDopingMode: Boolean(this.pendingDopingSource),
      dopingModeText: this.pendingDopingSource
        ? gtf(definition, "Status.DopingMode", { name: state.players?.[this.pendingDopingSource]?.name || "" }, ({ name }) => `Выберите цель для допинга: ${name}`)
        : "",
      statusLine: getDisplayStatusLine(state, baseDc),
      footerButtons,
    };
  }

  createPlayerPresentation(state, actorId, playerData) {
    const actor = game.actors?.get(actorId);
    const canOperate = canCurrentUserOperateActor(actor, state);
    const isGM = Boolean(game.user?.isGM);
    const isPlayPhase = state.phase === "play";
    const isJoinPhase = state.phase === "join";
    const isResultsPhase = state.phase === "results";
    const isTechniqueStage = isPlayPhase;
    const canShowChoices = canOperate || (isGM && state.debugMode);
    const selectedTechnique = playerData.selectedTech ? getTechniqueData(playerData.selectedTech) : null;
    const statusBadges = [];
    if (playerData.nextRoundEffects?.fortune) statusBadges.push({ label: "Удача", classes: "is-fortune" });
    if (playerData.nextRoundEffects?.misfortune) statusBadges.push({ label: "Неудача", classes: "is-misfortune" });
    if (playerData.isDopingImmune) statusBadges.push({ label: "Иммунитет", classes: "is-immune" });
    if (playerData.dopingEffectX2) statusBadges.push({ label: "×2 допинг", classes: "is-danger" });
    for (const badge of statusBadges) {
      if (badge.classes === "is-fortune") badge.label = tx("BadgeFortune");
      if (badge.classes === "is-misfortune") badge.label = tx("BadgeMisfortune");
      if (badge.classes === "is-immune") badge.label = tx("BadgeImmune");
      if (badge.classes === "is-danger") badge.label = tx("BadgeDopingX2");
    }
    const handButtons = canShowChoices && isTechniqueStage && playerData.isParticipating && !playerData.isEliminated && !playerData.isConfirmed
      ? playerData.hand.map((techId) => {
        const technique = getTechniqueData(techId);
        return {
          id: techId,
          icon: technique.icon,
          name: technique.name,
          modLabel: formatSignedNumber(getTechniqueModifier(actor, technique)),
          classes: playerData.selectedTech === techId ? "is-selected" : "",
          disabled: false,
        };
      })
      : [];
    const ooPct = Math.min(100, ((playerData.oo || 0) / Math.max(1, playerData.limit || 1)) * 100);
    const results = state.results ?? { winners: [] };
    const isWinner = results.winners?.includes(actorId);

    return {
      id: actorId,
      name: playerData.name,
      img: actor?.img || playerData.img || DEFAULT_IMG,
      isParticipating: playerData.isParticipating,
      ooPct,
      ooBadge: tf("OoBadge", { current: playerData.oo, limit: playerData.limit }),
      dopingLabel: tf("DopingBadge", { count: playerData.doping }),
      joinCheckbox: isJoinPhase && (canOperate || isGM),
      joinLabel: gt(definition, "JoinLabel", "Я в игре"),
      showSignatureControls: isJoinPhase && canShowChoices,
      signatureLabel: gt(definition, "Signature", "Коронная техника"),
      signatureOptions: [
        { value: "", label: gt(definition, "SignatureEmpty", "Без коронной"), selected: !playerData.signature },
        ...TECHNIQUE_ORDER.map((techId) => ({
          value: techId,
          label: getTechniqueData(techId).name,
          selected: playerData.signature === techId,
        })),
      ],
      spectatorLabel: !playerData.isParticipating ? gt(definition, "Spectator", "Наблюдает") : "",
      statusText: playerData.isEliminated
        ? gt(definition, "Status.Eliminated", "В отключке")
        : (playerData.isConfirmed ? gt(definition, "Status.Confirmed", "Выбор подтверждён") : ""),
      statusBadges,
      showActionArea: isPlayPhase && playerData.isParticipating,
      showWaitingText: isPlayPhase && !canShowChoices,
      waitingText: gt(definition, "Status.Waiting", "Игрок выбирает технику..."),
      showSignatureWaitingText: false,
      signatureWaitingText: gt(definition, "Status.WaitingSignature", "Игрок выбирает коронную технику..."),
      selectedTechnique: isTechniqueStage && selectedTechnique ? {
        icon: selectedTechnique.icon,
        name: selectedTechnique.name,
        successLabel: tx("UiSuccess"),
        failureLabel: tx("UiFailure"),
        successText: selectedTechnique.successText,
        failureText: selectedTechnique.failureText,
      } : null,
      handButtons,
      showConfirmButton: isPlayPhase && canShowChoices && playerData.isParticipating && !playerData.isEliminated,
      confirmLabel: playerData.isConfirmed ? gt(definition, "Buttons.Confirmed", "Подтверждено") : gt(definition, "Buttons.Confirm", "Подтвердить"),
      confirmClasses: playerData.isConfirmed ? "is-confirmed" : "",
      confirmDisabled: playerData.isConfirmed || !TECHNIQUES[playerData.selectedTech || playerData.hand?.[0]],
      showDopingButton: isPlayPhase && canShowChoices && playerData.isParticipating && !playerData.isEliminated,
      dopingButtonLabel: this.pendingDopingSource === actorId
        ? gt(definition, "Buttons.CancelDoping", "Отмена допинга")
        : gtf(definition, "Buttons.Doping", { count: playerData.doping }, ({ count }) => `Допинг ×${count}`),
      dopingButtonClasses: this.pendingDopingSource === actorId ? "is-selected" : "",
      dopingButtonDisabled: playerData.doping <= 0,
      showRemove: isJoinPhase && isGM,
      removeDisabled: false,
      classes: [
        playerData.isParticipating ? "tsu-player-card--active" : "tsu-player-card--spectator",
        playerData.isConfirmed ? "tsu-player-card--confirmed" : "",
        playerData.isEliminated ? "bf-player-card--eliminated tsu-player-card--loser" : "",
        isWinner ? "tsu-player-card--winner" : "",
        isResultsPhase && !isWinner && !playerData.isEliminated && playerData.isParticipating ? "tsu-player-card--loser" : "",
      ].filter(Boolean).join(" "),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.applyLocalizedPreviewLabels(html);

    html.on("click", "[data-action]", (event) => this.onActionClick(event));
    html.on("change", ".tsu-join-toggle", (event) => {
      void requestGameAction(GAME_ID, "toggle-join", {
        actorId: event.currentTarget.dataset.actorId,
        isParticipating: event.currentTarget.checked,
      });
    });
    html.on("change", ".bf-signature-select", (event) => {
      void requestGameAction(GAME_ID, "set-signature", {
        actorId: event.currentTarget.dataset.actorId,
        signature: event.currentTarget.value,
      });
    });
    html.on("change", "#bf-debug-mode", (event) => {
      if (!game.user?.isGM) return;
      void requestGameAction(GAME_ID, "toggle-debug", { enabled: event.currentTarget.checked });
    });
    html.on("change", ".bf-dc-input", (event) => {
      if (!game.user?.isGM) return;
      const rawValue = String(event.currentTarget.value ?? "").trim();
      if (!rawValue) {
        void requestGameAction(GAME_ID, "set-dc", { auto: true });
        return;
      }
      const value = Math.trunc(Number(rawValue));
      if (!Number.isFinite(value) || value < 1) return;
      void requestGameAction(GAME_ID, "set-dc", { value });
    });
    html.on("keydown", ".bf-dc-input", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.currentTarget.blur();
    });
    html.on("click", "[data-actor-card]", (event) => {
      const card = event.currentTarget;
      if (!this.pendingDopingSource) return;
      const targetId = card.dataset.actorCard;
      if (!targetId) return;
      void this.resolveDopingTarget(targetId);
    });
    html.on("dragover", (event) => {
      event.preventDefault();
    });
    html.on("drop", (event) => {
      event.preventDefault();
      void this._onDrop(event.originalEvent ?? event);
    });
  }

  onActionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (!action) return;

    switch (action) {
      case "help":
        new Dialog({
          title: gt(definition, "Rules.HelpTitle", GAME_TITLE),
          content: buildHelpHtml(),
          buttons: {
            close: {
              label: gt(definition, "Buttons.CloseRules", "Закрыть"),
            },
          },
        }).render(true);
        break;
      case "select-technique":
        void requestGameAction(GAME_ID, "select-technique", {
          actorId: button.dataset.actorId,
          techId: button.dataset.techId,
        });
        break;
      case "confirm-choice":
        void requestGameAction(GAME_ID, "confirm-choice", {
          actorId: button.dataset.actorId,
        });
        break;
      case "prepare-doping":
        this.toggleDopingMode(button.dataset.actorId);
        break;
      case "advance-phase":
        this.pendingDopingSource = "";
        void requestGameAction(GAME_ID, "advance-phase", {});
        break;
      case "clear":
        this.pendingDopingSource = "";
        void requestGameAction(GAME_ID, "clear", {});
        break;
      case "reset-game":
        this.pendingDopingSource = "";
        void requestGameAction(GAME_ID, "reset-game", {});
        break;
      case "remove-player":
        this.pendingDopingSource = "";
        void requestGameAction(GAME_ID, "remove-player", {
          actorId: button.dataset.actorId,
        });
        break;
      default:
        break;
    }
  }

  toggleDopingMode(actorId) {
    const state = this.getState();
    if (!actorId || !state.players?.[actorId]) return;
    if (this.pendingDopingSource === actorId) {
      this.pendingDopingSource = "";
      this.render(false);
      return;
    }
    if ((state.players[actorId].doping || 0) <= 0) return;
    this.pendingDopingSource = actorId;
    this.render(false);
  }

  async resolveDopingTarget(targetId) {
    const sourceId = this.pendingDopingSource;
    if (!sourceId || !targetId) return;
    this.pendingDopingSource = "";
    await requestGameAction(GAME_ID, "use-doping", {
      actorId: sourceId,
      targetId,
    });
    this.render(false);
  }

  async _onDrop(event) {
    if (!game.user?.isGM) return;
    const uuid = getActorUuidFromDropData(TextEditor.getDragEventData(event));
    if (!uuid) return;
    await requestGameAction(GAME_ID, "add-actor", { uuid });
  }

  applyLocalizedPreviewLabels(html) {
    if (!html?.length) return;
    const labels = [tx("UiSuccess"), tx("UiFailure")];
    html.find(".bf-tech-preview__copy").each((_index, element) => {
      $(element).find("div > b").each((labelIndex, node) => {
        if (labels[labelIndex]) $(node).text(labels[labelIndex]);
      });
    });
  }
}

const definition = {
  id: GAME_ID,
  i18nRoot: I18N_ROOT,
  createInitialState,
  ensureDefaultPlayers,
  syncDefaultPlayers,
  createApplication: () => new BeerFuriousApplication(),
  async handleAction({ action, data, state, senderId, canUserControlActor }) {
    const sender = game.users?.get(senderId);
    const senderIsGM = Boolean(sender?.isGM);
    normalizeRoundStage(state);

    switch (action) {
      case "toggle-join": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || state.phase !== "join" || !canSenderToggleJoin(data.actorId, senderId, canUserControlActor)) return false;
        playerData.isParticipating = Boolean(data.isParticipating);
        return true;
      }
      case "set-signature": {
        const playerData = state.players?.[data.actorId];
        const canSetInJoin = state.phase === "join";
        if (!playerData || !canSetInJoin || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        playerData.signature = TECHNIQUES[data.signature] ? data.signature : "";
        return true;
      }
      case "select-technique": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || state.phase !== "play" || playerData.isConfirmed || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        if (!playerData.hand?.includes(data.techId)) return false;
        playerData.selectedTech = data.techId;
        return true;
      }
      case "confirm-choice": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || state.phase !== "play" || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        const selected = playerData.selectedTech || playerData.hand?.[0];
        if (!TECHNIQUES[selected]) return false;
        playerData.selectedTech = selected;
        playerData.isConfirmed = true;
        return true;
      }
      case "toggle-debug":
        if (!senderIsGM) return false;
        state.debugMode = Boolean(data.enabled);
        return true;
      case "set-dc":
        if (!senderIsGM) return false;
        if (data.auto) {
          state.supportDcOverride = null;
          return true;
        }
        state.supportDcOverride = Math.max(1, Math.min(99, Math.trunc(Number(data.value) || 0)));
        return Boolean(state.supportDcOverride);
      case "use-doping": {
        const source = state.players?.[data.actorId];
        const target = state.players?.[data.targetId];
        if (!source || !target || state.phase !== "play" || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        if (!source.isParticipating || source.isEliminated || source.doping <= 0) return false;
        if (!target.isParticipating || target.isEliminated) return false;

        source.doping -= 1;
        source.lastDopingTarget = data.targetId;
        let power = source.nextDopingPower || 1;
        if (target.dopingEffectX2 && data.targetId !== data.actorId) power = 2;

        if (target.isDopingImmune && data.targetId !== data.actorId) {
          pushLog(state, buildDopingImmuneLog(target.name));
          return true;
        }

        const modifier = data.targetId === data.actorId ? -power : power;
        target.currentDCMod = Number(target.currentDCMod || 0) + modifier;
        pushLog(state, buildDopingLog(source.name, target.name, modifier));
        return true;
      }
      case "advance-phase": {
        if (!senderIsGM) return false;

        if (state.phase === "join") {
          const activeIds = Object.keys(state.players ?? {}).filter((actorId) => state.players?.[actorId]?.isParticipating);
          if (!activeIds.length) {
            ui.notifications?.warn(gt(definition, "Warnings.NoPlayers", "Добавьте хотя бы одного участника перед стартом."));
            return false;
          }
          state.phase = "play";
          state.round = 1;
          state.results = null;
          setupRound(state);
          return true;
        }

        if (state.phase === "play") {
          if (!allActivePlayersConfirmed(state)) {
            ui.notifications?.warn(gt(definition, "Warnings.NotReady", "Сначала все участники должны выбрать и подтвердить технику."));
            return false;
          }
          await processRound(state);
          checkEliminations(state);
          const survivors = getActivePlayerIds(state);
          if (state.round < 3 && survivors.length > 1) {
            state.round += 1;
            setupRound(state);
          } else {
            state.phase = "results";
            finalizeGame(state);
          }
          return true;
        }

        if (state.phase === "results") {
          state.phase = "join";
          state.round = 1;
          state.results = null;
          state.log = [gt(definition, "Log.Cleared", "<div class='tsu-log-entry'>Стол очищен.</div>")];
          for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
            clearPlayerForNewGame(playerData, game.actors?.get(actorId));
          }
          return true;
        }

        return false;
      }
      case "reset-game":
        if (!senderIsGM) return false;
        replaceStateContents(state, createInitialState());
        return true;
      case "clear":
        if (!senderIsGM) return false;
        state.phase = "join";
        state.round = 1;
        state.results = null;
        state.log = [gt(definition, "Log.Cleared", "<div class='tsu-log-entry'>Стол очищен.</div>")];
        for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
          clearPlayerForNewGame(playerData, game.actors?.get(actorId));
        }
        return true;
      case "remove-player":
        if (!senderIsGM || !state.players?.[data.actorId]) return false;
        state.excludedPlayers ||= {};
        state.excludedPlayers[data.actorId] = true;
        delete state.players[data.actorId];
        return true;
      case "add-actor": {
        if (!data.uuid) return false;
        const actors = await getDroppedActors(data.uuid);
        if (!actors.length) return false;
        let changed = false;
        for (const actor of actors) {
          if (!senderIsGM && !canUserControlActor(actor.id, senderId)) continue;
          state.excludedPlayers ||= {};
          delete state.excludedPlayers[actor.id];
          if (!state.players?.[actor.id]) {
            await addActorToState(state, actor, { isParticipating: actor.type === "npc", source: "manual" });
            changed = true;
            continue;
          }
          normalizePlayerState(state.players[actor.id], actor);
          state.players[actor.id].source = "manual";
          if (actor.type === "npc") state.players[actor.id].isParticipating = true;
          changed = true;
        }
        return changed;
      }
      default:
        return false;
    }
  },
};

export function createBeerFuriousGameDefinition() {
  return definition;
}
