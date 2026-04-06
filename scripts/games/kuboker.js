import {
  getActorUuidFromDropData,
  getDroppedActors,
  MODULE_ID,
  escapeHtml,
  formatSignedNumber,
  getGameState,
  getNonGmCharacters,
  gobj,
  gt,
  gtf,
  notify,
  randomChoice,
  requestGameAction,
  t,
  userCanControlActor,
} from "../core.js";

const GAME_ID = "kuboker";
const APP_ID = `${MODULE_ID}-${GAME_ID}`;
const I18N_ROOT = "Games.Kuboker";
const LOCKED_ROUNDS_TOTAL = 2;

const STRATEGIES = Object.freeze({
  fair: { key: "Fair" },
  cheat: { key: "Cheat" },
  observe: { key: "Observe" },
});

const STRATEGY_SKILLS = Object.freeze({
  fair: ["soc", "dip"],
  cheat: ["thi", "dec"],
  observe: ["per", "itm"],
});

const SKILL_KEYS = Object.freeze({
  soc: "Society",
  dip: "Diplomacy",
  thi: "Thievery",
  dec: "Deception",
  per: "Perception",
  itm: "Intimidation",
  lore: "GamesLore",
});

const PF2E_DC_BY_LEVEL = [12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40, 42, 44, 46, 48];
const HAND_PREVIEW_LAYOUTS = Object.freeze({
  Kuboker: { values: [8, 8, 8, 8, 8], groups: [5], highlightedGroups: [true], accent: "legend" },
  FourOfAKind: { values: [5, 5, 5, 5, 2], groups: [4, 1], highlightedGroups: [true, false], accent: "crimson" },
  FullHouse: { values: [6, 6, 6, 3, 3], groups: [3, 2], highlightedGroups: [true, true], accent: "royal" },
  Straight: { values: [6, 7, 8, 9, 10], groups: [5], highlightedGroups: [true], accent: "emerald" },
  ThreeOfAKind: { values: [9, 9, 9, 4, 2], groups: [3, 1, 1], highlightedGroups: [true, false, false], accent: "standard" },
  TwoPairs: { values: [7, 7, 4, 4, 1], groups: [2, 2, 1], highlightedGroups: [true, true, false], accent: "standard" },
  Pair: { values: [10, 10, 6, 3, 1], groups: [2, 1, 1, 1], highlightedGroups: [true, false, false, false], accent: "standard" },
  HighDie: { values: [10, 8, 6, 3, 1], groups: [1, 1, 1, 1, 1], highlightedGroups: [true, false, false, false, false], accent: "standard" },
});

function createInitialState() {
  return {
    players: {},
    excludedPlayers: {},
    center: [],
    phase: "join",
    lockedRound: 0,
    log: [],
    currentDC: 15,
    dcOverride: null,
    debugMode: false,
    openSignal: null,
  };
}

function replaceStateContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function getActorModifiers(actor) {
  if (!actor) {
    return { soc: 0, dip: 0, thi: 0, dec: 0, per: 0, itm: 0, lore: 0 };
  }

  const isNpc = actor.type === "npc";
  const system = actor.system ?? {};
  const level = system.details?.level?.value || 0;
  const intelligence = system.abilities?.int?.mod || 0;
  const getValue = (slug) => {
    if (slug === "perception") {
      return isNpc ? (system.perception?.mod || 0) : (actor.perception?.mod || 0);
    }
    return isNpc
      ? (system.skills?.[slug]?.base || system.skills?.[slug]?.value || 0)
      : (actor.skills?.[slug]?.mod || 0);
  };

  const lore = actor.items.find((item) => item.type === "lore" && ["game", "games", "пїЅпїЅпїЅпїЅ", "пїЅпїЅпїЅпїЅ"].some((term) => item.name.toLowerCase().includes(term)));
  let loreMod = intelligence;
  if (lore) {
    if (isNpc) loreMod = lore.system.mod?.value || intelligence;
    else {
      const rank = lore.system.proficient?.value || 0;
      loreMod = rank > 0 ? (rank * 2 + level + intelligence) : intelligence;
    }
  }

  return {
    soc: getValue("society"),
    dip: getValue("diplomacy"),
    thi: getValue("thievery"),
    dec: getValue("deception"),
    per: getValue("perception"),
    itm: getValue("intimidation"),
    lore: loreMod,
  };
}

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDiceValues(values, { fallback = 0, min = 0, max = 10 } = {}) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    const numeric = Math.trunc(toSafeNumber(value, Number.NaN));
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return fallback;
    return numeric;
  });
}

function getDiceDisplay(values, fallback = "-") {
  const dice = normalizeDiceValues(values, { fallback: 0 }).filter((value) => value > 0);
  return dice.length ? dice.join(" / ") : fallback;
}

function getSuggestedDc(state) {
  const activePlayers = Object.values(state?.players ?? {}).filter((entry) => entry?.isParticipating);
  const maxLevel = Math.max(...activePlayers.map((entry) => Number(entry.level) || 0), 0);
  return PF2E_DC_BY_LEVEL[maxLevel] || 12;
}

function hasManualDcOverride(state) {
  return typeof state?.dcOverride === "number" && Number.isFinite(state.dcOverride);
}

function getDcLabel(definition) {
  return gt(definition, "Rules.DcShort", "DC");
}

