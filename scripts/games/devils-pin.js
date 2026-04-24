import {
  comparePlayerEntriesForDisplay,
  getPinnedPlayerActorIdForDisplay,
  getActorUuidFromDropData,
  getDroppedActors,
  MODULE_ID,
  escapeHtml,
  formatSignedNumber,
  getActorLoreModifier,
  getGameState,
  getNonGmCharacters,
  isActorControlledByNonGm,
  gobj,
  gt,
  gtf,
  notify,
  patchApplicationRegions,
  randomChoice,
  requestGameAction,
  t,
  userCanControlActor,
} from "../core.js";

const GAME_ID = "devils-pin";
const APP_ID = `${MODULE_ID}-${GAME_ID}`;
const I18N_ROOT = "Games.DevilsPin";
const DART_UUID = "Compendium.pf2e.equipment-srd.Item.Tt4Qw64fwrxhr5gT";
const DART_MATCH_TOKENS = Object.freeze(["dart", "дротик", "дрот"]);
const DEFAULT_BASE_DC = 15;
const PLAYER_TARGET_PREFIX = "player:";
const PF2E_DC_BY_LEVEL = [12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40, 42, 44, 46, 48];
const OUTCOME_KEYS_BY_RANK = ["UberFailure", "CriticalFailure", "Failure", "Success", "CriticalSuccess", "UberCrit"];
const GAMES_LORE_SELECTOR = ["game", "games", "\u0438\u0433\u0440"];
const COIN_CURRENCIES = Object.freeze({
  dd: { shortKey: "DevilishDebtShort", longKey: "DevilishDebtLong", fallbackShort: "DD", fallbackLong: "Devilish Debt" },
  cp: { shortKey: "CopperShort", longKey: "CopperLong", fallbackShort: "cp", fallbackLong: "Copper" },
  sp: { shortKey: "SilverShort", longKey: "SilverLong", fallbackShort: "sp", fallbackLong: "Silver" },
  gp: { shortKey: "GoldShort", longKey: "GoldLong", fallbackShort: "gp", fallbackLong: "Gold" },
  pp: { shortKey: "PlatinumShort", longKey: "PlatinumLong", fallbackShort: "pp", fallbackLong: "Platinum" },
});

const TARGETS = Object.freeze({
  tongue: { levelOffset: -2, manualDcOffset: 0, points: 1, key: "Tongue" },
  nose: { levelOffset: 2, manualDcOffset: 4, points: 2, key: "Nose" },
  horns: { levelOffset: 6, manualDcOffset: 8, points: 3, key: "Horns" },
});

const SKILLS = Object.freeze({
  atk: { key: "Attack", sort: 0 },
  per: { key: "Perception", sort: 1 },
  thi: { key: "Thievery", sort: 2 },
  lore: { key: "GamesLore", sort: 3 },
});

function createInitialState() {
  return {
    players: {},
    excludedPlayers: {},
    phase: "join",
    round: 1,
    dcOverride: null,
    log: [],
    results: null,
    debugMode: false,
    openSignal: null,
    currency: "sp",
    payoutClaimed: false,
    awardedWinners: {},
  };
}

function normalizeCoinCurrency(currency) {
  return COIN_CURRENCIES[currency] ? currency : "sp";
}

function ensureCurrencyState(state) {
  state.currency = normalizeCoinCurrency(state.currency);
  state.payoutClaimed = Boolean(state.payoutClaimed);
  state.awardedWinners = (state.awardedWinners && typeof state.awardedWinners === "object")
    ? state.awardedWinners
    : {};
}

function getCurrencyShort(definition, currency) {
  const normalized = normalizeCoinCurrency(currency);
  const config = COIN_CURRENCIES[normalized];
  return gt(definition, `Currency.${config.shortKey}`, config.fallbackShort);
}

function getCurrencyLong(definition, currency) {
  const normalized = normalizeCoinCurrency(currency);
  const config = COIN_CURRENCIES[normalized];
  return gt(definition, `Currency.${config.longKey}`, config.fallbackLong);
}

function isScoreOnlyCurrency(currency) {
  return normalizeCoinCurrency(currency) === "dd";
}

function formatCurrencyAmount(definition, state, amount) {
  return `${Math.max(0, Math.trunc(Number(amount) || 0))} ${getCurrencyShort(definition, state.currency)}`;
}

function ensurePlayerActionState(playerData) {
  if (!playerData) return;
  if (typeof playerData.selectedSkill !== "string") playerData.selectedSkill = "";
  if (typeof playerData.selectedTarget !== "string") playerData.selectedTarget = "";
  if (typeof playerData.lastSkill !== "string") playerData.lastSkill = "";
  if (typeof playerData.lastTarget !== "string") playerData.lastTarget = "";
  if (typeof playerData.lastResolvedTarget !== "string") playerData.lastResolvedTarget = "";
  if (typeof playerData.lastPlayerTarget !== "string") playerData.lastPlayerTarget = "";
  if (!playerData.blockedUntilRound || typeof playerData.blockedUntilRound !== "object") playerData.blockedUntilRound = {};
  if (!Number.isFinite(Number(playerData.level))) playerData.level = 0;
  playerData.isConfirmed = Boolean(playerData.isConfirmed);
  playerData.hasThrown = Boolean(playerData.hasThrown);
  playerData.hasPaid = Boolean(playerData.hasPaid);
}

function replaceStateContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function makePlayerTargetId(actorId) {
  return actorId ? `${PLAYER_TARGET_PREFIX}${actorId}` : "";
}

function isPlayerTargetToken(targetToken) {
  return String(targetToken ?? "").startsWith(PLAYER_TARGET_PREFIX);
}

function getActorIdFromTargetToken(targetToken) {
  return isPlayerTargetToken(targetToken) ? String(targetToken).slice(PLAYER_TARGET_PREFIX.length) : "";
}

function isBoardTargetToken(targetToken) {
  return Boolean(TARGETS[targetToken]);
}

function getActivePlayerEntries(state) {
  return Object.entries(state.players ?? {}).filter(([, playerData]) => {
    ensurePlayerActionState(playerData);
    return playerData.isParticipating;
  });
}

function getLevelBasedDc(level) {
  const safeLevel = Math.max(0, Math.min(PF2E_DC_BY_LEVEL.length - 1, Math.trunc(Number(level) || 0)));
  return PF2E_DC_BY_LEVEL[safeLevel] || DEFAULT_BASE_DC;
}

function getSuggestedBaseLevel(state) {
  const activePlayers = getActivePlayerEntries(state);
  if (!activePlayers.length) return 0;
  return Math.min(...activePlayers.map(([actorId, playerData]) => {
    const actor = game.actors?.get(actorId);
    const level = actor?.level || actor?.system?.details?.level?.value || Number(playerData.level) || 0;
    playerData.level = level;
    return level;
  }));
}

function getSuggestedBaseDc(state) {
  return getLevelBasedDc(getSuggestedBaseLevel(state));
}

function getBaseDc(state) {
  const override = Math.trunc(Number(state?.dcOverride));
  if (Number.isFinite(override) && override > 0) return override;
  const legacyOverride = Math.trunc(Number(state?.baseDc));
  if (Number.isFinite(legacyOverride) && legacyOverride > 0 && legacyOverride !== DEFAULT_BASE_DC) return legacyOverride;
  return getSuggestedBaseDc(state);
}

function hasManualBaseDcOverride(state) {
  const override = Math.trunc(Number(state?.dcOverride));
  if (Number.isFinite(override) && override > 0) return true;
  const legacyOverride = Math.trunc(Number(state?.baseDc));
  return Number.isFinite(legacyOverride) && legacyOverride > 0 && legacyOverride !== DEFAULT_BASE_DC;
}

function getTargetDc(state, targetOrId) {
  const target = typeof targetOrId === "string" ? TARGETS[targetOrId] : targetOrId;
  if (!target) return DEFAULT_BASE_DC;
  if (hasManualBaseDcOverride(state)) return getBaseDc(state) + (target.manualDcOffset || 0);
  return getLevelBasedDc(getSuggestedBaseLevel(state) + (target.levelOffset || 0));
}

function getDcLabel(definition) {
  return gt(definition, "Rules.DcShort", "DC");
}

function formatDcPlaceholder(definition, dc) {
  return gtf(definition, "Rules.DcPlaceholder", { dc }, ({ dc: value }) => `${getDcLabel(definition)} ${value}`);
}

function getSkillLabel(definition, skillId) {
  const skill = SKILLS[skillId];
  return skill ? gt(definition, `Skills.${skill.key}.Short`, skillId) : "";
}

function getTargetLabel(definition, targetId) {
  const target = TARGETS[targetId];
  return target ? gt(definition, `Targets.${target.key}.Name`, target.key) : "";
}

function getPlayerAttackLabel(definition, state, actorId) {
  const name = state.players?.[actorId]?.name || game.actors?.get(actorId)?.name || actorId;
  return gtf(definition, "Selection.PlayerTarget", { name }, ({ name: playerName }) => `Attack ${playerName}`);
}

function getSelectionTargetLabel(definition, state, targetToken) {
  if (isBoardTargetToken(targetToken)) return getTargetLabel(definition, targetToken);
  if (isPlayerTargetToken(targetToken)) return getPlayerAttackLabel(definition, state, getActorIdFromTargetToken(targetToken));
  return "";
}

function findDartStrike(actor) {
  return findResolvedDartStrike(actor);
  const actions = actor.system?.actions?.filter((entry) => entry?.type === "strike") ?? [];
  return actions.find((entry) => {
    const item = entry.item;
    
    return slug === "dart" || name.includes("dart") || name.includes("дрот");
  }) ?? null;
}

function matchesDartText(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized && DART_MATCH_TOKENS.some((token) => normalized === token || normalized.includes(token));
}

