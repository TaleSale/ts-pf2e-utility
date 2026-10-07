import { positionInteractionButtons, scheduleInteractionPosition } from "./hotbar-interactions.js?v=20261006-instruments-v2";
const MODULE_ID = "ts-pf2e-utility";
const BUTTON_ID = "tsu-musical-instrument";
const INSTRUMENTS = Object.freeze({ piano: "Пианино", grandPiano: "Рояль", drums: "Барабаны", harp: "Арфа" });
const EN_NAMES = { piano: "Piano", grandPiano: "Grand piano", drums: "Drums", harp: "Harp" };
export const MELODY_TIERS = Object.freeze(["natural1", "minus15", "minus10", "minus5", "dc", "plus5", "plus10", "plus15", "natural20"]);
export const PERFORMANCE_OUTCOMES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess"]);
let primaryTokenId = null;
let busy = false;
let refreshFrame = null;
let playingSound = null;
let playbackGeneration = 0;
const playedMessages = new Set();

export function melodyTier(roll, dc = 20) {
  const die = roll.dice?.find((die) => die.faces === 20);
  const natural = die?.results?.find((result) => result.active !== false && !result.discarded)?.result;
  if (natural === 1) return "natural1";
  if (natural === 20) return "natural20";
  const band = Math.max(-3, Math.min(3, Math.floor((Number(roll.total) - dc) / 5)));
  return MELODY_TIERS[band + 4];
}

export function performanceOutcome(roll, outcome, dc = 20) {
  // PF2e supplies the final degree, including rule adjustments and natural 1/20.
  if (PERFORMANCE_OUTCOMES.includes(outcome)) return outcome;
  if (Number.isInteger(outcome) && outcome >= 0 && outcome <= 3) return PERFORMANCE_OUTCOMES[outcome];
  let degree = roll.total >= dc + 10 ? 3 : roll.total >= dc ? 2 : roll.total <= dc - 10 ? 0 : 1;
  const natural = roll.dice?.find((die) => die.faces === 20)?.results?.find((result) => result.active !== false && !result.discarded)?.result;
  if (natural === 1) degree--;
  if (natural === 20) degree++;
  return PERFORMANCE_OUTCOMES[Math.max(0, Math.min(3, degree))];
}

export function tokenAtInstrument(token, tile, grid) {
  if (!token || !tile || token.hidden || tile.hidden || token.parent !== tile.parent) return false;
  if (tile.includedInLevel?.(canvas.level) === false || token.includedInLevel?.(canvas.level) === false) return false;
  const size = Number(tile.parent.grid?.size) || 100;
  // Foundry 14 tiles use texture anchors; module assets have a centre anchor.
  // Their x/y already are the centre, unlike legacy top-left anchored tiles.
  const dx = tile.width * (0.5 - (tile.texture?.anchorX ?? 0.5));
  const dy = tile.height * (0.5 - (tile.texture?.anchorY ?? 0.5));
  const angle = (Number(tile.rotation) || 0) * Math.PI / 180;
  const center = tile.shape?.center ?? {
    x: tile.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: tile.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
  const pixels = token.getSize?.() ?? { width: token.width * size, height: token.height * size };
  const offset = (point) => grid?.getOffset?.(point) ?? {
    i: Math.floor(point.y / size), j: Math.floor(point.x / size),
  };
  const cell = offset(center);
  // An instrument belongs to the grid cell containing its centre. Its image
  // bounds and rotation must never activate neighbouring cells.
  if (grid?.getOffsetRange) {
    const [i0, j0, i1, j1] = grid.getOffsetRange({ x: token.x, y: token.y, ...pixels });
    return cell.i >= i0 && cell.i < i1 && cell.j >= j0 && cell.j < j1;
  }
  const origin = offset(token);
  return cell.i >= origin.i && cell.i < origin.i + Math.max(1, Math.ceil(pixels.height / size))
    && cell.j >= origin.j && cell.j < origin.j + Math.max(1, Math.ceil(pixels.width / size));
}

export function instrumentKey(tile) {
  const key = tile.flags?.[MODULE_ID]?.sceneAsset?.key;
  return Object.hasOwn(INSTRUMENTS, key) ? key : null;
}

function availableInstrument() {
  if (!canvas.ready || !canvas.scene) return null;
  const controlled = [...(canvas.tokens?.controlled ?? [])].sort((a, b) => Number(b.id === primaryTokenId) - Number(a.id === primaryTokenId));
  for (const object of controlled) {
    const token = object.document;
    if (!token.actor?.isOwner || !token.actor?.getStatistic?.("performance")) continue;
    for (const tile of canvas.scene.tiles ?? []) {
      const key = instrumentKey(tile);
      if (key && tokenAtInstrument(token, tile, canvas.grid)) return { token, tile, key };
    }
  }
  return null;
}

function refreshButton() {
  const existing = document.getElementById(BUTTON_ID);
  const instrument = availableInstrument();
  const hotbar = document.getElementById("hotbar");
  if (!instrument || !hotbar) {
    existing?.remove();
    positionInteractionButtons();
    return;
  }
  const russian = game.i18n.lang.startsWith("ru");
  const name = (russian ? INSTRUMENTS : EN_NAMES)[instrument.key];
  const title = russian ? `Играть: ${name} — Выступление, КС 20` : `Play: ${name} — Performance, DC 20`;
  const button = existing ?? document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.disabled = busy;
  button.innerHTML = '<i class="fa-solid fa-music"></i>';
  if (!existing) button.addEventListener("click", playInstrument);
  const actionBar = hotbar.querySelector("#action-bar");
  if (!actionBar) return;
  if (button.parentElement !== actionBar) actionBar.append(button);
  positionInteractionButtons();
  scheduleInteractionPosition();
}

function queueRefresh() {
  if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => { refreshFrame = null; refreshButton(); });
}

