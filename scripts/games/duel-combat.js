import {
  escapeHtml,
  getActorUuidFromDropData,
  getDroppedActors,
  getGameState,
  getNonGmCharacters,
  gt,
  MODULE_ID,
  notify,
  patchApplicationRegions,
  requestGameAction,
  userCanControlActor,
} from "../core.js";
import { DUEL_STYLE, DUEL_TEMPLATE, FLAVOR_CLASH } from "./duel-combat-data.js";

const GAME_ID = "duel-combat";
const APP_ID = `${MODULE_ID}-${GAME_ID}`;
const I18N_ROOT = "Games.DuelCombat";
const MANEUVER_TYPES = new Set(["ath", "acr", "int", "dec"]);
const TYPE_ORDER = ["atk", "ath", "acr", "int", "dec", "def", "none"];
const DEG_WEIGHT = { cs: 4, s: 3, f: 2, cf: 1, def: 0, none: -1 };

function createInitialState() {
  return {
    players: {},
    excludedPlayers: {},
    phase: "join",
    round: 1,
    log: [],
    debugMode: false,
    openSignal: null,
  };
}

function replaceStateContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function createPlayerState(actor, { isParticipating = false, source = "manual" } = {}) {
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img,
    isParticipating,
    planned: [],
    isReady: false,
    acPenalty: 0,
    lostActions: 0,
    wounds: 0,
    selectedStrikeId: null,
    source,
  };
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
  state.excludedPlayers ||= {};
  const defaultIds = new Set(defaultActors.map((actor) => actor.id));

  for (const actorId of defaultIds) {
    delete state.excludedPlayers[actorId];
  }

  for (const [actorId, playerData] of Object.entries(state.players ?? {})) {
    const actor = game.actors.get(actorId);
    const source = playerData.source ?? "auto";
    if (source === "manual") continue;
    if (actor?.type === "character" && !defaultIds.has(actorId)) {
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
    state.players[actor.id].source = "auto";
  }
}

function getActorDuelStats(actor, selectedStrikeId) {
  if (!actor) return null;

  const system = actor.system ?? {};
  const strikes = [];

  if (actor.type === "npc") {
    for (const item of actor.items.filter((entry) => entry.type === "melee")) {
      strikes.push({ id: item.id, name: item.name, atk: item.system.bonus?.value || 0 });
    }
  } else {
    const actions = system.actions?.filter((entry) => entry.type === "strike") ?? [];
    for (const [index, action] of actions.entries()) {
      strikes.push({
        id: action.slug || action.item?.id || `strike-${index}`,
        name: action.label || "Удар",
        atk: action.totalModifier || 0,
      });
    }
  }

  if (!strikes.length) {
    strikes.push({ id: "default", name: "Безоружная", atk: system.abilities?.str?.mod || 0 });
  }

  const selectedStrike = strikes.find((entry) => entry.id === selectedStrikeId) ?? strikes[0];
  const maxDying = system.attributes?.dying?.max || 4;
  const doomed = actor.items.find((item) => item.type === "condition" && item.slug === "doomed")?.system?.value?.value || 0;
  const maxWounds = Math.max(1, maxDying - doomed);
  const getMod = (slug) => actor.skills?.[slug]?.mod || system.skills?.[slug]?.mod || system.skills?.[slug]?.base || 0;
  const getDc = (slug) => {
    if (slug === "ac") return system.attributes?.ac?.value || 10;
    if (slug === "per") return actor.perception?.dc || ((system.perception?.mod || 0) + 10) || 10;
    return system.saves?.[slug]?.dc || ((system.saves?.[slug]?.value || 0) + 10) || 10;
  };

  return {
    maxWounds,
    atk: selectedStrike.atk,
    strikeName: selectedStrike.name,
    availableStrikes: strikes,
    ath: getMod("athletics"),
    acr: getMod("acrobatics"),
    int: getMod("intimidation"),
    dec: getMod("deception"),
    dc_ac: getDc("ac"),
    dc_fort: getDc("fortitude"),
    dc_ref: getDc("reflex"),
    dc_will: getDc("will"),
    dc_per: getDc("per"),
  };
}

function getDegreeKey(degree) {
  if (degree == null) return "def";
  if (degree === 4) return "cs";
  if (degree === 3) return "s";
  if (degree === 2) return "f";
  return "cf";
}

