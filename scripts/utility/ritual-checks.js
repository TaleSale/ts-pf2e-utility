import { MODULE_ID, SOCKET_CHANNEL, escapeHtml, i18nKey } from "../core.js";

const SETTING_ENABLE = "enableRitualChecks";
const FLAG_KEY = "ritualSession";
const SOCKET_TYPE = "ritual-checks-start";
const MARKER_PREFIX = "tsu-ritual";
const I18N_ROOT = "RitualChecks";

const DC_BY_LEVEL = Object.freeze({
  2: 16,
  4: 19,
  6: 22,
  8: 24,
  10: 27,
  12: 30,
  14: 32,
  16: 35,
  18: 38,
  20: 40,
});

const OUTCOMES = Object.freeze([
  "criticalFailure",
  "failure",
  "success",
  "criticalSuccess",
]);

const SKILL_ALIASES = Object.freeze({
  acrobatics: ["acrobatics", "акробатика"],
  arcana: ["arcana", "аркана"],
  athletics: ["athletics", "атлетика"],
  crafting: ["crafting", "ремесло"],
  deception: ["deception", "обман"],
  diplomacy: ["diplomacy", "дипломатия"],
  intimidation: ["intimidation", "запугивание"],
  medicine: ["medicine", "медицина"],
  nature: ["nature", "природа"],
  occultism: ["occultism", "оккультизм"],
  performance: ["performance", "выступление"],
  religion: ["religion", "религия"],
  society: ["society", "общество"],
  stealth: ["stealth", "скрытность"],
  survival: ["survival", "выживание"],
  thievery: ["thievery", "воровство"],
});

const sessionQueues = new Map();

function localize(key, data = {}, fallback = "") {
  const fullKey = `${i18nKey(I18N_ROOT)}.${key}`;
  if (data && Object.keys(data).length) {
    const value = game.i18n?.format?.(fullKey, data);
    if (value && value !== fullKey) return value;
  } else {
    const value = game.i18n?.localize?.(fullKey);
    if (value && value !== fullKey) return value;
  }
  return typeof fallback === "function" ? fallback(data) : fallback;
}

function getElement(root) {
  if (root instanceof HTMLElement) return root;
  if (root?.[0] instanceof HTMLElement) return root[0];
  return null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase(game.i18n?.lang || "ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slugifyLocal(value) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 48) || "check";
}

function localizedConfigLabel(key, fallback = "") {
  const value = key ? game.i18n?.localize?.(key) : null;
  return value && value !== key ? value : fallback || key || "";
}

function getSkillLabel(slug) {
  const config = CONFIG.PF2E?.skills?.[slug];
  return localizedConfigLabel(config?.label, SKILL_ALIASES[slug]?.[0] ?? slug);
}

function getStatisticLabel(statistic) {
  return localizedConfigLabel(statistic?.label, statistic?.slug ?? "");
}

function phraseIndex(haystack, phrase) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return -1;
  const index = haystack.indexOf(normalizedPhrase);
  if (index < 0) return -1;
  const before = haystack[index - 1] ?? " ";
  const after = haystack[index + normalizedPhrase.length] ?? " ";
  return /[\p{L}\p{N}]/u.test(before) || /[\p{L}\p{N}]/u.test(after) ? -1 : index;
}

function extractLoreOptions(text) {
  const source = String(text ?? "");
  const options = [];
  const pattern = /(?:знани(?:е|я|й)|lore)\s*(?:[:—-]\s*)?([^,;.()]{0,80})/giu;

  for (const match of source.matchAll(pattern)) {
    let subject = String(match[1] ?? "")
      .replace(/(?:^|[^\p{L}])(?:или|or)(?=$|[^\p{L}]).*$/iu, "")
      .trim();
    subject = subject.replace(/\s+/g, " ");
    const preceding = source.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
    if (!subject && /(?:схож[\p{L}]*|подходящ[\p{L}]*|similar|related)\s*$/iu.test(preceding)) continue;
    const nearby = source.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 60);
    const allowAnyLore = /(?:схож[\p{L}]*|подходящ[\p{L}]*|люб[\p{L}]*\s+знан|similar|related|appropriate|any\s+lore)/iu.test(nearby);
    const baseLabel = String(match[0] ?? "").replace(/\s+/g, " ").trim();
    const label = baseLabel || localize("Lore", {}, "Lore");
    const id = `lore-${slugifyLocal(subject || label)}-${match.index ?? options.length}`;
    options.push({
      id,
      kind: "lore",
      label,
      query: subject,
      allowAnyLore,
      index: match.index ?? Number.MAX_SAFE_INTEGER,
    });
  }

  return options;
}

