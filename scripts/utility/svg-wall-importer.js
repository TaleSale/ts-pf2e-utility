import { MODULE_ID, t } from "../core.js";

const WALL_TEXTURE_FLAG = "wallTexture";
const IMPORT_FLAG = "svgWallImporter";
const DEFAULT_WALL_COLOR = "#000000";
const DEFAULT_DOOR_COLOR = "#0867F2";
const DEFAULT_TEXTURE_STYLE = "";
const MIN_WALL_LENGTH = 10;
const MIN_DOOR_LENGTH = 4;
const SIMPLIFY_TOLERANCE_RATIO = 0.002;

function notifyWarn(message) {
  ui.notifications?.warn(message);
}

function notifyInfo(message) {
  ui.notifications?.info(message);
}

function notifyError(message) {
  ui.notifications?.error(message);
}

function getSceneBackground(scene) {
  return scene?.background?.src
    ?? scene?.background
    ?? scene?.img
    ?? scene?.thumb
    ?? "";
}

function isSvgPath(src) {
  const path = String(src ?? "").split("?")[0].split("#")[0].toLowerCase();
  return path.endsWith(".svg");
}

function normalizeColor(value) {
  const color = String(value ?? "").trim().toLowerCase();
  if (!color || color === "none" || color === "transparent") return "";

  const shortHex = color.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    return `#${shortHex[1].split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }

  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) return `#${hex[1].toLowerCase()}`;

  const rgb = color.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (rgb) {
    return `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
  }

  return color;
}

function getInheritedAttribute(element, name) {
  let current = element;
  while (current instanceof Element) {
    const value = current.getAttribute(name);
    if (value != null) return value;
    current = current.parentElement;
  }
  return "";
}

function getStyleColor(element, property) {
  const style = element.getAttribute("style") ?? "";
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = style.match(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1] ?? "";
}

function elementMatchesColor(element, targetColor) {
  const fill = normalizeColor(getStyleColor(element, "fill") || getInheritedAttribute(element, "fill"));
  const stroke = normalizeColor(getStyleColor(element, "stroke") || getInheritedAttribute(element, "stroke"));
  return fill === targetColor || stroke === targetColor;
}

function parseNumberList(value) {
  return Array.from(String(value ?? "").matchAll(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi), (match) => Number(match[0]))
    .filter(Number.isFinite);
}

function parsePoints(value) {
  const numbers = parseNumberList(value);
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplifyPoints(points, tolerance) {
  if (points.length <= 2) return points.slice();

  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= tolerance) return [start, end];

  const before = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
  const after = simplifyPoints(points.slice(maxIndex), tolerance);
  return before.slice(0, -1).concat(after);
}

function tokenizePathData(pathData) {
  return Array.from(String(pathData ?? "").matchAll(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g), (match) => match[0]);
}

function isCommand(token) {
  return /^[a-zA-Z]$/.test(token);
}

function parseSvgPath(pathData) {
  const tokens = tokenizePathData(pathData);
  const subpaths = [];
  let index = 0;
  let command = "";
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let points = [];

  const readNumber = () => Number(tokens[index++]);
  const flush = () => {
    if (points.length > 1) subpaths.push(points);
    points = [];
  };
  const addPoint = (point) => {
    current = point;
    points.push(point);
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) break;

    const relative = command === command.toLowerCase();
    const op = command.toUpperCase();

    if (op === "M") {
      if (index + 1 >= tokens.length) break;
      flush();
      const x = readNumber();
      const y = readNumber();
      current = { x: relative ? current.x + x : x, y: relative ? current.y + y : y };
      start = current;
      points = [current];
      command = relative ? "l" : "L";
      continue;
    }

    if (op === "L") {
      while (index + 1 < tokens.length && !isCommand(tokens[index])) {
        const x = readNumber();
        const y = readNumber();
        addPoint({ x: relative ? current.x + x : x, y: relative ? current.y + y : y });
      }
      continue;
    }

    if (op === "H") {
      while (index < tokens.length && !isCommand(tokens[index])) {
        const x = readNumber();
        addPoint({ x: relative ? current.x + x : x, y: current.y });
      }
      continue;
    }

    if (op === "V") {
      while (index < tokens.length && !isCommand(tokens[index])) {
        const y = readNumber();
        addPoint({ x: current.x, y: relative ? current.y + y : y });
      }
      continue;
    }

    if (op === "Z") {
      if (points.length && (current.x !== start.x || current.y !== start.y)) addPoint(start);
      flush();
      current = start;
      command = "";
      continue;
    }

    const parameterCounts = { C: 6, S: 4, Q: 4, T: 2, A: 7 };
    const count = parameterCounts[op];
    if (!count) break;

    while (index + count - 1 < tokens.length && !isCommand(tokens[index])) {
      const values = Array.from({ length: count }, readNumber);
      const x = values[count - 2];
      const y = values[count - 1];
      addPoint({ x: relative ? current.x + x : x, y: relative ? current.y + y : y });
    }
  }

  flush();
  return subpaths;
}

function getElementSubpaths(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === "path") return parseSvgPath(element.getAttribute("d"));
  if (tag === "polyline" || tag === "polygon") {
    const points = parsePoints(element.getAttribute("points"));
    if (tag === "polygon" && points.length) points.push(points[0]);
    return points.length > 1 ? [points] : [];
  }
  if (tag === "line") {
    const x1 = Number(element.getAttribute("x1") ?? 0);
    const y1 = Number(element.getAttribute("y1") ?? 0);
    const x2 = Number(element.getAttribute("x2") ?? 0);
    const y2 = Number(element.getAttribute("y2") ?? 0);
    return [Number.isFinite(x1 + y1 + x2 + y2) ? [{ x: x1, y: y1 }, { x: x2, y: y2 }] : []];
  }
  if (tag === "rect") {
    const x = Number(element.getAttribute("x") ?? 0);
    const y = Number(element.getAttribute("y") ?? 0);
    const width = Number(element.getAttribute("width") ?? 0);
    const height = Number(element.getAttribute("height") ?? 0);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
    return [[
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y },
    ]];
  }
  return [];
}

function segmentLength(segment) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
}

function subpathsToSegments(subpaths, tolerance, minLength) {
  const segments = [];
  for (const subpath of subpaths) {
    const simplified = simplifyPoints(subpath, tolerance);
    for (let index = 0; index + 1 < simplified.length; index += 1) {
      const start = simplified[index];
      const end = simplified[index + 1];
      const segment = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
      if (segmentLength(segment) >= minLength) segments.push(segment);
    }
  }
  return segments;
}

function subpathToDoorSegment(subpath, minLength) {
  if (subpath.length < 2) return null;

  const centroid = subpath.reduce((total, point) => ({
    x: total.x + point.x,
    y: total.y + point.y,
  }), { x: 0, y: 0 });
  centroid.x /= subpath.length;
  centroid.y /= subpath.length;

  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of subpath) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let minProjection = Infinity;
  let maxProjection = -Infinity;
  for (const point of subpath) {
    const projection = (point.x - centroid.x) * ux + (point.y - centroid.y) * uy;
    minProjection = Math.min(minProjection, projection);
    maxProjection = Math.max(maxProjection, projection);
  }

  const segment = {
    x1: centroid.x + ux * minProjection,
    y1: centroid.y + uy * minProjection,
    x2: centroid.x + ux * maxProjection,
    y2: centroid.y + uy * maxProjection,
  };

  return segmentLength(segment) >= minLength ? segment : null;
}

function dedupeSegments(segments) {
  const seen = new Set();
  const result = [];
  for (const segment of segments) {
    const rounded = [segment.x1, segment.y1, segment.x2, segment.y2].map((value) => Math.round(value));
    const forward = rounded.join(",");
    const backward = [rounded[2], rounded[3], rounded[0], rounded[1]].join(",");
    const key = forward < backward ? forward : backward;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(segment);
  }
  return result;
}

function getSvgSize(document) {
  const svg = document.documentElement;
  const viewBox = parseNumberList(svg.getAttribute("viewBox"));
  if (viewBox.length >= 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] };
  }

  const width = Number(String(svg.getAttribute("width") ?? "").replace(/[^\d.]/g, ""));
  const height = Number(String(svg.getAttribute("height") ?? "").replace(/[^\d.]/g, ""));
  return { x: 0, y: 0, width: width || 1, height: height || 1 };
}

function sceneSize(scene) {
  const dimensions = canvas?.dimensions ?? scene?.dimensions ?? {};
  const width = Number(dimensions.sceneWidth ?? scene?.width ?? dimensions.width ?? 1);
  const height = Number(dimensions.sceneHeight ?? scene?.height ?? dimensions.height ?? 1);
  const canvasWidth = Number(dimensions.width ?? width);
  const canvasHeight = Number(dimensions.height ?? height);
  const fallbackX = (canvasWidth - width) / 2;
  const fallbackY = (canvasHeight - height) / 2;
  const sceneX = Number(dimensions.sceneX ?? dimensions.x ?? fallbackX);
  const sceneY = Number(dimensions.sceneY ?? dimensions.y ?? fallbackY);
  return {
    x: Number.isFinite(sceneX) ? sceneX : 0,
    y: Number.isFinite(sceneY) ? sceneY : 0,
    width,
    height,
  };
}

function mapSegmentToScene(segment, svgBounds, sceneBounds) {
  const scaleX = sceneBounds.width / svgBounds.width;
  const scaleY = sceneBounds.height / svgBounds.height;
  const mapX = (x) => sceneBounds.x + (x - svgBounds.x) * scaleX;
  const mapY = (y) => sceneBounds.y + (y - svgBounds.y) * scaleY;
  return [mapX(segment.x1), mapY(segment.y1), mapX(segment.x2), mapY(segment.y2)].map((value) => Math.round(value));
}

function extractSegments(document, color, { doors = false } = {}) {
  const svgBounds = getSvgSize(document);
  const tolerance = Math.max(svgBounds.width, svgBounds.height) * SIMPLIFY_TOLERANCE_RATIO;
  const elements = Array.from(document.querySelectorAll("path,line,polyline,polygon,rect"))
    .filter((element) => elementMatchesColor(element, color));

  const segments = [];
  for (const element of elements) {
    const subpaths = getElementSubpaths(element);
    if (doors) {
      for (const subpath of subpaths) {
        const segment = subpathToDoorSegment(subpath, MIN_DOOR_LENGTH);
        if (segment) segments.push(segment);
      }
    } else {
      segments.push(...subpathsToSegments(subpaths, tolerance, MIN_WALL_LENGTH));
    }
  }

  return dedupeSegments(segments);
}

function countMatchingElements(document, color) {
  return Array.from(document.querySelectorAll("path,line,polyline,polygon,rect"))
    .filter((element) => elementMatchesColor(element, color)).length;
}

async function loadSvgDocument(src) {
  const response = await fetch(src, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const document = new DOMParser().parseFromString(text, "image/svg+xml");
  if (document.querySelector("parsererror")) throw new Error("Invalid SVG");
  return document;
}

function buildWallData(segment, svgBounds, sceneBounds, textureStyle) {
  const noDoor = CONST.WALL_DOOR_TYPES?.NONE ?? 0;
  const data = {
    c: mapSegmentToScene(segment, svgBounds, sceneBounds),
    door: noDoor,
    flags: {
      [MODULE_ID]: {
        [IMPORT_FLAG]: true,
      },
    },
  };

  if (textureStyle) {
    data.flags[MODULE_ID][WALL_TEXTURE_FLAG] = {
      enabled: true,
      style: textureStyle,
    };
  }

  return data;
}

function buildDoorData(segment, svgBounds, sceneBounds) {
  return {
    c: mapSegmentToScene(segment, svgBounds, sceneBounds),
    door: CONST.WALL_DOOR_TYPES?.DOOR ?? 1,
    ds: CONST.WALL_DOOR_STATES?.CLOSED ?? 1,
    flags: {
      [MODULE_ID]: {
        [IMPORT_FLAG]: true,
      },
    },
  };
}

async function deletePreviousImport(scene, replaceSceneWalls) {
  const ids = scene.walls
    .filter((wall) => replaceSceneWalls || wall.getFlag?.(MODULE_ID, IMPORT_FLAG) || wall.flags?.[MODULE_ID]?.[IMPORT_FLAG])
    .map((wall) => wall.id);
  if (ids.length) await scene.deleteEmbeddedDocuments("Wall", ids);
}

async function createWallsFromSvg({ wallColor, doorColor, textureStyle, replaceSceneWalls }) {
  const scene = canvas?.scene ?? game.scenes?.active;
  if (!scene) {
    notifyWarn(t("Notifications.SceneRequired", "An active scene is required."));
    return;
  }

  const background = getSceneBackground(scene);
  if (!background || !isSvgPath(background)) {
    notifyWarn(`Фон активной сцены должен быть SVG-файлом. Сейчас: ${background || "не найден"}`);
    return;
  }

  let document = null;
  try {
    document = await loadSvgDocument(background);
  } catch (error) {
    console.error(`${MODULE_ID} | SVG wall importer failed to load background`, background, error);
    notifyError(`Не удалось прочитать SVG-фон: ${error?.message ?? error}`);
    return;
  }

  const svgBounds = getSvgSize(document);
  const sceneBounds = sceneSize(scene);
  const wallSegments = extractSegments(document, wallColor);
  const doorSegments = extractSegments(document, doorColor, { doors: true });

  if (!wallSegments.length && !doorSegments.length) {
    const wallElements = countMatchingElements(document, wallColor);
    const doorElements = countMatchingElements(document, doorColor);
    notifyWarn(`В SVG не найдены стены или двери. Элементы цвета стен: ${wallElements}; цвета дверей: ${doorElements}; фон: ${background}`);
    return;
  }

  if (textureStyle) await game.settings.set(MODULE_ID, "enableWallTextures", true);
  await deletePreviousImport(scene, replaceSceneWalls);

  const documents = [
    ...wallSegments.map((segment) => buildWallData(segment, svgBounds, sceneBounds, textureStyle)),
    ...doorSegments.map((segment) => buildDoorData(segment, svgBounds, sceneBounds)),
  ];

  await scene.createEmbeddedDocuments("Wall", documents);
  notifyInfo(`Создано стен: ${wallSegments.length}; дверей: ${doorSegments.length}.`);
}

function dialogContent() {
  return `
    <form class="tsu-svg-wall-importer">
      <div class="form-group">
        <label>Цвет стен</label>
        <div class="form-fields">
          <input type="color" name="wallColor" value="${DEFAULT_WALL_COLOR}">
          <input type="text" name="wallColorText" value="${DEFAULT_WALL_COLOR}" data-color-proxy="wallColor">
        </div>
      </div>
      <div class="form-group">
        <label>Цвет дверей</label>
        <div class="form-fields">
          <input type="color" name="doorColor" value="${DEFAULT_DOOR_COLOR}">
          <input type="text" name="doorColorText" value="${DEFAULT_DOOR_COLOR}" data-color-proxy="doorColor">
        </div>
      </div>
      <div class="form-group">
        <label>Текстура стен</label>
        <div class="form-fields">
          <select name="textureStyle">
            <option value="">Без текстуры</option>
            <option value="grey-brick">Серый кирпич</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Заменить стены сцены</label>
        <div class="form-fields">
          <input type="checkbox" name="replaceSceneWalls" checked>
        </div>
      </div>
      <p class="notes">Макрос берёт SVG-фон активной сцены и создаёт стены по цвету стен, а двери по цвету дверей.</p>
    </form>
  `;
}

function readDialogData(html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const form = root.querySelector(".tsu-svg-wall-importer");
  const formData = new FormData(form);
  return {
    wallColor: normalizeColor(formData.get("wallColorText") || formData.get("wallColor") || DEFAULT_WALL_COLOR),
    doorColor: normalizeColor(formData.get("doorColorText") || formData.get("doorColor") || DEFAULT_DOOR_COLOR),
    textureStyle: String(formData.get("textureStyle") ?? DEFAULT_TEXTURE_STYLE),
    replaceSceneWalls: formData.get("replaceSceneWalls") === "on",
  };
}

function activateDialogListeners(html) {
  const root = html instanceof HTMLElement ? html : html[0];
  for (const input of root.querySelectorAll("input[type='color']")) {
    const text = root.querySelector(`[data-color-proxy="${input.name}"]`);
    input.addEventListener("input", () => {
      if (text) text.value = input.value;
    });
    text?.addEventListener("change", () => {
      const normalized = normalizeColor(text.value);
      if (/^#[0-9a-f]{6}$/i.test(normalized)) input.value = normalized;
    });
  }
}

export async function openSvgWallImporterDialog() {
  if (!game.user?.isGM) {
    notifyWarn(t("Notifications.OnlyGM", "Only the GM can open this tool."));
    return;
  }

  new Dialog({
    title: "SVG стены и двери",
    content: dialogContent(),
    buttons: {
      import: {
        icon: '<i class="fa-solid fa-vector-square"></i>',
        label: "Создать",
        callback: async (html) => createWallsFromSvg(readDialogData(html)),
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Отмена",
      },
    },
    default: "import",
    render: activateDialogListeners,
  }).render(true);
}