function getClashFlavor(typeA, subA, typeB, subB, degreeA, degreeB, nameA, nameB) {
  const leftType = typeA === "maneuver" ? subA : (typeA === "none" ? "none" : (typeA === "defense" ? "def" : "atk"));
  const rightType = typeB === "maneuver" ? subB : (typeB === "none" ? "none" : (typeB === "defense" ? "def" : "atk"));
  const leftName = `<b style="color:#d3d3d3">${escapeHtml(nameA)}</b>`;
  const rightName = `<b style="color:#d3d3d3">${escapeHtml(nameB)}</b>`;
  const leftDegree = leftType === "none" ? "none" : getDegreeKey(degreeA);
  const rightDegree = rightType === "none" ? "none" : getDegreeKey(degreeB);
  const leftIndex = TYPE_ORDER.indexOf(leftType);
  const rightIndex = TYPE_ORDER.indexOf(rightType);

  let key;
  let firstDegree;
  let secondDegree;
  let firstName;
  let secondName;

  if (leftIndex < rightIndex) {
    key = `${leftType}_vs_${rightType}`;
    firstDegree = leftDegree;
    secondDegree = rightDegree;
    firstName = leftName;
    secondName = rightName;
  } else if (leftIndex > rightIndex) {
    key = `${rightType}_vs_${leftType}`;
    firstDegree = rightDegree;
    secondDegree = leftDegree;
    firstName = rightName;
    secondName = leftName;
  } else {
    key = `${leftType}_vs_${rightType}`;
    if ((DEG_WEIGHT[leftDegree] ?? -1) >= (DEG_WEIGHT[rightDegree] ?? -1)) {
      firstDegree = leftDegree;
      secondDegree = rightDegree;
      firstName = leftName;
      secondName = rightName;
    } else {
      firstDegree = rightDegree;
      secondDegree = leftDegree;
      firstName = rightName;
      secondName = leftName;
    }
  }

  const list = FLAVOR_CLASH[key]?.[`${firstDegree}_${secondDegree}`];
  if (!Array.isArray(list) || !list.length) {
    return `${firstName} совершает действие, а ${secondName} отвечает.`;
  }

  const text = list[Math.floor(Math.random() * list.length)];
  return text.replace(/\{n1\}/g, firstName).replace(/\{n2\}/g, secondName);
}

function canCurrentUserOperateActor(actor, state) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return Boolean(state?.debugMode) || actor.type === "npc";
  return userCanControlActor(actor, game.user);
}

function canSenderOperateActor(actorId, senderId, state, canUserControlActor) {
  const sender = game.users?.get(senderId);
  const actor = game.actors?.get(actorId);
  if (!sender || !actor) return false;
  if (sender.isGM) return Boolean(state?.debugMode) || actor.type === "npc";
  return canUserControlActor(actorId, senderId);
}

function canSenderToggleJoin(actorId, senderId, canUserControlActor) {
  const sender = game.users?.get(senderId);
  if (!sender) return false;
  if (sender.isGM) return true;
  return canUserControlActor(actorId, senderId);
}

function getParticipatingActorIds(state) {
  return Object.keys(state.players ?? {}).filter((actorId) => state.players?.[actorId]?.isParticipating);
}

function canStartDuelWithState(state) {
  return getParticipatingActorIds(state).length === 2;
}

function startDuel(state) {
  state.phase = "play";
  state.round = 1;
  for (const playerData of Object.values(state.players ?? {})) {
    playerData.planned = [];
    playerData.isReady = false;
    playerData.acPenalty = 0;
    playerData.lostActions = 0;
  }
  state.log.unshift("<div style=\"text-align:center; color:#ff4444; border:2px solid #800020; background:rgba(128,0,32,0.2); padding:5px; margin-bottom:10px; font-weight:bold;\">ДУЭЛЬ НАЧАЛАСЬ!</div>");
}

function clearDuel(state) {
  state.phase = "join";
  state.round = 1;
  state.log = ["<div style='text-align:center; color:#2ecc71; background:rgba(46, 204, 113, 0.1); border:1px solid #2ecc71; padding:5px; border-radius:3px; font-weight:bold;'>--- Дуэль очищена, раны исцелены ---</div>"];
  for (const playerData of Object.values(state.players ?? {})) {
    playerData.planned = [];
    playerData.isReady = false;
    playerData.acPenalty = 0;
    playerData.lostActions = 0;
    playerData.wounds = 0;
  }
}