async function playInstrument(event) {
  if (busy) return;
  const instrument = availableInstrument();
  if (!instrument) { refreshButton(); return; }
  busy = true;
  refreshButton();
  try {
    const { token, tile, key } = instrument;
    await token.actor.getStatistic("performance").check.roll({
      event, token, dc: { value: 20 }, extraRollOptions: ["action:perform", `instrument:${key}`],
      callback: async (roll, outcome, message) => {
        if (!tokenAtInstrument(token, tile, canvas.grid)) return;
        await message.setFlag(MODULE_ID, "instrumentPerformance", { sceneId: tile.parent.id, tileId: tile.id, key, tier: melodyTier(roll), outcome: performanceOutcome(roll, outcome) });
      },
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Instrument performance failed`, error);
    ui.notifications.error(game.i18n.lang.startsWith("ru") ? "Не удалось сыграть на инструменте." : "Could not play the instrument.");
  } finally { busy = false; refreshButton(); }
}

async function playMessageMelody(message, changed) {
  const flag = changed.flags?.[MODULE_ID]?.instrumentPerformance ?? changed[`flags.${MODULE_ID}.instrumentPerformance`];
  if (!flag || playedMessages.has(message.id) || !message.isContentVisible || canvas.scene?.id !== flag.sceneId) return;
  if (!Object.hasOwn(INSTRUMENTS, flag.key) || !MELODY_TIERS.includes(flag.tier)) return;
  if (!PERFORMANCE_OUTCOMES.includes(flag.outcome)) return;
  const tile = canvas.scene.tiles.get(flag.tileId);
  if (!tile || tile.hidden || tile.includedInLevel?.(canvas.level) === false) return;
  playedMessages.add(message.id);
  if (playedMessages.size > 200) playedMessages.delete(playedMessages.values().next().value);
  const generation = ++playbackGeneration;
  try {
    await playingSound?.stop();
    const helper = foundry.audio.AudioHelper;
    const sound = await helper.play({ src: `modules/${MODULE_ID}/audio/instruments/${flag.key}/${flag.outcome}/${flag.tier}.wav?v=3`, volume: 0.6, loop: false }, false);
    if (generation !== playbackGeneration) await sound?.stop();
    else playingSound = sound;
  } catch (error) { console.error(`${MODULE_ID} | Instrument audio failed`, error); }
}

Hooks.on("updateChatMessage", (message, changed) => { void playMessageMelody(message, changed); });
Hooks.on("controlToken", (token, controlled) => {
  if (controlled) primaryTokenId = token.id;
  else if (primaryTokenId === token.id) primaryTokenId = null;
  queueRefresh();
});
for (const hook of ["canvasReady", "renderHotbar", "createTile", "updateTile", "deleteTile", "createToken", "updateToken", "deleteToken", "refreshToken", "canvasLevelChange"]) Hooks.on(hook, queueRefresh);
Hooks.on("canvasTearDown", () => {
  document.getElementById(BUTTON_ID)?.remove();
  playbackGeneration++;
  void playingSound?.stop();
  playingSound = null;
});