function parseCheckOptions(text) {
  const source = String(text ?? "").trim();
  const normalized = normalizeText(source);
  const options = [];

  for (const [slug, staticAliases] of Object.entries(SKILL_ALIASES)) {
    const aliases = [...staticAliases, getSkillLabel(slug)];
    const indices = aliases.map((alias) => phraseIndex(normalized, alias)).filter((index) => index >= 0);
    if (!indices.length) continue;
    options.push({
      id: `skill-${slug}`,
      kind: "skill",
      slug,
      label: getSkillLabel(slug),
      index: Math.min(...indices),
    });
  }

  options.push(...extractLoreOptions(source));
  const deduplicated = Array.from(new Map(options.map((option) => [option.id, option])).values())
    .sort((left, right) => left.index - right.index)
    .map(({ index: _index, ...option }) => option);

  if (deduplicated.length) return deduplicated;
  if (!source) return [];
  return [{
    id: `manual-${slugifyLocal(source)}`,
    kind: "manual",
    label: source,
  }];
}

function getActorLevel(actor) {
  return Math.max(0, Number(actor?.level ?? actor?.system?.details?.level?.value) || 0);
}

function getMaximumRitualRank(actor, baseRank) {
  return Math.clamp(Math.max(baseRank, Math.ceil(getActorLevel(actor) / 2)), 1, 10);
}

function getRitualDCs(rank) {
  const normalizedRank = Math.clamp(Math.trunc(Number(rank)) || 1, 1, 10);
  const level = normalizedRank * 2;
  const base = DC_BY_LEVEL[level] ?? DC_BY_LEVEL[2];
  const withoutLevel = Boolean(game.pf2e?.settings?.variants?.pwol?.enabled);
  const secondary = base - (withoutLevel ? level : 0);
  return {
    level,
    secondary,
    primary: secondary + 5,
  };
}

function rankLabel(rank) {
  return localize("Rank", { rank }, ({ rank: value }) => game.i18n?.lang === "ru" ? `${value}-й ранг` : `Rank ${value}`);
}