async function resolveRound(state) {
  const activeIds = getParticipatingActorIds(state);
  if (activeIds.length !== 2) {
    ui.notifications?.warn("Для раунда нужно ровно 2 активных дуэлянта!");
    return false;
  }

  const [p1Id, p2Id] = activeIds;
  const p1 = state.players[p1Id];
  const p2 = state.players[p2Id];

  state.log.unshift(`<div style="text-align:center; background:linear-gradient(90deg, transparent, #800020, transparent); color:#A8A9AD; font-weight:bold; padding:4px; margin:10px 0; border-top:1px solid #A8A9AD; border-bottom:1px solid #A8A9AD; text-transform:uppercase; letter-spacing:2px;">⚔️ РАУНД ${state.round} ⚔️</div>`);

  let p1NextLost = 0;
  let p2NextLost = 0;
  let p1NextAcPen = 0;
  let p2NextAcPen = 0;
  const mapP1 = { attack: 0, ath: 0, acr: 0, int: 0, dec: 0 };
  const mapP2 = { attack: 0, ath: 0, acr: 0, int: 0, dec: 0 };

  for (let slot = 0; slot < 3; slot += 1) {
    let act1 = p1.planned?.[slot] || { type: "none" };
    let act2 = p2.planned?.[slot] || { type: "none" };

    if (slot >= (3 - (p1.lostActions || 0))) act1 = { type: "none" };
    if (slot >= (3 - (p2.lostActions || 0))) act2 = { type: "none" };

    if (act1.type === "none" && act2.type === "none") {
      state.log.unshift(`<div style="border-left: 3px solid #71797E; background: rgba(0,0,0,0.4); padding: 5px; margin-bottom: 5px; border-radius:3px;">
        <div style="text-align:center; font-size:11px; color:#A8A9AD; margin-bottom:6px; letter-spacing:2px; font-family:'Modesto Condensed', serif;">-- ДЕЙСТВИЕ ${slot + 1} --</div>
        <div style="text-align:center; background: rgba(0,0,0,0.6); padding: 6px; margin-bottom: 6px; border-radius:3px; border-left: 3px solid #800020; font-size: 11.5px; font-style: italic; color:#d3d3d3;">
          📜 ${getClashFlavor("none", null, "none", null, null, null, p1.name, p2.name)}
        </div>
      </div>`);
      continue;
    }

    let logEntry = `<div style="border-left: 3px solid #71797E; background: rgba(0,0,0,0.4); padding: 5px; margin-bottom: 5px; border-radius:3px;">`;
    logEntry += `<div style="text-align:center; font-size:11px; color:#A8A9AD; margin-bottom:6px; letter-spacing:2px; font-family:'Modesto Condensed', serif;">-- ДЕЙСТВИЕ ${slot + 1} --</div>`;

    const evalAct = async (attacker, defender, attackAction, defenseAction, mapState) => {
      if (attackAction.type === "none" || attackAction.type === "defense") return { html: "", degree: null };

      const attackerStats = getActorDuelStats(game.actors.get(attacker.id), attacker.selectedStrikeId);
      const defenderStats = getActorDuelStats(game.actors.get(defender.id), defender.selectedStrikeId);
      if (!attackerStats || !defenderStats) return { html: "", degree: null };

      const mapType = attackAction.type === "maneuver" ? attackAction.sub : attackAction.type;
      const mapCount = mapState[mapType] || 0;
      const mapPenalty = mapCount === 0 ? 0 : (mapCount === 1 ? -4 : -8);
      const baseModifier = attackAction.type === "attack" ? attackerStats.atk : attackerStats[attackAction.sub];
      let rollModifier = mapPenalty;
      let dcPenalty = defender.acPenalty || 0;
      let interactionText = "";
      let rollFormula = "1d20 + @m";

      if (defenseAction.type === "defense") {
        rollFormula = "2d20kl + @m";
        interactionText += " | Взаимодействие: <span style='color:#ffaa00'>По Обороне (Неудача 2d20kl)</span>";
      }
      if (attackAction.type === "maneuver" && defenseAction.type === "attack") {
        rollModifier -= 2;
        interactionText += " | Взаимодействие: <span style='color:#ffaa00'>-2 (vs Атака)</span>";
      }
      if (attackAction.type === "maneuver" && defenseAction.type === "defense") {
        dcPenalty += 2;
        interactionText += " | Взаимодействие: <span style='color:#2ecc71'>Преимущество (КС цели -2)</span>";
      }

      const totalModifier = baseModifier + rollModifier;
      const dcType = attackAction.type === "attack"
        ? "dc_ac"
        : (attackAction.sub === "ath"
          ? "dc_fort"
          : (attackAction.sub === "acr"
            ? "dc_ref"
            : (attackAction.sub === "int" ? "dc_will" : "dc_per")));
      const dc = defenderStats[dcType] - dcPenalty;
      const roll = await new Roll(rollFormula, { m: totalModifier }).evaluate({ async: true });
      const d20 = roll.dice[0]?.total ?? roll.total;
      const diceResults = roll.dice[0]?.results?.map((result) => result.result) ?? [d20];
      const total = roll.total;
      const diceString = diceResults.length > 1
        ? `🎲[${diceResults.join(", ")}] ➔ Наименьшее: <b>${d20}</b>`
        : `🎲 ${d20}`;

      let degree = total >= (dc + 10) ? 4 : (total >= dc ? 3 : (total <= (dc - 10) ? 1 : 2));
      if (d20 === 20) degree = Math.min(degree + 1, 4);
      if (d20 === 1) degree = Math.max(degree - 1, 1);
      degree = Math.min(Math.max(degree, 1), 4);

      let effectText = "";
      if (attackAction.type === "attack") {
        let woundDelta = 0;
        if (degree === 4) woundDelta = 2;
        else if (degree === 3) woundDelta = 1;

        if (woundDelta > 0) {
          defender.wounds = (defender.wounds || 0) + woundDelta;
          effectText = `<b>Эффект:</b> Цель получает <b style="color:#ff4444">+${woundDelta} ${woundDelta === 1 ? "рану" : "раны"}</b>.<br>`;
        }
        if (degree === 1) {
          if (attacker.id === p1Id) p1NextLost += 1;
          else p2NextLost += 1;
          effectText = "<b>Эффект:</b> <b style=\"color:#ffaa00\">Вы теряете 1 действие.</b><br>";
        }
      } else if (attackAction.type === "maneuver") {
        if (degree === 4) {
          if (defender.id === p1Id) {
            p1NextAcPen += 2;
            p1NextLost += 1;
          } else {
            p2NextAcPen += 2;
            p2NextLost += 1;
          }
          effectText = "<b>Эффект:</b> <b style=\"color:#2ecc71\">Цель теряет 2 КБ и 1 действие.</b><br>";
        } else if (degree === 3) {
          if (defender.id === p1Id) p1NextAcPen += 2;
          else p2NextAcPen += 2;
          effectText = "<b>Эффект:</b> <b style=\"color:#2ecc71\">Цель теряет 2 КБ.</b><br>";
        } else if (degree === 1) {
          if (attacker.id === p1Id) p1NextLost += 1;
          else p2NextLost += 1;
          effectText = "<b>Эффект:</b> <b style=\"color:#ffaa00\">Вы теряете 1 действие.</b><br>";
        }
      }

      let actionTypeName = "";
      if (attackAction.type === "attack") actionTypeName = "⚔️ АТАКА";
      else if (attackAction.sub === "ath") actionTypeName = "🤹 МАНЕВР (Атлетика)";
      else if (attackAction.sub === "acr") actionTypeName = "🤹 МАНЕВР (Акробатика)";
      else if (attackAction.sub === "int") actionTypeName = "🤹 МАНЕВР (Запугивание)";
      else if (attackAction.sub === "dec") actionTypeName = "🤹 МАНЕВР (Обман)";

      const badge = degree === 4 ? "КРИТ" : (degree === 3 ? "УСПЕХ" : (degree === 2 ? "ПРОМАХ" : "КРИТ ПРОМАХ"));
      const color = degree === 4 ? "#800020" : (degree === 3 ? "#4a0404" : (degree === 2 ? "#555" : "#880000"));
      const html = `<div style="margin-top:4px;"><span style="background:${color}; color:#d3d3d3; padding:1px 4px; border-radius:2px; font-size:9px;">${actionTypeName}: ${badge}</span>
        <div style="font-size:10px; color:#aaa; margin-top:4px; padding:4px; background:rgba(0,0,0,0.5); border-left:2px solid #555;">
          <b>Модификатор:</b> База (${baseModifier >= 0 ? "+" : ""}${baseModifier}) | ШМА (${mapPenalty})${interactionText} = <b>${totalModifier >= 0 ? "+" : ""}${totalModifier}</b><br>
          <b>Бросок:</b> ${diceString} + ${totalModifier} = <b>${total}</b> против КС <b>${dc}</b><br>
          ${effectText}
        </div></div>`;

      mapState[mapType] = (mapState[mapType] || 0) + 1;
      return { html, degree };
    };

    const wrapBlock = (html, title) => {
      if (!html) return "";
      return `<div style="border: 1px solid #4a0404; background: rgba(10,10,10,0.8); padding: 5px; margin-bottom: 5px; border-radius: 4px;">
        <div style="font-weight:bold; font-size:11px; color:#ffaa00; border-bottom:1px dashed #4a0404; margin-bottom:4px; padding-bottom:2px;">Ход: ${escapeHtml(title)}</div>
        ${html}
      </div>`;
    };

    let p1Log = "";
    let p2Log = "";
    const res1 = await evalAct(p1, p2, act1, act2, mapP1);
    const res2 = await evalAct(p2, p1, act2, act1, mapP2);
    logEntry += `<div style="text-align:center; background: rgba(0,0,0,0.6); padding: 6px; margin-bottom: 6px; border-radius:3px; border-left: 3px solid #800020; font-size: 11.5px; font-style: italic; color:#d3d3d3;">
      📜 ${getClashFlavor(act1.type, act1.sub, act2.type, act2.sub, res1.degree, res2.degree, p1.name, p2.name)}
    </div>`;

    if (act1.type === "defense") p1Log += "<div style=\"font-size:11px; margin-bottom:4px; font-weight:bold; color:#A8A9AD;\">🛡️ Уходит в глухую оборону.</div>";
    if (act1.type === "none") p1Log += "<div style=\"font-size:11px; margin-bottom:4px; font-style:italic; color:#888;\">⏳ Потеря или пропуск действия...</div>";
    if (res1.html) p1Log += res1.html;

    if (act2.type === "defense") p2Log += "<div style=\"font-size:11px; margin-bottom:4px; font-weight:bold; color:#A8A9AD;\">🛡️ Уходит в глухую оборону.</div>";
    if (act2.type === "none") p2Log += "<div style=\"font-size:11px; margin-bottom:4px; font-style:italic; color:#888;\">⏳ Потеря или пропуск действия...</div>";
    if (res2.html) p2Log += res2.html;

    if (p1Log) logEntry += wrapBlock(p1Log, p1.name);
    if (p2Log) logEntry += wrapBlock(p2Log, p2.name);

    logEntry += "</div>";
    state.log.unshift(logEntry);
  }

  p1.acPenalty = p1NextAcPen;
  p2.acPenalty = p2NextAcPen;
  p1.lostActions = Math.min(3, p1NextLost);
  p2.lostActions = Math.min(3, p2NextLost);
  p1.isReady = false;
  p2.isReady = false;
  p1.planned = [];
  p2.planned = [];
  state.round += 1;

  const stats1 = getActorDuelStats(game.actors.get(p1.id));
  const stats2 = getActorDuelStats(game.actors.get(p2.id));
  const p1Dead = (p1.wounds || 0) >= (stats1?.maxWounds || 1);
  const p2Dead = (p2.wounds || 0) >= (stats2?.maxWounds || 1);

  if (p1Dead || p2Dead) {
    state.phase = "end";
    let endText = "";
    if (p1Dead && p2Dead) endText = "НИЧЬЯ! Оба дуэлянта падают, истекая кровью.";
    else if (p1Dead) endText = `🏆 ПОБЕДА: ${escapeHtml(p2.name)}! Противник сломлен.`;
    else endText = `🏆 ПОБЕДА: ${escapeHtml(p1.name)}! Противник сломлен.`;
    state.log.unshift(`<div style="background:linear-gradient(135deg, #4a0404, #800020, #4a0404); border:2px solid #A8A9AD; padding:10px; border-radius:5px; color:#d3d3d3; text-align:center; font-weight:bold; font-size:13px; text-shadow:1px 1px 2px black;">${endText}</div>`);
  }

  return true;
}

