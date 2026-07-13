const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const Module = require("node:module");

const MODULE_ROOT = path.resolve(__dirname, "..");
const PACK_CONFIGS = Object.freeze([
  {
    label: "games",
    dbPath: path.join(MODULE_ROOT, ".pack-build", "games"),
    publishPath: path.join(MODULE_ROOT, "packs", "games"),
    sourceFiles: Object.freeze([
      "pack-src/games/Open_Beer_Furious_BrF0rsh1P1v00001.json",
      "pack-src/games/Open_Bug_Race_BrUgR4cE2026pF2.json",
      "pack-src/games/Open_Kuboker_uK8pV4mX2rQ7nHs5.json",
      "pack-src/games/Open_Devils_Pin_YwNQfY3G4kP1mL2a.json",
    ]),
  },
  {
    label: "mechanics",
    dbPath: path.join(MODULE_ROOT, ".pack-build", "mechanics"),
    publishPath: path.join(MODULE_ROOT, "packs", "mechanics"),
    sourceFiles: Object.freeze([
      "pack-src/games/Open_Duel_Combat_D7m3oX9QaL2cV8pR.json",
    ]),
  },
  {
    label: "utility",
    dbPath: path.join(MODULE_ROOT, ".pack-build", "utility"),
    publishPath: path.join(MODULE_ROOT, "packs", "utility"),
    sourceFiles: Object.freeze([
      "pack-src/utility/Refresh_Actor_Keep_ID_UtActSync0000001.json",
      "pack-src/utility/Refresh_Actor_Items_And_Spells_UtItemSync000001.json",
      "pack-src/utility/Creature_Statblock_UtCrStBlk000001.json",
      "pack-src/utility/Token_Adjectives_UtTokAdj000001.json",
      "pack-src/utility/Quick_Effects_UtQuickFx00001.json",
      "pack-src/utility/SVG_Walls_And_Doors_UtSvgWalls00001.json",
    ]),
  },
  {
    label: "creature-builder",
    dbPath: path.join(MODULE_ROOT, ".pack-build", "creature-builder"),
    publishPath: path.join(MODULE_ROOT, "packs", "creature-builder"),
    sourceFiles: Object.freeze([]),
  },
  {
    label: "success-effects",
    dbPath: path.join(MODULE_ROOT, ".pack-build", "success-effects"),
    publishPath: path.join(MODULE_ROOT, "packs", "success-effects"),
    sourceFiles: Object.freeze([]),
  },
]);

function getFoundryAppPath() {
  const direct = process.env.FOUNDRY_APP_PATH;
  if (direct && fs.existsSync(direct)) return direct;

  const fromArg = process.argv[2];
  if (fromArg && fs.existsSync(fromArg)) return fromArg;

  const candidates = [
    "D:/Foundry/Foundry Virtual Tabletop/resources/app",
    "C:/Program Files/Foundry Virtual Tabletop/resources/app",
    "C:/Program Files (x86)/Foundry Virtual Tabletop/resources/app",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function createFoundryRequire(foundryAppPath) {
  const packageJsonPath = path.join(foundryAppPath, "package.json");
  return Module.createRequire(packageJsonPath);
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

async function loadSourceDocuments(sourceFiles) {
  const documents = [];
  for (const relativePath of sourceFiles) {
    const absolutePath = path.join(MODULE_ROOT, relativePath);
    const data = await readJson(absolutePath);
    const key = String(data._key ?? `!macros!${data._id}`);
    const value = { ...data };
    delete value._key;
    documents.push({ key, value });
  }
  return documents;
}

async function syncPack(ClassicLevel, config) {
  const db = new ClassicLevel(config.dbPath, {
    keyEncoding: "utf8",
    valueEncoding: "json",
  });

  await db.open();
  try {
    const sources = await loadSourceDocuments(config.sourceFiles);
    const expectedKeys = new Set(sources.map((doc) => doc.key));
    const existingKeys = [];

    for await (const [key] of db.iterator()) {
      existingKeys.push(String(key));
    }

    const batch = db.batch();
    const created = [];
    const updated = [];
    const deleted = [];

    for (const source of sources) {
      const existing = await db.get(source.key).catch((error) => {
        if (error?.code === "LEVEL_NOT_FOUND") return undefined;
        throw error;
      });

      if (!existing) {
        batch.put(source.key, source.value);
        created.push(source.key);
        continue;
      }

      const existingText = JSON.stringify(existing);
      const sourceText = JSON.stringify(source.value);
      if (existingText !== sourceText) {
        batch.put(source.key, source.value);
        updated.push(source.key);
      }
    }

    for (const existingKey of existingKeys) {
      if (expectedKeys.has(existingKey)) continue;
      batch.del(existingKey);
      deleted.push(existingKey);
    }

    await batch.write();
    if (typeof db.compactRange === "function") {
      await db.compactRange("", "~");
    }
    return { created, updated, deleted };
  } finally {
    await db.close();
  }
}

async function publishPack(config) {
  const targetParent = path.dirname(config.publishPath);
  await fsp.mkdir(targetParent, { recursive: true });
  await fsp.rm(config.publishPath, { recursive: true, force: true });
  await fsp.mkdir(config.publishPath, { recursive: true });

  const entries = await fsp.readdir(config.dbPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "LOCK") continue;
    const source = path.join(config.dbPath, entry.name);
    const target = path.join(config.publishPath, entry.name);
    if (entry.isDirectory()) {
      await fsp.cp(source, target, { recursive: true, force: true });
      continue;
    }
    await fsp.copyFile(source, target);
  }
}

async function main() {
  const foundryAppPath = getFoundryAppPath();
  if (!foundryAppPath) {
    throw new Error("Foundry resources/app path not found. Set FOUNDRY_APP_PATH or pass it as the first argument.");
  }

  const requestedLabels = new Set(process.argv.slice(2).filter((value) => value && !fs.existsSync(value)));
  const packConfigs = requestedLabels.size
    ? PACK_CONFIGS.filter((config) => requestedLabels.has(config.label))
    : PACK_CONFIGS;

  if (requestedLabels.size && !packConfigs.length) {
    throw new Error(`Unknown pack label(s): ${Array.from(requestedLabels).join(", ")}`);
  }

  const foundryRequire = createFoundryRequire(foundryAppPath);
  const { ClassicLevel } = foundryRequire("classic-level");

  for (const config of packConfigs) {
    const result = await syncPack(ClassicLevel, config);
    await publishPack(config);
    console.log(`${config.label}: created=${result.created.length}, updated=${result.updated.length}, deleted=${result.deleted.length}`);
    if (result.created.length) console.log(`  created: ${result.created.join(", ")}`);
    if (result.updated.length) console.log(`  updated: ${result.updated.join(", ")}`);
    if (result.deleted.length) console.log(`  deleted: ${result.deleted.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