function describeActorStrikes(actor) {
  const actions = actor?.system?.actions ?? [];
  return actions
    .filter((entry) => entry?.type === "strike")
    .map((entry, index) => ({
      index,
      label: entry.label ?? "",
      slug: entry.slug ?? "",
      totalModifier: entry.totalModifier ?? null,
      itemName: entry.item?.name ?? "",
      itemSlug: entry.item?.slug ?? "",
    }));
}

function findResolvedDartStrike(actor) {
  const actions = actor?.system?.actions?.filter((entry) => entry?.type === "strike") ?? [];
  return actions.find((entry) => {
    const item = entry?.item;
    return [entry?.slug, entry?.label, item?.slug, item?.name].some(matchesDartText);
  }) ?? null;
}

async function getDartModifierForCharacter(actor) {
  if (!actor || actor.type !== "character") return 0;

  try {
    const existingStrike = findResolvedDartStrike(actor);
    if (existingStrike?.totalModifier != null) return existingStrike.totalModifier;

    const dartSource = await fromUuid(DART_UUID);
    if (!dartSource) {
      console.warn(`${MODULE_ID} | devils-pin: dart source not found for ${actor.name}`, {
        actor: actor.name,
        strikes: describeActorStrikes(actor),
      });
      return actor.system.abilities?.dex?.mod || 0;
    }

    const itemData = dartSource.toObject();
    itemData.system ??= {};
    itemData.system.equipped = {
      ...(itemData.system.equipped ?? {}),
      carryType: "held",
      handsHeld: 1,
    };
    const [tempItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
    if (!tempItem) {
      console.warn(`${MODULE_ID} | devils-pin: failed to create temporary dart for ${actor.name}`, {
        actor: actor.name,
        strikes: describeActorStrikes(game.actors?.get(actor.id) ?? actor),
      });
      return actor.system.abilities?.dex?.mod || 0;
    }

    try {
      const refreshedActor = game.actors?.get(actor.id) ?? actor;
      const dartStrike = findResolvedDartStrike(refreshedActor);
      if (dartStrike?.totalModifier != null) return dartStrike.totalModifier;

      console.warn(`${MODULE_ID} | devils-pin: falling back to DEX for ${actor.name}`, {
        actor: actor.name,
        dex: actor.system.abilities?.dex?.mod ?? 0,
        tempItem: {
          id: tempItem.id,
          name: tempItem.name,
          slug: tempItem.slug ?? tempItem.system?.slug ?? "",
        },
        strikes: describeActorStrikes(refreshedActor),
      });
      return actor.system.abilities?.dex?.mod ?? 0;
    } finally {
      await actor.deleteEmbeddedDocuments("Item", [tempItem.id]);
    }
  } catch (_error) {
    console.warn(`${MODULE_ID} | devils-pin: failed to compute dart modifier for ${actor.name}`, _error);
    return actor.system?.abilities?.dex?.mod || 0;
  }
}

function getLoreModifier(actor) {
  return getActorLoreModifier(actor, GAMES_LORE_SELECTOR);
  if (!actor) return 0;
  const isNpc = actor.type === "npc";
  const system = actor.system ?? {};
  const level = system.details?.level?.value || 0;
  const intelligence = system.abilities?.int?.mod || 0;
  const hasUntrainedImprovisation = actor.type === "character" && actor.items.some((item) => {
    if (item.type !== "feat") return false;
    const slug = String(item.slug ?? item.system?.slug ?? "").toLowerCase();
    const sourceId = String(item.sourceId ?? item.flags?.core?.sourceId ?? "").toLowerCase();
    const name = String(item.name ?? "").toLowerCase();
    return slug === "untrained-improvisation"
      || sourceId.includes(".item.untrained-improvisation")
      || name.includes("untrained improvisation");
  });
  const untrainedModifier = intelligence + (hasUntrainedImprovisation ? Math.max(level - 2, 0) : 0);
  const lore = actor.items.find((item) => item.type === "lore" && ["game", "games", "����", "����"].some((term) => item.name.toLowerCase().includes(term)));
  if (!lore) return untrainedModifier;
  if (isNpc) return lore.system.mod?.value || intelligence;
  const rank = lore.system.proficient?.value || 0;
  return rank > 0 ? (rank * 2 + level + intelligence) : untrainedModifier;
}

function getAttackModifierForNpc(actor) {
  const system = actor.system ?? {};
  const level = system.details?.level?.value || 0;
  const dexterity = system.abilities?.dex?.mod || 0;
  const strikes = actor.items.filter((item) => item.type === "melee");
  const bonuses = strikes.map((item) => item.system.bonus?.value || 0);
  return bonuses.length ? Math.min(...bonuses) : (level + 2 + dexterity);
}

function calculateModifiers(actor, playerData) {
  if (!actor) return { atk: 0, per: 0, thi: 0, lore: 0 };
  if (actor.type === "npc") {
    return {
      atk: getAttackModifierForNpc(actor),
      per: actor.system.perception?.mod || 0,
      thi: actor.system.skills?.thievery?.base || actor.system.skills?.thievery?.value || 0,
      lore: getActorLoreModifier(actor, GAMES_LORE_SELECTOR),
    };
  }
  return {
    atk: playerData.cachedAtk || 0,
    per: actor.perception?.mod || 0,
    thi: actor.skills?.thievery?.mod || 0,
    lore: getActorLoreModifier(actor, GAMES_LORE_SELECTOR),
  };
}

function getOutcomeMeta(definition, outcomeKey) {
  return {
    label: gt(definition, `Outcomes.${outcomeKey}.Label`, outcomeKey),
    color: gt(definition, `Outcomes.${outcomeKey}.Color`, "#ffffff"),
    style: gt(definition, `Outcomes.${outcomeKey}.Style`, "background: rgba(255,255,255,0.08);"),
  };
}

function normalizeOutcomeLabel(label) {
  return String(label ?? "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

function getOutcomeClassName(outcomeKey) {
  return String(outcomeKey ?? "")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function getChronicleLogVisual(outcomeKey) {
  switch (outcomeKey) {
    case "UberCrit":
      return {
        badgeColor: "#ffaa00",
        wrapperStyle: "background:rgba(90,74,0,0.3); border:1px solid gold; color:#ffcc00;",
      };
    case "CriticalSuccess":
      return {
        badgeColor: "#2ecc71",
        wrapperStyle: "background:rgba(46,204,113,0.15); border-left:4px solid #2ecc71;",
      };
    case "Success":
      return {
        badgeColor: "#27ae60",
        wrapperStyle: "background:rgba(39,174,96,0.1); border-left:3px solid #27ae60;",
      };
    case "Failure":
      return {
        badgeColor: "#e67e22",
        wrapperStyle: "background:rgba(230,126,34,0.1); border-left:3px solid #e67e22;",
      };
    case "CriticalFailure":
      return {
        badgeColor: "#c0392b",
        wrapperStyle: "background:rgba(192,57,43,0.2); border-left:4px solid #c0392b;",
      };
    default:
      return {
        badgeColor: "#9b59b6",
        wrapperStyle: "background:rgba(68,0,68,0.3); border:1px solid #9b59b6; color:#d689ff;",
      };
  }
}

function buildThrowLogEntry(definition, outcomeKey, {
  state,
  label,
  d20,
  mod,
  total,
  dc,
  mathLabel,
  flavor,
  oldDebt,
  newDebt,
  delta,
  target,
  skill,
  extraHtml = "",
}) {
  const normalizedLabel = normalizeOutcomeLabel(label);
  const visual = getChronicleLogVisual(outcomeKey);
  const dcLabel = getDcLabel(definition);
  const math = mathLabel || `${d20}+${mod}=${total} vs ${dcLabel} ${dc}`;
  const debtLine = gtf(
    definition,
    "Log.DebtLine",
    { oldDebt, newDebt, delta, currency: getCurrencyShort(definition, state.currency) },
    ({ oldDebt: from, newDebt: to, delta: diff, currency }) => `Debt: ${from} -> <b>${to}</b> (${diff} ${currency})`
  );

  return `<div class="tsu-log-entry" style="padding:6px; margin-bottom:5px; border-radius:4px; ${visual.wrapperStyle}">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:3px;">
      <span style="background:${visual.badgeColor}; color:black; padding:1px 6px; border-radius:3px; font-weight:bold; font-size:10px;">${escapeHtml(normalizedLabel)}</span>
      <span style="opacity:0.7; font-size:10px;">[${escapeHtml(math)}]</span>
    </div>
    <div style="margin-bottom:4px; line-height:1.2; font-size:11px;"><b>${escapeHtml(skill)}</b> -> <b>${escapeHtml(target)}</b></div>
    <div style="line-height:1.2; font-size:11px;">${flavor}</div>
    ${extraHtml ? `<div style="margin-top:4px; line-height:1.2; font-size:11px;">${extraHtml}</div>` : ""}
    <div style="margin-top:4px; line-height:1.2; font-size:11px;">${debtLine}</div>
  </div>`;
}

function getFlavor(definition, category, actorName) {
  const choices = gobj(definition, `Flavor.${category}`, [gt(definition, "FlavorFallback", "The dart flies true.")]);
  return randomChoice(choices, gt(definition, "FlavorFallback", "The dart flies true."))
    .replaceAll("{n}", `<b style="color:white">${escapeHtml(actorName)}</b>`);
}

async function addActorToState(state, actor, { isParticipating = false, source = "manual" } = {}) {
  ensureCurrencyState(state);
  if (!actor) return;
  state.players ||= {};

  const existing = state.players[actor.id];
  const level = actor.level || actor.system?.details?.level?.value || 0;
  if (existing) {
    ensurePlayerActionState(existing);
    existing.name = actor.name;
    existing.img = actor.img;
    existing.cachedAtk = Number(existing.cachedAtk) || 0;
    existing.level = level;
    existing.source = source;
    if (actor.type === "npc") {
      existing.isParticipating = true;
    } else if (source === "manual" && isParticipating) {
      existing.isParticipating = true;
    }
    return;
  }

  state.players[actor.id] = {
    name: actor.name,
    img: actor.img,
    debt: 10,
    isParticipating,
    hasThrown: false,
    selectedSkill: "",
    selectedTarget: "",
    cachedAtk: 0,
    lastSkill: "",
    lastTarget: "",
    lastResolvedTarget: "",
    lastPlayerTarget: "",
    blockedUntilRound: {},
    isConfirmed: false,
    hasPaid: false,
    level,
    source,
  };
}

async function ensureDefaultPlayers(state) {
  for (const actor of getNonGmCharacters()) {
    await addActorToState(state, actor, { isParticipating: false, source: "auto" });
  }
}

async function syncDefaultPlayers(state) {
  const defaultActors = getNonGmCharacters();
  state.excludedPlayers ||= {};
  const defaultIds = new Set(defaultActors.map((actor) => actor.id));

  for (const actorId of defaultIds) {
    delete state.excludedPlayers[actorId];
  }

  for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
    const actor = game.actors.get(actorId);
    const isCharacter = actor?.type === "character";
    const source = playerData.source ?? "auto";
    if (source === "manual") continue;
    if (isCharacter && !defaultIds.has(actorId)) {
      delete state.players[actorId];
      continue;
    }
    playerData.source = "auto";
  }

  for (const actor of defaultActors) {
    if (state.excludedPlayers[actor.id]) continue;
    if (!state.players[actor.id]) {
      await addActorToState(state, actor, { isParticipating: false, source: "auto" });
      continue;
    }

    state.players[actor.id].name = actor.name;
    state.players[actor.id].img = actor.img;
    state.players[actor.id].cachedAtk = Number(state.players[actor.id].cachedAtk) || 0;
    state.players[actor.id].level = actor.level || actor.system?.details?.level?.value || 0;
    state.players[actor.id].source = "auto";
  }
}

function buildSummaryUi(definition, state) {
  const parseRuleLabel = (rawLabel) => {
    const label = String(rawLabel ?? "");
    const match = label.match(/^(\S+)\s+(.+)$/u);
    return {
      icon: match?.[1] ?? "",
      label: match?.[2] ?? label,
    };
  };

  return {
    title: gt(definition, "Title", "Devil's Pin"),
    rulesTitle: gt(definition, "Rules.PanelTitle", "Rules"),
    spectatorLabel: gt(definition, "Spectator", "Spectating"),
    joinLabel: gt(definition, "JoinLabel", "I'm in the game"),
    debugLabel: gt(definition, "DebugMode", "GM debug mode"),
    helpTitle: gt(definition, "Rules.HelpTitle", "Devil's Pin Rules"),
    helpHtml: gt(definition, "Rules.HelpHtml", "<p>No rules available.</p>"),
    footerButtons: {
      start: gt(definition, "Buttons.Start", "Start"),
      clear: gt(definition, "Buttons.Clear", "Clear Table"),
      resetRound: gt(definition, "Buttons.ResetRound", "Round"),
      resetGame: gt(definition, "Buttons.ResetGame", "Full Reset"),

      remove: gt(definition, "Buttons.Remove", "Remove"),
      pay: gt(definition, "Buttons.Pay", "Pay"),
      collected: gt(definition, "Buttons.Collected", "Collected"),
      paid: gt(definition, "Buttons.Paid", "Paid"),
    },
    sections: [
      {
        title: gt(definition, "Rules.TargetsHeader", "Targets"),
        items: Object.entries(TARGETS).map(([targetId, target]) => ({
          icon: gt(definition, `Targets.${target.key}.Icon`, ""),
          label: gt(definition, `Targets.${target.key}.Name`, target.key),
          copy: `${getTargetDc(state, targetId)} / ${target.points}`,
          itemClasses: "dp-rule-item--target",
          id: targetId,
        })),
      },
      {
        title: gt(definition, "Rules.OutcomesHeader", "Outcomes"),
        items: ["UberCrit", "CriticalSuccess", "Success", "Failure", "CriticalFailure", "UberFailure"].map((outcomeKey) => {
          const parsedLabel = parseRuleLabel(gt(definition, `Outcomes.${outcomeKey}.Label`, outcomeKey));
          return {
            icon: parsedLabel.icon,
            label: parsedLabel.label,
            copy: gt(definition, `Outcomes.${outcomeKey}.Summary`, ""),
            itemClasses: "dp-rule-item--outcome",
          };
        }),
      },
      {
        title: gt(definition, "Rules.RestrictionsHeader", "Restrictions"),
        items: [
          {
            icon: "🔁",
            label: gt(definition, "Rules.Restrictions.NoSameSkillLabel", "Same skill"),
            copy: gt(definition, "Rules.Restrictions.NoSameSkillSummary", "You cannot use the same skill twice in a row."),
            itemClasses: "dp-rule-item--restriction",
          },
          {
            icon: "🎯",
            label: gt(definition, "Rules.Restrictions.NoSameFaceLabel", "Same final target"),
            copy: gt(definition, "Rules.Restrictions.NoSameFaceSummary", "You cannot end on the same face part in consecutive rounds."),
            itemClasses: "dp-rule-item--restriction",
          },
          {
            icon: "🪃",
            label: gt(definition, "Rules.Restrictions.NoSameInterferenceLabel", "Same interference target"),
            copy: gt(definition, "Rules.Restrictions.NoSameInterferenceSummary", "You cannot target the same player's throw in consecutive rounds."),
            itemClasses: "dp-rule-item--restriction",
          },
        ],
      },
    ],
  };
}

function isBoardTargetBlocked(playerData, targetId, round) {
  ensurePlayerActionState(playerData);
  return Number(playerData.blockedUntilRound?.[targetId] || 0) >= round;
}

function canChooseBoardTarget(state, playerData, targetId) {
  ensurePlayerActionState(playerData);
  if (!TARGETS[targetId]) return false;
  if (playerData.lastResolvedTarget === targetId) return false;
  return !isBoardTargetBlocked(playerData, targetId, state.round);
}

function canChoosePlayerTarget(state, actorId, playerData, targetActorId) {
  ensurePlayerActionState(playerData);
  if (!targetActorId || targetActorId === actorId) return false;
  if (!state.players?.[targetActorId]?.isParticipating) return false;
  return playerData.lastPlayerTarget !== targetActorId;
}

function isChoiceReady(state, actorId, playerData) {
  ensurePlayerActionState(playerData);
  if (!playerData.selectedSkill || !playerData.selectedTarget || playerData.lastSkill === playerData.selectedSkill) return false;
  if (isBoardTargetToken(playerData.selectedTarget)) {
    return canChooseBoardTarget(state, playerData, playerData.selectedTarget);
  }
  if (isPlayerTargetToken(playerData.selectedTarget)) {
    return canChoosePlayerTarget(state, actorId, playerData, getActorIdFromTargetToken(playerData.selectedTarget));
  }
  return false;
}

function buildSelectionText(definition, state, playerData) {
  ensurePlayerActionState(playerData);
  const selectedSkill = getSkillLabel(definition, playerData.selectedSkill);
  const selectedTarget = getSelectionTargetLabel(definition, state, playerData.selectedTarget);
  const lastSkill = getSkillLabel(definition, playerData.lastSkill);
  const lastTarget = getSelectionTargetLabel(definition, state, playerData.lastTarget);
  const lastResolvedTarget = getTargetLabel(definition, playerData.lastResolvedTarget);

  let current = "";
  if (selectedSkill && selectedTarget) {
    current = gtf(definition, "Selection.CurrentChoice", { skill: selectedSkill, target: selectedTarget }, ({ skill, target }) => `Chosen: ${skill} -> ${target}`);
  } else if (selectedSkill) {
    current = gtf(definition, "Selection.CurrentSkill", { skill: selectedSkill }, ({ skill }) => `Chosen skill: ${skill}`);
  } else if (selectedTarget) {
    current = gtf(definition, "Selection.CurrentTarget", { target: selectedTarget }, ({ target }) => `Chosen target: ${target}`);
  }

  const last = lastSkill && lastTarget
    ? gtf(definition, "Selection.LastThrow", { skill: lastSkill, target: lastTarget }, ({ skill, target }) => `Last throw: ${skill} -> ${target}`)
    : "";

  const resolved = lastResolvedTarget
    ? gtf(definition, "Selection.LastResolvedTarget", { target: lastResolvedTarget }, ({ target }) => `Resolved target: ${target}`)
    : "";

  return { current, last, resolved };
}

function canCurrentUserOperateActor(actor, state) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return Boolean(state?.debugMode) || actor.type === "npc";
  return userCanControlActor(actor, game.user);
}

function canSenderOperateActor(actorId, senderId, state, canUserControlActor) {
  const sender = game.users?.get(senderId);
  if (!sender) return false;
  if (sender.isGM) return Boolean(state?.debugMode) || game.actors?.get(actorId)?.type === "npc";
  return canUserControlActor(actorId, senderId);
}

function canCurrentUserToggleJoin(actor, state) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return true;
  return userCanControlActor(actor, game.user);
}

function canSenderToggleJoin(actorId, senderId, _state, canUserControlActor) {
  const sender = game.users?.get(senderId);
  if (!sender) return false;
  if (sender.isGM) return true;
  return canUserControlActor(actorId, senderId);
}

function isCurrentUserSpectator(state) {
  if (!game.user) return false;
  if (game.user.isGM) {
    return !Object.entries(state?.players ?? {}).some(([actorId, playerData]) => {
      if (!playerData?.isParticipating) return false;
      return game.actors?.get(actorId)?.type === "npc";
    });
  }
  return !Object.entries(state?.players ?? {}).some(([actorId, playerData]) => {
    if (!playerData?.isParticipating) return false;
    return userCanControlActor(game.actors?.get(actorId), game.user);
  });
}

function buildHeaderStatus(definition, state) {
  if (state.phase === "join") return gt(definition, "Status.Preparing", "Preparing the game");
  if (state.phase === "playing") return gtf(definition, "Status.Round", { round: state.round }, ({ round }) => `Round ${round}`);
  if (state.phase === "results") return gt(definition, "Status.Results", "Results");
  return "";
}

function buildEmptyState(definition, state, visibleEntries = null) {
  const resolvedEntries = visibleEntries ?? Object.entries(state.players ?? {}).filter(([actorId, entry]) => !state.excludedPlayers?.[actorId] || entry?.source === "manual");
  const playerCount = resolvedEntries.length;
  const participatingCount = resolvedEntries.filter(([, entry]) => entry.isParticipating).length;
  if (!playerCount) {
    return t("Common.Empty.NoPlayers", "No players found. Assign characters to users or drag actors into the game window.");
  }
  if (state.phase === "join" && !participatingCount) {
    return gt(definition, "Empty.JoinInstructions", "Players mark \"I'm in the game\", then the GM clicks Start.");
  }
  if (state.phase === "playing" && !participatingCount) {
    return gt(definition, "Empty.NoParticipants", "There are no participants. Return to setup and mark players as participating.");
  }
  return "";
}

function buildPlayerStatusText(definition, state, playerData, { canChoose, isWinner, isLoser }) {
  ensurePlayerActionState(playerData);
  if (state.phase === "join") {
    return playerData.isParticipating
      ? gt(definition, "Status.ReadyToPlay", "Ready to play")
      : "";
  }
  if (state.phase === "playing") {
    if (!playerData.isParticipating) return gt(definition, "Status.Spectating", "Spectating");
    if (playerData.isConfirmed && !playerData.hasThrown) return gt(definition, "Status.Confirmed", "Choice confirmed");
    if (canChoose) return gt(definition, "Status.ChooseTarget", "Choose a skill and a target");
    if (playerData.hasThrown) return gt(definition, "Status.TurnFinished", "Turn finished");
    return gt(definition, "Status.Waiting", "Waiting for turn");
  }
  if (state.phase === "results") {
    if (isWinner) return gt(definition, "Status.Winner", "Winner");
    if (isLoser) return gt(definition, "Status.Lost", "Lost");
  }
  return "";
}

function createPlayerPresentation(definition, state, actorId, playerData) {
  ensureCurrencyState(state);
  ensurePlayerActionState(playerData);
  const actor = game.actors.get(actorId);
  const isWinner = (state.results?.winners || []).includes(actorId);
  const isLoser = state.phase === "results" && playerData.isParticipating && !isWinner;
  const canPlayerControl = canCurrentUserOperateActor(actor, state);
  const isSpectatorViewer = isCurrentUserSpectator(state);
  const canSpectatorInspectActor = isSpectatorViewer && isActorControlledByNonGm(actor);
  const isObserverCard = !playerData.isParticipating;
  const canChoose = state.phase === "playing"
    && playerData.isParticipating
    && !playerData.hasThrown
    && canPlayerControl;
  const showChoiceControls = !isObserverCard && state.phase === "playing" && (canPlayerControl || canSpectatorInspectActor);
  const canConfirmChoice = canChoose
    && isChoiceReady(state, actorId, playerData);
  const isConfirmed = Boolean(playerData.isConfirmed);
  const modifiers = calculateModifiers(actor, playerData);
  const classes = [
    playerData.isParticipating ? "" : "tsu-player-card--spectator",
    canChoose ? "tsu-player-card--active" : "",
    isConfirmed ? "tsu-player-card--confirmed" : "",
    isWinner ? "tsu-player-card--winner" : "",
    isLoser ? "tsu-player-card--loser" : "",
    playerData.isParticipating ? "" : "is-spectator",
    canChoose ? "active" : "",
    isConfirmed ? "is-confirmed" : "",
    isWinner ? "is-winner" : "",
    isLoser ? "is-loser" : "",
  ].filter(Boolean).join(" ");

  const badgeText = playerData.isParticipating
    ? gtf(
      definition,
      "DebtBadge",
      { debt: playerData.debt, currency: getCurrencyShort(definition, state.currency) },
      ({ debt, currency }) => `${debt} ${currency}`
    )
    : "";
  const showPrivateSelection = !isObserverCard && (canPlayerControl || canSpectatorInspectActor);
  const selectionState = showPrivateSelection ? buildSelectionText(definition, state, playerData) : { current: "", last: "", resolved: "" };
  const statusText = isObserverCard ? "" : buildPlayerStatusText(definition, state, playerData, { canChoose, isWinner, isLoser });
  const skillButtons = Object.entries(SKILLS)
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([skillId, skill]) => ({
      id: skillId,
      label: `${gt(definition, `Skills.${skill.key}.Short`, skillId)} (${formatSignedNumber(modifiers[skillId] || 0)})`,
      disabled: !canChoose || playerData.lastSkill === skillId,
      classes: [
        showPrivateSelection && playerData.selectedSkill === skillId ? "is-selected" : "",
        playerData.lastSkill === skillId ? "is-forbidden" : "",
        (!canChoose || playerData.lastSkill === skillId) ? "is-disabled disabled" : "",
      ].filter(Boolean).join(" "),
    }));
  const targetButtons = Object.entries(TARGETS).map(([targetId, target]) => ({
    id: targetId,
    label: gt(definition, `Targets.${target.key}.Name`, target.key),
    disabled: !canChoose || !canChooseBoardTarget(state, playerData, targetId),
    classes: [
      showPrivateSelection && playerData.selectedTarget === targetId ? "is-selected" : "",
      !canChooseBoardTarget(state, playerData, targetId) ? "is-forbidden" : "",
      (!canChoose || !canChooseBoardTarget(state, playerData, targetId)) ? "is-disabled disabled" : "",
    ].filter(Boolean).join(" "),
  }));
  const playerTargetButtons = getActivePlayerEntries(state)
    .filter(([targetActorId]) => targetActorId !== actorId)
    .map(([targetActorId, targetPlayerData]) => ({
      id: targetActorId,
      label: targetPlayerData.name,
      disabled: !canChoose || !canChoosePlayerTarget(state, actorId, playerData, targetActorId),
      classes: [
        showPrivateSelection && playerData.selectedTarget === makePlayerTargetId(targetActorId) ? "is-selected" : "",
        !canChoosePlayerTarget(state, actorId, playerData, targetActorId) ? "is-forbidden" : "",
        (!canChoose || !canChoosePlayerTarget(state, actorId, playerData, targetActorId)) ? "is-disabled disabled" : "",
      ].filter(Boolean).join(" "),
    }));

  return {
    id: actorId,
    name: playerData.name,
    img: playerData.img,
    badgeText,
    classes,
    isParticipating: playerData.isParticipating,
    joinLabel: gt(definition, "JoinLabel", "I'm in the game"),
    joinCheckbox: state.phase === "join" && canCurrentUserToggleJoin(actor, state),
    isActorOwner: canPlayerControl,
    spectatorLabel: !playerData.isParticipating ? gt(definition, "Spectator", "Spectating") : "",
    showAwardMoneyButton: game.user.isGM
      && state.phase === "results"
      && isWinner
      && !state.awardedWinners?.[actorId]
      && state.results?.payoutEnabled !== false
      && (Number(state.results?.totalPot) || 0) > 0,
    awardMoneyLabel: gt(definition, "Buttons.AwardMoney", "Award Money"),
    selectionText: selectionState.current,
    historyText: selectionState.last,
    resolvedText: selectionState.resolved,
    selectionClasses: isConfirmed ? "is-confirmed" : (canConfirmChoice ? "is-ready" : ""),
    statusText,
    showRemove: state.phase === "join",
    removeDisabled: !game.user.isGM,
    canChoose,
    showChoiceControls,
    showConfirmButton: state.phase === "playing" && !isObserverCard,
    confirmLabel: isConfirmed
      ? gt(definition, "Buttons.Confirmed", "Confirmed")
      : gt(definition, "Buttons.Confirm", "Confirm"),
    confirmClasses: [
      isConfirmed ? "is-active is-confirmed" : (canConfirmChoice ? "is-ready" : ""),
      (!canChoose || (!canConfirmChoice && !isConfirmed)) ? "is-disabled disabled" : "",
    ].filter(Boolean).join(" "),
    confirmDisabled: !canChoose || (!canConfirmChoice && !isConfirmed),
    skillButtons,
    targetButtons,
    playerTargetButtons,
  };
}