function outcomeLabel(outcome) {
  return localize(`Outcomes.${outcome}`, {}, outcome);
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function getPhaseDC(state, phase) {
  const calculated = getRitualDCs(state.rank);
  return phase === "primary"
    ? Number(state.primaryDC) || calculated.primary
    : Number(state.secondaryDC) || calculated.secondary;
}

function getApplicationActor(element) {
  const applicationElement = element.closest?.(".application, .app");
  const appId = applicationElement?.dataset?.appid ?? applicationElement?.dataset?.appId;
  const instances = [
    ...Array.from(foundry.applications?.instances?.values?.() ?? []),
    ...Object.values(ui.windows ?? {}),
  ];
  const app = instances.find((entry) =>
    String(entry?.appId ?? entry?.id) === String(appId)
    || entry?.element === applicationElement
    || entry?.element?.[0] === applicationElement,
  );
  const document = app?.actor ?? app?.document ?? app?.object ?? null;
  return document?.documentName === "Actor" ? document : document?.actor ?? null;
}

function userCanControlActor(actor, user = game.user) {
  if (!actor || !user) return false;
  return Boolean(user.isGM || actor.testUserPermission?.(user, "OWNER") || user.character?.id === actor.id);
}

function getPrimaryActiveGM() {
  return (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0] ?? null;
}

function isPrimaryActiveGM() {
  return getPrimaryActiveGM()?.id === game.user?.id;
}

async function chooseRitualRank(spell, actor) {
  const baseRank = Math.clamp(Number(spell.baseRank ?? spell.rank) || 1, 1, 10);
  const maximumRank = getMaximumRitualRank(actor, baseRank);
  const options = [];

  for (let rank = baseRank; rank <= maximumRank; rank += 1) {
    const dc = getRitualDCs(rank);
    options.push(`<option value="${rank}">${escapeHtml(rankLabel(rank))} — ${escapeHtml(localize("DCPair", {
      secondary: dc.secondary,
      primary: dc.primary,
    }, ({ secondary, primary }) => `Secondary DC ${secondary}, primary DC ${primary}`))}</option>`);
  }

  return foundry.applications.api.DialogV2.prompt({
    window: { title: localize("ChooseRankTitle", { ritual: spell.name }, ({ ritual }) => ritual) },
    content: `<div class="form-group"><label>${escapeHtml(localize("ChooseRank", {}, "Rank"))}</label><div class="form-fields"><select name="rank">${options.join("")}</select></div></div>`,
    ok: {
      label: localize("Cast", {}, "Cast"),
      callback: (_event, button) => Number(button.form.elements.rank.value),
    },
  });
}

async function onRitualCastClick(event) {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  const button = event.target.closest?.('button[data-action="cast-spell"]');
  if (!button) return;
  const row = button.closest?.('.spell[data-entry-id="rituals"], .spell-list[data-category="ritual"] .spell');
  if (!row) return;

  const itemId = row.dataset.itemId;
  const actor = getApplicationActor(button)
    ?? game.actors?.find?.((candidate) => candidate.items?.has?.(itemId))
    ?? null;
  const spell = actor?.items?.get?.(itemId) ?? null;
  if (!actor || !spell?.isRitual || !userCanControlActor(actor)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const activeGM = getPrimaryActiveGM();
  if (!activeGM && !game.user?.isGM) {
    ui.notifications?.warn?.(localize("Notifications.GMRequired", {}, "An active GM is required."));
    return;
  }

  const rank = await chooseRitualRank(spell, actor);
  if (!Number.isInteger(rank)) return;

  await spell.toMessage(null, { data: { castRank: rank } });
  const request = {
    moduleId: MODULE_ID,
    type: SOCKET_TYPE,
    senderId: game.user?.id ?? null,
    actorId: actor.id,
    itemId: spell.id,
    rank,
  };

  if (game.user?.isGM) {
    await createRitualSession(request);
  } else {
    game.socket?.emit?.(SOCKET_CHANNEL, request);
  }
}

function buildSessionState(actor, spell, rank, senderId) {
  const dc = getRitualDCs(rank);
  return {
    id: foundry.utils.randomID(16),
    version: 2,
    createdAt: Date.now(),
    senderId,
    primaryActorId: actor.id,
    primaryActorName: actor.name,
    spellId: spell.id,
    spellUuid: spell.uuid,
    spellName: spell.name,
    spellImg: spell.img,
    rank,
    ritualLevel: dc.level,
    secondaryDC: dc.secondary,
    primaryDC: dc.primary,
    requiredSecondary: Math.clamp(Number(spell.system?.ritual?.secondary?.casters) || 0, 0, 100),
    primaryText: String(spell.system?.ritual?.primary?.check ?? "").trim(),
    secondaryText: String(spell.system?.ritual?.secondary?.checks ?? "").trim(),
    primaryOptions: parseCheckOptions(spell.system?.ritual?.primary?.check),
    secondaryOptions: parseCheckOptions(spell.system?.ritual?.secondary?.checks),
    secondaryResults: {},
    aggregateBonus: 0,
    aggregatePenalty: 0,
    aggregateModifier: 0,
    primaryResult: null,
  };
}

async function createRitualSession(request) {
  const sender = game.users?.get?.(request.senderId);
  const actor = game.actors?.get?.(request.actorId);
  const spell = actor?.items?.get?.(request.itemId);
  if (!sender || !actor || !spell?.isRitual || !userCanControlActor(actor, sender)) return;

  const baseRank = Math.clamp(Number(spell.baseRank ?? spell.rank) || 1, 1, 10);
  const maximumRank = getMaximumRitualRank(actor, baseRank);
  const requestedRank = Number(request.rank);
  const rank = Math.clamp(Number.isInteger(requestedRank) ? requestedRank : baseRank, baseRank, maximumRank);
  const state = buildSessionState(actor, spell, rank, sender.id);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    content: renderSessionContent(state),
    flags: {
      [MODULE_ID]: {
        [FLAG_KEY]: state,
      },
    },
  });
}

