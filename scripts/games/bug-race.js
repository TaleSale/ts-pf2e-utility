import {
  comparePlayerEntriesForDisplay,
  escapeHtml,
  getDroppedActors,
  getGameState,
  getNonGmCharacters,
  getPinnedPlayerActorIdForDisplay,
  MODULE_ID,
  patchApplicationRegions,
  randomChoice,
  requestGameAction,
  userCanControlActor,
} from "../core.js";

const GAME_ID = "bug-race";
const APP_ID = `${MODULE_ID}-${GAME_ID}`;
const GAME_TITLE = "Cockroach Dash";
const DEFAULT_IMG = "icons/svg/mystery-man.svg";
const BUG_ICON = "icons/creatures/invertebrates/beetle-stag-tan-brown.webp";
const BUG_ITEM_TYPE = "racing_cockroach_v14";
const LEGACY_ITEM_SCOPE = "world";
const ROUND_SUPPORT_DCS = [15, 20, 25];
const OBSTACLE_DCS = Object.freeze({ 1: 12, 2: 17, 3: 22 });
const STATUS_BY_PHASE = Object.freeze({
  join: "Подготовка забега",
  support: "Выбор техник",
  obstacle: "Препятствие",
  sprint: "Спринт",
  upgrade: "Награда победителя",
  results: "Итоги забега",
});
const BUG_NAMES = Object.freeze([
  "Борис",
  "Шумахер",
  "Турбо-Ус",
  "Кипиш",
  "Ракета",
  "Зенит",
  "Стасик",
  "Феррари",
  "Метеор",
  "Титан",
  "Вспышка",
  "Болт",
  "Самурай",
  "Ниндзя",
  "Адмирал",
  "Молния",
  "Вихрь",
  "Стриж",
  "Дизель",
  "Нитро",
  "Форсаж",
  "Шустрик",
  "Живчик",
  "Ураган",
  "Торпеда",
  "Стрела",
  "Комета",
  "Фантом",
  "Призрак",
  "Мираж",
  "Шелест",
  "Шепот",
  "Панцирь",
  "Хитин",
  "Усач",
  "Рыжик",
  "Прусак",
  "Ахиллес",
  "Гермес",
  "Спиди",
]);
const BUG_NAMES_EN = Object.freeze([
  "Boris",
  "Schumacher",
  "Turbo Whisker",
  "Ruckus",
  "Rocket",
  "Zenith",
  "Stas",
  "Ferrari",
  "Meteor",
  "Titan",
  "Flash",
  "Bolt",
  "Samurai",
  "Ninja",
  "Admiral",
  "Lightning",
  "Whirlwind",
  "Swift",
  "Diesel",
  "Nitro",
  "Dash",
  "Quickster",
  "Spry",
  "Hurricane",
  "Torpedo",
  "Arrow",
  "Comet",
  "Phantom",
  "Ghost",
  "Mirage",
  "Rustle",
  "Whisper",
  "Carapace",
  "Chitin",
  "Whiskers",
  "Red",
  "Roach",
  "Achilles",
  "Hermes",
  "Speedy",
]);
const TECHNIQUES = Object.freeze({
  ath: {
    name: "Атлетика",
    icon: "fas fa-fist-raised",
    skillSlug: "athletics",
    successText: "+5 фт в спринте.",
    failureText: "+1 усталость.",
    supportSuccess: "{trainer} придаёт {bug} мощный стартовый импульс.",
    supportFailure: "{trainer} срывает ритм и едва не сбивает {bug}.",
  },
  acr: {
    name: "Акробатика",
    icon: "fas fa-wind",
    skillSlug: "acrobatics",
    successText: "Авто-успех на препятствии.",
    failureText: "-5 фт в спринте.",
    supportSuccess: "{bug} проходит связку финтов как цирковой артист.",
    supportFailure: "{bug} путается в траектории из-за лишнего пируэта.",
  },
  thi: {
    name: "Воровство",
    icon: "fas fa-mask",
    skillSlug: "thievery",
    successText: "Врагам КС препятствия +3.",
    failureText: "Вашему КС препятствия +5.",
    supportSuccess: "{trainer} незаметно усложняет трассу для чужих тараканов.",
    supportFailure: "{trainer} путает метки и подставляет собственного чемпиона.",
  },
  ste: {
    name: "Скрытность",
    icon: "fas fa-user-ninja",
    skillSlug: "stealth",
    successText: "Иммунитет к вражескому спринт-вреду.",
    failureText: "Спринт кидается d12 вместо d20.",
    supportSuccess: "{bug} растворяется на трассе, уходя из поля зрения соперников.",
    supportFailure: "{trainer} прячет {bug} так старательно, что тот теряет темп.",
  },
  arc: {
    name: "Аркана",
    icon: "fas fa-magic",
    skillSlug: "arcana",
    successText: "Спринт с Удачей.",
    failureText: "+1 усталость.",
    supportSuccess: "{trainer} накладывает на {bug} заклятие ускорения.",
    supportFailure: "Магический импульс бьёт по {bug} слишком резко.",
  },
  occ: {
    name: "Оккультизм",
    icon: "fas fa-eye",
    skillSlug: "occultism",
    successText: "Случайный враг бежит с Неудачей.",
    failureText: "Ваш спринт с Неудачей.",
    supportSuccess: "{trainer} тянет за тайные нити чужую удачу.",
    supportFailure: "Запретный шёпот сбивает {bug} с боевого настроя.",
  },
  rel: {
    name: "Религия",
    icon: "fas fa-pray",
    skillSlug: "religion",
    successText: "-1 усталость.",
    failureText: "Без эффекта.",
    supportSuccess: "{trainer} благословляет {bug} перед самым забегом.",
    supportFailure: "Молитва не успевает дойти до небес.",
  },
  nat: {
    name: "Природа",
    icon: "fas fa-leaf",
    skillSlug: "nature",
    successText: "+5 к препятствию.",
    failureText: "-5 к препятствию.",
    supportSuccess: "{trainer} пробуждает в {bug} дикое чувство трассы.",
    supportFailure: "Инстинкты подводят {bug} на самом неприятном участке.",
  },
  soc: {
    name: "Общество",
    icon: "fas fa-users",
    skillSlug: "society",
    successText: "Лидер перед спринтом получает +5 фт.",
    failureText: "Лидер перед спринтом получает -5 фт.",
    supportSuccess: "{trainer} заводит толпу и подталкивает лидера арены.",
    supportFailure: "{trainer} настраивает публику против того, кто идёт первым.",
  },
  dec: {
    name: "Обман",
    icon: "fas fa-comment-slash",
    skillSlug: "deception",
    successText: "Все враги получают -5 фт в спринте.",
    failureText: "Ваш таракан получает -10 фт в спринте.",
    supportSuccess: "{trainer} вбрасывает идеальный вбок-взгляд про тапок.",
    supportFailure: "Блеф раскалывается слишком рано.",
  },
  dip: {
    name: "Дипломатия",
    icon: "fas fa-comments",
    skillSlug: "diplomacy",
    successText: "+1 удача навсегда.",
    failureText: "-5 фт в спринте.",
    supportSuccess: "{trainer} находит слова, от которых {bug} верит в победу.",
    supportFailure: "Слишком мягкая речь только усыпляет азарт {bug}.",
  },
  itm: {
    name: "Запугивание",
    icon: "fas fa-angry",
    skillSlug: "intimidation",
    successText: "+10 фт, +1 усталость.",
    failureText: "+2 усталости.",
    supportSuccess: "{trainer} пугает {bug} так, что тот готов рвануть от ужаса.",
    supportFailure: "Перегиб с давлением выматывает {bug} ещё до рывка.",
  },
  per: {
    name: "Выступление",
    icon: "fas fa-guitar",
    skillSlug: "performance",
    successText: "+2 Моб на гонку.",
    failureText: "Враги получают +1 Моб на гонку.",
    supportSuccess: "{trainer} заводит арену победным ритмом.",
    supportFailure: "Шоу идёт не туда и вдохновляет кого угодно, только не {bug}.",
  },
  med: {
    name: "Медицина",
    icon: "fas fa-first-aid",
    skillSlug: "medicine",
    successText: "+10 фт и +1 усталость.",
    failureText: "+1 усталость.",
    supportSuccess: "{trainer} вкалывает {bug} точный порционный адреналин.",
    supportFailure: "Процедура проходит грубее, чем хотелось бы.",
  },
  sur: {
    name: "Выживание",
    icon: "fas fa-campground",
    skillSlug: "survival",
    successText: "Минимум 15 фт в спринте.",
    failureText: "Максимум 15 фт в спринте.",
    supportSuccess: "{trainer} показывает {bug} самую живучую линию маршрута.",
    supportFailure: "{bug} уходит в слишком осторожный режим.",
  },
  crf: {
    name: "Ремесло",
    icon: "fas fa-hammer",
    skillSlug: "crafting",
    successText: "+1 Инт на гонку.",
    failureText: "-1 Инт на гонку.",
    supportSuccess: "{trainer} доводит усики и панцирь {bug} до боевой геометрии.",
    supportFailure: "Тюнинг выходит спорным и мешает манёвру.",
  },
  prc: {
    name: "Внимательность",
    icon: "fas fa-search",
    skillSlug: "perception",
    successText: "+1 удача навсегда.",
    failureText: "Авто-провал препятствия.",
    supportSuccess: "{trainer} считывает дорожку раньше всех.",
    supportFailure: "{trainer} отвлекается на трибуны и пропускает главную угрозу.",
  },
});
const TECHNIQUES_EN = Object.freeze({
  ath: { name: "Athletics", successText: "+5 ft in sprint.", failureText: "+1 fatigue.", supportSuccess: "{trainer} gives {bug} a powerful starting burst.", supportFailure: "{trainer} throws off the rhythm and almost clips {bug}." },
  acr: { name: "Acrobatics", successText: "Auto-success on the obstacle.", failureText: "-5 ft in sprint.", supportSuccess: "{bug} strings feints together like a circus performer.", supportFailure: "{bug} tangles the line with one flourish too many." },
  thi: { name: "Thievery", successText: "Enemies get +3 obstacle DC.", failureText: "Your obstacle DC gets +5.", supportSuccess: "{trainer} quietly makes the track nastier for rival roaches.", supportFailure: "{trainer} mixes up the markers and sabotages their own champion." },
  ste: { name: "Stealth", successText: "Immune to enemy sprint penalties.", failureText: "Sprint uses d12 instead of d20.", supportSuccess: "{bug} vanishes on the track and slips out of sight.", supportFailure: "{trainer} hides {bug} so well that the pace is lost." },
  arc: { name: "Arcana", successText: "Sprint with Fortune.", failureText: "+1 fatigue.", supportSuccess: "{trainer} wraps {bug} in a spell of speed.", supportFailure: "The magical surge slams into {bug} too hard." },
  occ: { name: "Occultism", successText: "A random enemy runs with Misfortune.", failureText: "Your sprint has Misfortune.", supportSuccess: "{trainer} tugs at the hidden threads of someone else's luck.", supportFailure: "A forbidden whisper rattles {bug} before the run." },
  rel: { name: "Religion", successText: "-1 fatigue.", failureText: "No effect.", supportSuccess: "{trainer} blesses {bug} right before the race.", supportFailure: "The prayer does not reach the heavens in time." },
  nat: { name: "Nature", successText: "+5 to obstacle.", failureText: "-5 to obstacle.", supportSuccess: "{trainer} awakens a wild sense of the track in {bug}.", supportFailure: "{bug}'s instincts fail at the worst part of the course." },
  soc: { name: "Society", successText: "The leader gets +5 ft before sprint.", failureText: "The leader gets -5 ft before sprint.", supportSuccess: "{trainer} whips up the crowd and pushes the arena leader forward.", supportFailure: "{trainer} turns the audience against whoever is ahead." },
  dec: { name: "Deception", successText: "All enemies get -5 ft in sprint.", failureText: "Your roach gets -10 ft in sprint.", supportSuccess: "{trainer} plants the perfect fake tell about the slipper.", supportFailure: "The bluff falls apart too early." },
  dip: { name: "Diplomacy", successText: "+1 luck permanently.", failureText: "-5 ft in sprint.", supportSuccess: "{trainer} finds the words that make {bug} believe in victory.", supportFailure: "The speech is so gentle it lulls {bug}'s competitive edge." },
  itm: { name: "Intimidation", successText: "+10 ft, +1 fatigue.", failureText: "+2 fatigue.", supportSuccess: "{trainer} scares {bug} so badly it is ready to bolt in terror.", supportFailure: "Too much pressure tires {bug} out before the dash." },
  per: { name: "Performance", successText: "+2 Mob for the race.", failureText: "Enemies get +1 Mob for the race.", supportSuccess: "{trainer} sets the arena on fire with a winning rhythm.", supportFailure: "The show goes sideways and inspires everyone except {bug}." },
  med: { name: "Medicine", successText: "+10 ft and +1 fatigue.", failureText: "+1 fatigue.", supportSuccess: "{trainer} doses {bug} with a precise shot of adrenaline.", supportFailure: "The procedure is rougher than intended." },
  sur: { name: "Survival", successText: "Minimum 15 ft in sprint.", failureText: "Maximum 15 ft in sprint.", supportSuccess: "{trainer} shows {bug} the toughest line through the course.", supportFailure: "{bug} slips into an overly cautious mode." },
  crf: { name: "Crafting", successText: "+1 Int for the race.", failureText: "-1 Int for the race.", supportSuccess: "{trainer} tunes {bug}'s antennae and shell into racing geometry.", supportFailure: "The tune-up turns questionable and ruins the line." },
  prc: { name: "Perception", successText: "+1 luck permanently.", failureText: "Auto-fail on the obstacle.", supportSuccess: "{trainer} reads the track before anyone else.", supportFailure: "{trainer} gets distracted by the stands and misses the real danger." },
});
const PHASES_EN = Object.freeze({
  join: "Race setup",
  support: "Technique selection",
  obstacle: "Obstacle",
  sprint: "Sprint",
  upgrade: "Winner's upgrade",
  results: "Race results",
});
const TEXT = Object.freeze({
  DefaultRunner: { ru: "Бегун", en: "Runner" },
  TableReady: { ru: "Стол готов. Выберите участников и соберите тараканов.", en: "The table is ready. Pick the racers and build your cockroaches." },
  SupportDeath: { ru: "не выдерживает нагрузки ещё до старта основного рывка.", en: "cannot handle the strain before the main dash even starts." },
  OutcomeObstacleCrit: { ru: "{name} проходит барьер на чистом форсаже благодаря технике «{technique}».", en: "{name} blasts through the barrier at full throttle thanks to “{technique}”." },
  OutcomeObstacleCritFail: { ru: "{name} влетает в препятствие и теряет весь импульс.", en: "{name} crashes into the obstacle and loses every bit of momentum." },
  OutcomeObstacleFail: { ru: "{name} спотыкается о барьер и срывает темп.", en: "{name} stumbles at the barrier and loses the pace." },
  OutcomeObstacleSuccess: { ru: "{name} чисто проходит препятствие и держится в гонке.", en: "{name} clears the obstacle cleanly and stays in the race." },
  SprintBand30: { ru: "Это уже не таракан, а легенда скорости.", en: "This is no longer a cockroach. This is a legend of speed." },
  SprintBand25: { ru: "Панцирь дрожит от предельного темпа.", en: "The shell vibrates from the sheer pace." },
  SprintBand20: { ru: "Лапки мелькают так быстро, что стол гудит.", en: "Its legs blur so fast the whole table hums." },
  SprintBand15: { ru: "Хороший, плотный рывок без потери контроля.", en: "A strong, compact burst with full control." },
  SprintBand10: { ru: "Таракан идёт уверенно, но без чудес.", en: "The cockroach is moving confidently, just without miracles." },
  SprintBand1: { ru: "Скорость есть, но в этом рывке не хватило остроты.", en: "There is speed here, but not enough sharpness in this burst." },
  SprintBand0: { ru: "Рывок захлебнулся, и таракан почти не продвинулся.", en: "The burst fizzles out and the cockroach barely advances." },
  SupportPhase: { ru: "Фаза поддержки · КС {dc}", en: "Support phase · DC {dc}" },
  Success: { ru: "Успех", en: "Success" },
  Failure: { ru: "Провал", en: "Failure" },
  Effect: { ru: "Эффект:", en: "Effect:" },
  AgainstDC: { ru: "1d20 + {modifier} = {total} против КС {dc}", en: "1d20 + {modifier} = {total} vs DC {dc}" },
  Decision: { ru: "Решение", en: "Decision" },
  ObstaclePending: { ru: "Препятствие не пройдено. Игрок решает, тратить ли удачу.", en: "The obstacle was not cleared. The player decides whether to spend luck." },
  Roll: { ru: "Бросок: {total} против КС {dc}", en: "Roll: {total} vs DC {dc}" },
  CritSuccess: { ru: "Крит. успех", en: "Critical success" },
  CritFailure: { ru: "Крит. провал", en: "Critical failure" },
  RollDegree: { ru: "Бросок: {total} против КС {dc}{suffix}", en: "Roll: {total} vs DC {dc}{suffix}" },
  CriticalDegreeSuffix: { ru: " · критическая степень", en: " · critical degree" },
  ObstacleClear: { ru: "Чистый проход.", en: "Clean passage." },
  ObstacleCritEffect: { ru: "Следующий спринт получает +5 фт.", en: "The next sprint gets +5 ft." },
  ObstacleFailEffect: { ru: "+1 усталость.", en: "+1 fatigue." },
  ObstacleCritFailEffect: { ru: "+1 усталость и штраф -10 фт в спринте.", en: "+1 fatigue and a -10 ft sprint penalty." },
  MedSave: { ru: "{name} выживает на медицине и адреналине.", en: "{name} survives on medicine and adrenaline." },
  ObstacleDeath: { ru: "сходит с трассы после удара о препятствие.", en: "drops out of the race after slamming into the obstacle." },
  ObstaclePhase: { ru: "Препятствие · КС {dc}", en: "Obstacle · DC {dc}" },
  AcceptFailure: { ru: "{name} принимает провал препятствия и получает +1 усталость.", en: "{name} accepts the failed obstacle and gains +1 fatigue." },
  AcceptFailureDeath: { ru: "не выдерживает нагрузку после провала.", en: "cannot withstand the strain after the failure." },
  SprintPhase: { ru: "Спринт", en: "Sprint" },
  ModAth: { ru: "+5 Атлетика", en: "+5 Athletics" },
  ModIntimidation: { ru: "+10 Запугивание", en: "+10 Intimidation" },
  ModMedicine: { ru: "+10 Медицина", en: "+10 Medicine" },
  ModDeception: { ru: "-10 Обман", en: "-10 Deception" },
  ModObstacle: { ru: "-5 Препятствие", en: "-5 Obstacle" },
  ModCritObstaclePenalty: { ru: "-10 Крит. препятствие", en: "-10 Critical obstacle" },
  ModCritObstacleBonus: { ru: "+5 Крит. препятствие", en: "+5 Critical obstacle" },
  ModAcrobatics: { ru: "-5 Акробатика", en: "-5 Acrobatics" },
  ModDiplomacy: { ru: "-5 Дипломатия", en: "-5 Diplomacy" },
  ModDeceptionOther: { ru: "-5 Обман {name}", en: "-5 Deception {name}" },
  ModCrowdBonus: { ru: "+5 Толпа", en: "+5 Crowd" },
  ModCrowdPenalty: { ru: "-5 Толпа", en: "-5 Crowd" },
  ModSurvivalMin: { ru: "мин. 15 Выживание", en: "min. 15 Survival" },
  ModSurvivalMax: { ru: "макс. 15 Выживание", en: "max. 15 Survival" },
  SprintBurst: { ru: "Рывок", en: "Burst" },
  SprintHead: { ru: "{name} · {distance} фт", en: "{name} · {distance} ft" },
  SprintCalc: { ru: "{formula} + {bonus} = {total}{mods}", en: "{formula} + {bonus} = {total}{mods}" },
  SprintDistance: { ru: "Итого дистанция: {distance} фт.", en: "Total distance: {distance} ft." },
  NotCollected: { ru: "Таракан {name} погиб и не попал в коллекцию.", en: "Cockroach {name} died and was not added to the collection." },
  ChampionDescription: { ru: "Race champion.", en: "Race champion." },
  PrefixCockroach: { ru: "Таракан", en: "Cockroach" },
  SavedToActor: { ru: "Таракан {name} сохранён у актёра {actor}.", en: "Cockroach {name} was saved on actor {actor}." },
  NoSurvivors: { ru: "Все участники сошли с трассы. Итоги зафиксированы.", en: "All participants dropped out. The results have been recorded." },
  WinnerUpgrade: { ru: "Победитель забега: {name}. Выберите одно улучшение.", en: "Race winner: {name}. Choose one upgrade." },
  UpgradeGain: { ru: "{name} получает улучшение {stat}.", en: "{name} gains the {stat} upgrade." },
  LuckReroll: { ru: "{name} тратит удачу и идёт на переброс препятствия.", en: "{name} spends luck and rerolls the obstacle." },
  ResetDone: { ru: "Сброс завершён.", en: "Reset complete." },
  RulesTitle: { ru: "Правила", en: "Rules" },
  NameChampion: { ru: "Имя чемпиона", en: "Champion name" },
  LuckQuestion: { ru: "Препятствие провалено. Что делаем?", en: "The obstacle failed. What do we do?" },
  LuckButton: { ru: "Удача ({value})", en: "Luck ({value})" },
  AcceptButton: { ru: "Принять", en: "Accept" },
  ChronicleTitle: { ru: "Хроника забегов", en: "Race chronicle" },
  DebugMode: { ru: "Режим ГМ", en: "GM mode" },
  FooterRound: { ru: "Раунд", en: "Round" },
  FooterClear: { ru: "Очистить", en: "Clear" },
  FooterReset: { ru: "Сброс", en: "Reset" },
  StatusSupport: { ru: "Раунд {round} · Поддержка КС {dc}", en: "Round {round} · Support DC {dc}" },
  StatusObstacle: { ru: "Раунд {round} · Препятствие КС {dc}", en: "Round {round} · Obstacle DC {dc}" },
  StatusSprint: { ru: "Раунд {round} · Спринт завершён", en: "Round {round} · Sprint complete" },
  EmptyState: { ru: "Список пуст. Назначьте игрокам персонажей или перетащите актёров в окно игры.", en: "No players found. Assign characters to users or drag actors into the game window." },
  NoActor: { ru: "Без актёра", en: "No actor" },
  JoinLabel: { ru: "Я в гонке", en: "I'm racing" },
  Dead: { ru: "Погиб", en: "Dead" },
  Spectator: { ru: "Наблюдает", en: "Watching" },
  Confirmed: { ru: "Подтверждено", en: "Confirmed" },
  NeedsReward: { ru: "Нужно выбрать награду", en: "Choose a reward" },
  WaitingLuck: { ru: "Ждёт удачу", en: "Waiting on luck" },
  BuildReward: { ru: "Награда победителя: выберите +1", en: "Winner's reward: choose +1" },
  BuildPoints: { ru: "Очков развития: {points}", en: "Advancement points: {points}" },
  WaitingTechnique: { ru: "Игрок выбирает технику...", en: "Player is choosing a technique..." },
  ConfirmButton: { ru: "Подтвердить", en: "Confirm" },
  Close: { ru: "Закрыть", en: "Close" },
  RuleRoundsTitle: { ru: "Раунды", en: "Rounds" },
  RuleRound1: { ru: "Поддержка: КС 15, затем препятствие КС 12 и спринт.", en: "Support: DC 15, then obstacle DC 12 and sprint." },
  RuleRound2: { ru: "Поддержка: КС 20, затем препятствие КС 17 и спринт.", en: "Support: DC 20, then obstacle DC 17 and sprint." },
  RuleRound3: { ru: "Поддержка: КС 25, затем препятствие КС 22 и спринт.", en: "Support: DC 25, then obstacle DC 22 and sprint." },
  RuleStatsTitle: { ru: "Характеристики", en: "Stats" },
  RuleEnd: { ru: "Лимит усталости. Если усталость выше ВЫН, таракан погибает.", en: "Fatigue limit. If fatigue exceeds END, the cockroach dies." },
  RuleMob: { ru: "Бонус к спринту. Дальность забега измеряется в футах.", en: "Sprint bonus. Race distance is measured in feet." },
  RuleInt: { ru: "Бонус к прохождению препятствия.", en: "Bonus to clearing the obstacle." },
  RuleLuck: { ru: "Позволяет перебросить неудачное препятствие вместо принятия провала.", en: "Lets you reroll a failed obstacle instead of accepting the failure." },
  RuleOrderTitle: { ru: "Порядок хода", en: "Turn order" },
  RuleOrder1: { ru: "В фазе поддержки каждый игрок выбирает одну из трёх техник и подтверждает выбор.", en: "In the support phase, each player chooses one of three techniques and confirms the choice." },
  RuleOrder2: { ru: "После препятствия игроки с доступной удачей решают: перебросить или принять провал.", en: "After the obstacle, players with luck decide whether to reroll or accept the failure." },
  RuleOrder3: { ru: "После трёх раундов победитель получает +1 к одной характеристике и сохраняется предметом.", en: "After three rounds, the winner gains +1 to one stat and is saved as an item." },
  HelpIntro1: { ru: "{title} — гонка на трёх раундах с фазами поддержки, препятствия и спринта.", en: "{title} is a three-round race with support, obstacle, and sprint phases." },
  HelpIntro2: { ru: "Игрок сперва усиливает своего чемпиона техникой, затем таракан проходит препятствие, а после делает основной рывок по дистанции.", en: "A player first boosts their champion with a technique, then the cockroach clears an obstacle, and finally makes the main burst down the track." },
  HelpIntro3: { ru: "Побеждает живой участник с наибольшей дистанцией. Если живых не остаётся, игра всё равно фиксирует результаты и удаляет погибших тараканов.", en: "The living participant with the greatest distance wins. If nobody survives, the game still records the results and removes the dead cockroaches." },
  HelpTechniques: { ru: "Техники", en: "Techniques" },
  StatEnd: { ru: "ВЫН", en: "END" },
  StatMob: { ru: "МОБ", en: "MOB" },
  StatInt: { ru: "ИНТ", en: "INT" },
  StatLuck: { ru: "УДЧ", en: "LCK" },
  StatFatigue: { ru: "Уст.", en: "Fat." },
  StatPoints: { ru: "Очки", en: "Pts" },
  Ready: { ru: "готов", en: "ready" },
  Distance: { ru: "{value} фт", en: "{value} ft" },
  CockroachName: { ru: "Таракан: {name}", en: "Cockroach: {name}" },
  DescEnd: { ru: "ВЫН: {value}", en: "END: {value}" },
  DescMob: { ru: "МОБ: {value}", en: "MOB: {value}" },
  DescInt: { ru: "ИНТ: {value}", en: "INT: {value}" },
  DescLuck: { ru: "УДЧ: {value} / {max}", en: "LCK: {value} / {max}" },
});
const TECHNIQUE_ORDER = Object.keys(TECHNIQUES);