async function awardMoneyToWinners(definition, state, actorId) {
  ensureCurrencyState(state);
  const winnerIds = state.results?.winners || [];
  if (!winnerIds.length || !actorId || !winnerIds.includes(actorId) || state.awardedWinners?.[actorId] || state.results?.payoutEnabled === false) return false;
  const amount = Math.max(0, Math.trunc(Number(state.results?.totalPot) || 0));
  if (!amount) return false;

  const share = Math.floor(amount / winnerIds.length);
  if (share <= 0) return false;

  const winner = game.actors.get(actorId);
  if (!winner?.inventory?.addCoins) return false;
  await winner.inventory.addCoins({ [state.currency]: share });

  state.awardedWinners[actorId] = true;
  state.payoutClaimed = winnerIds.every((winnerId) => state.awardedWinners?.[winnerId]);
  const names = state.players[actorId]?.name || winner.name || actorId;
  state.log.unshift(gtf(
    definition,
    "Log.Payment",
    { names, amount: share, currency: getCurrencyShort(definition, state.currency) },
    ({ names: winnerNames, amount: payout, currency }) => `<div class="tsu-log-entry"><b>${escapeHtml(winnerNames)}</b> receives ${payout} ${currency}.</div>`
  ));
  return true;
}

function clearPlayerChoice(playerData) {
  ensurePlayerActionState(playerData);
  playerData.selectedSkill = "";
  playerData.selectedTarget = "";
  playerData.isConfirmed = false;
}

