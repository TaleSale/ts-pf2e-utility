import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

globalThis.Hooks = { on() {}, once() {} };

const textures = await import("../scripts/utility/texture-presets.js?test=texture-migrations");
const ROOT = "modules/ts-pf2e-utility/images/";

test("canonicalizes legacy base and preset texture paths transitively", () => {
  assert.equal(
    textures.baseTextureRelativePath(`${ROOT}scene-floors/sea-deep-floor-v2.webp`),
    "scene-floors/sea-deep-floor-v5.webp",
  );
  assert.equal(
    textures.baseTextureRelativePath(
      `${ROOT}presets/bastion-blasphemy/scene-assets/bookshelf-corner-wall-topdown-v4.webp`,
    ),
    "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  );
  assert.equal(
    textures.baseTextureRelativePath(
      `${ROOT}presets/bastion-blasphemy/scene-floors/grass-meadow-floor-bastion-v3.png`,
    ),
    "scene-floors/grass-meadow-floor-v4.webp",
  );
});

test("resolves deleted legacy paths directly to existing active files", () => {
  const oldSource = `${ROOT}scene-floors/sea-deep-floor-v2.webp`;
  const base = textures.resolvePresetTexture(oldSource, textures.BASE_TEXTURE_PRESET, null);
  const bastion = textures.resolvePresetTexture(oldSource, textures.BASTION_TEXTURE_PRESET, null);
  assert.equal(base, `${ROOT}scene-floors/sea-deep-floor-v5.webp`);
  assert.equal(
    bastion,
    `${ROOT}presets/bastion-blasphemy/scene-floors/sea-deep-floor-bastion-v6.webp`,
  );
  for (const source of [base, bastion]) {
    assert.equal(fs.existsSync(source.replace("modules/ts-pf2e-utility/", "")), true, source);
  }
});

test("migrates removed grass stone assets to existing rubble variants", () => {
  const cases = [
    ["scene-floors/grass-scatter-stones-v2.webp", "scene-floors/rubble-cutout-stone-01-v16.webp"],
    ["scene-floors/grass-stone-single-12-v3.webp", "scene-floors/rubble-cutout-stone-12-v16.webp"],
    ["scene-floors/grass-stone-varied-24-v3.webp", "scene-floors/rubble-cutout-stone-12-v16.webp"],
    ["presets/bastion-blasphemy/scene-floors/grass-stone-varied-13-bastion-v3.webp", "scene-floors/rubble-cutout-stone-01-v16.webp"],
  ];
  for (const [legacyPath, logicalPath] of cases) {
    const source = `${ROOT}${legacyPath}`;
    assert.equal(textures.baseTextureRelativePath(source), logicalPath);
    for (const preset of [textures.BASE_TEXTURE_PRESET, textures.BASTION_TEXTURE_PRESET]) {
      const resolved = textures.resolvePresetTexture(source, preset, null);
      assert.equal(fs.existsSync(resolved.replace("modules/ts-pf2e-utility/", "")), true, resolved);
    }
  }
});

test("every retired grass stone version resolves without a missing file", () => {
  for (const [prefix, count] of [["grass-stone-single", 12], ["grass-stone-varied", 24]]) {
    for (let index = 1; index <= count; index += 1) {
      const number = String(index).padStart(2, "0");
      for (const version of [1, 2, 3]) {
        const legacyPaths = [
          `scene-floors/${prefix}-${number}-v${version}.webp`,
          `presets/bastion-blasphemy/scene-floors/${prefix}-${number}-bastion-v${version}.webp`,
        ];
        for (const legacyPath of legacyPaths) {
          const source = `${ROOT}${legacyPath}`;
          for (const preset of [textures.BASE_TEXTURE_PRESET, textures.BASTION_TEXTURE_PRESET]) {
            const resolved = textures.resolvePresetTexture(source, preset, null);
            assert.equal(fs.existsSync(resolved.replace("modules/ts-pf2e-utility/", "")), true, resolved);
          }
        }
      }
    }
  }
});

test("migrates the removed purple grass flower to flower 08", () => {
  for (const version of [1, 2, 3]) {
    const legacyPaths = [
      `scene-floors/grass-flower-single-07-v${version}.webp`,
      `presets/bastion-blasphemy/scene-floors/grass-flower-single-07-bastion-v${version}.webp`,
    ];
    for (const legacyPath of legacyPaths) {
      const source = `${ROOT}${legacyPath}`;
      assert.equal(
        textures.baseTextureRelativePath(source),
        "scene-floors/grass-flower-single-08-v3.webp",
      );
      for (const preset of [textures.BASE_TEXTURE_PRESET, textures.BASTION_TEXTURE_PRESET]) {
        const resolved = textures.resolvePresetTexture(source, preset, null);
        assert.equal(fs.existsSync(resolved.replace("modules/ts-pf2e-utility/", "")), true, resolved);
      }
    }
  }
});

test("every Bastion manifest entry resolves to an existing base and preset file", () => {
  for (const logicalPath of textures.presetTextureManifest(textures.BASTION_TEXTURE_PRESET)) {
    const source = `${ROOT}${logicalPath}`;
    assert.equal(textures.baseTextureRelativePath(source), logicalPath);
    const base = textures.baseTextureSource(source);
    const bastion = textures.resolvePresetTexture(source, textures.BASTION_TEXTURE_PRESET, null);
    assert.equal(bastion.startsWith(`${ROOT}presets/bastion-blasphemy/`), true, bastion);
    for (const resolved of [base, bastion]) {
      assert.equal(fs.existsSync(resolved.replace("modules/ts-pf2e-utility/", "")), true, resolved);
    }
  }
});