function isRussianLocale() {
  return String(game.i18n?.lang ?? "en").startsWith("ru");
}

function tx(key) {
  const entry = TEXT[key];
  if (!entry) return key;
  return isRussianLocale() ? entry.ru : entry.en;
}

function tf(key, data = {}) {
  return tx(key).replace(/\{(\w+)\}/g, (_match, token) => String(data[token] ?? ""));
}

function getTechniqueData(key) {
  const base = TECHNIQUES[key];
  if (!base) return null;
  if (isRussianLocale()) return base;
  return { ...base, ...(TECHNIQUES_EN[key] ?? {}) };
}

function getBugNamePool() {
  return isRussianLocale() ? BUG_NAMES : BUG_NAMES_EN;
}

function getStatLabel(stat) {
  return ({
    end: tx("StatEnd"),
    mob: tx("StatMob"),
    int: tx("StatInt"),
    luck: tx("StatLuck"),
  })[stat] ?? String(stat ?? "").toUpperCase();
}

function createInitialState() {
  return {
    players: {},
    excludedPlayers: {},
    round: 1,
    phase: "join",
    log: [
      `<div class="tsu-log-entry br-log-entry br-log-entry--system">${escapeHtml(tx("TableReady"))}</div>`,
    ],
    winnerId: "",
    debugMode: false,
    suppressDefaultPlayers: false,
    openSignal: null,
  };
}