function clampOutcomeRank(rank) {
  return Math.max(0, Math.min(5, Math.trunc(Number(rank) || 0)));
}

function getOutcomeKeyFromRank(rank) {
  return OUTCOME_KEYS_BY_RANK[clampOutcomeRank(rank)] || "Failure";
}

function resolveOutcomeRank(total, dc, d20) {
  if (d20 === 20 && total >= dc + 10) return 5;
  if (d20 === 1 && total <= dc - 10) return 0;

  let degree = 2;
  if (total >= dc + 10) degree = 4;
  else if (total >= dc) degree = 3;
  else if (total <= dc - 10) degree = 1;
  if (d20 === 20) degree = Math.min(degree + 1, 4);
  if (d20 === 1) degree = Math.max(degree - 1, 1);
  return degree;
}

function getInterferenceSelfRank(rank) {
  switch (clampOutcomeRank(rank)) {
    case 5:
      return 4;
    case 4:
      return 3;
    case 0:
      return 1;
    default:
      return 2;
  }
}

function getInterferenceTargetShift(rank) {
  switch (clampOutcomeRank(rank)) {
    case 5:
    case 4:
    case 3:
      return -1;
    case 1:
    case 0:
      return 1;
    default:
      return 0;
  }
}

function applyOutcomeToDebt(playerData, target, rank) {
  const outcomeRank = clampOutcomeRank(rank);
  const oldDebt = playerData.debt;
  if (outcomeRank === 5) playerData.debt = Math.max(0, Math.floor(playerData.debt / 2) - (target.points * 2));
  else if (outcomeRank === 4) playerData.debt = Math.max(0, Math.floor(playerData.debt / 2) - target.points);
  else if (outcomeRank === 3) playerData.debt = Math.max(0, playerData.debt - target.points);
  else if (outcomeRank === 2) playerData.debt += target.points;
  else if (outcomeRank === 1) playerData.debt = (playerData.debt * 2) + target.points;
  else playerData.debt = (playerData.debt * 2) + (target.points * 2);

  return {
    oldDebt,
    newDebt: playerData.debt,
    diff: playerData.debt - oldDebt,
    outcomeKey: getOutcomeKeyFromRank(outcomeRank),
  };
}