function getSecondaryResults(state) {
  return Object.values(state.secondaryResults ?? {});
}

function secondaryChecksComplete(state) {
  return getSecondaryResults(state).length >= Number(state.requiredSecondary || 0);
}

function recomputeSecondaryEffects(state) {
  const results = getSecondaryResults(state);
  const bonus = results.some((result) => result.outcome === "criticalSuccess") ? 2 : 0;
  const penalty = results.some((result) => ["failure", "criticalFailure"].includes(result.outcome)) ? -4 : 0;
  state.aggregateBonus = bonus;
  state.aggregatePenalty = penalty;
  state.aggregateModifier = bonus + penalty;
}

function renderCheckButtons(options, phase, state) {
  if (!options?.length) {
    return `<p class="tsu-ritual-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(localize("NoChecksRecognized", {}, "No checks recognized."))}</p>`;
  }

  const dc = getPhaseDC(state, phase);
  return `<div class="tsu-ritual-buttons">${options.map((option) => `
    <button type="button" data-tsu-ritual-action="roll" data-phase="${phase}" data-candidate-id="${escapeHtml(option.id)}">
      <i class="fa-solid fa-dice-d20"></i>
      <span>${escapeHtml(option.label)}</span>
      <strong>${escapeHtml(localize("DC", { dc }, ({ dc: value }) => `DC ${value}`))}</strong>
    </button>`).join("")}</div>`;
}

function renderSecondaryResult(result) {
  const reroll = result.heroReroll
    ? `<i class="fa-solid fa-circle-h" data-tooltip="${escapeHtml(localize("HeroReroll", {}, "Hero Point reroll"))}"></i>`
    : "";
  return `<li class="tsu-ritual-result tsu-ritual-result--${escapeHtml(result.outcome)}">
    <span><strong>${escapeHtml(result.actorName)}</strong> — ${escapeHtml(result.statisticLabel)}</span>
    <span>${reroll}${escapeHtml(outcomeLabel(result.outcome))} (${escapeHtml(String(result.total))})</span>
  </li>`;
}

function renderAggregate(state) {
  const modifier = Number(state.aggregateModifier) || 0;
  const label = localize("PrimaryModifier", { modifier: formatSigned(modifier) }, ({ modifier: value }) => `Circumstance modifier: ${value}`);
  return `<div class="tsu-ritual-aggregate"><i class="fa-solid fa-scale-balanced"></i> ${escapeHtml(label)}</div>`;
}

function renderPrimaryResult(state) {
  const result = state.primaryResult;
  if (!result) return "";
  const outcome = outcomeLabel(result.outcome);
  const reroll = result.heroReroll
    ? `<i class="fa-solid fa-circle-h" data-tooltip="${escapeHtml(localize("HeroReroll", {}, "Hero Point reroll"))}"></i>`
    : "";
  return `<div class="tsu-ritual-primary-result tsu-ritual-result--${escapeHtml(result.outcome)}">
    <strong>${escapeHtml(localize("RitualResult", {}, "Ritual result"))}</strong>
    <span>${reroll}${escapeHtml(result.actorName)} — ${escapeHtml(result.statisticLabel)}: ${escapeHtml(outcome)} (${escapeHtml(String(result.total))})</span>
  </div>`;
}

