const SAVE_ALIASES = Object.freeze({
  fortitude: "fortitude",
  fort: "fortitude",
  "стойкость": "fortitude",
  "стойкости": "fortitude",
  reflex: "reflex",
  ref: "reflex",
  "рефлекс": "reflex",
  "рефлекса": "reflex",
  will: "will",
  "воля": "will",
  "воли": "will",
});

const UNIT_ALIASES = Object.freeze({
  round: "rounds", rounds: "rounds", раунд: "rounds", раунда: "rounds", раундов: "rounds",
  second: "seconds", seconds: "seconds", секунда: "seconds", секунды: "seconds", секунд: "seconds",
  minute: "minutes", minutes: "minutes", минута: "minutes", минуты: "minutes", минут: "minutes",
  hour: "hours", hours: "hours", час: "hours", часа: "hours", часов: "hours",
  day: "days", days: "days", день: "days", дня: "days", дней: "days",
});

const CONDITION_ALIASES = Object.freeze({
  blinded: ["blinded", "слепота", "ослеплен", "ослеплён", "ослеплена", "ослеплено"],
  clumsy: ["clumsy", "неуклюжесть", "неуклюж"],
  confused: ["confused", "замешательство", "в замешательстве"],
  controlled: ["controlled", "под контролем"],
  dazzled: ["dazzled", "ослеплён светом", "ослеплен светом"],
  deafened: ["deafened", "глухота", "оглох"],
  drained: ["drained", "истощён", "истощен", "истощение"],
  enfeebled: ["enfeebled", "ослаблен", "ослаблена", "слабость"],
  fascinated: ["fascinated", "заворожён", "заворожен"],
  fatigued: ["fatigued", "утомлён", "утомлен", "утомление"],
  fleeing: ["fleeing", "бегство", "убегает"],
  frightened: ["frightened", "напуган", "испуган", "страх"],
  immobilized: ["immobilized", "обездвижен"],
  offGuard: ["off-guard", "off guard", "застигнут врасплох"],
  paralyzed: ["paralyzed", "парализован"],
  persistentDamage: ["persistent damage", "продолжительный урон"],
  prone: ["prone", "ничком", "сбит с ног"],
  quickened: ["quickened", "ускорен", "ускорён"],
  restrained: ["restrained", "сдерживаем"],
  sickened: ["sickened", "тошнота", "тошнит"],
  slowed: ["slowed", "замедлен"],
  stunned: ["stunned", "ошеломлён", "ошеломлен"],
  stupefied: ["stupefied", "одурманен"],
  unconscious: ["unconscious", "без сознания"],
});