function formatDebtDelta(definition, state, diff) {
  const currency = getCurrencyShort(definition, state.currency);
  return diff < 0
    ? `<b style="color:#2ecc71">${diff} ${currency}</b>`
    : `<b style="color:#e74c3c">+${diff} ${currency}</b>`;
}

function prependChronologyEntries(state, entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    state.log.unshift(entries[index]);
  }
}

function getPlayerAttackDc(actions, targetActorId) {
  return (actions[targetActorId]?.modifier || 0) + 10;
}

function analyzeTargetChain(actions, startActorId) {
  const visited = new Map();
  const path = [];
  let current = startActorId;

  while (current) {
    if (visited.has(current)) {
      return {
        type: "cycle",
        path,
        cycle: path.slice(visited.get(current)),
      };
    }

    visited.set(current, path.length);
    path.push(current);
    const action = actions[current];
    if (!action) return { type: "missing", path, cycle: [] };
    if (action.targetFaceId) return { type: "face", path, cycle: [], faceTargetId: action.targetFaceId };
    if (!action.targetActorId || !actions[action.targetActorId]) return { type: "missing", path, cycle: [] };
    current = action.targetActorId;
  }

  return { type: "missing", path, cycle: [] };
}

function finishResolvedAction(state, actorId, action, resolvedTargetId, { blockTongueUntilRound = null } = {}) {
  const playerData = state.players[actorId];
  ensurePlayerActionState(playerData);
  playerData.hasThrown = true;
  playerData.lastSkill = action.skillId;
  playerData.lastTarget = action.directTargetToken;
  playerData.lastResolvedTarget = resolvedTargetId;
  playerData.lastPlayerTarget = action.targetActorId || "";
  if (blockTongueUntilRound) {
    playerData.blockedUntilRound.tongue = Math.max(Number(playerData.blockedUntilRound.tongue) || 0, blockTongueUntilRound);
  }
  clearPlayerChoice(playerData);
}

async function resolveConfirmedRound(definition, state) {
  const activePlayers = getActivePlayerEntries(state);
  if (!activePlayers.length) return false;
  if (!activePlayers.every(([actorId, playerData]) => playerData.isConfirmed && isChoiceReady(state, actorId, playerData))) {
    notify("warn", "DevilsPinAllChoicesRequired", {}, "All participants must choose and confirm before the round can resolve.");
    return false;
  }

  const actions = {};
  for (const [actorId, playerData] of activePlayers) {
    const actor = game.actors.get(actorId);
    if (!actor) return false;
    const modifiers = calculateModifiers(actor, playerData);
    const skillId = playerData.selectedSkill;
    const targetToken = playerData.selectedTarget;
    actions[actorId] = {
      actorId,
      actorName: playerData.name,
      skillId,
      skillName: getSkillLabel(definition, skillId),
      directTargetToken: targetToken,
      directTargetLabel: getSelectionTargetLabel(definition, state, targetToken),
      targetFaceId: isBoardTargetToken(targetToken) ? targetToken : "",
      targetActorId: isPlayerTargetToken(targetToken) ? getActorIdFromTargetToken(targetToken) : "",
      modifier: modifiers[skillId] || 0,
      incomingShift: 0,
      outgoingShift: 0,
    };
  }

  for (const action of Object.values(actions)) {
    action.dc = action.targetFaceId ? getTargetDc(state, action.targetFaceId) : getPlayerAttackDc(actions, action.targetActorId);
    const roll = await new Roll("1d20 + @mod", { mod: action.modifier }).evaluate({ async: true });
    action.d20 = roll.dice[0]?.total || 0;
    action.total = roll.total;
    action.baseRank = resolveOutcomeRank(action.total, action.dc, action.d20);
    action.baseOutcomeKey = getOutcomeKeyFromRank(action.baseRank);
  }

  const analyses = {};
  for (const actorId of Object.keys(actions)) {
    analyses[actorId] = analyzeTargetChain(actions, actorId);
  }

  for (const [actorId, playerData] of activePlayers) {
    const analysis = analyses[actorId];
    if (analysis.type !== "face") continue;
    if (analysis.faceTargetId && analysis.faceTargetId === playerData.lastResolvedTarget) {
      notify("warn", "DevilsPinRepeatResolvedTarget", {}, "One of the throws repeats the previous round's resolved target.");
      return false;
    }
  }

  const chronology = [
    `<div class="tsu-log-entry" style="text-align:center;background:#2f0808;color:#ffd572;border:1px solid rgba(255,213,114,0.28);"><b>${escapeHtml(gtf(definition, "Status.Round", { round: state.round }, ({ round }) => `Round ${round}`))}</b></div>`,
  ];

  const resolvableActorIds = Object.keys(actions).filter((actorId) => analyses[actorId]?.type === "face");
  const indegree = Object.fromEntries(resolvableActorIds.map((actorId) => [actorId, 0]));
  for (const actorId of resolvableActorIds) {
    const targetActorId = actions[actorId].targetActorId;
    if (targetActorId && targetActorId in indegree) indegree[targetActorId] += 1;
  }

  const queue = resolvableActorIds.filter((actorId) => indegree[actorId] === 0);
  const processed = [];
  while (queue.length) {
    const actorId = queue.shift();
    const action = actions[actorId];
    action.adjustedRank = clampOutcomeRank(action.baseRank + action.incomingShift);
    action.adjustedOutcomeKey = getOutcomeKeyFromRank(action.adjustedRank);
    processed.push(actorId);

    if (action.targetActorId && action.targetActorId in indegree) {
      action.outgoingShift = getInterferenceTargetShift(action.adjustedRank);
      actions[action.targetActorId].incomingShift += action.outgoingShift;
      indegree[action.targetActorId] -= 1;
      if (indegree[action.targetActorId] === 0) queue.push(action.targetActorId);
    }
  }

  const unresolvedActorIds = Object.keys(actions).filter((actorId) => analyses[actorId]?.type !== "face");
  for (const actorId of unresolvedActorIds) {
    const action = actions[actorId];
    const playerData = state.players[actorId];
    const penalty = applyOutcomeToDebt(playerData, TARGETS.tongue, 1);
    finishResolvedAction(state, actorId, action, "tongue", { blockTongueUntilRound: state.round + 1 });
    const chainPath = analyses[actorId]?.path?.map((id) => state.players[id]?.name || actions[id]?.actorName || id).join(" -> ") || playerData.name;
    const meta = getOutcomeMeta(definition, penalty.outcomeKey);

    chronology.push(buildThrowLogEntry(definition, penalty.outcomeKey, {
      state,
      label: meta.label,
      d20: action.d20,
      mod: action.modifier,
      total: action.total,
      dc: action.dc,
      mathLabel: `${action.d20}+${action.modifier}=${action.total} vs ${getDcLabel(definition)} ${action.dc}`,
      flavor: getFlavor(definition, penalty.outcomeKey, playerData.name),
      oldDebt: penalty.oldDebt,
      newDebt: penalty.newDebt,
      delta: formatDebtDelta(definition, state, penalty.diff),
      target: getTargetLabel(definition, "tongue"),
      skill: action.skillName,
      extraHtml: [
        `<div>${gtf(definition, "Log.ChainBreak", { chain: chainPath }, ({ chain }) => `Chain collapses: <b>${escapeHtml(chain)}</b>.`)}</div>`,
        `<div>${gt(definition, "Log.TongueLock", "Critical tongue failure: tongue is blocked next round.")}</div>`,
      ].join(""),
    }));
  }

  for (const actorId of processed) {
    const action = actions[actorId];
    const playerData = state.players[actorId];
    const finalTargetId = analyses[actorId].faceTargetId;
    const selfRank = action.targetActorId ? getInterferenceSelfRank(action.adjustedRank) : action.adjustedRank;
    const resolution = applyOutcomeToDebt(playerData, TARGETS[finalTargetId], selfRank);
    const extraHtml = [];

    if (action.incomingShift) {
      extraHtml.push(`<div>${gtf(definition, "Log.IncomingShift", { shift: formatSignedNumber(action.incomingShift) }, ({ shift }) => `Incoming correction: ${shift}`)}</div>`);
    }
    if (action.targetActorId) {
      const targetName = state.players[action.targetActorId]?.name || action.targetActorId;
      extraHtml.push(`<div>${gtf(definition, "Log.FinalTarget", { target: getTargetLabel(definition, finalTargetId) }, ({ target }) => `Resolved target: ${target}`)}</div>`);
      if (action.outgoingShift) extraHtml.push(`<div>${gtf(definition, "Log.TargetShift", { name: targetName, shift: formatSignedNumber(action.outgoingShift) }, ({ name, shift }) => `${escapeHtml(name)}: degree ${shift}`)}</div>`);
      else extraHtml.push(`<div>${gtf(definition, "Log.TargetShiftNone", { name: targetName }, ({ name }) => `${escapeHtml(name)}: degree unchanged`)}</div>`);
      extraHtml.push(`<div>${gtf(definition, "Log.SelfResolution", { outcome: gt(definition, `Outcomes.${resolution.outcomeKey}.Label`, resolution.outcomeKey) }, ({ outcome }) => `Self effect: ${escapeHtml(normalizeOutcomeLabel(outcome))}`)}</div>`);
    }

    if (action.targetFaceId) {
      const beforeBonus = playerData.debt;
      playerData.debt = Math.max(0, playerData.debt - 1);
      resolution.newDebt = playerData.debt;
      resolution.diff = playerData.debt - resolution.oldDebt;
      extraHtml.push(`<div>${beforeBonus !== playerData.debt
        ? gtf(
          definition,
          "Log.FairPlayBonus",
          { currency: getCurrencyShort(definition, state.currency) },
          ({ currency }) => `Fair play bonus: -1 ${currency}.`
        )
        : gt(definition, "Log.FairPlayBonusZero", "Fair play bonus applied.")}</div>`);
    }

    finishResolvedAction(state, actorId, action, finalTargetId);
    const meta = getOutcomeMeta(definition, action.adjustedOutcomeKey);

    chronology.push(buildThrowLogEntry(definition, action.adjustedOutcomeKey, {
      state,
      label: meta.label,
      d20: action.d20,
      mod: action.modifier,
      total: action.total,
      dc: action.dc,
      mathLabel: `${action.d20}+${action.modifier}=${action.total} vs ${getDcLabel(definition)} ${action.dc}`,
      flavor: getFlavor(definition, action.adjustedOutcomeKey, playerData.name),
      oldDebt: resolution.oldDebt,
      newDebt: resolution.newDebt,
      delta: formatDebtDelta(definition, state, resolution.diff),
      target: action.targetActorId ? action.directTargetLabel : getTargetLabel(definition, finalTargetId),
      skill: action.skillName,
      extraHtml: extraHtml.join(""),
    }));
  }

  if (state.round >= 3) {
    state.phase = "results";
    const minimumDebt = Math.min(...activePlayers.map(([, playerData]) => playerData.debt));
    const winnerIds = activePlayers.filter(([, playerData]) => playerData.debt === minimumDebt).map(([id]) => id);
    const totalPot = activePlayers.filter(([, playerData]) => playerData.debt > minimumDebt).reduce((sum, [, playerData]) => sum + playerData.debt, 0);
    const payoutEnabled = !isScoreOnlyCurrency(state.currency);
    state.results = { winners: winnerIds, totalPot, payoutEnabled };
    state.payoutClaimed = !payoutEnabled;
    const names = winnerIds.map((id) => state.players[id]?.name).filter(Boolean).join(", ");
    const currency = getCurrencyShort(definition, state.currency);
    chronology.push(payoutEnabled
      ? gtf(
        definition,
        "Log.Win",
        { names, totalPot, currency },
        ({ names: winnerNames, totalPot: pot, currency: winnerCurrency }) => `<div class="tsu-log-entry" style="background:linear-gradient(135deg,#123e1f,#2d8f45,#123e1f);color:white;border:1px solid gold;"><b>${escapeHtml(winnerNames)}</b> win the pot: <b>${pot} ${winnerCurrency}</b></div>`
      )
      : gtf(
        definition,
        "Log.WinScore",
        { names, debt: minimumDebt, currency },
        ({ names: winnerNames, debt, currency: winnerCurrency }) => `<div class="tsu-log-entry" style="background:linear-gradient(135deg,#123e1f,#2d8f45,#123e1f);color:white;border:1px solid gold;"><b>${escapeHtml(winnerNames)}</b> win on points: <b>${debt} ${winnerCurrency}</b></div>`
      ));
  } else {
    state.round += 1;
    for (const [, playerData] of activePlayers) {
      ensurePlayerActionState(playerData);
      playerData.hasThrown = false;
      clearPlayerChoice(playerData);
    }
    chronology.push(gtf(definition, "Log.RoundDivider", { round: state.round }, ({ round }) => `<div class="tsu-log-entry" style="text-align:center;background:#4a0000;color:#ffd572;"><b>Round ${round}</b></div>`));
  }

  prependChronologyEntries(state, chronology);
  return true;
}