function renderSessionContent(state) {
  const results = getSecondaryResults(state);
  const secondaryComplete = secondaryChecksComplete(state);
  const complete = Boolean(state.primaryResult);
  const secondaryDC = getPhaseDC(state, "secondary");
  const primaryDC = getPhaseDC(state, "primary");
  const secondaryList = Number(state.requiredSecondary) === 0
    ? `<p class="notes">${escapeHtml(localize("NoSecondaryRequired", {}, "No secondary checks are required."))}</p>`
    : results.length
    ? `<ol class="tsu-ritual-results">${results.map(renderSecondaryResult).join("")}</ol>`
    : `<p class="notes">${escapeHtml(localize("WaitingForSecondary", {}, "Waiting for secondary checks."))}</p>`;

  let controls = "";
  if (!secondaryComplete) {
    controls = renderCheckButtons(state.secondaryOptions, "secondary", state);
  } else if (!complete) {
    controls = `${renderAggregate(state)}${renderCheckButtons(state.primaryOptions, "primary", state)}`;
  }

  return `<article class="tsu-ritual-card" data-tsu-ritual-session="${escapeHtml(state.id)}">
    <header class="tsu-ritual-header">
      <img src="${escapeHtml(state.spellImg)}" alt="${escapeHtml(state.spellName)}">
      <div><h3>${escapeHtml(state.spellName)}</h3><p>${escapeHtml(rankLabel(state.rank))} · ${escapeHtml(localize("DCPair", {
        secondary: secondaryDC,
        primary: primaryDC,
      }, ({ secondary, primary }) => `Secondary DC ${secondary}, primary DC ${primary}`))}</p></div>
    </header>
    <section class="tsu-ritual-check-summary">
      <p><strong>${escapeHtml(localize("PrimaryCheck", {}, "Primary check"))}:</strong> ${escapeHtml(state.primaryText || "—")}</p>
      <p><strong>${escapeHtml(localize("SecondaryChecks", {}, "Secondary checks"))}:</strong> ${escapeHtml(state.secondaryText || "—")}</p>
    </section>
    <section class="tsu-ritual-phase">
      <h4>${escapeHtml(localize("SecondaryProgress", {
        current: results.length,
        required: state.requiredSecondary,
      }, ({ current, required }) => `Secondary checks: ${current}/${required}`))}</h4>
      ${secondaryList}
      ${controls}
      ${complete ? `${renderAggregate(state)}${renderPrimaryResult(state)}` : ""}
    </section>
    <footer><i class="fa-solid fa-circle-h"></i> ${escapeHtml(localize("RerollHint", {}, "Hero Point rerolls replace the previous result."))}</footer>
  </article>`;
}

function getSessionMessage(sessionId) {
  return game.messages?.find?.((message) => message.getFlag(MODULE_ID, FLAG_KEY)?.id === sessionId) ?? null;
}

function candidateAllowsStatistic(candidate, actor, statistic) {
  if (!candidate || !statistic) return false;
  if (candidate.kind === "skill") return statistic.slug === candidate.slug;
  if (candidate.kind === "manual") return true;
  if (candidate.kind !== "lore" || !statistic.lore) return false;
  if (candidate.allowAnyLore || !candidate.query) return true;

  const label = normalizeText(getStatisticLabel(statistic));
  const query = normalizeText(candidate.query);
  const tokens = query.split(" ").filter((token) => token.length > 2);
  return label.includes(query) || tokens.some((token) => label.includes(token));
}

function getCandidateStatistics(actor, candidate) {
  const statistics = Object.values(actor?.skills ?? {});
  if (candidate?.kind === "skill") {
    const statistic = actor?.getStatistic?.(candidate.slug);
    return candidateAllowsStatistic(candidate, actor, statistic) ? [statistic] : [];
  }

  const matching = statistics.filter((statistic) => candidateAllowsStatistic(candidate, actor, statistic));
  if (matching.length || candidate?.kind !== "lore" || !candidate?.allowAnyLore) return matching;
  return statistics.filter((statistic) => statistic.lore && candidateAllowsStatistic({ ...candidate, allowAnyLore: true }, actor, statistic));
}

function uniqueActors(actors) {
  return Array.from(new Map(actors.filter(Boolean).map((actor) => [actor.id, actor])).values());
}

function getRollActors(state, phase) {
  if (phase === "primary") {
    const actor = game.actors?.get?.(state.primaryActorId);
    return actor && userCanControlActor(actor) ? [actor] : [];
  }

  const controlled = (canvas?.tokens?.controlled ?? []).map((token) => token.actor);
  if (game.user?.isGM && controlled.length) {
    return uniqueActors(controlled).filter((actor) => actor.id !== state.primaryActorId);
  }
  const assigned = game.user?.character ? [game.user.character] : [];
  const owned = (game.actors?.contents ?? []).filter((actor) =>
    actor?.isOfType?.("character", "npc") && userCanControlActor(actor),
  );
  const actors = uniqueActors([...controlled, ...assigned, ...owned]);
  return actors.filter((actor) => actor.id !== state.primaryActorId);
}