const DURATION_PATTERN = String.raw`([+\-]?\d+(?:d\d+)?(?:\s*[+\-]\s*\d+)?)\s*(rounds?|seconds?|minutes?|hours?|days?|раунд(?:а|ов)?|секунд(?:а|ы)?|минут(?:а|ы)?|час(?:а|ов)?|д(?:ень|ня|ней))`;

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&minus;|&#8722;/gi, "−")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function htmlToAfflictionText(value) {
  return decodeEntities(value)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h\d|section|article|tr)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSaveType(value) {
  return SAVE_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

function normalizeUnit(value) {
  return UNIT_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

export function normalizeDuration(value) {
  if (!value || typeof value !== "object") return null;
  const formula = String(value.formula ?? value.value ?? "").trim().replace(/−/g, "-");
  const unit = normalizeUnit(value.unit) ?? String(value.unit ?? "").trim();
  if (!formula || !unit) return null;
  return { formula, unit };
}

function parseDuration(value) {
  const matches = Array.from(String(value ?? "").matchAll(new RegExp(DURATION_PATTERN, "giu")));
  const match = matches.at(-1);
  return match ? normalizeDuration({ formula: match[1], unit: match[2] }) : null;
}

function extractLabeledDuration(text, labels) {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = new RegExp(String.raw`(?:${labelPattern})\s*:?\s*${DURATION_PATTERN}`, "iu").exec(text);
  return match ? normalizeDuration({ formula: match[1], unit: match[2] }) : null;
}

function parseSave(raw, text) {
  const checks = Array.from(String(raw ?? "").matchAll(/@Check\[([^\]]+)\]/giu));
  for (const [, body] of checks) {
    const parts = body.split("|").map((entry) => entry.trim());
    const type = normalizeSaveType(parts.find((entry) => !entry.includes(":")) ?? parts.find((entry) => /^type:/i.test(entry))?.split(":")[1]);
    const dc = Number(parts.find((entry) => /^dc:/i.test(entry))?.split(":")[1]);
    if (type && Number.isFinite(dc) && dc > 0) return { type, dc: Math.trunc(dc) };
  }

  const dataCheck = /data-pf2-check=["'](fortitude|reflex|will)["'][^>]*data-pf2-dc=["'](\d+)["']/iu.exec(raw)
    ?? /data-pf2-dc=["'](\d+)["'][^>]*data-pf2-check=["'](fortitude|reflex|will)["']/iu.exec(raw);
  if (dataCheck) {
    const firstIsType = Number.isNaN(Number(dataCheck[1]));
    return { type: normalizeSaveType(firstIsType ? dataCheck[1] : dataCheck[2]), dc: Number(firstIsType ? dataCheck[2] : dataCheck[1]) };
  }

  const plain = /(fortitude|reflex|will|стойкост(?:ь|и)|рефлекс(?:а)?|вол(?:я|и))[^\d]{0,50}(?:dc|кс)\s*(\d+)/iu.exec(text)
    ?? /(?:dc|кс)\s*(\d+)[^\n]{0,50}(fortitude|reflex|will|стойкост(?:ь|и)|рефлекс(?:а)?|вол(?:я|и))/iu.exec(text);
  if (!plain) return { type: "fortitude", dc: null };
  const firstIsType = Number.isNaN(Number(plain[1]));
  return { type: normalizeSaveType(firstIsType ? plain[1] : plain[2]) ?? "fortitude", dc: Number(firstIsType ? plain[2] : plain[1]) };
}

function scanEnricherBodies(raw, enricher) {
  const source = String(raw ?? "");
  const result = [];
  const marker = `@${enricher}[`;
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) break;
    let depth = 1;
    let index = start + marker.length;
    for (; index < source.length && depth > 0; index += 1) {
      if (source[index] === "[") depth += 1;
      else if (source[index] === "]") depth -= 1;
    }
    if (depth === 0) result.push(source.slice(start + marker.length, index - 1));
    cursor = Math.max(index, start + marker.length);
  }
  return result;
}

function parseDamage(stageRaw, stageText) {
  const damage = [];
  for (const body of scanEnricherBodies(stageRaw, "Damage")) {
    const normalized = body.split("|")[0].trim();
    const flavored = /^(.+?)\[([a-z-]+)(?:,([a-z-]+))?\]$/iu.exec(normalized);
    damage.push({
      formula: String(flavored?.[1] ?? normalized).trim(),
      damageType: String(flavored?.[2] ?? "untyped").trim().toLowerCase(),
      category: flavored?.[3] ? flavored[3].trim().toLowerCase() : null,
    });
  }
  if (damage.length) return damage;

  const patterns = [
    /(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s+(acid|bleed|cold|electricity|fire|mental|poison|spirit|void|vitality)\s+damage/giu,
    /(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s+(?:урона?\s+)?(?:ядом|ядовитого\s+урона)/giu,
  ];
  for (const pattern of patterns) {
    for (const match of stageText.matchAll(pattern)) {
      damage.push({ formula: match[1].replace(/\s+/g, ""), damageType: match[2] ?? "poison", category: null });
    }
  }
  return damage;
}

function parseConditions(stageText) {
  const normalized = stageText.toLowerCase();
  const conditions = [];
  for (const [slug, aliases] of Object.entries(CONDITION_ALIASES)) {
    const alias = aliases.find((candidate) => normalized.includes(candidate));
    if (!alias || slug === "persistentDamage") continue;
    const index = normalized.indexOf(alias);
    const suffix = normalized.slice(index + alias.length, index + alias.length + 8);
    const value = Number(/^\s*(\d+)/u.exec(suffix)?.[1]);
    conditions.push({ slug: slug === "offGuard" ? "off-guard" : slug, value: Number.isFinite(value) && value > 0 ? value : 1, linked: true });
  }
  return conditions;
}

function splitStages(raw, text) {
  const markers = Array.from(text.matchAll(/(?:^|\n|[.;])\s*(?:stage|стадия)\s*(\d+)\s*:?/giu));
  if (!markers.length) return [];
  return markers.map((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? text.length;
    const stageText = text.slice(start, end).trim().replace(/^[—–\-:;,.\s]+|[\s]+$/g, "");
    const rawIndex = raw.toLowerCase().indexOf(stageText.slice(0, Math.min(stageText.length, 24)).toLowerCase());
    const stageRaw = rawIndex >= 0 ? raw.slice(rawIndex, rawIndex + Math.max(stageText.length * 3, 200)) : stageText;
    return {
      number: Number(marker[1]),
      text: stageText,
      duration: parseDuration(stageText),
      damage: parseDamage(stageRaw, stageText),
      conditions: parseConditions(stageText),
      effects: [],
    };
  }).sort((left, right) => left.number - right.number);
}

export function parseAfflictionDescription(rawDescription, { name = "", img = "", traits = [] } = {}) {
  const raw = String(rawDescription ?? "");
  const text = htmlToAfflictionText(raw);
  const stages = splitStages(raw, text);
  return {
    name: String(name ?? "").trim(),
    img: String(img ?? "").trim(),
    type: "poison",
    save: parseSave(raw, text),
    onset: extractLabeledDuration(text, ["onset", "возникновение", "период возникновения"]),
    maxDuration: extractLabeledDuration(text, ["maximum duration", "max. duration", "max duration", "макс. продолжительность", "макс.продолжительность", "максимальная продолжительность"]),
    virulent: (Array.isArray(traits) ? traits : Array.from(traits ?? [])).includes("virulent") || /\bvirulent\b|\bвирулентн/iu.test(text),
    stages,
  };
}

export function validateAfflictionDefinition(definition) {
  const errors = [];
  if (definition?.type !== "poison") errors.push("unsupportedType");
  if (!definition?.save?.type || !Number.isFinite(Number(definition?.save?.dc)) || Number(definition.save.dc) <= 0) errors.push("save");
  if (!Array.isArray(definition?.stages) || definition.stages.length === 0) errors.push("stages");
  for (const [index, stage] of (definition?.stages ?? []).entries()) {
    if (!normalizeDuration(stage?.duration)) errors.push(`stageDuration:${index + 1}`);
  }
  return errors;
}

export function mergeAfflictionDefinition(config) {
  const parsed = config?.parsed && typeof config.parsed === "object" ? structuredClone(config.parsed) : parseAfflictionDescription("");
  const overrides = config?.overrides && typeof config.overrides === "object" ? config.overrides : {};
  for (const key of ["name", "img", "type", "save", "onset", "maxDuration", "virulent", "stages"]) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) parsed[key] = structuredClone(overrides[key]);
  }
  parsed.type = config?.type ?? parsed.type ?? "poison";
  return parsed;
}

export function durationUnitSeconds(unit, roundTime = 6) {
  return ({ rounds: roundTime, seconds: 1, minutes: 60, hours: 3600, days: 86400 })[unit] ?? 0;
}