function clone(value) {
  return foundry.utils.deepClone(value);
}

function getBugItem(actor) {
  if (!actor) return null;
  return actor.items.find((item) => {
    const moduleType = item.getFlag(MODULE_ID, "type");
    const legacyType = item.getFlag(LEGACY_ITEM_SCOPE, "type");
    return moduleType === BUG_ITEM_TYPE || legacyType === BUG_ITEM_TYPE;
  }) ?? null;
}

function sanitizeStatValue(value) {
  const numeric = Math.trunc(Number(value) || 0);
  return Math.max(0, Math.min(7, numeric));
}

function createFreshBug(existingNames = []) {
  const availableNames = getBugNamePool().filter((name) => !existingNames.includes(name));
  return {
    name: randomChoice(availableNames, tx("DefaultRunner")),
    stats: {
      end: 0,
      mob: 0,
      int: 0,
      luck: 0,
    },
    points: 10,
    isNew: true,
    maxLuck: 0,
  };
}

function getPersistentBugSnapshot(playerData) {
  return {
    name: String(playerData.name || tx("DefaultRunner")),
    stats: {
      end: sanitizeStatValue(playerData.stats?.end),
      mob: sanitizeStatValue(playerData.stats?.mob),
      int: sanitizeStatValue(playerData.stats?.int),
      luck: sanitizeStatValue(playerData.stats?.luck),
    },
    points: Math.max(0, Math.trunc(Number(playerData.points) || 0)),
    isNew: Boolean(playerData.isNew),
    maxLuck: Math.max(0, Math.trunc(Number(playerData.maxLuck) || 0)),
  };
}