async function chooseRollerAndStatistic(state, phase, candidate) {
  const choices = getRollActors(state, phase).flatMap((actor) =>
    getCandidateStatistics(actor, candidate).map((statistic) => ({ actor, statistic })),
  );

  if (!choices.length) {
    ui.notifications?.warn?.(localize("Notifications.NoEligibleCheck", { check: candidate.label }, ({ check }) => `No eligible statistic for ${check}.`));
    return null;
  }
  if (choices.length === 1) return choices[0];

  const options = choices.map(({ actor, statistic }, index) => {
    const modifier = Number(statistic.mod ?? statistic.check?.mod) || 0;
    return `<option value="${index}">${escapeHtml(actor.name)} — ${escapeHtml(getStatisticLabel(statistic))} (${escapeHtml(formatSigned(modifier))})</option>`;
  });
  const selected = await foundry.applications.api.DialogV2.prompt({
    window: { title: localize("ChooseCheckTitle", {}, "Choose a check") },
    content: `<div class="form-group"><label>${escapeHtml(localize("CasterAndCheck", {}, "Caster and check"))}</label><div class="form-fields"><select name="choice">${options.join("")}</select></div></div>`,
    ok: {
      label: localize("Roll", {}, "Roll"),
      callback: (_event, button) => Number(button.form.elements.choice.value),
    },
  });
  return Number.isInteger(selected) ? choices[selected] ?? null : null;
}

function buildMarkerOptions(state, phase, candidate, actor, statistic) {
  return [
    `${MARKER_PREFIX}:session:${state.id}`,
    `${MARKER_PREFIX}:phase:${phase}`,
    `${MARKER_PREFIX}:attempt:${foundry.utils.randomID(16)}`,
    `${MARKER_PREFIX}:candidate:${candidate.id}`,
    `${MARKER_PREFIX}:actor:${actor.id}`,
    `${MARKER_PREFIX}:statistic:${statistic.slug}`,
  ];
}

async function rollRitualCheck(sessionMessage, phase, candidateId) {
  const state = foundry.utils.deepClone(sessionMessage.getFlag(MODULE_ID, FLAG_KEY));
  if (!state || state.primaryResult) return;
  if (phase === "secondary" && secondaryChecksComplete(state)) return;
  if (phase === "primary" && !secondaryChecksComplete(state)) return;

  const candidates = phase === "primary" ? state.primaryOptions : state.secondaryOptions;
  const candidate = candidates.find((option) => option.id === candidateId);
  if (!candidate) return;
  const choice = await chooseRollerAndStatistic(state, phase, candidate);
  if (!choice) return;

  const modifiers = [];
  if (phase === "primary" && state.aggregateBonus) {
    modifiers.push(new game.pf2e.Modifier({
      slug: "ritual-secondary-checks-bonus",
      label: localize("SecondaryBonusLabel", {}, "Secondary ritual checks: critical success"),
      modifier: state.aggregateBonus,
      type: "circumstance",
    }));
  }
  if (phase === "primary" && state.aggregatePenalty) {
    modifiers.push(new game.pf2e.Modifier({
      slug: "ritual-secondary-checks-penalty",
      label: localize("SecondaryPenaltyLabel", {}, "Secondary ritual checks: failure"),
      modifier: state.aggregatePenalty,
      type: "circumstance",
    }));
  }

  await choice.statistic.roll({
    dc: { value: getPhaseDC(state, phase) },
    modifiers,
    extraRollOptions: buildMarkerOptions(state, phase, candidate, choice.actor, choice.statistic),
    label: localize("RollLabel", {
      ritual: state.spellName,
      check: phase === "primary" ? localize("PrimaryCheck", {}, "Primary check") : localize("SecondaryCheck", {}, "Secondary check"),
    }, ({ ritual, check }) => `${ritual}: ${check}`),
  });
}

function parseRitualMarker(message) {
  const options = message.flags?.pf2e?.context?.options ?? [];
  const get = (key) => String(options.find((option) => option.startsWith(`${MARKER_PREFIX}:${key}:`)) ?? "").slice(`${MARKER_PREFIX}:${key}:`.length);
  const sessionId = get("session");
  const phase = get("phase");
  const attemptId = get("attempt");
  const candidateId = get("candidate");
  const actorId = get("actor");
  const statisticSlug = get("statistic");
  if (!sessionId || !["primary", "secondary"].includes(phase) || !candidateId || !actorId || !statisticSlug) return null;
  return { sessionId, phase, attemptId, candidateId, actorId, statisticSlug, options };
}