let helpersRegistered = false;

function registerHandlebarsHelpers() {
  if (helpersRegistered) return;
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("and", (a, b) => a && b);
  Handlebars.registerHelper("or", (a, b) => a || b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("not", (a) => !a);
  helpersRegistered = true;
}

class DuelCombatApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: APP_ID,
      title: gt(definition, "Title", "Дуэль - Боевая"),
      width: 1400,
      height: 800,
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
    registerHandlebarsHelpers();
    return $(DUEL_STYLE + Handlebars.compile(DUEL_TEMPLATE)(data));
  }

  async refresh() {
    if (!this.rendered || !this.element?.length) return;
    const nextRoot = await this._renderInner(this.getData());
    const patched = patchApplicationRegions(this, "#duel-app", [
      ".dl-col-rules",
      ".dl-col-main",
      ".dl-col-log",
      ".dl-footer",
    ], nextRoot);
    if (!patched) this.render(false);
  }

  getData() {
    const state = this.getState();
    const players = [];
    const activeCombatants = Object.values(state.players ?? {}).filter((entry) => entry.isParticipating);
    const participatingCount = activeCombatants.length;
    const isSpectator = !activeCombatants.some((entry) => userCanControlActor(game.actors.get(entry.id), game.user));

    const entries = Object.entries(state.players ?? {}).sort((left, right) => {
      const leftOwned = userCanControlActor(game.actors.get(left[0]), game.user) ? 1 : 0;
      const rightOwned = userCanControlActor(game.actors.get(right[0]), game.user) ? 1 : 0;
      if (leftOwned !== rightOwned) return rightOwned - leftOwned;
      return (left[1].name || "").localeCompare(right[1].name || "", game.i18n?.lang || "ru", { sensitivity: "base" });
    });

    for (const [actorId, playerData] of entries) {
      const actor = game.actors.get(actorId);
      if (!actor) continue;

      const stats = getActorDuelStats(actor, playerData.selectedStrikeId);
      if (!stats) continue;

      const wounds = playerData.wounds || 0;
      const woundPct = Math.min(100, (wounds / stats.maxWounds) * 100);
      const isOwner = canCurrentUserOperateActor(actor, state);
      const isObserverCard = !playerData.isParticipating;
      const isOwnerParticipant = isOwner && playerData.isParticipating;
      const showStats = game.user.isGM || isOwner || (isSpectator && actor.type === "character");
      const actionSlots = [];
      const availableSlots = 3 - (playerData.lostActions || 0);

      for (let index = 0; index < 3; index += 1) {
        actionSlots.push({
          num: index + 1,
          isDisabled: index >= availableSlots,
          planned: playerData.planned?.[index] || { type: "none", sub: "ath" },
        });
      }

      players.push({
        ...playerData,
        id: actorId,
        isOwner,
        isOwnerParticipant,
        isObserverCard,
        spectatorLabel: isObserverCard ? gt(definition, "Spectator", "Наблюдает") : "",
        showStats,
        wounds,
        woundPct,
        stats,
        actionSlots,
      });
    }

    return {
      state,
      players,
      isGM: game.user.isGM,
      isJoinPhase: state.phase === "join",
      isPlayingPhase: state.phase === "play",
      canStartDuel: participatingCount === 2,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".dl-join-cb").on("change", (event) => {
      void requestGameAction(GAME_ID, "toggle-join", {
        actorId: event.currentTarget.dataset.actor,
        isParticipating: event.currentTarget.checked,
      });
    });

    html.find(".dl-weapon-select").on("change", (event) => {
      const select = $(event.currentTarget);
      void requestGameAction(GAME_ID, "select-strike", {
        actorId: select.data("actor"),
        strikeId: select.val(),
      });
    });

    html.find(".dl-act-btn").on("click", (event) => {
      const button = $(event.currentTarget);
      if (button.parent().hasClass("disabled")) return;
      const actorId = button.data("actor");
      const slot = Number(button.data("slot"));
      const type = button.data("type");
      const sub = html.find(`.dl-man-sel[data-actor="${actorId}"][data-slot="${slot}"]`).val() || "ath";
      void requestGameAction(GAME_ID, "plan-action", { actorId, slot, type, sub });
    });

    html.find(".dl-man-sel").on("change", (event) => {
      const select = $(event.currentTarget);
      void requestGameAction(GAME_ID, "plan-action", {
        actorId: select.data("actor"),
        slot: Number(select.data("slot")),
        type: "maneuver",
        sub: select.val(),
      });
    });

    html.find(".dl-ready-btn").on("click", (event) => {
      const actorId = $(event.currentTarget).data("actor");
      const playerData = this.getState().players?.[actorId];
      void requestGameAction(GAME_ID, "toggle-ready", {
        actorId,
        isReady: !playerData?.isReady,
      });
    });

    html.find("#dl-debug").on("change", (event) => {
      if (!game.user?.isGM) return;
      void requestGameAction(GAME_ID, "toggle-debug", { enabled: event.currentTarget.checked });
    });

    html.find("#dl-start").on("click", () => {
      void requestGameAction(GAME_ID, "start-duel", {});
    });
    html.find("#dl-resolve").on("click", () => {
      void requestGameAction(GAME_ID, "resolve-round", {});
    });
    html.find("#dl-clear").on("click", () => {
      void requestGameAction(GAME_ID, "clear", {});
    });
    html.find("#dl-reset").on("click", () => {
      void requestGameAction(GAME_ID, "reset-game", {});
    });

    html.on("dragover", (event) => {
      event.preventDefault();
    });
    html.on("drop", (event) => {
      event.preventDefault();
      void this._onDrop(event.originalEvent ?? event);
    });
  }

  async _onDrop(event) {
    if (!game.user?.isGM) return;
    const uuid = getActorUuidFromDropData(TextEditor.getDragEventData(event));
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
  createApplication: () => new DuelCombatApplication(),
  async handleAction({ action, data, state, senderId, canUserControlActor }) {
    const senderIsGM = game.users?.get(senderId)?.isGM ?? false;

    switch (action) {
      case "toggle-join": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || state.phase !== "join" || !canSenderToggleJoin(data.actorId, senderId, canUserControlActor)) return false;
        const nextParticipating = Boolean(data.isParticipating);
        if (nextParticipating) {
          const activeIds = getParticipatingActorIds(state).filter((actorId) => actorId !== data.actorId);
          if (activeIds.length >= 2) {
            notify("warn", "Games.DuelCombat.StartNeedsTwo", {}, "В дуэли должно быть ровно 2 участника.");
            return false;
          }
        }
        playerData.isParticipating = nextParticipating;
        return true;
      }
      case "select-strike": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || !playerData.isParticipating || playerData.isReady || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        playerData.selectedStrikeId = String(data.strikeId ?? "");
        return true;
      }
      case "plan-action": {
        const playerData = state.players?.[data.actorId];
        const slot = Math.trunc(Number(data.slot));
        const type = String(data.type ?? "");
        const sub = String(data.sub ?? "ath");
        const availableSlots = 3 - (playerData?.lostActions || 0);
        if (!playerData || !playerData.isParticipating || state.phase !== "play" || playerData.isReady || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        if (!Number.isInteger(slot) || slot < 0 || slot > 2 || slot >= availableSlots) return false;
        if (!["attack", "defense", "maneuver"].includes(type)) return false;
        if (type === "maneuver" && !MANEUVER_TYPES.has(sub)) return false;
        playerData.planned[slot] = { type, sub: type === "maneuver" ? sub : null };
        return true;
      }
      case "toggle-ready": {
        const playerData = state.players?.[data.actorId];
        if (!playerData || !playerData.isParticipating || state.phase !== "play" || !canSenderOperateActor(data.actorId, senderId, state, canUserControlActor)) return false;
        playerData.isReady = Boolean(data.isReady);
        return true;
      }
      case "toggle-debug": {
        if (!senderIsGM) return false;
        state.debugMode = Boolean(data.enabled);
        return true;
      }
      case "start-duel": {
        if (!senderIsGM) return false;
        if (!canStartDuelWithState(state)) {
          notify("warn", "Games.DuelCombat.StartNeedsTwo", {}, "В дуэли должно быть ровно 2 участника.");
          return false;
        }
        startDuel(state);
        return true;
      }
      case "resolve-round": {
        if (!senderIsGM || state.phase !== "play") return false;
        return resolveRound(state);
      }
      case "clear": {
        if (!senderIsGM) return false;
        clearDuel(state);
        return true;
      }
      case "reset-game": {
        if (!senderIsGM) return false;
        replaceStateContents(state, createInitialState());
        await syncDefaultPlayers(state);
        return true;
      }
      case "add-actor": {
        if (!senderIsGM || !data.uuid) return false;
        const actors = await getDroppedActors(data.uuid);
        if (!actors.length) return false;
        for (const actor of actors) {
          await addActorToState(state, actor, {
            isParticipating: actor.type === "npc",
            source: "manual",
          });
        }
        return true;
      }
      default:
        return false;
    }
  },
};

export function createDuelCombatGameDefinition() {
  return definition;
}
