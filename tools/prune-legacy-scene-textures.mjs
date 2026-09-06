import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.Hooks = { on() {}, once() {} };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_ROOT = path.join(ROOT, "images");
const MODULE_IMAGE_ROOT = "modules/ts-pf2e-utility/images/";
const PRESET = "bastion-blasphemy";
const APPLY = process.argv.includes("--apply");

function sourceText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function objectBody(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`Missing declaration: ${declaration}`);
  const bodyStart = start + declaration.length;
  const end = source.indexOf("\n});", bodyStart);
  if (end < 0) throw new Error(`Unterminated declaration: ${declaration}`);
  return source.slice(bodyStart, end);
}

function literalRedirects(body) {
  return Array.from(body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g), ([, from, to]) => [from, to]);
}

function generatedScatterRedirects(body) {
  const redirects = [];
  const pattern = /numberedScatterLegacyCanonicalPaths\("([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+)\)/g;
  for (const match of body.matchAll(pattern)) {
    const [, prefix, countText, oldVersion, newVersion] = match;
    for (let index = 1; index <= Number(countText); index += 1) {
      const number = String(index).padStart(2, "0");
      const current = `scene-floors/${prefix}-${number}-v${newVersion}.webp`;
      redirects.push([`scene-floors/${prefix}-${number}-v${oldVersion}.webp`, current]);
      redirects.push([`scene-floors/${prefix}-${number}-bastion-v${oldVersion}.webp`, current]);
    }
  }
  return redirects;
}

function absoluteImagePath(relativePath) {
  const normalized = relativePath.replaceAll("/", path.sep);
  const absolute = path.resolve(IMAGE_ROOT, normalized);
  const relativeToRoot = path.relative(IMAGE_ROOT, absolute);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Refusing path outside image root: ${relativePath}`);
  }
  return absolute;
}

const textureSource = sourceText("scripts/utility/texture-presets.js");
const assetSource = sourceText("scripts/utility/scene-assets.js");
const textureBody = objectBody(textureSource, "const LEGACY_PRESET_CANONICAL_PATHS = Object.freeze({");
const assetBody = objectBody(assetSource, "const LEGACY_ASSET_REDIRECTS = Object.freeze({");
const redirects = new Map([
  ...literalRedirects(assetBody),
  ...literalRedirects(textureBody),
  ...generatedScatterRedirects(textureBody),
]);

function canonicalPath(relativePath) {
  let current = relativePath;
  const visited = new Set();
  while (!visited.has(current)) {
    visited.add(current);
    const replacement = redirects.get(current);
    if (!replacement || replacement === current) return current;
    current = replacement;
  }
  throw new Error(`Legacy redirect cycle: ${[...visited, current].join(" -> ")}`);
}

const { baseTextureSource, resolvePresetTexture } = await import("../scripts/utility/texture-presets.js?tool=prune-legacy");
const protectedPaths = new Set();
for (const legacyPath of redirects.keys()) {
  const logical = canonicalPath(legacyPath.replace(/^presets\/[^/]+\//, ""));
  const baseSource = `${MODULE_IMAGE_ROOT}${logical}`;
  protectedPaths.add(logical);
  const presetSource = resolvePresetTexture(baseSource, PRESET, null);
  protectedPaths.add(presetSource.slice(MODULE_IMAGE_ROOT.length));
}

const candidates = new Set();
for (const legacyPath of redirects.keys()) {
  if (legacyPath.startsWith("presets/")) candidates.add(legacyPath);
  else {
    candidates.add(legacyPath);
    candidates.add(`presets/${PRESET}/${legacyPath}`);
  }
}

for (const relativeRoot of [
  "scene-assets",
  "scene-floors",
  "scene-walls",
  `presets/${PRESET}/scene-assets`,
  `presets/${PRESET}/scene-floors`,
  `presets/${PRESET}/scene-walls`,
]) {
  const directory = absoluteImagePath(relativeRoot);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relativePath = `${relativeRoot}/${entry.name}`;
    const source = `${MODULE_IMAGE_ROOT}${relativePath}`;
    const baseSource = baseTextureSource(source);
    const desired = relativePath.startsWith("presets/")
      ? resolvePresetTexture(baseSource, PRESET, null)
      : baseSource;
    if (desired === source) continue;
    candidates.add(relativePath);
    protectedPaths.add(desired.slice(MODULE_IMAGE_ROOT.length));
  }
}

const existing = [...candidates]
  .filter((relativePath) => !protectedPaths.has(relativePath))
  .filter((relativePath) => fs.existsSync(absoluteImagePath(relativePath)))
  .sort();

const missingTargets = [...protectedPaths]
  .filter((relativePath) => !fs.existsSync(absoluteImagePath(relativePath)))
  .sort();
if (missingTargets.length) {
  console.error("Refusing to prune because canonical targets are missing:");
  for (const relativePath of missingTargets) console.error(`  ${relativePath}`);
  process.exitCode = 1;
} else if (!APPLY) {
  console.log(`Dry run: ${existing.length} legacy scene texture(s) can be removed.`);
  for (const relativePath of existing) console.log(`  ${relativePath}`);
  console.log("Run with --apply to remove them.");
} else {
  for (const relativePath of existing) fs.rmSync(absoluteImagePath(relativePath));
  console.log(`Removed ${existing.length} legacy scene texture(s).`);
}