function restorePersistentBug(actor, existingNames = []) {
  const item = getBugItem(actor);
  const stored = item?.getFlag(MODULE_ID, "stats") ?? item?.getFlag(LEGACY_ITEM_SCOPE, "stats");
  if (!stored || typeof stored !== "object") return createFreshBug(existingNames);

  const fallback = createFreshBug(existingNames);
  const stats = stored.stats ?? {};
  const persistent = {
    name: String(stored.name || fallback.name),
    stats: {
      end: sanitizeStatValue(stats.end),
      mob: sanitizeStatValue(stats.mob),
      int: sanitizeStatValue(stats.int),
      luck: sanitizeStatValue(stats.luck),
    },
    points: Math.max(0, Math.trunc(Number(stored.points) || 0)),
    isNew: Boolean(stored.isNew),
    maxLuck: Math.max(0, Math.trunc(Number(stored.maxLuck) || stats.luck || 0)),
  };

  if (!persistent.name.trim()) persistent.name = fallback.name;
  return persistent;
}

function createPlayerState(actor, { isParticipating = false, source = "manual", existingNames = [] } = {}) {
  const persistent = restorePersistentBug(actor, existingNames);
  return {
    id: actor.id,
    source,
    name: persistent.name,
    stats: persistent.stats,
    points: persistent.points,
    isNew: persistent.isNew,
    maxLuck: Math.max(persistent.maxLuck, persistent.stats.luck),
    isParticipating,
    isDead: false,
    fatigue: 0,
    distance: 0,
    hand: [],
    selectedTech: "",
    isConfirmed: false,
    roundRes: null,
    lastObs: "",
    needsLuck: false,
    lastUpgrade: "",
  };
}

function normalizePlayerState(playerData, actor) {
  if (!playerData || typeof playerData !== "object") return;
  playerData.id ||= actor?.id ?? "";
  playerData.source ||= "auto";
  playerData.name = String(playerData.name || tx("DefaultRunner"));
  playerData.points = Math.max(0, Math.trunc(Number(playerData.points) || 0));
  playerData.isNew = Boolean(playerData.isNew);
  playerData.maxLuck = Math.max(0, Math.trunc(Number(playerData.maxLuck) || 0));
  playerData.isParticipating = Boolean(playerData.isParticipating);
  playerData.isDead = Boolean(playerData.isDead);
  playerData.fatigue = Math.max(0, Math.trunc(Number(playerData.fatigue) || 0));
  playerData.distance = Math.max(0, Math.trunc(Number(playerData.distance) || 0));
  playerData.hand = Array.isArray(playerData.hand) ? playerData.hand.filter((id) => TECHNIQUES[id]) : [];
  playerData.selectedTech = TECHNIQUES[playerData.selectedTech] ? playerData.selectedTech : "";
  playerData.isConfirmed = Boolean(playerData.isConfirmed);
  playerData.roundRes = playerData.roundRes && TECHNIQUES[playerData.roundRes.key]
    ? { key: playerData.roundRes.key, s: Boolean(playerData.roundRes.s) }
    : null;
  playerData.lastObs = String(playerData.lastObs || "");
  playerData.needsLuck = Boolean(playerData.needsLuck);
  playerData.lastUpgrade = String(playerData.lastUpgrade || "");
  playerData.stats ||= {};
  playerData.stats.end = sanitizeStatValue(playerData.stats.end);
  playerData.stats.mob = sanitizeStatValue(playerData.stats.mob);
  playerData.stats.int = sanitizeStatValue(playerData.stats.int);
  playerData.stats.luck = sanitizeStatValue(playerData.stats.luck);
  playerData.maxLuck = Math.max(playerData.maxLuck, playerData.stats.luck);
}

function getVisibleEntries(state) {
  return Object.entries(state.players ?? {}).filter(([actorId, playerData]) => (
    !state.excludedPlayers?.[actorId] || playerData?.source === "manual"
  ));
}

function getActiveEntries(state) {
  return getVisibleEntries(state).filter(([, playerData]) => Boolean(playerData?.isParticipating));
}

function getActiveAliveEntries(state) {
  return getActiveEntries(state).filter(([, playerData]) => !playerData.isDead);
}

function allActivePlayersBuilt(state) {
  const activeEntries = getActiveEntries(state);
  if (!activeEntries.length) return false;
  return activeEntries.every(([, playerData]) => !playerData.isNew || playerData.points === 0);
}

function allActivePlayersConfirmed(state) {
  const activeEntries = getActiveAliveEntries(state);
  if (!activeEntries.length) return false;
  return activeEntries.every(([, playerData]) => playerData.isConfirmed && TECHNIQUES[playerData.selectedTech]);
}

function currentRoundSupportDc(state) {
  return ROUND_SUPPORT_DCS[Math.max(0, Math.min(ROUND_SUPPORT_DCS.length - 1, (state.round || 1) - 1))];
}

function currentObstacleDc(state) {
  return OBSTACLE_DCS[state.round] ?? OBSTACLE_DCS[3];
}

function addSystemLog(state, text) {
  state.log.unshift(`<div class="tsu-log-entry br-log-entry br-log-entry--system">${text}</div>`);
}

function buildRoundDivider(round) {
  return `<div class="tsu-log-entry br-log-entry br-log-entry--divider">${tf("StatusSupport", { round, dc: currentRoundSupportDc({ round }) }).split(" · ")[0]}</div>`;
}

function formatTechniqueFlavor(template, trainerName, bugName) {
  return escapeHtml(String(template)
    .replaceAll("{trainer}", trainerName)
    .replaceAll("{bug}", bugName));
}

function describeObstacleOutcome(playerData, degree) {
  const technique = getTechniqueData(playerData.roundRes?.key || "ath") ?? getTechniqueData("ath");
  switch (degree) {
    case "CRIT":
      return escapeHtml(tf("OutcomeObstacleCrit", { name: playerData.name, technique: technique.name }));
    case "CFAIL":
      return escapeHtml(tf("OutcomeObstacleCritFail", { name: playerData.name }));
    case "FAIL":
      return escapeHtml(tf("OutcomeObstacleFail", { name: playerData.name }));
    default:
      return escapeHtml(tf("OutcomeObstacleSuccess", { name: playerData.name }));
  }
}

function describeSprintBand(totalGain) {
  if (totalGain >= 30) return tx("SprintBand30");
  if (totalGain >= 25) return tx("SprintBand25");
  if (totalGain >= 20) return tx("SprintBand20");
  if (totalGain >= 15) return tx("SprintBand15");
  if (totalGain >= 10) return tx("SprintBand10");
  if (totalGain > 0) return tx("SprintBand1");
  return tx("SprintBand0");
}

function getTechniqueModifier(actor, technique) {
  if (!actor || !technique) return 0;
  if (technique.skillSlug === "perception") return actor.perception?.mod || 0;
  return actor.skills?.[technique.skillSlug]?.mod || actor.perception?.mod || 0;
}

function canCurrentUserOperateActor(actor, state) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return true;
  return userCanControlActor(actor, game.user) && (state.phase !== "upgrade" || !state.winnerId || actor.id === state.winnerId);
}

function canSenderOperateActor(actorId, senderId) {
  const sender = game.users?.get(senderId);
  const actor = game.actors?.get(actorId);
  if (!sender || !actor) return false;
  if (sender.isGM) return true;
  return userCanControlActor(actor, sender);
}

async function addActorToState(state, actor, { isParticipating = false, source = "manual" } = {}) {
  if (!actor || state.players[actor.id]) return;
  const existingNames = Object.values(state.players).map((playerData) => playerData.name);
  state.players[actor.id] = createPlayerState(actor, { isParticipating, source, existingNames });
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
    const actor = game.actors?.get(actorId);
    if ((playerData.source ?? "auto") === "manual") {
      normalizePlayerState(playerData, actor);
      continue;
    }
    if (actor?.type === "character" && !defaultIds.has(actorId)) {
      delete state.players[actorId];
      continue;
    }
    normalizePlayerState(playerData, actor);
    playerData.source = "auto";
  }

  for (const actor of defaultActors) {
    if (state.excludedPlayers[actor.id]) continue;
    if (!state.players[actor.id]) {
      await addActorToState(state, actor, { isParticipating: false, source: "auto" });
      continue;
    }
    normalizePlayerState(state.players[actor.id], actor);
    state.players[actor.id].source = "auto";
  }
}