const template = `
<div class="tsu-game tsu-devils-pin" id="devils-pin-app">
  <section class="tsu-panel tsu-panel--rules dp-col-rules dp-col-wrapper">
    <div class="tsu-panel-title dp-rule-headline">
      <span>{{ui.rulesTitle}}</span>
      {{#if isGM}}<input type="number" class="dp-dc-input" min="1" max="99" step="1" value="{{dcInputValue}}" placeholder="{{dcPlaceholder}}">{{/if}}
      <button type="button" class="tsu-help-button dp-rules-help" data-action="help">?</button>
    </div>
    {{#each ui.sections}}
      <div class="tsu-rule-block">
        <h3 class="tsu-rule-header dp-rule-subhead">{{this.title}}</h3>
        <div class="tsu-rule-list">
          {{#each this.items}}
            <div class="tsu-rule-item dp-rule-item {{itemClasses}}">
              <div class="dp-rule-item__lead">
                {{#if icon}}<span class="dp-rule-item__icon">{{icon}}</span>{{/if}}
                <span class="dp-rule-item__label">{{label}}</span>
              </div>
              <div class="dp-rule-item__copy">{{copy}}</div>
            </div>
          {{/each}}
        </div>
      </div>
    {{/each}}
  </section>

  <section class="tsu-panel tsu-panel--main dp-col-main dp-col-wrapper" id="dp-main-area">
    <div class="tsu-game-header dp-header-thematic">
      <h2>{{ui.title}}</h2>
      {{#if statusLine}}<div class="tsu-status-line">{{statusLine}}</div>{{/if}}
    </div>
    {{#if showEmptyState}}<div class="tsu-empty-state">{{emptyState}}</div>{{/if}}
    <div class="tsu-player-list">
      {{#each players}}
        <article class="tsu-player-card dp-player-card {{classes}}" data-actor-card="{{id}}">
          <div class="dp-card-headrail">
            {{#if showConfirmButton}}<div class="dp-card-controls"><button type="button" class="tsu-button dp-confirm-btn {{confirmClasses}}" data-action="confirm-choice" data-actor-id="{{id}}" {{#if confirmDisabled}}disabled{{/if}}>{{confirmLabel}}</button></div>{{/if}}
            {{#if badgeText}}<div class="tsu-badge dp-debt-badge">{{badgeText}}</div>{{/if}}
          </div>
          {{#if showRemove}}<button type="button" class="tsu-icon-button dp-remove-btn {{#if removeDisabled}}is-disabled disabled{{/if}}" data-action="remove-player" data-actor-id="{{id}}" {{#if removeDisabled}}disabled{{/if}}><i class="fas fa-times"></i></button>{{/if}}
          <div class="tsu-player-card-top">
            <img class="tsu-avatar" src="{{img}}" alt="{{name}}">
            <div class="tsu-player-meta">
              <div class="tsu-player-name">{{name}}</div>
              <div class="tsu-player-subline">
                {{#if joinCheckbox}}<label class="tsu-checkbox dp-join-label"><input type="checkbox" class="tsu-join-toggle dp-join-cb" data-actor-id="{{id}}" {{#if isParticipating}}checked{{/if}}> <span>{{joinLabel}}</span></label>{{/if}}
                {{#if spectatorLabel}}<span class="tsu-chip">{{spectatorLabel}}</span>{{/if}}
                {{#if statusText}}<span class="tsu-chip">{{statusText}}</span>{{/if}}
              </div>
            </div>
          </div>
          {{#if showChoiceControls}}
            {{#if selectionText}}<div class="dp-selection-preview {{selectionClasses}}">{{selectionText}}</div>{{/if}}
            {{#if historyText}}<div class="dp-selection-history">{{historyText}}</div>{{/if}}
            {{#if resolvedText}}<div class="dp-selection-history">{{resolvedText}}</div>{{/if}}
            <div class="tsu-grid-buttons tsu-grid-buttons--4 dp-action-row">
              {{#each skillButtons}}
                <button type="button" class="tsu-chip dp-skill-btn {{classes}}" data-action="skill" data-actor-id="{{../id}}" data-skill="{{id}}" {{#if disabled}}disabled{{/if}}>{{label}}</button>
              {{/each}}
            </div>
            <div class="tsu-grid-buttons tsu-grid-buttons--3 dp-target-row">
              {{#each targetButtons}}
                <button type="button" class="tsu-chip dp-target-btn {{classes}}" data-action="target" data-actor-id="{{../id}}" data-target="{{id}}" {{#if disabled}}disabled{{/if}}>{{label}}</button>
              {{/each}}
            </div>
            {{#if playerTargetButtons.length}}
            <div class="tsu-grid-buttons tsu-grid-buttons--3 dp-target-row">
              {{#each playerTargetButtons}}
                <button type="button" class="tsu-chip dp-target-btn {{classes}}" data-action="player-target" data-actor-id="{{../id}}" data-target-actor-id="{{id}}" {{#if disabled}}disabled{{/if}}>{{label}}</button>
              {{/each}}
            </div>
            {{/if}}
          {{/if}}
          {{#if showAwardMoneyButton}}<button type="button" class="tsu-button dp-pay-btn" data-action="award-money" data-actor-id="{{id}}">{{awardMoneyLabel}}</button>{{/if}}
        </article>
      {{/each}}
    </div>
  </section>

  <section class="tsu-panel tsu-panel--log dp-col-log dp-col-wrapper" id="dp-log-area">
    <h3 class="tsu-panel-title">{{ui.logTitle}}</h3>
    <div class="tsu-log-list">
      {{#each state.log}}
        {{{this}}}
      {{/each}}
    </div>
  </section>

  <div class="tsu-footer dp-footer">
    <div class="dp-footer-settings">
      {{#if isGM}}
        <label class="tsu-checkbox dp-debug-label"><input type="checkbox" id="dp-debug-mode" {{#if state.debugMode}}checked{{/if}}> {{ui.debugLabel}}</label>
        <label class="dp-currency-field">
          <span>{{currencyLabel}}</span>
          <div class="dp-currency-dropdown">
            <button type="button" class="dp-currency-select" data-action="toggle-currency-dropdown">
              <span class="dp-currency-select__pad" aria-hidden="true"></span>
              <span class="dp-currency-select__value">{{selectedCurrencyLabel}}</span>
              <span class="dp-currency-select__arrow" aria-hidden="true"></span>
            </button>
            <div class="dp-currency-dropdown-menu">
              {{#each currencyOptions}}
                <button type="button" class="dp-currency-option {{#if selected}}is-selected{{/if}}" data-action="set-currency-option" data-currency="{{value}}">
                  {{label}}
                </button>
              {{/each}}
            </div>
          </div>
        </label>
      {{/if}}
    </div>
    <div class="tsu-footer-actions">
      {{#each footerButtons}}
        <button type="button" class="tsu-button dp-btn {{classes}}" data-action="{{action}}" title="{{title}}" {{#if disabled}}disabled{{/if}}>
          {{#if icon}}<i class="{{icon}}"></i> {{/if}}{{label}}
        </button>
      {{/each}}
    </div>
  </div>
</div>`;

class DevilsPinApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      classes: ["tsu-window"],
      title: gt(definition, "Title", "Devil's Pin"),
      width: 1460,
      height: 860,
      resizable: true,
      popOut: true,
      dragDrop: [{ dragSelector: null, dropSelector: ".window-content" }],
    });
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
    const patched = patchApplicationRegions(this, "#devils-pin-app", [
      ".dp-col-rules",
      "#dp-main-area",
      "#dp-log-area",
      ".dp-footer",
    ], nextRoot);
    if (!patched) this.render(false);
  }

  getData() {
    try {
      const state = this.getState();
      ensureCurrencyState(state);
      const ui = {
        ...buildSummaryUi(definition, state),
        logTitle: gt(definition, "Log.PanelTitle", "Journal"),
      };
      const discoveredIds = new Set(getNonGmCharacters().map((actor) => actor.id));
      const playerEntries = Object.entries(state.players ?? {});
      let visibleEntries = playerEntries.filter(([actorId, entry]) => !state.excludedPlayers?.[actorId] || entry?.source === "manual");
      if (!visibleEntries.length && discoveredIds.size) {
        visibleEntries = playerEntries.filter(([actorId]) => discoveredIds.has(actorId));
      }
      const participatingCount = Object.entries(state.players ?? {})
        .filter(([actorId]) => visibleEntries.some(([visibleId]) => visibleId === actorId))
        .filter(([, entry]) => entry.isParticipating)
        .length;
      const confirmedThrows = Object.entries(state.players ?? {})
        .filter((entry) => {
          const [, playerData] = entry;
          ensurePlayerActionState(playerData);
          return playerData.isParticipating && !playerData.hasThrown && playerData.isConfirmed && isChoiceReady(state, entry[0], playerData);
        })
        .length;
      const readyToResolve = state.phase === "playing" && participatingCount > 0 && confirmedThrows === participatingCount;
      const pinnedActorId = getPinnedPlayerActorIdForDisplay(visibleEntries, game.user);
      const players = visibleEntries
        .sort((a, b) => comparePlayerEntriesForDisplay(a, b, { state, user: game.user, locale: game.i18n?.lang || "en", pinnedActorId }))
        .map(([actorId, playerData]) => createPlayerPresentation(definition, state, actorId, playerData));

      console.log(`${MODULE_ID} | devils-pin getData`, {
        phase: state.phase,
        statePlayers: Object.keys(state.players ?? {}),
        discoveredPlayers: Array.from(discoveredIds),
        visiblePlayers: players.map((player) => ({ id: player.id, name: player.name })),
        excluded: Object.keys(state.excludedPlayers ?? {}),
      });

      const footerButtons = [];
      if (game.user.isGM) {
        const roundButton = {
          action: "reset-round",
          label: ui.footerButtons.resetRound,
          title: ui.footerButtons.resetRound,
          icon: "fas fa-broom",
          classes: "is-round",
          disabled: false,
        };

        if (state.phase === "join") {
          roundButton.action = "start-game";
          roundButton.title = ui.footerButtons.start;
          roundButton.icon = "fas fa-play";
          roundButton.classes = "is-start";
          roundButton.disabled = participatingCount === 0;
        } else if (state.phase === "playing") {
          roundButton.disabled = !readyToResolve;
        } else {
          roundButton.disabled = true;
        }

        footerButtons.push(roundButton);
        footerButtons.push({
          action: "clear",
          label: ui.footerButtons.clear,
          title: ui.footerButtons.clear,
          icon: "fas fa-rotate-left",
          classes: "is-clear",
        });
        footerButtons.push({
          action: "reset-game",
          label: ui.footerButtons.resetGame,
          title: ui.footerButtons.resetGame,
          icon: "fas fa-redo",
          classes: "is-reset",
        });
      }

      return {
        state,
        ui,
        players,
        statusLine: buildHeaderStatus(definition, state),
        showEmptyState: players.length === 0 || (state.phase === "playing" && participatingCount === 0),
        emptyState: buildEmptyState(definition, state, visibleEntries),
        dcInputValue: hasManualBaseDcOverride(state) ? `${getBaseDc(state)}` : "",
        dcPlaceholder: formatDcPlaceholder(definition, getBaseDc(state)),
        footerButtons,
        currencyLabel: gt(definition, "Currency.Label", "Currency"),
        selectedCurrencyLabel: getCurrencyShort(definition, state.currency),
        currencyOptions: Object.keys(COIN_CURRENCIES).map((currency) => ({
          value: currency,
          label: getCurrencyShort(definition, currency),
          selected: state.currency === currency,
        })),
        isGM: game.user.isGM,
      };
    } catch (error) {
      console.error(`${MODULE_ID} | devils-pin getData failed`, error);
      const state = this.getState();
      return {
        state,
        ui: {
          ...buildSummaryUi(definition, state),
          logTitle: gt(definition, "Log.PanelTitle", "Journal"),
        },
        players: [],
        statusLine: buildHeaderStatus(definition, state),
        showEmptyState: true,
        emptyState: gt(definition, "Errors.RenderFailed", "Rendering failed. Check console."),
        dcInputValue: hasManualBaseDcOverride(state) ? `${getBaseDc(state)}` : "",
        dcPlaceholder: formatDcPlaceholder(definition, getBaseDc(state)),
        footerButtons: [],
        isGM: game.user.isGM,
      };
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", (event) => {
      if ($(event.target).closest(".dp-currency-dropdown").length) return;
      html.find(".dp-currency-dropdown.is-open").removeClass("is-open");
    });
    html.on("click", "[data-action]", (event) => this.onActionClick(event));
    html.on("dragover", (event) => {
      event.preventDefault();
    });
    html.on("drop", (event) => {
      event.preventDefault();
      void this._onDrop(event.originalEvent ?? event);
    });
    html.on("change", ".tsu-join-toggle", (event) => {
      const input = event.currentTarget;
      void requestGameAction(GAME_ID, "toggle-join", {
        actorId: input.dataset.actorId,
        isParticipating: input.checked,
      });
    });
    html.on("change", "#dp-debug-mode", (event) => {
      if (!game.user.isGM) return;
      void requestGameAction(GAME_ID, "toggle-debug", { enabled: event.currentTarget.checked });
    });
    html.on("change", ".dp-dc-input", (event) => {
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
    html.on("keydown", ".dp-dc-input", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.currentTarget.blur();
    });
  }

  async onActionClick(event) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorId = button.dataset.actorId;

    switch (action) {
      case "help":
        new Dialog({
          title: gt(definition, "Rules.HelpTitle", "Devil's Pin Rules"),
          content: `<div class="tsu-dialog-content">${gt(definition, "Rules.HelpHtml", "")}</div>`,
          buttons: { ok: { label: gt(definition, "Buttons.CloseRules", "Close") } },
        }, { width: 560 }).render(true);
        break;
      case "toggle-currency-dropdown": {
        event.preventDefault();
        event.stopPropagation();
        const dropdown = button.closest(".dp-currency-dropdown");
        if (!dropdown) break;
        this.element?.find(".dp-currency-dropdown.is-open").not(dropdown).removeClass("is-open");
        dropdown.classList.toggle("is-open");
        break;
      }
      case "set-currency-option":
        event.preventDefault();
        event.stopPropagation();
        button.closest(".dp-currency-dropdown")?.classList.remove("is-open");
        await requestGameAction(GAME_ID, "set-currency", { currency: button.dataset.currency });
        break;
      case "skill":
        await requestGameAction(GAME_ID, "set-skill", { actorId, skill: button.dataset.skill });
        break;
      case "target":
        await requestGameAction(GAME_ID, "set-target", { actorId, target: button.dataset.target });
        break;
      case "player-target":
        await requestGameAction(GAME_ID, "set-player-target", { actorId, targetActorId: button.dataset.targetActorId });
        break;
      case "confirm-choice":
        await requestGameAction(GAME_ID, "toggle-confirm", { actorId });
        break;

      case "start-game":
        await requestGameAction(GAME_ID, "start-game", {});
        break;
      case "award-money":
        await requestGameAction(GAME_ID, "award-money", { actorId });
        break;
      case "clear":
        await requestGameAction(GAME_ID, "clear", {});
        break;
      case "reset-round":
        await requestGameAction(GAME_ID, "reset-round", {});
        break;
      case "reset-game":
        await requestGameAction(GAME_ID, "reset-game", {});
        break;
      case "remove-player":
        await requestGameAction(GAME_ID, "remove-player", { actorId });
        break;
      default:
        break;
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    console.log(`${MODULE_ID} | devils-pin drop`, data);
    const uuid = getActorUuidFromDropData(data);
    if (!uuid) return;
    await requestGameAction(GAME_ID, "add-actor", { uuid });
  }
}