function formatDcPlaceholder(definition, dc) {
  return gtf(definition, "Rules.DcPlaceholder", { dc }, ({ dc: value }) => `${getDcLabel(definition)} ${value}`);
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

function isActorAssignedToGm(actor) {
  if (!actor) return false;
  return (game.users?.contents ?? []).some((user) => user.isGM && user.character?.id === actor.id);
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

function createHandPreview(handKey) {
  const layout = HAND_PREVIEW_LAYOUTS[handKey];
  if (!layout) return null;

  let groupIndex = 0;
  let remainingInGroup = layout.groups[groupIndex] ?? layout.values.length;
  return layout.values.map((value, index) => {
    const isHighlighted = Boolean(layout.highlightedGroups?.[groupIndex]);
    remainingInGroup -= 1;
    const isGroupEnd = remainingInGroup === 0 && index < (layout.values.length - 1);
    if (isGroupEnd) {
      groupIndex += 1;
      remainingInGroup = layout.groups[groupIndex] ?? 0;
    }

    return {
      value,
      classes: [
        isHighlighted ? `tsu-kuboker-hand__die--accent-${layout.accent}` : "",
        value >= 10 ? "tsu-kuboker-hand__die--wide" : "",
        isGroupEnd ? "tsu-kuboker-hand__die--group-end" : "",
      ].filter(Boolean).join(" "),
    };
  });
}

function getHandPreviewAccentClass(handKey) {
  const accent = HAND_PREVIEW_LAYOUTS[handKey]?.accent;
  return accent ? `tsu-kuboker-hand-preview--${accent}` : "";
}

function evaluateHand(playerDice, centerDice) {
  const dice = [
    ...normalizeDiceValues(playerDice, { fallback: 0 }),
    ...normalizeDiceValues(centerDice, { fallback: 0 }),
  ].filter((value) => value > 0).sort((a, b) => b - a);
  if (dice.length < 2) return { nameKey: "NoHand", score: 0 };

  const counts = {};
  for (const die of dice) counts[die] = (counts[die] || 0) + 1;
  const frequencies = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const isStraight = (new Set(dice).size === 5) && (dice[0] - dice[4] === 4);

  let rank = 1;
  let nameKey = "HighDie";
  if (frequencies[0].count === 5) {
    rank = 8;
    nameKey = "Kuboker";
  } else if (frequencies[0].count === 4) {
    rank = 7;
    nameKey = "FourOfAKind";
  } else if (frequencies[0].count === 3 && frequencies[1].count === 2) {
    rank = 6;
    nameKey = "FullHouse";
  } else if (isStraight) {
    rank = 5;
    nameKey = "Straight";
  } else if (frequencies[0].count === 3) {
    rank = 4;
    nameKey = "ThreeOfAKind";
  } else if (frequencies[0].count === 2 && frequencies[1].count === 2) {
    rank = 3;
    nameKey = "TwoPairs";
  } else if (frequencies[0].count === 2) {
    rank = 2;
    nameKey = "Pair";
  }

  let score = rank * 100000000;
  let multiplier = 1000000;
  for (const freq of frequencies) {
    for (let index = 0; index < freq.count; index += 1) {
      score += freq.value * multiplier;
      multiplier /= 100;
    }
  }

  return { nameKey, score };
}

function getOutcomeMeta(definition, outcomeKey) {
  return {
    label: gt(definition, `Outcomes.${outcomeKey}.Label`, outcomeKey),
    color: gt(definition, `Outcomes.${outcomeKey}.Color`, "#ffffff"),
    style: gt(definition, `Outcomes.${outcomeKey}.Style`, "background: rgba(255,255,255,0.08);"),
  };
}

function getFlavor(definition, strategy, outcomeKey, actorName) {
  const key = `${STRATEGIES[strategy].key}.${outcomeKey}`;
  const choices = gobj(definition, `Flavor.${key}`, [gt(definition, "FlavorFallback", "The table answers in silence.")]);
  return randomChoice(choices, gt(definition, "FlavorFallback", "The table answers in silence."))
    .replaceAll("{n}", `<b style="color:white">${escapeHtml(actorName)}</b>`);
}

async function addActorToState(state, actor, { isParticipating = false, source = "manual" } = {}) {
  if (!actor || state.players[actor.id]) return;
  state.players[actor.id] = {
    id: actor.id,
    name: actor.name,
    img: actor.img,
    level: actor.level || actor.system.details?.level?.value || 0,
    dice: [0, 0, 0],
    strategy: "fair",
    skill: "soc",
    isParticipating,
    changesLeft: 0,
    crownChangesLeft: 0,
    complaints: [],
    blackDiceIdx: -1,
    isConfirmed: false,
    degree: 2,
    isWinner: false,
    handName: "",
    score: 0,
    source,
  };
}

function getLockedRound(state) {
  const currentRound = Number(state?.lockedRound);
  if (Number.isInteger(currentRound) && currentRound >= 1) {
    return Math.min(currentRound, LOCKED_ROUNDS_TOTAL);
  }
  return 1;
}

function getRerollResourcesForPlayer(playerData) {
  if (!playerData?.isParticipating) {
    return { changesLeft: 0, crownChangesLeft: 0 };
  }

  if (playerData.strategy === "observe") {
    return { changesLeft: playerData.degree >= 3 ? 1 : 0, crownChangesLeft: 0 };
  }

  if (playerData.strategy === "cheat") {
    if (playerData.degree === 5) return { changesLeft: 2, crownChangesLeft: 0 };
    return { changesLeft: playerData.degree >= 3 ? 1 : 0, crownChangesLeft: 0 };
  }

  if (playerData.degree === 5) return { changesLeft: 2, crownChangesLeft: 1 };
  if (playerData.degree === 4) return { changesLeft: 2, crownChangesLeft: 0 };
  if (playerData.degree === 3) return { changesLeft: 1, crownChangesLeft: 0 };
  return { changesLeft: 0, crownChangesLeft: 0 };
}

function applyRerollResources(playerData) {
  const { changesLeft, crownChangesLeft } = getRerollResourcesForPlayer(playerData);
  playerData.changesLeft = changesLeft;
  playerData.crownChangesLeft = crownChangesLeft;
}

function hasPendingCrownReroll(playerData) {
  return Number(playerData?.crownChangesLeft) > 0;
}

function hasAnyPendingCrownRerolls(state) {
  return Object.values(state?.players ?? {}).some((playerData) => (
    playerData?.isParticipating
    && hasPendingCrownReroll(playerData)
    && !isPlayerLockedOut(state, playerData)
  ));
}

function isPlayerDisqualified(playerData) {
  return Boolean(playerData?.complaints?.length);
}

function isPlayerLockedOut(state, playerData) {
  return isPlayerDisqualified(playerData)
    && getLockedRound(state) > 1
    && ["deal", "locked"].includes(state?.phase);
}

function getPhaseLabel(definition, state) {
  const phase = state.phase || "join";
  const baseLabel = gt(definition, `Phases.${phase}`, phase);
  if (!["deal", "locked"].includes(phase)) return baseLabel;

  const roundText = gtf(
    definition,
    "RoundProgress",
    { current: getLockedRound(state), total: LOCKED_ROUNDS_TOTAL },
    ({ current, total }) => `Round ${current}/${total}`
  );

  return `${baseLabel} (${roundText})`;
}

function buildEmptyState(definition, state, visibleEntries = null) {
  const resolvedEntries = visibleEntries ?? Object.entries(state.players ?? {}).filter(([actorId]) => !state.excludedPlayers?.[actorId]);
  const playerCount = resolvedEntries.length;
  const participatingCount = resolvedEntries.filter(([, entry]) => entry.isParticipating).length;
  if (!playerCount) {
    return t("Common.Empty.NoPlayers", "No players found. Assign characters to users or drag actors into the game window.");
  }
  if (state.phase === "join" && !participatingCount) {
    return gt(definition, "Empty.JoinInstructions", "Players mark \"I'm in the game\", then the GM clicks Start.");
  }
  if (state.phase !== "join" && !participatingCount) {
    return gt(definition, "Empty.NoParticipants", "There are no participants. Return to setup and mark players as participating.");
  }
  return "";
}

function beginNextLockedRound(definition, state) {
  const nextRound = getLockedRound(state) + 1;
  if (nextRound > LOCKED_ROUNDS_TOTAL) return false;

  state.phase = "deal";
  state.lockedRound = nextRound;

  for (const playerData of Object.values(state.players)) {
    if (!playerData.isParticipating) continue;
    playerData.isConfirmed = false;
    playerData.changesLeft = 0;
    playerData.crownChangesLeft = 0;
  }

  const content = unwrapChronicleEntry(gtf(
    definition,
    "Log.NextRound",
    { round: nextRound, total: LOCKED_ROUNDS_TOTAL },
    ({ round, total }) => `<b>Round ${round}/${total} begins.</b>`
  ));
  state.log.unshift(buildChronicleNote(content, { color: "#8ecbff", centered: true }));
  return true;
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
    state.players[actor.id].level = actor.level || actor.system.details?.level?.value || 0;
    state.players[actor.id].source = "auto";
  }
}

function buildSummaryUi(definition, state) {
  return {
    title: gt(definition, "Title", "Kuboker"),
    rulesTitle: gt(definition, "Rules.PanelTitle", "Table Rules"),
    logTitle: gt(definition, "Log.PanelTitle", "Chronicle"),
    spectatorLabel: gt(definition, "Spectator", "Spectating"),
    joinLabel: gt(definition, "JoinLabel", "I'm in the game"),
    debugLabel: gt(definition, "DebugMode", "GM debug mode"),
    helpTitle: gt(definition, "Rules.HelpTitle", "Kuboker Rules"),
    helpHtml: gt(definition, "Rules.HelpHtml", "<p>No rules available.</p>"),
    buttons: {
      start: gt(definition, "Buttons.Start", "Start"),
      round: gt(definition, "Buttons.ResetRound", "Round"),
      reveal: gt(definition, "Buttons.Reveal", "Reveal"),
      clear: gt(definition, "Buttons.Clear", "Clear Table"),
      resetGame: gt(definition, "Buttons.ResetGame", "Full Reset"),
      confirm: gt(definition, "Buttons.Confirm", "Confirm"),
      ready: gt(definition, "Buttons.Ready", "Ready"),
      report: gt(definition, "Buttons.Report", "Report"),
      reported: gt(definition, "Buttons.Reported", "Reported"),
    },
    sections: [
      {
        title: gt(definition, "Rules.StrategiesHeader", "Strategies"),
        items: ["Fair", "Cheat", "Observe"].map((strategyKey) => ({
          left: gt(definition, `Strategies.${strategyKey}.Name`, strategyKey),
          right: gt(definition, `Strategies.${strategyKey}.Summary`, ""),
          classes: "tsu-rule-item--stacked",
        })),
      },
      {
        title: gt(definition, "Rules.HandsHeader", "Hands"),
        items: ["Kuboker", "FourOfAKind", "FullHouse", "Straight", "ThreeOfAKind", "TwoPairs", "Pair", "HighDie"].map((handKey) => ({
          label: gt(definition, `Hands.${handKey}`, handKey),
          dicePreview: createHandPreview(handKey),
          previewClasses: getHandPreviewAccentClass(handKey),
          right: gt(definition, `HandsSummary.${handKey}`, ""),
        })),
      },
    ],
  };
}

function getVisibleCheatersMap(state) {
  const visible = {};
  if (!["locked", "reveal"].includes(state.phase)) return visible;

  for (const [targetId, targetData] of Object.entries(state.players)) {
    if (targetData.strategy !== "cheat" || !targetData.isParticipating) continue;
    visible[targetId] = [];
    for (const [viewerId, viewerData] of Object.entries(state.players)) {
      if (viewerId === targetId || !viewerData.isParticipating) continue;
      let noticed = false;
      if (targetData.degree === 0) noticed = true;
      else if (targetData.degree === 1 && viewerData.degree > 1) noticed = true;
      else if (targetData.degree === 2 && viewerData.strategy === "observe" && viewerData.degree >= 4) noticed = true;
      else if (targetData.degree === 3 && viewerData.strategy === "observe" && viewerData.degree === 5) noticed = true;
      if (noticed) visible[targetId].push(viewerId);
    }
  }

  return visible;
}

function createPlayerPresentation(definition, state, actorId, playerData, visibleCheatersMap) {
  const actor = game.actors.get(actorId);
  const canPlayerControl = canCurrentUserOperateActor(actor, state);
  const isVisualOwner = canPlayerControl;
  const isSpectatorViewer = isCurrentUserSpectator(state);
  const isObserverCard = !playerData.isParticipating;
  const hidePrivateDetailsFromSpectator = false;
  const isLockedOut = isPlayerLockedOut(state, playerData);
  const hasPendingCrownLock = state.phase === "locked" && hasAnyPendingCrownRerolls(state);
  const canSeeDice = state.phase === "reveal" || isVisualOwner || isSpectatorViewer;
  const canSeeChoices = isVisualOwner || isSpectatorViewer;
  const showDice = state.phase !== "join" && !isObserverCard;
  const showStrategyControls = state.phase === "deal" && canSeeChoices;
  const showSkillControls = state.phase === "deal" && canSeeChoices;
  const canPlan = showStrategyControls && playerData.isParticipating && isVisualOwner && !isLockedOut;
  const canUseCrownReroll = state.phase === "locked" && playerData.isParticipating && isVisualOwner && hasPendingCrownReroll(playerData) && !isLockedOut;
  const canReroll = state.phase === "locked" && playerData.isParticipating && isVisualOwner && playerData.changesLeft > 0 && !hasPendingCrownReroll(playerData) && !hasPendingCrownLock && !isLockedOut;
  const showConfirm = ["deal", "locked"].includes(state.phase) && canSeeChoices && !isObserverCard;
  const confirmDisabled = !showConfirm || !playerData.isParticipating || isLockedOut || !canPlayerControl || (state.phase === "locked" && hasPendingCrownLock);
  const classes = [
    playerData.isParticipating ? "" : "tsu-player-card--spectator",
    (canPlan || canReroll || canUseCrownReroll) ? "tsu-player-card--active" : "",
    playerData.isWinner ? "tsu-player-card--winner" : "",
    playerData.isParticipating ? "active" : "",
    playerData.isWinner ? "is-winner" : "",
  ].filter(Boolean).join(" ");

  const strategyButtons = Object.entries(STRATEGIES).map(([strategyId, strategy]) => ({
    id: strategyId,
    label: gt(definition, `Strategies.${strategy.key}.Name`, strategyId),
    disabled: !playerData.isParticipating || !canPlan,
    classes: [
      canSeeChoices && playerData.strategy === strategyId ? "is-active" : "",
      !playerData.isParticipating || !canPlan ? "is-disabled disabled" : "",
    ].filter(Boolean).join(" "),
  }));

  const skillButtons = [...(STRATEGY_SKILLS[playerData.strategy] || []), "lore"].map((skillId) => ({
    id: skillId,
    label: `${gt(definition, `Skills.${SKILL_KEYS[skillId]}.Short`, skillId)} (${formatSignedNumber(getActorModifiers(actor)[skillId] || 0)})`,
    disabled: !playerData.isParticipating || !canPlan,
    classes: [
      canSeeChoices && playerData.skill === skillId ? "is-active" : "",
      !playerData.isParticipating || !canPlan ? "is-disabled disabled" : "",
    ].filter(Boolean).join(" "),
  }));

  const normalizedDice = normalizeDiceValues(playerData.dice, { fallback: 0 });
  while (normalizedDice.length < 3) normalizedDice.push(0);
  const dice = normalizedDice.slice(0, 3).map((value, index) => {
    const canInteractWithDie = playerData.isParticipating && canReroll && playerData.blackDiceIdx !== index;
    const showReadonlyDie = canSeeDice && !canInteractWithDie && !(game.user?.isGM && state?.debugMode);
    return {
      index,
      disabled: !canSeeDice,
      readonly: showReadonlyDie,
      classes: [
        value === 0 ? "tsu-die--black" : "",
        !canSeeDice ? "tsu-die--hidden" : "",
        canInteractWithDie ? "tsu-die--reroll" : "",
        !canSeeDice ? "is-disabled disabled" : "",
        showReadonlyDie ? "kb-die--readonly" : "",
        value === 0 ? "black" : "",
        !canSeeDice ? "hidden" : "",
        canInteractWithDie ? "re-roll" : "",
      ].filter(Boolean).join(" "),
      value: value === 0 ? "☠" : (canSeeDice ? `${value}` : "?"),
    };
  });

  const normalizedCenterDice = normalizeDiceValues(state.center, { fallback: 0 });
  while (normalizedCenterDice.length < 2) normalizedCenterDice.push(0);
  const crownDice = normalizedCenterDice.slice(0, 2).map((value, index) => ({
    index,
    disabled: !playerData.isParticipating || !canUseCrownReroll || value <= 0,
    classes: [
      canUseCrownReroll && value > 0 ? "tsu-die--reroll kb-crown-die" : "",
      (!playerData.isParticipating || !canUseCrownReroll || value <= 0) ? "is-disabled disabled" : "",
      canUseCrownReroll && value > 0 ? "re-roll crown" : "",
    ].filter(Boolean).join(" "),
    value: value > 0 ? `${value}` : "-",
  }));

  const exposedTargets = [];
  if (state.phase === "locked" && isVisualOwner && !hasPendingCrownLock) {
    for (const [cheaterId, observerIds] of Object.entries(visibleCheatersMap)) {
      if (!observerIds.includes(actorId)) continue;
      const cheater = state.players[cheaterId];
      const alreadyComplained = (cheater.complaints || []).includes(actorId);
      exposedTargets.push({
        id: cheaterId,
        actorId,
        label: (cheater.name || "").split(" ")[0] || cheater.name,
        alreadyComplained,
        disabled: alreadyComplained,
        buttonLabel: alreadyComplained
          ? gt(definition, "Buttons.Reported", "Reported")
          : gt(definition, "Buttons.Report", "Report"),
      });
    }
  }

  const isDisqualified = isPlayerDisqualified(playerData);

  let statusText = "";
  if (isObserverCard) {
    statusText = "";
  } else if (isLockedOut) {
    statusText = gt(definition, "Disqualified", "Disqualified");
  } else if (state.phase === "reveal" && playerData.handName && !playerData.isWinner && !isDisqualified) {
    statusText = playerData.handName;
  } else if (state.phase === "locked" && playerData.crownChangesLeft > 0) {
    statusText = gtf(definition, "CrownRerollPrompt", { count: playerData.crownChangesLeft }, ({ count }) => `Crown die x${count}: replace a stock die first.`);
  } else if (state.phase === "locked" && playerData.changesLeft > 0) {
    statusText = gtf(definition, "RerollsLeft", { count: playerData.changesLeft }, ({ count }) => `Rerolls left: ${count}`);
  }
  const handResolvedName = state.phase === "reveal" ? (playerData.handName || "") : "";

  return {
    id: actorId,
    name: playerData.name,
    img: playerData.img,
    classes,
    isParticipating: playerData.isParticipating,
    isActorOwner: canPlayerControl,
    isVisualOwner,
    isWinner: playerData.isWinner,
    isCaught: Boolean(playerData.complaints?.length),
    joinCheckbox: state.phase === "join" && canCurrentUserToggleJoin(actor, state),
    joinLabel: gt(definition, "JoinLabel", "I'm in the game"),
    spectatorLabel: !playerData.isParticipating ? gt(definition, "Spectator", "Spectating") : "",
    showSubline: state.phase === "join" || !playerData.isParticipating,
    showRemove: state.phase === "join",
    removeDisabled: !game.user.isGM,
    showBody: state.phase !== "join" && !isObserverCard,
    showDice,
    showStrategyControls,
    showSkillControls,
    canPlan,
    canReroll,
    canUseCrownReroll,
    strategyButtons,
    skillButtons,
    dice,
    showCrownControls: canUseCrownReroll,
    crownLabel: gt(definition, "CrownRerollLabel", "Crown die"),
    crownDice,
    displayDice: dice.map((die) => ({
      ...die,
      val: die.value,
      isHidden: die.classes.includes("hidden"),
      isBlack: die.classes.includes("black"),
      canReroll: die.classes.includes("re-roll"),
    })),
    statusText,
    showConfirm,
    confirmDisabled,
    confirmLabel: playerData.isConfirmed ? gt(definition, "Buttons.Ready", "Ready") : gt(definition, "Buttons.Confirm", "Confirm"),
    confirmClasses: [
      playerData.isConfirmed ? "is-active ready" : "",
      confirmDisabled ? "is-disabled disabled" : "",
    ].filter(Boolean).join(" "),
    exposedTargets,
    winnerLabel: playerData.isWinner ? gt(definition, "Winner", "Winner") : "",
    caughtLabel: playerData.complaints?.length ? gt(definition, "Disqualified", "Disqualified") : "",
    handResolvedName,
  };
}

function getOutcomeKeyFromDegree(degree) {
  if (degree === 5) return "UberCrit";
  if (degree === 4) return "CriticalSuccess";
  if (degree === 3) return "Success";
  if (degree === 2) return "Failure";
  if (degree === 1) return "CriticalFailure";
  return "UberFailure";
}

function unwrapChronicleEntry(html) {
  const text = String(html ?? "").trim();
  const match = text.match(/^<div(?:\s+[^>]*)?>([\s\S]*)<\/div>$/i);
  return match ? match[1] : text;
}

function getChronicleOutcomeLabel(outcomeKey) {
  const isRu = (game?.i18n?.lang ?? "en").startsWith("ru");
  const labels = isRu
    ? {
        UberCrit: "НАТ 20 UBER",
        CriticalSuccess: "КРИТ. УСПЕХ",
        Success: "УСПЕХ",
        Failure: "ПРОВАЛ",
        CriticalFailure: "КРИТ. ПРОВАЛ",
        UberFailure: "НАТ 1 UBER",
      }
    : {
        UberCrit: "NAT 20 UBER",
        CriticalSuccess: "CRIT. SUCCESS",
        Success: "SUCCESS",
        Failure: "FAILURE",
        CriticalFailure: "CRIT. FAILURE",
        UberFailure: "NAT 1 UBER",
      };
  return labels[outcomeKey] ?? outcomeKey.toUpperCase();
}

function getChronicleOutcomeVisual(outcomeKey) {
  switch (outcomeKey) {
    case "UberCrit":
      return {
        badgeColor: "#ffaa00",
        flavorKey: "uber_crit",
        wrapperStyle: "background:rgba(90,74,0,0.3); border:1px solid gold; color:#ffcc00;",
      };
    case "CriticalSuccess":
      return {
        badgeColor: "#2ecc71",
        flavorKey: "crit",
        wrapperStyle: "background:rgba(46,204,113,0.15); border-left:4px solid #2ecc71;",
      };
    case "Success":
      return {
        badgeColor: "#27ae60",
        flavorKey: "success",
        wrapperStyle: "background:rgba(39,174,96,0.1); border-left:3px solid #27ae60;",
      };
    case "Failure":
      return {
        badgeColor: "#e67e22",
        flavorKey: "fail",
        wrapperStyle: "background:rgba(230,126,34,0.1); border-left:3px solid #e67e22;",
      };
    case "CriticalFailure":
      return {
        badgeColor: "#c0392b",
        flavorKey: "crit_fail",
        wrapperStyle: "background:rgba(192,57,43,0.2); border-left:4px solid #c0392b;",
      };
    default:
      return {
        badgeColor: "#9b59b6",
        flavorKey: "uber_fail",
        wrapperStyle: "background:rgba(68,0,68,0.3); border:1px solid #9b59b6; color:#d689ff;",
      };
  }
}

function buildChronicleNote(content, { color = "#ffd700", centered = false } = {}) {
  return `<div style="font-size:11px; color:${color}; line-height:1.2;${centered ? " text-align:center;" : ""}">${content}</div>`;
}

function buildChronicleHeader(definition, dc) {
  const isRu = (game?.i18n?.lang ?? "en").startsWith("ru");
  const title = isRu ? `ПРОВЕРКА СТРАТЕГИЙ (КС ${dc})` : `STRATEGY CHECKS (DC ${dc})`;
  return `<div style="text-align:center; color:#ffd700; border-top:1px solid #d4af37; border-bottom:1px solid #d4af37; background:rgba(212,175,55,0.1); padding:4px; margin:10px 0; font-weight:bold; font-size:12px;">${title}</div>`;
}

function buildChronicleResultEntry(definition, playerData, d20, modifier, penalty, total, dc, degree, prefixKey) {
  const outcomeKey = getOutcomeKeyFromDegree(degree);
  const visual = getChronicleOutcomeVisual(outcomeKey);
  const safeD20 = toSafeNumber(d20, 0);
  const safeModifier = toSafeNumber(modifier, 0);
  const safePenalty = toSafeNumber(penalty, 0);
  const safeTotal = toSafeNumber(total, safeD20 + safeModifier + safePenalty);
  const safeDc = toSafeNumber(dc, 0);
  const prefix = gt(definition, `Prefixes.${prefixKey}`, prefixKey).toUpperCase();
  const penaltyText = safePenalty ? formatSignedNumber(safePenalty) : "";
  const math = `[${safeD20}${formatSignedNumber(safeModifier)}${penaltyText}=${safeTotal} vs ${getDcLabel(definition)}${safeDc}]`;
  const flavor = getFlavor(definition, playerData.strategy, outcomeKey, playerData.name);
  return `<div style="padding:6px; margin-bottom:5px; border-radius:4px; ${visual.wrapperStyle}"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:3px;"><span style="background:${visual.badgeColor}; color:black; padding:1px 6px; border-radius:3px; font-weight:bold; font-size:10px;">${escapeHtml(prefix)}: ${escapeHtml(getChronicleOutcomeLabel(outcomeKey))}</span><span style="opacity:0.7; font-size:10px;">${escapeHtml(math)}</span></div><div style="line-height:1.2; font-size:11px;">${flavor}</div></div>`;
}

function logResult(definition, state, playerData, d20, modifier, penalty, total, dc, degree, prefixKey) {
  state.log.unshift(buildChronicleResultEntry(definition, playerData, d20, modifier, penalty, total, dc, degree, prefixKey));
}

async function executeMasterLogic(definition, state, { round = 1, preserveComplaints = false } = {}) {
  state.phase = "locked";
  state.lockedRound = round;
  const participants = Object.values(state.players).filter((entry) => entry.isParticipating);
  const activePlayers = participants.filter((entry) => !(round > 1 && isPlayerDisqualified(entry)));
  const dc = state.currentDC || 15;
  state.log.unshift(buildChronicleHeader(definition, dc));

  for (const playerData of participants) {
    playerData.isConfirmed = false;
    if (!preserveComplaints) playerData.complaints = [];
    playerData.isWinner = false;
    if (round > 1 && isPlayerDisqualified(playerData)) {
      playerData.changesLeft = 0;
      playerData.crownChangesLeft = 0;
    }
  }

  let eagleSuccesses = 0;
  for (const playerData of activePlayers.filter((entry) => entry.strategy === "observe")) {
    const actor = game.actors.get(playerData.id);
    const modifiers = getActorModifiers(actor);
    const modifier = modifiers[playerData.skill] || 0;
    const roll = await new Roll("1d20").evaluate({ async: true });
    const total = roll.total + modifier;
    let degree = (total >= dc + 10) ? 4 : (total >= dc ? 3 : (total <= dc - 10 ? 1 : 2));
    if (roll.total === 20) degree = 5;
    if (roll.total === 1) degree = 0;
    playerData.degree = degree;
    applyRerollResources(playerData);
    playerData.blackDiceIdx = -1;
    if (degree >= 3) eagleSuccesses += 1;
    if (degree === 0) {
      const dieIndex = Math.floor(Math.random() * 3);
      playerData.dice[dieIndex] = 0;
      playerData.blackDiceIdx = dieIndex;
    }
    logResult(definition, state, playerData, roll.total, modifier, 0, total, dc, degree, "Observe");
  }

  const cheatPenalty = eagleSuccesses === 1 ? -2 : eagleSuccesses > 1 ? -(2 + (eagleSuccesses - 1)) : 0;
  if (cheatPenalty < 0) {
    const content = unwrapChronicleEntry(gtf(definition, "Log.CheatPenalty", { penalty: cheatPenalty }, ({ penalty }) => `<b>Cheater penalty from eagle eyes: ${penalty}</b>`));
    state.log.unshift(buildChronicleNote(content, { color: "#ff8f8f", centered: true }));
  }

  for (const playerData of activePlayers.filter((entry) => entry.strategy === "cheat")) {
    const actor = game.actors.get(playerData.id);
    const modifiers = getActorModifiers(actor);
    const modifier = modifiers[playerData.skill] || 0;
    const roll = await new Roll("1d20").evaluate({ async: true });
    const total = roll.total + modifier + cheatPenalty;
    let degree = (total >= dc + 10) ? 4 : (total >= dc ? 3 : (total <= dc - 10 ? 1 : 2));
    if (roll.total === 20) degree = 5;
    if (roll.total === 1) degree = 0;
    playerData.degree = degree;
    applyRerollResources(playerData);
    playerData.blackDiceIdx = -1;
    logResult(definition, state, playerData, roll.total, modifier, cheatPenalty, total, dc, degree, "Cheat");
  }

  for (const playerData of activePlayers.filter((entry) => entry.strategy === "fair")) {
    const actor = game.actors.get(playerData.id);
    const modifiers = getActorModifiers(actor);
    const modifier = modifiers[playerData.skill] || 0;
    const roll = await new Roll("1d20").evaluate({ async: true });
    const total = roll.total + modifier;
    let degree = (total >= dc + 10) ? 4 : (total >= dc ? 3 : (total <= dc - 10 ? 1 : 2));
    if (roll.total === 20) degree = 5;
    if (roll.total === 1) degree = 0;
    playerData.degree = degree;
    playerData.blackDiceIdx = -1;
    applyRerollResources(playerData);

    if (degree === 1) {
      const dieIndex = Math.floor(Math.random() * 3);
      playerData.dice[dieIndex] = Math.floor(Math.random() * 10) + 1;
      const content = unwrapChronicleEntry(gtf(definition, "Log.ForcedReroll", { name: playerData.name }, ({ name }) => `Dealer forces a reroll for <b>${escapeHtml(name)}</b>.`));
      state.log.unshift(buildChronicleNote(`вљ  ${content}`, { color: "#ffb347" }));
    }
    if (degree === 0) {
      const dieIndex = Math.floor(Math.random() * 3);
      playerData.dice[dieIndex] = 0;
      playerData.blackDiceIdx = dieIndex;
      const content = unwrapChronicleEntry(gtf(definition, "Log.BlackDie", { name: playerData.name }, ({ name }) => `Black die for <b>${escapeHtml(name)}</b>.`));
      state.log.unshift(buildChronicleNote(`вљ  ${content}`, { color: "#ff8b8b" }));
    }
    logResult(definition, state, playerData, roll.total, modifier, 0, total, dc, degree, "Fair");
  }
}

const template = `
<form class="tsu-game tsu-kuboker" id="kuboker-app" autocomplete="off">
  <aside class="tsu-panel tsu-panel--rules kb-col-rules">
    <div class="tsu-panel-title kb-rule-headline">
      <span>{{ui.rulesTitle}}</span>
      {{#if isGM}}<input type="number" class="kb-dc-input" min="1" max="99" step="1" value="{{dcInputValue}}" placeholder="{{dcPlaceholder}}">{{/if}}
      <button type="button" class="tsu-help-button kb-rules-help" data-action="help">?</button>
    </div>
    {{#each ui.sections}}
      <section class="tsu-rule-block">
        <h3 class="tsu-rule-header">{{title}}</h3>
        <div class="tsu-rule-list">
          {{#each items}}
            <div class="tsu-rule-item kb-combo-item {{classes}}">
              {{#if dicePreview}}
                <div class="tsu-kuboker-hand-preview kb-hand-preview {{previewClasses}}">
                  <div class="tsu-kuboker-hand-preview__title kb-hand-label">{{label}}</div>
                  <div class="tsu-kuboker-hand kb-mini-dice-row" role="img" aria-label="{{label}}">
                    {{#each dicePreview}}
                      <span class="tsu-kuboker-hand__die kb-mini-die {{classes}}">{{value}}</span>
                    {{/each}}
                  </div>
                  {{#if right}}<div class="tsu-kuboker-hand-preview__summary">{{right}}</div>{{/if}}
                </div>
              {{else}}
                <div><strong>{{left}}</strong></div>
                {{#if right}}<div class="tsu-rule-item-copy">{{right}}</div>{{/if}}
              {{/if}}
            </div>
          {{/each}}
        </div>
      </section>
    {{/each}}
  </aside>

  <section class="tsu-panel tsu-panel--main kb-col-main" id="kb-main-area">
    <header class="tsu-game-header kb-header-casino">
      <h2>{{ui.title}}</h2>
      <div class="tsu-status-line">{{phaseLabel}}</div>
    </header>

    <section class="kb-stock-block">
      <div class="tsu-dice-row kb-dice-box kb-stock-dice">
        {{#each centerDice}}
          <span class="tsu-die kb-stock-die">{{this}}</span>
        {{/each}}
      </div>
    </section>

    {{#if showEmptyState}}<div class="tsu-empty-state kb-empty-state">{{emptyState}}</div>{{/if}}

    <div class="tsu-player-list">
      {{#each players}}
        <article class="tsu-player-card kb-player-card {{classes}}">
          <div class="kb-card-headrail">
            {{#if showConfirm}}
              <div class="kb-card-controls">
                <button type="button" class="tsu-button kb-btn-confirm {{confirmClasses}}" data-action="toggle-confirm" data-actor-id="{{id}}" data-actor="{{id}}" {{#if confirmDisabled}}disabled{{/if}}>{{confirmLabel}}</button>
              </div>
            {{/if}}
          </div>
          {{#if showRemove}}
            <button type="button" class="tsu-icon-button kb-remove-btn {{#if removeDisabled}}is-disabled disabled{{/if}}" data-action="remove-player" data-actor-id="{{id}}" data-actor="{{id}}" {{#if removeDisabled}}disabled{{/if}}>x</button>
          {{/if}}
          <div class="tsu-player-card-top {{#if showConfirm}}kb-player-card-top--with-controls{{/if}}">
            <img class="tsu-avatar" src="{{img}}" alt="{{name}}">
            <div class="tsu-player-meta">
              <div class="tsu-player-name">{{name}}</div>
              {{#if showSubline}}
              <div class="tsu-player-subline kb-player-subline">
                {{#if joinCheckbox}}
                  <label class="tsu-checkbox kb-join-label">
                    <input class="tsu-join-toggle kb-join-cb" type="checkbox" data-actor-id="{{id}}" data-actor="{{id}}" {{#if isParticipating}}checked{{/if}}>
                    <span>{{joinLabel}}</span>
                  </label>
                {{/if}}
                {{#if spectatorLabel}}<span class="tsu-chip">{{spectatorLabel}}</span>{{/if}}
              </div>
              {{/if}}
            </div>
          </div>

          {{#if showBody}}
          {{#if showDice}}
              <div class="tsu-dice-row kb-dice-box">
                {{#each displayDice}}
                  <button type="button" class="tsu-die {{classes}}" data-action="reroll-die" data-actor-id="{{../id}}" data-actor="{{../id}}" data-die-index="{{index}}" {{#if disabled}}disabled{{/if}} {{#if readonly}}tabindex="-1" aria-disabled="true"{{/if}}>{{value}}</button>
                {{/each}}
              </div>
            {{/if}}

              {{#if showCrownControls}}
                <div class="tsu-player-subline kb-bottom-status">
                  <span class="tsu-chip">{{crownLabel}}</span>
                </div>
                <div class="tsu-dice-row kb-dice-box kb-crown-dice-box">
                  {{#each crownDice}}
                    <button type="button" class="tsu-die {{classes}}" data-action="reroll-center-die" data-actor-id="{{../id}}" data-actor="{{../id}}" data-center-index="{{index}}" {{#if disabled}}disabled{{/if}}>{{value}}</button>
                  {{/each}}
                </div>
              {{/if}}

              {{#if showStrategyControls}}
                <div class="tsu-grid-buttons tsu-grid-buttons--3">
                  {{#each strategyButtons}}
                    <button type="button" class="tsu-chip kb-btn-sm kb-strat-btn {{classes}}" data-action="select-strategy" data-actor-id="{{../id}}" data-actor="{{../id}}" data-strategy="{{id}}" {{#if disabled}}disabled{{/if}}>{{label}}</button>
                  {{/each}}
                </div>
              {{/if}}
              {{#if showSkillControls}}
                <div class="tsu-grid-buttons tsu-grid-buttons--3 kb-skill-row">
                  {{#each skillButtons}}
                    <button type="button" class="tsu-small-button kb-btn-sm kb-skill-btn {{classes}}" data-action="select-skill" data-actor-id="{{../id}}" data-actor="{{../id}}" data-skill="{{id}}" {{#if disabled}}disabled{{/if}}>{{label}}</button>
                  {{/each}}
                </div>
              {{/if}}

              {{#if exposedTargets.length}}
                <div class="tsu-grid-buttons tsu-grid-buttons--2 kb-report-row">
                  {{#each exposedTargets}}
                    <button type="button" class="tsu-small-button kb-disq-btn {{#if disabled}}is-disabled disabled{{/if}}" data-action="report-cheater" data-actor-id="{{actorId}}" data-target-id="{{id}}" {{#if disabled}}disabled{{/if}}>
                      {{buttonLabel}} {{label}}!
                    </button>
                  {{/each}}
                </div>
              {{/if}}

              {{#if isWinner}}<div class="kb-result-line kb-result-line--win">{{winnerLabel}} {{handResolvedName}}!</div>{{/if}}
              {{#if isCaught}}<div class="kb-result-line kb-result-line--caught">{{caughtLabel}}</div>{{/if}}
              {{#if statusText}}<div class="kb-result-line kb-result-line--note">{{statusText}}</div>{{/if}}
          {{/if}}

        </article>
      {{/each}}
    </div>

  </section>

  <aside class="tsu-panel tsu-panel--log kb-col-log">
    <h4 class="kb-log-title">{{ui.logTitle}}</h4>
    <div class="kb-log-list">
      {{#each logEntries}}
        <div class="kb-log-record">{{{this}}}</div>
      {{/each}}
    </div>
  </aside>

  <footer class="tsu-footer kb-footer">
    <div>
      {{#if isGM}}
        <label class="tsu-checkbox kb-debug-label">
          <input id="kb-debug-mode" class="kb-debug" type="checkbox" {{#if state.debugMode}}checked{{/if}}>
          <span>{{ui.debugLabel}}</span>
        </label>
      {{/if}}
    </div>
    <div class="tsu-footer-actions">
      {{#each footerButtons}}
        <button type="button" class="tsu-button kb-btn-main {{classes}}" data-action="{{action}}">
          {{#if icon}}<i class="{{icon}}"></i> {{/if}}{{label}}
        </button>
      {{/each}}
    </div>
  </footer>
</form>`;

class KubokerApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      title: gt(definition, "Title", "Kuboker"),
      width: 1420,
      height: 860,
      resizable: true,
      popOut: true,
      classes: ["tsu-window"],
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

  getData() {
    const state = this.getState();
    const visibleCheatersMap = getVisibleCheatersMap(state);
    const suggestedDc = getSuggestedDc(state);
    const ui = {
      ...buildSummaryUi(definition, state),
      helpLabel: gt(definition, "Buttons.Help", "Rules"),
    };

    const phaseLabel = getPhaseLabel(definition, state);
    const visibleEntries = Object.entries(state.players)
      .filter(([actorId]) => !state.excludedPlayers?.[actorId]);
    const participatingCount = visibleEntries.filter(([, entry]) => entry.isParticipating).length;
    const players = visibleEntries
      .sort((a, b) => {
        const aOwned = (!game.user.isGM && userCanControlActor(game.actors.get(a[0]), game.user)) ? 1 : 0;
        const bOwned = (!game.user.isGM && userCanControlActor(game.actors.get(b[0]), game.user)) ? 1 : 0;
        if (aOwned !== bOwned) return bOwned - aOwned;
        return (a[1].name || "").localeCompare(b[1].name || "", game.i18n?.lang || "en", { sensitivity: "base" });
      })
      .map(([actorId, playerData]) => createPlayerPresentation(definition, state, actorId, playerData, visibleCheatersMap));

    console.log(`${MODULE_ID} | kuboker getData`, {
      phase: state.phase,
      statePlayers: Object.keys(state.players ?? {}).length,
      visiblePlayers: players.length,
      excluded: Object.keys(state.excludedPlayers ?? {}),
    });

    const footerButtons = [];
    const hasPendingCrownLock = state.phase === "locked" && hasAnyPendingCrownRerolls(state);
    if (game.user.isGM) {
      if (state.phase === "join") footerButtons.push({ action: "deal", label: ui.buttons.start, title: ui.buttons.start, icon: "fas fa-dice", classes: "is-deal" });
      if (state.phase === "deal") footerButtons.push({ action: "run-lock", label: ui.buttons.round, title: ui.buttons.round, icon: "fas fa-broom", classes: "is-resolve" });
      if (state.phase === "locked" && getLockedRound(state) < LOCKED_ROUNDS_TOTAL) {
        footerButtons.push({
          action: "advance-round",
          label: ui.buttons.round,
          title: ui.buttons.round,
          icon: "fas fa-arrow-right",
          classes: `is-resolve${hasPendingCrownLock ? " is-disabled disabled" : ""}`,
          disabled: hasPendingCrownLock,
        });
      }
      if (state.phase === "locked" && getLockedRound(state) >= LOCKED_ROUNDS_TOTAL) {
        footerButtons.push({
          action: "reveal",
          label: ui.buttons.reveal,
          title: ui.buttons.reveal,
          icon: "fas fa-eye",
          classes: `is-reveal${hasPendingCrownLock ? " is-disabled disabled" : ""}`,
          disabled: hasPendingCrownLock,
        });
      }
      if (state.phase !== "join") footerButtons.push({ action: "clear", label: ui.buttons.clear, title: ui.buttons.clear, icon: "fas fa-rotate-left", classes: "is-clear" });
      footerButtons.push({ action: "reset-game", label: ui.buttons.resetGame, title: ui.buttons.resetGame, icon: "fas fa-redo", classes: "is-reset" });
    }

    return {
      state,
      ui,
      phaseLabel,
      dcInputValue: hasManualDcOverride(state) ? `${state.dcOverride}` : "",
      dcPlaceholder: formatDcPlaceholder(definition, suggestedDc),
      players,
      showEmptyState: players.length === 0 || participatingCount === 0,
      emptyState: buildEmptyState(definition, state, visibleEntries),
      centerDice: (() => {
        const dice = normalizeDiceValues(state.center, { fallback: 0 }).filter((value) => value > 0);
        return dice.length ? dice : ["-", "-"];
      })(),
      footerButtons,
      logEntries: state.log?.length ? state.log : [gt(definition, "Log.Empty", "No entries yet.")],
      isGM: game.user.isGM,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

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
    html.on("change", "#kb-debug-mode", (event) => {
      if (!game.user.isGM) return;
      void requestGameAction(GAME_ID, "toggle-debug", { enabled: event.currentTarget.checked });
    });
    html.on("change", ".kb-dc-input", (event) => {
      if (!game.user?.isGM) return;
      const rawValue = String(event.currentTarget.value ?? "").trim();
      if (!rawValue) {
        void requestGameAction(GAME_ID, "set-dc", { auto: true });
        return;
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      void requestGameAction(GAME_ID, "set-dc", { value });
    });
    html.on("keydown", ".kb-dc-input", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.currentTarget.blur();
    });
  }

  async onActionClick(event) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorId = button.dataset.actorId;
    const targetId = button.dataset.targetId;
    const dieIndex = Number(button.dataset.dieIndex);

    switch (action) {
      case "help":
        new Dialog({
          title: gt(definition, "Rules.HelpTitle", "Kuboker Rules"),
          content: `<div class="tsu-dialog-content">${gt(definition, "Rules.HelpHtml", "")}</div>`,
          buttons: { ok: { label: gt(definition, "Buttons.CloseRules", "Close") } },
        }, { width: 620 }).render(true);
        break;
      case "select-strategy":
        await requestGameAction(GAME_ID, "select-strategy", { actorId, strategy: button.dataset.strategy });
        break;
      case "select-skill":
        await requestGameAction(GAME_ID, "select-skill", { actorId, skill: button.dataset.skill });
        break;
      case "toggle-confirm": {
        const playerData = this.getState().players?.[actorId];
        await requestGameAction(GAME_ID, "toggle-confirm", { actorId, isConfirmed: !playerData?.isConfirmed });
        break;
      }
      case "reroll-die": {
        const playerData = this.getState().players?.[actorId];
        if (!playerData || playerData.changesLeft <= 0 || playerData.blackDiceIdx === dieIndex || hasPendingCrownReroll(playerData)) return;
        if (playerData.strategy === "cheat" && playerData.degree >= 4) {
          new Dialog({
            title: gt(definition, "Dialogs.SetDieTitle", "Set a die"),
            content: `<div class="tsu-dialog-content"><input type="number" id="kb-die-value" min="1" max="10" value="10" style="width:100%; text-align:center;"></div>`,
            buttons: {
              ok: {
                label: gt(definition, "Buttons.Accept", "Accept"),
                callback: (dialogHtml) => {
                  const value = Number(dialogHtml.find("#kb-die-value").val()) || 10;
                  void requestGameAction(GAME_ID, "reroll-die", { actorId, dieIndex, newValue: value });
                },
              },
            },
          }, { width: 320 }).render(true);
        } else {
          await requestGameAction(GAME_ID, "reroll-die", { actorId, dieIndex });
        }
        break;
      }
      case "reroll-center-die": {
        const playerData = this.getState().players?.[actorId];
        const centerIndex = Number(button.dataset.centerIndex);
        if (!playerData || playerData.crownChangesLeft <= 0 || !Number.isInteger(centerIndex) || centerIndex < 0 || centerIndex > 1) return;
        await requestGameAction(GAME_ID, "reroll-center-die", { actorId, centerIndex });
        break;
      }
      case "report-cheater":
        await requestGameAction(GAME_ID, "report-cheater", { actorId, targetId });
        break;
      case "deal":
        await requestGameAction(GAME_ID, "deal", {});
        break;
      case "run-lock":
        await requestGameAction(GAME_ID, "run-lock", {});
        break;
      case "advance-round":
        await requestGameAction(GAME_ID, "advance-round", {});
        break;
      case "reveal":
        await requestGameAction(GAME_ID, "reveal", {});
        break;
      case "clear":
        await requestGameAction(GAME_ID, "clear", {});
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
    console.log(`${MODULE_ID} | kuboker drop`, data);
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
  createApplication: () => new KubokerApplication(),
  async handleAction({ action, data, state, senderId, canUserControlActor }) {
    const senderIsGM = game.users?.get(senderId)?.isGM ?? false;
    switch (action) {
      case "toggle-join": {
        const playerData = state.players[data.actorId];
        if (!playerData || state.phase !== "join" || !canSenderToggleJoin(data.actorId, senderId, state, canUserControlActor)) return false;
        playerData.isParticipating = Boolean(data.isParticipating);
        return true;
      }
      case "set-dc": {
        if (!senderIsGM) return false;
        if (data.auto) {
          state.dcOverride = null;
          state.currentDC = getSuggestedDc(state);
          return true;
        }
        const value = Math.max(1, Math.min(99, Math.trunc(Number(data.value) || 0)));
        if (!value) return false;
        state.dcOverride = value;
        state.currentDC = value;
        return true;
      }
      case "select-strategy": {
        const playerData = state.players[data.actorId];
        const strategy = data.strategy;
        if (!playerData || !playerData.isParticipating || state.phase !== "deal" || isPlayerLockedOut(state, playerData) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || !STRATEGIES[strategy]) return false;
        playerData.strategy = strategy;
        const allowed = new Set([...(STRATEGY_SKILLS[strategy] || []), "lore"]);
        if (!allowed.has(playerData.skill)) {
          playerData.skill = STRATEGY_SKILLS[strategy]?.[0] || "lore";
        }
        playerData.isConfirmed = false;
        return true;
      }
      case "select-skill": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || state.phase !== "deal" || isPlayerLockedOut(state, playerData) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        const allowed = new Set([...(STRATEGY_SKILLS[playerData.strategy] || []), "lore"]);
        if (!allowed.has(data.skill) || playerData.skill === data.skill) return false;
        playerData.skill = data.skill;
        playerData.isConfirmed = false;
        return true;
      }
      case "toggle-confirm": {
        const playerData = state.players[data.actorId];
        if (!playerData || !playerData.isParticipating || !["deal", "locked"].includes(state.phase) || isPlayerLockedOut(state, playerData) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        if (state.phase === "locked" && hasAnyPendingCrownRerolls(state)) return false;
        playerData.isConfirmed = Boolean(data.isConfirmed);
        return true;
      }
      case "reroll-die": {
        const playerData = state.players[data.actorId];
        const dieIndex = Number(data.dieIndex);
        if (!playerData || !playerData.isParticipating || isPlayerLockedOut(state, playerData) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "locked") return false;
        if (hasAnyPendingCrownRerolls(state)) return false;
        if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex > 2) return false;
        if (playerData.changesLeft <= 0 || playerData.blackDiceIdx === dieIndex || hasPendingCrownReroll(playerData)) return false;

        let newValue = Number(data.newValue);
        if (!Number.isInteger(newValue) || newValue < 1 || newValue > 10) {
          newValue = Math.floor(Math.random() * 10) + 1;
        }
        if (!(playerData.strategy === "cheat" && playerData.degree >= 4)) {
          newValue = Math.floor(Math.random() * 10) + 1;
        }

        playerData.dice[dieIndex] = newValue;
        playerData.changesLeft -= 1;
        playerData.isConfirmed = false;
        const content = unwrapChronicleEntry(gtf(
          definition,
          "Log.Reroll",
          { name: playerData.name, die: dieIndex + 1 },
          ({ name, die }) => `<b>${escapeHtml(name)}</b> changes die ${die}.`
        ));
        state.log.unshift(buildChronicleNote(content));
        return true;
      }
      case "reroll-center-die": {
        const playerData = state.players[data.actorId];
        const centerIndex = Number(data.centerIndex);
        if (!playerData || !playerData.isParticipating || isPlayerLockedOut(state, playerData) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor) || state.phase !== "locked") return false;
        if (!Number.isInteger(centerIndex) || centerIndex < 0 || centerIndex > 1) return false;
        if (playerData.crownChangesLeft <= 0) return false;

        state.center[centerIndex] = Math.floor(Math.random() * 10) + 1;
        playerData.crownChangesLeft -= 1;
        playerData.isConfirmed = false;
        const content = unwrapChronicleEntry(gtf(
          definition,
          "Log.CrownReroll",
          { name: playerData.name, die: centerIndex + 1 },
          ({ name, die }) => `<b>${escapeHtml(name)}</b> replaces stock die ${die}.`
        ));
        state.log.unshift(buildChronicleNote(content, { color: "#ffd98a" }));
        return true;
      }
      case "report-cheater": {
        const viewer = state.players[data.actorId];
        const target = state.players[data.targetId];
        if (!viewer || !viewer.isParticipating || !target || state.phase !== "locked" || isPlayerLockedOut(state, viewer) || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        if (hasAnyPendingCrownRerolls(state)) return false;
        const visible = getVisibleCheatersMap(state);
        if (!visible[data.targetId]?.includes(data.actorId)) return false;
        target.complaints ||= [];
        if (target.complaints.includes(data.actorId)) return false;
        target.complaints.push(data.actorId);
        const content = unwrapChronicleEntry(gtf(
          definition,
          "Log.Complaint",
          { reporter: viewer.name, target: target.name },
          ({ reporter, target }) => `<b>${escapeHtml(reporter)}</b> reports <b>${escapeHtml(target)}</b>.`
        ));
        state.log.unshift(buildChronicleNote(content, { color: "#ff8b8b" }));
        return true;
      }
      case "deal": {
        if (!senderIsGM) return false;
        const activePlayers = Object.values(state.players).filter((entry) => entry.isParticipating);
        if (!activePlayers.length) {
          notify("warn", "KubokerNoPlayers", {}, "Add at least one participant before the deal.");
          return false;
        }

        state.phase = "deal";
        state.lockedRound = 1;
        state.center = [Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1];
        const suggestedDc = getSuggestedDc(state);
        state.currentDC = hasManualDcOverride(state) ? state.dcOverride : suggestedDc;
        const dealContent = unwrapChronicleEntry(gtf(
          definition,
          "Log.DealStart",
          { dc: state.currentDC, center: getDiceDisplay(state.center) },
          ({ dc, center }) => `<b>The table opens.</b> Center: <b>${escapeHtml(center)}</b>. Base DC: <b>${dc}</b>.`
        ));
        state.log.unshift(buildChronicleNote(dealContent));

        for (const playerData of Object.values(state.players)) {
          playerData.dice = playerData.isParticipating
            ? [Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1]
            : [0, 0, 0];
          playerData.strategy = "fair";
          playerData.skill = "soc";
          playerData.changesLeft = 0;
          playerData.crownChangesLeft = 0;
          playerData.complaints = [];
          playerData.blackDiceIdx = -1;
          playerData.isConfirmed = false;
          playerData.degree = 2;
          playerData.isWinner = false;
          playerData.handName = "";
          playerData.score = 0;
        }
        return true;
      }
      case "run-lock": {
        if (!senderIsGM || state.phase !== "deal") return false;
        const round = getLockedRound(state);
        await executeMasterLogic(definition, state, { round, preserveComplaints: round > 1 });
        return true;
      }
      case "advance-round": {
        if (!senderIsGM || state.phase !== "locked") return false;
        if (hasAnyPendingCrownRerolls(state)) return false;
        return beginNextLockedRound(definition, state);
      }
      case "reveal": {
        if (!senderIsGM || state.phase !== "locked" || getLockedRound(state) < LOCKED_ROUNDS_TOTAL) return false;
        if (hasAnyPendingCrownRerolls(state)) return false;
        state.phase = "reveal";
        let bestScore = -1;
        const winners = [];

        for (const playerData of Object.values(state.players)) {
          playerData.isWinner = false;
          if (!playerData.isParticipating) continue;
          if (playerData.complaints?.length) {
            playerData.handName = gt(definition, "Disqualified", "Disqualified");
            playerData.score = -1;
            continue;
          }
          const hand = evaluateHand(playerData.dice, state.center);
          playerData.handName = gt(definition, `Hands.${hand.nameKey}`, hand.nameKey);
          playerData.score = hand.score;
          if (hand.score > bestScore) bestScore = hand.score;
        }

        for (const playerData of Object.values(state.players)) {
          if (!playerData.isParticipating || playerData.score !== bestScore || bestScore < 0) continue;
          playerData.isWinner = true;
          winners.push(playerData.name);
        }

        const winnerNames = winners.join(", ");
        const winnerContent = unwrapChronicleEntry(gtf(
          definition,
          "Log.Winner",
          {
            winners: winnerNames,
            name: winnerNames,
            hand: Object.values(state.players).find((entry) => entry.isWinner)?.handName || gt(definition, "NoHand", "No hand"),
          },
          ({ winners, hand }) => `<b>Winner:</b> ${escapeHtml(winners || "-")}<br><span>${escapeHtml(hand)}</span>`
        ));
        state.log.unshift(buildChronicleNote(winnerContent, { color: "#ffd700" }));
        return true;
      }
      case "clear": {
        if (!senderIsGM) return false;
        state.phase = "join";
        state.lockedRound = 0;
        state.center = [];
        state.currentDC = hasManualDcOverride(state) ? state.dcOverride : getSuggestedDc(state);
        state.log = [buildChronicleNote(unwrapChronicleEntry(gt(definition, "Log.Cleared", "Table cleared.")), { color: "#888888" })];
        for (const playerData of Object.values(state.players)) {
          playerData.dice = [0, 0, 0];
          playerData.strategy = "fair";
          playerData.skill = "soc";
          playerData.changesLeft = 0;
          playerData.crownChangesLeft = 0;
          playerData.complaints = [];
          playerData.blackDiceIdx = -1;
          playerData.isConfirmed = false;
          playerData.degree = 2;
          playerData.isWinner = false;
          playerData.handName = "";
          playerData.score = 0;
        }
        return true;
      }
      case "reset-game": {
        if (!senderIsGM) return false;
        replaceStateContents(state, createInitialState());
        await syncDefaultPlayers(state);
        return true;
      }
      case "toggle-debug": {
        if (!senderIsGM) return false;
        state.debugMode = Boolean(data.enabled);
        return true;
      }
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
        if (!actors.length) return false;
        for (const actor of actors) {
          const canAdd = senderIsGM || canUserControlActor(actor.id, senderId);
          if (!canAdd) continue;
          state.excludedPlayers ||= {};
          delete state.excludedPlayers[actor.id];
          await addActorToState(state, actor, { isParticipating: actor.type === "npc", source: "manual" });
        }
        return true;
      }
      default:
        return false;
    }
  },
};

export function createKubokerGameDefinition() {
  return definition;
}

