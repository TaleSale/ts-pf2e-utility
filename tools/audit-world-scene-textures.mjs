import fs from "node:fs";
import path from "node:path";

globalThis.Hooks = { on() {}, once() {} };

const worldRoot = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(worldRoot)) {
  console.error("Usage: node tools/audit-world-scene-textures.mjs <world-directory>");
  process.exit(1);
}

const moduleRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const modulePrefix = "modules/ts-pf2e-utility/";
const { baseTextureSource, resolvePresetTexture } = await import(
  "../scripts/utility/texture-presets.js?tool=audit-world"
);

function filesBelow(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

const sceneStore = path.join(worldRoot, "data", "scenes");
if (!fs.existsSync(sceneStore)) {
  console.error(`Scene store not found: ${sceneStore}`);
  process.exit(1);
}

const counts = new Map();
const pattern = /modules\/ts-pf2e-utility\/images\/[A-Za-z0-9_./-]+\.(?:avif|jpe?g|png|svg|webp)/g;
for (const file of filesBelow(sceneStore)) {
  let source;
  try { source = fs.readFileSync(file).toString("latin1"); }
  catch (error) {
    if (error?.code === "EBUSY" || error?.code === "EACCES") continue;
    throw error;
  }
  for (const match of source.matchAll(pattern)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
}

const missing = [];
const migratable = [];
for (const [source, count] of counts) {
  const diskPath = path.join(moduleRoot, source.slice(modulePrefix.length).replaceAll("/", path.sep));
  if (fs.existsSync(diskPath)) continue;
  const base = baseTextureSource(source);
  const resolved = resolvePresetTexture(base, null, null);
  const baseDiskPath = path.join(moduleRoot, base.slice(modulePrefix.length).replaceAll("/", path.sep));
  const resolvedDiskPath = path.join(moduleRoot, resolved.slice(modulePrefix.length).replaceAll("/", path.sep));
  const record = { count, source, base, resolved, baseExists: fs.existsSync(baseDiskPath), resolvedExists: fs.existsSync(resolvedDiskPath) };
  missing.push(record);
  if (record.baseExists || record.resolvedExists) migratable.push(record);
}

console.log(`World: ${worldRoot}`);
console.log(`Stored module texture paths: ${counts.size}`);
console.log(`Missing physical paths: ${missing.length}`);
console.log(`Recognized migration paths: ${migratable.length}`);
for (const record of missing.sort((left, right) => right.count - left.count || left.source.localeCompare(right.source))) {
  console.log(`${record.count}x ${record.source}`);
  console.log(`   -> ${record.resolved} (${record.resolvedExists ? "exists" : "missing"})`);
}