function pickThreeTechniques() {
  const pool = [...TECHNIQUE_ORDER];
  const selected = [];
  while (selected.length < 3 && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function setupRound(state) {
  state.log.unshift(buildRoundDivider(state.round));
  for (const [, playerData] of getActiveAliveEntries(state)) {
    playerData.isConfirmed = false;
    playerData.selectedTech = "";
    playerData.roundRes = null;
    playerData.lastObs = "";
    playerData.needsLuck = false;
    playerData.hand = pickThreeTechniques();
  }
}

function markPlayerDeath(state, playerData, reason) {
  if (playerData.isDead) return;
  playerData.isDead = true;
  state.log.unshift(
    `<div class="tsu-log-entry br-log-entry br-log-entry--death"><b>${escapeHtml(playerData.name)}</b> ${escapeHtml(reason)}</div>`,
  );
}

function applySupportImmediateEffects(state, playerData, techKey, success) {
  switch (techKey) {
    case "itm":
      playerData.fatigue += success ? 1 : 2;
      break;
    case "med":
      playerData.fatigue += 1;
      break;
    case "rel":
      if (success) playerData.fatigue = Math.max(0, playerData.fatigue - 1);
      break;
    case "dip":
      if (success) {
        playerData.stats.luck = sanitizeStatValue(playerData.stats.luck + 1);
        playerData.maxLuck = Math.max(playerData.maxLuck, playerData.stats.luck);
      }
      break;
    case "prc":
      if (success) {
        playerData.stats.luck = sanitizeStatValue(playerData.stats.luck + 1);
        playerData.maxLuck = Math.max(playerData.maxLuck, playerData.stats.luck);
      }
      break;
    case "per":
      if (success) {
        playerData.stats.mob = sanitizeStatValue(playerData.stats.mob + 2);
      } else {
        for (const [, other] of getActiveAliveEntries(state)) {
          if (other === playerData) continue;
          other.stats.mob = sanitizeStatValue(other.stats.mob + 1);
        }
      }
      break;
    case "crf":
      if (success) {
        playerData.stats.int = sanitizeStatValue(playerData.stats.int + 1);
      } else {
        playerData.stats.int = sanitizeStatValue(playerData.stats.int - 1);
      }
      break;
    default:
      break;
  }

  if (playerData.fatigue > playerData.stats.end && !(state.round === 3 && techKey === "med" && success)) {
    markPlayerDeath(state, playerData, tx("SupportDeath"));
  }
}

async function processSupport(state) {
  const lines = [
    `<div class="tsu-log-entry br-log-entry br-log-entry--phase">${escapeHtml(tf("SupportPhase", { dc: currentRoundSupportDc(state) }))}</div>`,
  ];

  for (const [actorId, playerData] of getActiveAliveEntries(state)) {
    const actor = game.actors?.get(actorId);
    if (!actor) continue;
    const techKey = playerData.selectedTech || playerData.hand[0];
    const technique = getTechniqueData(techKey) ?? getTechniqueData("ath");
    const dc = currentRoundSupportDc(state);
    const modifier = getTechniqueModifier(actor, technique);
    const roll = new Roll(`1d20 + ${modifier}`);
    await roll.evaluate();

    const success = roll.total >= dc;
    playerData.roundRes = { key: techKey, s: success };

    const flavor = formatTechniqueFlavor(
      success ? technique.supportSuccess : technique.supportFailure,
      actor.name,
      playerData.name,
    );
    const outcomeClass = success ? "is-success" : "is-failure";
    const outcomeLabel = success ? tx("Success") : tx("Failure");

    lines.push(`
      <div class="tsu-log-entry br-log-entry br-log-entry--detail ${outcomeClass}">
        <div class="br-log-line__head">
          <span class="br-log-pill">${outcomeLabel}</span>
          <b>${escapeHtml(actor.name)}</b> · ${escapeHtml(technique.name)}
        </div>
        <div class="br-log-line__body">${flavor}</div>
        <div class="br-log-line__calc">${escapeHtml(tf("AgainstDC", { modifier, total: roll.total, dc }))}</div>
        <div class="br-log-line__effect"><b>${escapeHtml(tx("Effect"))}</b> ${escapeHtml(success ? technique.successText : technique.failureText)}</div>
      </div>
    `);

    applySupportImmediateEffects(state, playerData, techKey, success);
  }

  state.log.unshift(lines.join(""));
}

function createObstaclePendingEntry(playerData, dc, total) {
  return `
    <div class="tsu-log-entry br-log-entry br-log-entry--detail is-warning">
      <div class="br-log-line__head">
        <span class="br-log-pill">${escapeHtml(tx("Decision"))}</span>
        <b>${escapeHtml(playerData.name)}</b>
      </div>
      <div class="br-log-line__body">${escapeHtml(tx("ObstaclePending"))}</div>
      <div class="br-log-line__calc">${escapeHtml(tf("Roll", { total, dc }))}</div>
    </div>
  `;
}

function createObstacleResolvedEntry(playerData, degree, dc, rollTotal, effectText) {
  const success = degree === "SUCCESS" || degree === "CRIT";
  const critical = degree === "CRIT" || degree === "CFAIL";
  const label = degree === "CRIT"
    ? tx("CritSuccess")
    : degree === "CFAIL"
      ? tx("CritFailure")
      : success
        ? tx("Success")
        : tx("Failure");
  const className = degree === "CRIT"
    ? "is-success"
    : degree === "CFAIL"
      ? "is-failure"
      : success
        ? "is-success"
        : "is-failure";
  const body = describeObstacleOutcome(playerData, degree);

  return `
    <div class="tsu-log-entry br-log-entry br-log-entry--detail ${className}">
      <div class="br-log-line__head">
        <span class="br-log-pill">${label}</span>
        <b>${escapeHtml(playerData.name)}</b>
      </div>
      <div class="br-log-line__body">${body}</div>
      <div class="br-log-line__calc">${escapeHtml(tf("RollDegree", { total: rollTotal, dc, suffix: critical ? tx("CriticalDegreeSuffix") : "" }))}</div>
      <div class="br-log-line__effect"><b>${escapeHtml(tx("Effect"))}</b> ${escapeHtml(effectText)}</div>
    </div>
  `;
}

async function processSingleObstacle(state, actorId, { isReroll = false } = {}) {
  const playerData = state.players?.[actorId];
  if (!playerData || playerData.isDead) return { pending: false, entry: "" };

  let dc = currentObstacleDc(state);
  let bonus = playerData.stats.int;

  if (playerData.roundRes?.key === "nat" && playerData.roundRes.s) bonus += 5;
  if (playerData.roundRes?.key === "nat" && !playerData.roundRes.s) bonus -= 5;

  for (const [otherActorId, otherPlayerData] of getActiveAliveEntries(state)) {
    if (otherActorId === actorId) continue;
    if (otherPlayerData.roundRes?.key === "thi" && otherPlayerData.roundRes.s) dc += 3;
  }
  if (playerData.roundRes?.key === "thi" && !playerData.roundRes.s) dc += 5;

  const roll = new Roll(`1d20 + ${bonus}`);
  await roll.evaluate();

  let success = roll.total >= dc || (playerData.roundRes?.key === "acr" && playerData.roundRes.s);
  if (playerData.roundRes?.key === "prc" && !playerData.roundRes.s) success = false;

  if (!success && !isReroll && playerData.stats.luck > 0) {
    playerData.needsLuck = true;
    return {
      pending: true,
      entry: createObstaclePendingEntry(playerData, dc, roll.total),
    };
  }

  const degree = roll.total >= dc + 10
    ? "CRIT"
    : success
      ? "SUCCESS"
      : roll.total <= dc - 10
        ? "CFAIL"
        : "FAIL";
  playerData.lastObs = degree === "CRIT" ? "CRIT" : degree === "CFAIL" ? "CFAIL" : success ? "OK" : "FAIL";

  let effectText = tx("ObstacleClear");
  if (degree === "CRIT") effectText = tx("ObstacleCritEffect");
  if (degree === "FAIL") effectText = tx("ObstacleFailEffect");
  if (degree === "CFAIL") effectText = tx("ObstacleCritFailEffect");

  if (!success) {
    playerData.fatigue += 1;
    if (playerData.fatigue > playerData.stats.end) {
      const medSave = state.round === 3 && playerData.roundRes?.key === "med" && playerData.roundRes.s;
      if (medSave) {
        addSystemLog(state, `<b>${escapeHtml(tf("MedSave", { name: playerData.name }))}</b>`);
      } else {
        markPlayerDeath(state, playerData, tx("ObstacleDeath"));
      }
    }
  }

  return {
    pending: false,
    entry: createObstacleResolvedEntry(playerData, degree, dc, roll.total, effectText),
  };
}

async function processObstacle(state) {
  const lines = [
    `<div class="tsu-log-entry br-log-entry br-log-entry--phase">${escapeHtml(tf("ObstaclePhase", { dc: currentObstacleDc(state) }))}</div>`,
  ];

  for (const [actorId] of getActiveAliveEntries(state)) {
    const result = await processSingleObstacle(state, actorId);
    if (result.entry) lines.push(result.entry);
  }

  state.log.unshift(lines.join(""));
}

async function resolveObstacleFailure(state, actorId) {
  const playerData = state.players?.[actorId];
  if (!playerData || playerData.isDead) return;
  playerData.needsLuck = false;
  playerData.lastObs = "FAIL";
  playerData.fatigue += 1;
  state.log.unshift(`
    <div class="tsu-log-entry br-log-entry br-log-entry--warning">
      ${escapeHtml(tf("AcceptFailure", { name: playerData.name }))}
    </div>
  `);
  if (playerData.fatigue > playerData.stats.end) {
    markPlayerDeath(state, playerData, tx("AcceptFailureDeath"));
  }
}

async function processSprint(state) {
  const activeAliveEntries = getActiveAliveEntries(state);
  const lines = [
    `<div class="tsu-log-entry br-log-entry br-log-entry--phase">${escapeHtml(tx("SprintPhase"))}</div>`,
  ];

  for (const [actorId, playerData] of activeAliveEntries) {
    let bonus = playerData.stats.mob;
    let formula = "1d20";

    if (playerData.roundRes?.key === "ste" && !playerData.roundRes.s) formula = "1d12";
    if (playerData.roundRes?.key === "arc" && playerData.roundRes.s) formula = "2d20kh";

    const enemyMisfortune = activeAliveEntries.some(([otherId, other]) => otherId !== actorId && other.roundRes?.key === "occ" && other.roundRes.s);
    if ((enemyMisfortune || (playerData.roundRes?.key === "occ" && !playerData.roundRes.s)) && !(playerData.roundRes?.key === "ste" && playerData.roundRes.s)) {
      formula = "2d20kl";
    }

    const roll = new Roll(`${formula} + ${bonus}`);
    await roll.evaluate();

    let totalGain = roll.total;
    const modifiers = [];

    if (playerData.roundRes?.key === "ath" && playerData.roundRes.s) {
      totalGain += 5;
      modifiers.push(tx("ModAth"));
    }
    if (playerData.roundRes?.key === "itm" && playerData.roundRes.s) {
      totalGain += 10;
      modifiers.push(tx("ModIntimidation"));
    }
    if (playerData.roundRes?.key === "med" && playerData.roundRes.s) {
      totalGain += 10;
      modifiers.push(tx("ModMedicine"));
    }
    if (playerData.roundRes?.key === "dec" && !playerData.roundRes.s) {
      totalGain -= 10;
      modifiers.push(tx("ModDeception"));
    }
    if (playerData.lastObs === "FAIL") {
      totalGain -= 5;
      modifiers.push(tx("ModObstacle"));
    }
    if (playerData.lastObs === "CFAIL") {
      totalGain -= 10;
      modifiers.push(tx("ModCritObstaclePenalty"));
    }
    if (playerData.lastObs === "CRIT") {
      totalGain += 5;
      modifiers.push(tx("ModCritObstacleBonus"));
    }
    if (playerData.roundRes?.key === "acr" && !playerData.roundRes.s) {
      totalGain -= 5;
      modifiers.push(tx("ModAcrobatics"));
    }
    if (playerData.roundRes?.key === "dip" && !playerData.roundRes.s) {
      totalGain -= 5;
      modifiers.push(tx("ModDiplomacy"));
    }

    for (const [otherActorId, other] of activeAliveEntries) {
      if (otherActorId === actorId) continue;
      if (other.roundRes?.key === "dec" && other.roundRes.s && !(playerData.roundRes?.key === "ste" && playerData.roundRes.s)) {
        totalGain -= 5;
        modifiers.push(tf("ModDeceptionOther", { name: other.name }));
      }
    }

    const leadDistance = Math.max(0, ...activeAliveEntries.map(([, entry]) => entry.distance));
    if (playerData.distance === leadDistance) {
      for (const [, other] of activeAliveEntries) {
        if (other.roundRes?.key !== "soc") continue;
        if (other.roundRes.s) {
          totalGain += 5;
          modifiers.push(tx("ModCrowdBonus"));
        } else {
          totalGain -= 5;
          modifiers.push(tx("ModCrowdPenalty"));
        }
      }
    }

    if (playerData.roundRes?.key === "sur" && playerData.roundRes.s) {
      totalGain = Math.max(15, totalGain);
      modifiers.push(tx("ModSurvivalMin"));
    }
    if (playerData.roundRes?.key === "sur" && !playerData.roundRes.s) {
      totalGain = Math.min(15, totalGain);
      modifiers.push(tx("ModSurvivalMax"));
    }

    totalGain = Math.max(0, totalGain);
    playerData.distance += totalGain;

    lines.push(`
      <div class="tsu-log-entry br-log-entry br-log-entry--detail ${totalGain >= 15 ? "is-success" : totalGain > 0 ? "is-neutral" : "is-failure"}">
        <div class="br-log-line__head">
          <span class="br-log-pill">${escapeHtml(tx("SprintBurst"))}</span>
          ${escapeHtml(tf("SprintHead", { name: playerData.name, distance: totalGain }))}
        </div>
        <div class="br-log-line__body">${escapeHtml(describeSprintBand(totalGain))}</div>
        <div class="br-log-line__calc">${escapeHtml(tf("SprintCalc", { formula, bonus, total: roll.total, mods: modifiers.length ? ` · ${modifiers.join(", ")}` : "" }))}</div>
        <div class="br-log-line__effect"><b>${escapeHtml(tx("Effect"))}</b> ${escapeHtml(tf("SprintDistance", { distance: playerData.distance }))}</div>
      </div>
    `);
  }

  state.log.unshift(lines.join(""));
}

async function finalizeBugs(state) {
  for (const [actorId, playerData] of getActiveEntries(state)) {
    const actor = game.actors?.get(actorId);
    if (!actor) continue;

    const existingItem = getBugItem(actor);
    if (playerData.isDead) {
      if (existingItem) await existingItem.delete();
      state.log.unshift(`
        <div class="tsu-log-entry br-log-entry br-log-entry--warning">
          ${escapeHtml(tf("NotCollected", { name: playerData.name }))}
        </div>
      `);
      continue;
    }

    const persistent = getPersistentBugSnapshot(playerData);
    persistent.points = 0;
    persistent.isNew = false;
    persistent.maxLuck = Math.max(persistent.maxLuck, persistent.stats.luck);

    const description = `
      <p>${escapeHtml(tx("ChampionDescription"))}</p>
      <ul>
        <li>${escapeHtml(tf("DescEnd", { value: persistent.stats.end }))}</li>
        <li>${escapeHtml(tf("DescMob", { value: persistent.stats.mob }))}</li>
        <li>${escapeHtml(tf("DescInt", { value: persistent.stats.int }))}</li>
        <li>${escapeHtml(tf("DescLuck", { value: persistent.stats.luck, max: persistent.maxLuck }))}</li>
      </ul>
    `;
    const itemData = {
      name: tf("CockroachName", { name: persistent.name }),
      type: "equipment",
      img: BUG_ICON,
      system: { description: { value: description } },
      flags: {
        [MODULE_ID]: {
          type: BUG_ITEM_TYPE,
          stats: persistent,
        },
        [LEGACY_ITEM_SCOPE]: {
          type: BUG_ITEM_TYPE,
          stats: persistent,
        },
      },
    };

    if (existingItem) await existingItem.update(itemData);
    else await actor.createEmbeddedDocuments("Item", [itemData]);

    state.log.unshift(`
      <div class="tsu-log-entry br-log-entry br-log-entry--success">
        ${escapeHtml(tf("SavedToActor", { name: persistent.name, actor: actor.name }))}
      </div>
    `);
  }
}

async function resolveWinner(state) {
  const aliveEntries = getActiveAliveEntries(state)
    .sort((left, right) => right[1].distance - left[1].distance);

  if (!aliveEntries.length) {
    state.winnerId = "";
    state.phase = "results";
    await finalizeBugs(state);
    addSystemLog(state, tx("NoSurvivors"));
    return;
  }

  state.winnerId = aliveEntries[0][0];
  state.phase = "upgrade";
  addSystemLog(state, tf("WinnerUpgrade", { name: `<b>${escapeHtml(aliveEntries[0][1].name.toUpperCase())}</b>` }));
}

function resetStateForNewTable(state) {
  const fresh = createInitialState();
  state.players = fresh.players;
  state.excludedPlayers = fresh.excludedPlayers;
  state.round = fresh.round;
  state.phase = fresh.phase;
  state.log = fresh.log;
  state.winnerId = "";
  state.debugMode = false;
  state.suppressDefaultPlayers = false;
}

function buildRulesSections() {
  return [
    {
      title: tx("RuleRoundsTitle"),
      items: [
        { label: "1", copy: tx("RuleRound1") },
        { label: "2", copy: tx("RuleRound2") },
        { label: "3", copy: tx("RuleRound3") },
      ],
    },
    {
      title: tx("RuleStatsTitle"),
      items: [
        { label: tx("StatEnd"), copy: tx("RuleEnd") },
        { label: tx("StatMob"), copy: tx("RuleMob") },
        { label: tx("StatInt"), copy: tx("RuleInt") },
        { label: tx("StatLuck"), copy: tx("RuleLuck") },
      ],
    },
    {
      title: tx("RuleOrderTitle"),
      items: [
        { label: "1", copy: tx("RuleOrder1") },
        { label: "2", copy: tx("RuleOrder2") },
        { label: "3", copy: tx("RuleOrder3") },
      ],
    },
  ];
}

function buildHelpHtml() {
  const items = TECHNIQUE_ORDER.map((techId) => {
    const technique = getTechniqueData(techId);
    return `
      <div class="br-help-tech">
        <div class="br-help-tech__head"><i class="${technique.icon}"></i> <b>${escapeHtml(technique.name)}</b></div>
        <div><b>${escapeHtml(tx("Success"))}:</b> ${escapeHtml(technique.successText)}</div>
        <div><b>${escapeHtml(tx("Failure"))}:</b> ${escapeHtml(technique.failureText)}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="tsu-dialog-content br-help">
      <p>${escapeHtml(tf("HelpIntro1", { title: GAME_TITLE }))}</p>
      <p>${escapeHtml(tx("HelpIntro2"))}</p>
      <p>${escapeHtml(tx("HelpIntro3"))}</p>
      <h3>${escapeHtml(tx("HelpTechniques"))}</h3>
      ${items}
    </div>
  `;
}

const template = `
<div class="tsu-game tsu-bug-race" id="bug-race-app">
  <section class="tsu-panel tsu-panel--rules br-col-rules">
    <div class="tsu-panel-title">
      <span>{{ui.rulesTitle}}</span>
      <button type="button" class="tsu-help-button" data-action="help">?</button>
    </div>
    {{#each ui.ruleSections}}
      <div class="tsu-rule-block">
        <h3 class="tsu-rule-header">{{title}}</h3>
        <div class="tsu-rule-list">
          {{#each items}}
            <div class="tsu-rule-item br-rule-item">
              <div class="br-rule-item__label">{{label}}</div>
              <div class="br-rule-item__copy">{{copy}}</div>
            </div>
          {{/each}}
        </div>
      </div>
    {{/each}}
  </section>

  <section class="tsu-panel tsu-panel--main br-col-main" id="br-main-area">
    <div class="tsu-game-header br-header">
      <h2>{{ui.title}}</h2>
      <div class="tsu-status-line">{{statusLine}}</div>
    </div>
    {{#if showEmptyState}}<div class="tsu-empty-state br-empty-state">{{emptyState}}</div>{{/if}}
    <div class="tsu-player-list">
      {{#each players}}
        <article class="tsu-player-card br-player-card {{classes}}" data-actor-card="{{id}}">
          <div class="br-card-headrail">
            <div class="tsu-badge br-distance-badge">{{distanceLabel}}</div>
            {{#if showRemove}}
              <button type="button" class="tsu-icon-button br-remove-btn" data-action="remove-player" data-actor-id="{{id}}"><i class="fas fa-times"></i></button>
            {{/if}}
          </div>

          <div class="tsu-player-card-top">
            <img class="tsu-avatar" src="{{img}}" alt="{{trainerName}}">
            <div class="tsu-player-meta">
              <div class="tsu-player-name">{{bugName}}</div>
              <div class="tsu-player-subline">
                <span class="tsu-chip br-chip">{{trainerName}}</span>
                {{#if joinCheckbox}}
                  <label class="tsu-checkbox br-join-label"><input type="checkbox" class="br-join-toggle" data-actor-id="{{id}}" {{#if isParticipating}}checked{{/if}}> <span>{{joinLabel}}</span></label>
                {{/if}}
                {{#if statusText}}<span class="tsu-chip br-chip">{{statusText}}</span>{{/if}}
                {{#if pendingLuckText}}<span class="tsu-chip br-chip is-warning">{{pendingLuckText}}</span>{{/if}}
              </div>
            </div>
          </div>

          {{#if showNameEditor}}
            <div class="br-name-row">
              <span>{{@root.ui.nameChampion}}</span>
              <input type="text" class="br-name-input" data-actor-id="{{id}}" value="{{bugName}}" maxlength="40">
            </div>
          {{/if}}

          <div class="br-stat-grid">
            {{#each stats}}
              <div class="br-stat-box {{classes}}">
                <div class="br-stat-box__label">{{label}}</div>
                <div class="br-stat-box__value">{{value}}</div>
              </div>
            {{/each}}
          </div>

          {{#if showBuildArea}}
            <div class="br-build-panel">
              <div class="br-build-panel__title">{{buildTitle}}</div>
              <div class="tsu-grid-buttons tsu-grid-buttons--4">
                {{#each buildButtons}}
                  <button type="button" class="tsu-small-button br-stat-btn" data-action="edit-stat" data-actor-id="{{../id}}" data-stat="{{stat}}" {{#if disabled}}disabled{{/if}}>
                    {{label}}
                  </button>
                {{/each}}
              </div>
            </div>
          {{/if}}

          {{#if showTechniqueArea}}
            {{#if showWaitingText}}
              <div class="br-waiting">{{waitingText}}</div>
            {{else}}
              {{#if selectedTechnique}}
                <div class="br-tech-preview">
                  <div class="br-tech-preview__title"><i class="{{selectedTechnique.icon}}"></i> {{selectedTechnique.name}}</div>
                  <div class="br-tech-preview__copy">
                    <div><b>{{@root.ui.successLabel}}</b> {{selectedTechnique.successText}}</div>
                    <div><b>{{@root.ui.failureLabel}}</b> {{selectedTechnique.failureText}}</div>
                  </div>
                </div>
              {{/if}}
              <div class="tsu-grid-buttons tsu-grid-buttons--3 br-tech-grid">
                {{#each techniqueButtons}}
                  <button type="button" class="tsu-chip br-tech-btn {{classes}}" data-action="select-technique" data-actor-id="{{../id}}" data-tech-id="{{techId}}" {{#if disabled}}disabled{{/if}}>
                    <i class="{{icon}}"></i>
                    <span>{{name}}</span>
                    <small>{{modifier}}</small>
                  </button>
                {{/each}}
              </div>
              <button type="button" class="tsu-button br-confirm-btn {{confirmClasses}}" data-action="confirm-choice" data-actor-id="{{id}}" {{#if confirmDisabled}}disabled{{/if}}>
                {{confirmLabel}}
              </button>
            {{/if}}
          {{/if}}

          {{#if showLuckControls}}
            <div class="br-luck-panel">
              <div class="br-luck-panel__title">{{@root.ui.luckQuestion}}</div>
              <div class="tsu-grid-buttons tsu-grid-buttons--2">
                <button type="button" class="tsu-button br-luck-btn" data-action="use-luck" data-actor-id="{{id}}" {{#if luckDisabled}}disabled{{/if}}>{{luckLabel}}</button>
                <button type="button" class="tsu-button br-luck-btn is-secondary" data-action="accept-failure" data-actor-id="{{id}}">{{@root.ui.acceptLabel}}</button>
              </div>
            </div>
          {{/if}}
        </article>
      {{/each}}
    </div>
  </section>

  <section class="tsu-panel tsu-panel--log br-col-log" id="br-log-area">
    <h3 class="tsu-panel-title">{{ui.chronicleTitle}}</h3>
    <div class="tsu-log-list">
      {{#each state.log}}
        {{{this}}}
      {{/each}}
    </div>
  </section>

  <div class="tsu-footer br-footer">
    <div class="br-footer-meta">
      {{#if isGM}}<label class="tsu-checkbox br-debug-label"><input type="checkbox" id="br-debug-mode" {{#if state.debugMode}}checked{{/if}}> {{ui.debugMode}}</label>{{/if}}
    </div>
    <div class="tsu-footer-actions">
      {{#each footerButtons}}
        <button type="button" class="tsu-button br-btn {{classes}}" data-action="{{action}}" {{#if disabled}}disabled{{/if}}>
          {{#if icon}}<i class="{{icon}}"></i> {{/if}}{{label}}
        </button>
      {{/each}}
    </div>
  </div>
</div>`;

class BugRaceApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      classes: ["tsu-window"],
      title: GAME_TITLE,
      width: 1460,
      height: 860,
      resizable: true,
      popOut: true,
      dragDrop: [{ dragSelector: null, dropSelector: ".window-content" }],
    });
  }

  _canDragDrop() {
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
    const patched = patchApplicationRegions(this, "#bug-race-app", [
      ".br-col-rules",
      "#br-main-area",
      "#br-log-area",
      ".br-footer",
    ], nextRoot);
    if (!patched) this.render(false);
  }

  getData() {
    const state = this.getState();
    const entries = getVisibleEntries(state);
    for (const [actorId, playerData] of entries) {
      normalizePlayerState(playerData, game.actors?.get(actorId));
    }

    const pinnedActorId = getPinnedPlayerActorIdForDisplay(entries, game.user);
    const players = entries
      .sort((left, right) => comparePlayerEntriesForDisplay(left, right, { state, user: game.user, locale: game.i18n?.lang || "ru", pinnedActorId }))
      .map(([actorId, playerData]) => this.createPlayerPresentation(state, actorId, playerData));

    const footerButtons = [];
    if (game.user?.isGM) {
      const primary = {
        action: "advance-phase",
        label: tx("FooterRound"),
        classes: "is-main",
        disabled: !allActivePlayersBuilt(state),
      };

      if (state.phase === "support") {
        primary.disabled = !allActivePlayersConfirmed(state);
      } else if (state.phase === "obstacle") {
        primary.disabled = getActiveEntries(state).some(([, playerData]) => playerData.needsLuck);
      } else if (state.phase === "sprint") {
        primary.disabled = false;
      } else if (state.phase === "upgrade") {
        primary.disabled = true;
      } else if (state.phase === "results") {
        primary.disabled = true;
      }

      footerButtons.push(primary);
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
        disabled: false,
      });
    }

    return {
      state,
      players,
      ui: {
        title: GAME_TITLE,
        rulesTitle: tx("RulesTitle"),
        nameChampion: tx("NameChampion"),
        successLabel: `${tx("Success")}:`,
        failureLabel: `${tx("Failure")}:`,
        luckQuestion: tx("LuckQuestion"),
        acceptLabel: tx("AcceptButton"),
        chronicleTitle: tx("ChronicleTitle"),
        debugMode: tx("DebugMode"),
        ruleSections: buildRulesSections(),
      },
      statusLine: state.phase === "support"
        ? tf("StatusSupport", { round: state.round, dc: currentRoundSupportDc(state) })
        : state.phase === "obstacle"
          ? tf("StatusObstacle", { round: state.round, dc: currentObstacleDc(state) })
          : state.phase === "sprint"
            ? tf("StatusSprint", { round: state.round })
            : (isRussianLocale() ? STATUS_BY_PHASE[state.phase] : (PHASES_EN[state.phase] ?? STATUS_BY_PHASE[state.phase] ?? "Setup")),
      isGM: Boolean(game.user?.isGM),
      showEmptyState: players.length === 0,
      emptyState: tx("EmptyState"),
      footerButtons,
    };
  }

  createPlayerPresentation(state, actorId, playerData) {
    const actor = game.actors?.get(actorId);
    const canOperate = canCurrentUserOperateActor(actor, state);
    const isGM = Boolean(game.user?.isGM);
    const selectedTechnique = getTechniqueData(playerData.selectedTech) ?? null;
    const inJoin = state.phase === "join";
    const inSupport = state.phase === "support";
    const inUpgrade = state.phase === "upgrade" && state.winnerId === actorId;
    const isWinner = state.winnerId === actorId;
    const showHiddenChoices = canOperate || (isGM && state.debugMode);
    const techniqueButtons = inSupport && playerData.isParticipating && !playerData.isDead && showHiddenChoices
      ? playerData.hand.map((techId) => {
        const technique = getTechniqueData(techId);
        return {
          techId,
          icon: technique.icon,
          name: technique.name,
          modifier: `${getTechniqueModifier(actor, technique) >= 0 ? "+" : ""}${getTechniqueModifier(actor, technique)}`,
          classes: playerData.selectedTech === techId ? "is-selected" : "",
          disabled: playerData.isConfirmed,
        };
      })
      : [];

    const stats = [
      { label: tx("StatEnd"), value: playerData.stats.end, classes: isWinner && playerData.lastUpgrade === "end" ? "is-upgrade" : "" },
      { label: tx("StatMob"), value: playerData.stats.mob, classes: isWinner && playerData.lastUpgrade === "mob" ? "is-upgrade" : "" },
      { label: tx("StatInt"), value: playerData.stats.int, classes: isWinner && playerData.lastUpgrade === "int" ? "is-upgrade" : "" },
      { label: tx("StatLuck"), value: `${playerData.stats.luck}/${playerData.maxLuck}`, classes: isWinner && playerData.lastUpgrade === "luck" ? "is-upgrade" : "" },
      { label: tx("StatFatigue"), value: `${playerData.fatigue}/${playerData.stats.end}`, classes: playerData.fatigue > playerData.stats.end ? "is-danger" : "" },
      { label: tx("StatPoints"), value: playerData.isNew ? playerData.points : tx("Ready"), classes: playerData.isNew && playerData.points > 0 ? "is-warning" : "" },
    ];

    return {
      id: actorId,
      img: actor?.img || DEFAULT_IMG,
      trainerName: actor?.name || tx("NoActor"),
      bugName: playerData.name,
      isParticipating: playerData.isParticipating,
      distanceLabel: tf("Distance", { value: playerData.distance }),
      joinCheckbox: inJoin && (canOperate || isGM),
      joinLabel: tx("JoinLabel"),
      showRemove: inJoin && isGM && playerData.source === "manual",
      statusText: playerData.isDead
        ? tx("Dead")
        : !playerData.isParticipating
          ? tx("Spectator")
          : playerData.isConfirmed
            ? tx("Confirmed")
            : inUpgrade && isWinner
              ? tx("NeedsReward")
              : "",
      pendingLuckText: playerData.needsLuck ? tx("WaitingLuck") : "",
      showNameEditor: inJoin && playerData.isParticipating && (canOperate || isGM),
      stats,
      showBuildArea: (inJoin && playerData.isParticipating && (canOperate || isGM) && playerData.points > 0) || (inUpgrade && (canOperate || isGM)),
      buildTitle: inUpgrade ? tx("BuildReward") : tf("BuildPoints", { points: playerData.points }),
      buildButtons: [
        { stat: "end", label: `${tx("StatEnd")}+`, disabled: playerData.stats.end >= 7 || (!inUpgrade && playerData.points <= 0) },
        { stat: "mob", label: `${tx("StatMob")}+`, disabled: playerData.stats.mob >= 7 || (!inUpgrade && playerData.points <= 0) },
        { stat: "int", label: `${tx("StatInt")}+`, disabled: playerData.stats.int >= 7 || (!inUpgrade && playerData.points <= 0) },
        { stat: "luck", label: `${tx("StatLuck")}+`, disabled: playerData.stats.luck >= 7 || (!inUpgrade && playerData.points <= 0) },
      ],
      showTechniqueArea: inSupport && playerData.isParticipating && !playerData.isDead,
      showWaitingText: inSupport && !showHiddenChoices,
      waitingText: tx("WaitingTechnique"),
      selectedTechnique: selectedTechnique ? {
        icon: selectedTechnique.icon,
        name: selectedTechnique.name,
        successText: selectedTechnique.successText,
        failureText: selectedTechnique.failureText,
      } : null,
      techniqueButtons,
      confirmLabel: playerData.isConfirmed ? tx("Confirmed") : tx("ConfirmButton"),
      confirmClasses: playerData.isConfirmed ? "is-confirmed" : "",
      confirmDisabled: playerData.isConfirmed || !playerData.selectedTech,
      showLuckControls: state.phase === "obstacle" && playerData.needsLuck && showHiddenChoices,
      luckDisabled: playerData.stats.luck <= 0,
      luckValue: playerData.stats.luck,
      luckLabel: tf("LuckButton", { value: playerData.stats.luck }),
      classes: [
        playerData.isParticipating ? "tsu-player-card--active" : "tsu-player-card--spectator",
        isWinner ? "tsu-player-card--winner" : "",
        playerData.isDead ? "tsu-player-card--loser br-player-card--dead" : "",
      ].filter(Boolean).join(" "),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", "[data-action]", (event) => this.onActionClick(event));
    html.on("change", ".br-join-toggle", (event) => {
      void requestGameAction(GAME_ID, "toggle-join", {
        actorId: event.currentTarget.dataset.actorId,
        isParticipating: event.currentTarget.checked,
      });
    });
    html.on("change", ".br-name-input", (event) => {
      void requestGameAction(GAME_ID, "set-bug-name", {
        actorId: event.currentTarget.dataset.actorId,
        name: event.currentTarget.value,
      });
    });
    html.on("change", "#br-debug-mode", (event) => {
      if (!game.user?.isGM) return;
      void requestGameAction(GAME_ID, "toggle-debug", { enabled: event.currentTarget.checked });
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
          title: GAME_TITLE,
          content: buildHelpHtml(),
          buttons: {
            close: { label: tx("Close") },
          },
        }).render(true);
        break;
      case "edit-stat":
        void requestGameAction(GAME_ID, "edit-stat", {
          actorId: button.dataset.actorId,
          stat: button.dataset.stat,
        });
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
      case "use-luck":
        void requestGameAction(GAME_ID, "use-luck", {
          actorId: button.dataset.actorId,
        });
        break;
      case "accept-failure":
        void requestGameAction(GAME_ID, "accept-failure", {
          actorId: button.dataset.actorId,
        });
        break;
      case "advance-phase":
        void requestGameAction(GAME_ID, "advance-phase", {});
        break;
      case "clear":
        void requestGameAction(GAME_ID, "clear", {});
        break;
      case "reset-game":
        void requestGameAction(GAME_ID, "reset-game", {});
        break;
      case "remove-player":
        void requestGameAction(GAME_ID, "remove-player", {
          actorId: button.dataset.actorId,
        });
        break;
      default:
        break;
    }
  }

  async _onDrop(event) {
    if (!game.user?.isGM) return;
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      return;
    }

    const actors = await getDroppedActors(data);
    if (!actors.length) return;
    void requestGameAction(GAME_ID, "add-dropped-actors", {
      actorIds: actors.map((actor) => actor.id),
    });
  }
}