const definition = {
  id: GAME_ID,
  i18nRoot: I18N_ROOT,
  createInitialState,
  ensureDefaultPlayers,
  syncDefaultPlayers,
  createApplication: () => new DevilsPinApplication(),
  async handleAction({ action, data, state, senderId, canUserControlActor }) {
    ensureCurrencyState(state);
    const senderIsGM = game.users?.get(senderId)?.isGM ?? false;
    switch (action) {
      case "toggle-join": {
        const playerData = state.players[data.actorId];
        if (!playerData || state.phase !== "join" || !canSenderToggleJoin(data.actorId, senderId, state, canUserControlActor)) return false;
        playerData.isParticipating = Boolean(data.isParticipating);
        return true;
      }

      case "set-skill": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "playing" || playerData.hasThrown || !SKILLS[data.skill]) return false;
        ensurePlayerActionState(playerData);
        if (playerData.lastSkill === data.skill) return false;
        playerData.selectedSkill = playerData.selectedSkill === data.skill ? "" : data.skill;
        playerData.isConfirmed = false;
        return true;
      }
      case "set-target": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "playing" || playerData.hasThrown || !TARGETS[data.target]) return false;
        ensurePlayerActionState(playerData);
        if (!canChooseBoardTarget(state, playerData, data.target)) return false;
        playerData.selectedTarget = playerData.selectedTarget === data.target ? "" : data.target;
        playerData.isConfirmed = false;
        return true;
      }
      case "set-player-target": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "playing" || playerData.hasThrown) return false;
        ensurePlayerActionState(playerData);
        if (!canChoosePlayerTarget(state, data.actorId, playerData, data.targetActorId)) return false;
        const targetToken = makePlayerTargetId(data.targetActorId);
        playerData.selectedTarget = playerData.selectedTarget === targetToken ? "" : targetToken;
        playerData.isConfirmed = false;
        return true;
      }
      case "toggle-confirm": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "playing" || playerData.hasThrown) return false;
        ensurePlayerActionState(playerData);
        if (playerData.isConfirmed) {
          playerData.isConfirmed = false;
          return true;
        }
        if (!isChoiceReady(state, data.actorId, playerData)) {
          notify("warn", "DevilsPinChoiceRequired", {}, "Choose a skill and a legal target first.");
          return false;
        }
        playerData.isConfirmed = true;
        return true;
      }
      case "reset-round": {
        if (!senderIsGM) return false;
        if (state.phase === "playing") {
          const activePlayers = getActivePlayerEntries(state);
          const readyPlayers = activePlayers.filter(([actorId, playerData]) => playerData.isConfirmed && isChoiceReady(state, actorId, playerData));
          if (!readyPlayers.length) {
            notify("warn", "DevilsPinNoConfirmedChoices", {}, "There are no confirmed throws to resolve.");
            return false;
          }
          if (readyPlayers.length !== activePlayers.length) {
            notify("warn", "DevilsPinAllChoicesRequired", {}, "All participants must choose and confirm before the round can resolve.");
            return false;
          }
          return resolveConfirmedRound(definition, state);
        }
        state.phase = "join";
        state.round = 1;
        state.results = null;
        state.payoutClaimed = false;
        state.awardedWinners = {};
        state.log = [gt(definition, "Log.Cleared", "<div class='tsu-log-entry'><b>Journal cleared.</b></div>")];
        for (const playerData of Object.values(state.players)) {
          ensurePlayerActionState(playerData);
          playerData.debt = 10;
          playerData.hasThrown = false;
          playerData.hasPaid = false;
          clearPlayerChoice(playerData);
          playerData.lastSkill = "";
          playerData.lastTarget = "";
          playerData.lastResolvedTarget = "";
          playerData.lastPlayerTarget = "";
          playerData.blockedUntilRound = {};
        }
        return true;
      }
      case "start-game": {
        if (!senderIsGM) return false;
        const activePlayerEntries = Object.entries(state.players).filter(([, entry]) => entry.isParticipating);
        if (!activePlayerEntries.length) {
          notify("warn", "DevilsPinNoPlayers", {}, "Add at least one participant before starting.");
          return false;
        }
        for (const [actorId, playerData] of activePlayerEntries) {
          const actor = game.actors.get(actorId);
          if (actor?.type === "character") {
            playerData.cachedAtk = await getDartModifierForCharacter(actor);
            console.log(`${MODULE_ID} | devils-pin: start-game attack cache`, {
              actorId,
              actor: actor.name,
              cachedAtk: playerData.cachedAtk,
              isParticipating: playerData.isParticipating,
            });
          }
        }
        state.phase = "playing";
        state.round = 1;
        state.results = null;
        state.payoutClaimed = false;
        state.awardedWinners = {};
        for (const playerData of Object.values(state.players)) {
          ensurePlayerActionState(playerData);
          playerData.hasThrown = false;
          playerData.hasPaid = false;
          clearPlayerChoice(playerData);
          playerData.lastSkill = "";
          playerData.lastTarget = "";
          playerData.lastResolvedTarget = "";
          playerData.lastPlayerTarget = "";
          playerData.blockedUntilRound = {};
        }
        state.log.unshift(gt(definition, "Log.GameStarted", "<div class='tsu-log-entry'><b>The game begins.</b></div>"));
        return true;
      }
      case "reset-game": {
        if (!senderIsGM) return false;
        replaceStateContents(state, createInitialState());
        await syncDefaultPlayers(state);
        return true;
      }
      case "clear": {
        if (!senderIsGM) return false;
        state.phase = "join";
        state.round = 1;
        state.results = null;
        state.payoutClaimed = false;
        state.awardedWinners = {};
        state.log = [gt(definition, "Log.Cleared", "<div class='tsu-log-entry'><b>Journal cleared.</b></div>")];
        for (const playerData of Object.values(state.players)) {
          ensurePlayerActionState(playerData);
          playerData.debt = 10;
          playerData.hasThrown = false;
          playerData.hasPaid = false;
          clearPlayerChoice(playerData);
          playerData.lastSkill = "";
          playerData.lastTarget = "";
          playerData.lastResolvedTarget = "";
          playerData.lastPlayerTarget = "";
          playerData.blockedUntilRound = {};
        }
        return true;
      }
      case "toggle-debug": {
        if (!senderIsGM) return false;
        state.debugMode = Boolean(data.enabled);
        return true;
      }
      case "set-currency": {
        if (!senderIsGM) return false;
        state.currency = normalizeCoinCurrency(data.currency);
        return true;
      }
      case "set-dc": {
        if (!senderIsGM) return false;
        if (data.auto) {
          state.dcOverride = null;
          state.baseDc = DEFAULT_BASE_DC;
          return true;
        }
        const value = Math.max(1, Math.min(99, Math.trunc(Number(data.value) || 0)));
        if (!value) return false;
        state.dcOverride = value;
        state.baseDc = value;
        return true;
      }
      case "award-money":
        if (!senderIsGM || state.phase !== "results") return false;
        return awardMoneyToWinners(definition, state, data.actorId);
      case "remove-player": {
        if (!senderIsGM || !state.players[data.actorId]) return false;
        state.excludedPlayers ||= {};
        state.excludedPlayers[data.actorId] = true;
        delete state.players[data.actorId];
        return true;
      }
      case "add-actor": {
        if (!data.uuid) return false;
        const actors = await getDroppedActors(data.uuid);
        console.log(`${MODULE_ID} | devils-pin add-actor`, {
          requestedUuid: data.uuid,
          resolvedActors: actors.map((actor) => ({ id: actor.id, name: actor.name, type: actor.type })),
        });
        if (!actors.length) return false;
        let addedCount = 0;
        for (const actor of actors) {
          const canAdd = senderIsGM || canUserControlActor(actor.id, senderId);
          if (!canAdd) continue;
          state.excludedPlayers ||= {};
          delete state.excludedPlayers[actor.id];
          const alreadyPresent = Boolean(state.players?.[actor.id]);
          await addActorToState(state, actor, { isParticipating: actor.type === "npc", source: "manual" });
          state.players[actor.id].source = "manual";
          if (actor.type === "npc") state.players[actor.id].isParticipating = true;
          addedCount += 1;
          console.log(`${MODULE_ID} | devils-pin add-actor upsert`, {
            actorId: actor.id,
            actorName: actor.name,
            alreadyPresent,
            excludedAfter: Boolean(state.excludedPlayers?.[actor.id]),
            participating: Boolean(state.players?.[actor.id]?.isParticipating),
            source: state.players?.[actor.id]?.source ?? null,
          });
        }
        console.log(`${MODULE_ID} | devils-pin add-actor result`, {
          addedCount,
          playerIds: Object.keys(state.players ?? {}),
          excluded: Object.keys(state.excludedPlayers ?? {}),
        });
        return true;
      }
      default:
        return false;
    }
  },
};

export function createDevilsPinGameDefinition() {
  return definition;
}