function enqueueSessionUpdate(sessionId, callback) {
  const previous = sessionQueues.get(sessionId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(callback);
  sessionQueues.set(sessionId, current);
  void current.finally(() => {
    if (sessionQueues.get(sessionId) === current) sessionQueues.delete(sessionId);
  });
  return current;
}

async function processRitualRoll(message, marker) {
  const sessionMessage = getSessionMessage(marker.sessionId);
  const state = foundry.utils.deepClone(sessionMessage?.getFlag(MODULE_ID, FLAG_KEY));
  if (!sessionMessage || !state) return;

  const actor = message.actor;
  const author = message.author;
  const context = message.flags?.pf2e?.context ?? {};
  const candidates = marker.phase === "primary" ? state.primaryOptions : state.secondaryOptions;
  const candidate = candidates.find((option) => option.id === marker.candidateId);
  const statistic = actor?.getStatistic?.(marker.statisticSlug);
  const outcome = context.outcome;
  if (!actor || actor.id !== marker.actorId || !author || !userCanControlActor(actor, author)) return;
  if (!candidate || !candidateAllowsStatistic(candidate, actor, statistic)) return;
  if (!OUTCOMES.includes(outcome) || Number(context.dc?.value) !== getPhaseDC(state, marker.phase)) return;

  const result = {
    actorId: actor.id,
    actorName: actor.name,
    statisticSlug: statistic.slug,
    statisticLabel: getStatisticLabel(statistic),
    candidateId: candidate.id,
    total: Number(message.rolls?.[0]?.total) || 0,
    outcome,
    messageId: message.id,
    heroReroll: marker.options.includes("check:reroll:hero-points"),
    updatedAt: Date.now(),
  };

  if (marker.phase === "secondary") {
    if (actor.id === state.primaryActorId || state.primaryResult) return;
    const resultKey = marker.attemptId || actor.id;
    const existing = state.secondaryResults?.[resultKey];
    if (!existing && secondaryChecksComplete(state)) return;
    state.secondaryResults ??= {};
    state.secondaryResults[resultKey] = result;
    recomputeSecondaryEffects(state);
  } else {
    if (actor.id !== state.primaryActorId || !secondaryChecksComplete(state)) return;
    state.primaryResult = result;
  }

  await sessionMessage.update({
    content: renderSessionContent(state),
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: state,
  });
}

function onCreateChatMessage(message) {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE) || !isPrimaryActiveGM()) return;
  const marker = parseRitualMarker(message);
  if (!marker) return;
  void enqueueSessionUpdate(marker.sessionId, () => processRitualRoll(message, marker));
}

function onRenderChatMessage(message, root) {
  const element = getElement(root);
  if (!element) return;

  const state = message.getFlag(MODULE_ID, FLAG_KEY);
  if (state) {
    for (const button of element.querySelectorAll("button[data-tsu-ritual-action=roll]")) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void rollRitualCheck(message, button.dataset.phase, button.dataset.candidateId);
      });
    }
  }

}

function onSocketMessage(message) {
  if (message?.moduleId !== MODULE_ID || message?.type !== SOCKET_TYPE || !isPrimaryActiveGM()) return;
  void createRitualSession(message).catch((error) => {
    console.error(`${MODULE_ID} | failed to create ritual session`, error);
  });
}

function rerenderActorSheets() {
  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.actor || app?.document?.documentName === "Actor") app.render?.(false);
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey("Settings.RitualChecks.Name"),
    hint: i18nKey("Settings.RitualChecks.Hint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: rerenderActorSheets,
  });
});

Hooks.once("ready", () => {
  document.addEventListener("click", onRitualCastClick, true);
  game.socket?.on?.(SOCKET_CHANNEL, onSocketMessage);
});

Hooks.on("createChatMessage", onCreateChatMessage);
Hooks.on("renderChatMessageHTML", onRenderChatMessage);