const definition = {
  id: GAME_ID,
  createInitialState,
  ensureDefaultPlayers,
  syncDefaultPlayers,
  createApplication: () => new BugRaceApplication(),
  async handleAction({ action, data, state, senderId }) {
    state.players ||= {};
    state.excludedPlayers ||= {};

    for (const [actorId, playerData] of Object.entries(state.players)) {
      normalizePlayerState(playerData, game.actors?.get(actorId));
    }

    switch (action) {
      case "toggle-debug":
        if (!game.user?.isGM) return false;
        state.debugMode = Boolean(data.enabled);
        return true;
      case "toggle-join": {
        const actorId = String(data.actorId || "");
        const actor = game.actors?.get(actorId);
        if (!actor || !canSenderOperateActor(actorId, senderId)) return false;
        if (!state.players[actorId]) {
          await addActorToState(state, actor, { isParticipating: Boolean(data.isParticipating), source: "manual" });
          return true;
        }
        state.players[actorId].isParticipating = Boolean(data.isParticipating);
        if (state.players[actorId].isParticipating) state.excludedPlayers[actorId] = false;
        return true;
      }
      case "set-bug-name": {
        const actorId = String(data.actorId || "");
        if (state.phase !== "join" || !canSenderOperateActor(actorId, senderId) || !state.players[actorId]) return false;
        const nextName = String(data.name || "").trim().slice(0, 40);
        if (!nextName) return false;
        state.players[actorId].name = nextName;
        return true;
      }
      case "edit-stat": {
        const actorId = String(data.actorId || "");
        const stat = String(data.stat || "");
        const playerData = state.players[actorId];
        if (!playerData || !["end", "mob", "int", "luck"].includes(stat) || !canSenderOperateActor(actorId, senderId)) return false;

        if (state.phase === "upgrade" && state.winnerId === actorId) {
          if (playerData.stats[stat] >= 7) return false;
          playerData.stats[stat] = sanitizeStatValue(playerData.stats[stat] + 1);
          playerData.lastUpgrade = stat;
          playerData.maxLuck = Math.max(playerData.maxLuck, playerData.stats.luck);
          playerData.isNew = false;
          playerData.points = 0;
          state.phase = "results";
          await finalizeBugs(state);
          addSystemLog(state, tf("UpgradeGain", { name: playerData.name, stat: getStatLabel(stat) }));
          return true;
        }

        if (state.phase !== "join" || !playerData.isParticipating || playerData.points <= 0 || playerData.stats[stat] >= 7) return false;
        playerData.stats[stat] = sanitizeStatValue(playerData.stats[stat] + 1);
        playerData.points = Math.max(0, playerData.points - 1);
        if (playerData.points === 0) {
          playerData.isNew = false;
          playerData.maxLuck = Math.max(playerData.maxLuck, playerData.stats.luck);
        }
        return true;
      }
      case "select-technique": {
        const actorId = String(data.actorId || "");
        const techId = String(data.techId || "");
        const playerData = state.players[actorId];
        if (state.phase !== "support" || !playerData || !canSenderOperateActor(actorId, senderId) || playerData.isConfirmed) return false;
        if (!playerData.hand.includes(techId)) return false;
        playerData.selectedTech = techId;
        return true;
      }
      case "confirm-choice": {
        const actorId = String(data.actorId || "");
        const playerData = state.players[actorId];
        if (state.phase !== "support" || !playerData || !canSenderOperateActor(actorId, senderId) || !TECHNIQUES[playerData.selectedTech]) return false;
        playerData.isConfirmed = true;
        return true;
      }
      case "use-luck": {
        const actorId = String(data.actorId || "");
        const playerData = state.players[actorId];
        if (state.phase !== "obstacle" || !playerData || !playerData.needsLuck || !canSenderOperateActor(actorId, senderId) || playerData.stats.luck <= 0) return false;
        playerData.stats.luck = sanitizeStatValue(playerData.stats.luck - 1);
        playerData.needsLuck = false;
        state.log.unshift(`
          <div class="tsu-log-entry br-log-entry br-log-entry--success">
            ${escapeHtml(tf("LuckReroll", { name: playerData.name }))}
          </div>
        `);
        const result = await processSingleObstacle(state, actorId, { isReroll: true });
        if (result.entry) state.log.unshift(result.entry);
        return true;
      }
      case "accept-failure": {
        const actorId = String(data.actorId || "");
        const playerData = state.players[actorId];
        if (state.phase !== "obstacle" || !playerData || !playerData.needsLuck || !canSenderOperateActor(actorId, senderId)) return false;
        await resolveObstacleFailure(state, actorId);
        return true;
      }
      case "advance-phase":
        if (!game.user?.isGM) return false;
        if (state.phase === "join") {
          if (!allActivePlayersBuilt(state)) return false;
          state.phase = "support";
          state.round = 1;
          state.winnerId = "";
          setupRound(state);
          return true;
        }
        if (state.phase === "support") {
          if (!allActivePlayersConfirmed(state)) return false;
          await processSupport(state);
          state.phase = "obstacle";
          await processObstacle(state);
          return true;
        }
        if (state.phase === "obstacle") {
          if (getActiveEntries(state).some(([, playerData]) => playerData.needsLuck)) return false;
          state.phase = "sprint";
          await processSprint(state);
          return true;
        }
        if (state.phase === "sprint") {
          if (state.round < 3) {
            state.round += 1;
            state.phase = "support";
            setupRound(state);
          } else {
            await resolveWinner(state);
          }
          return true;
        }
        if (state.phase === "results") {
          resetStateForNewTable(state);
          await syncDefaultPlayers(state);
          return true;
        }
        return false;
      case "clear":
        if (!game.user?.isGM) return false;
        resetStateForNewTable(state);
        await syncDefaultPlayers(state);
        return true;
      case "remove-player": {
        if (!game.user?.isGM || state.phase !== "join") return false;
        const actorId = String(data.actorId || "");
        if (!state.players[actorId]) return false;
        delete state.players[actorId];
        delete state.excludedPlayers[actorId];
        return true;
      }
      case "add-dropped-actors": {
        if (!game.user?.isGM || state.phase !== "join") return false;
        const actorIds = Array.isArray(data.actorIds) ? data.actorIds : [];
        let changed = false;
        for (const actorId of actorIds) {
          const actor = game.actors?.get(actorId);
          if (!actor) continue;
          if (!state.players[actor.id]) {
            await addActorToState(state, actor, { isParticipating: true, source: "manual" });
            changed = true;
            continue;
          }
          state.players[actor.id].isParticipating = true;
          changed = true;
        }
        return changed;
      }
      case "reset-game":
        if (!game.user?.isGM) return false;
        resetStateForNewTable(state);
        await syncDefaultPlayers(state);
        state.log.unshift(`<div class="tsu-log-entry br-log-entry br-log-entry--system">${escapeHtml(tx("ResetDone"))}</div>`);
        return true;
      default:
        return false;
    }
  },
};

export function createBugRaceGameDefinition() {
  return definition;
}
