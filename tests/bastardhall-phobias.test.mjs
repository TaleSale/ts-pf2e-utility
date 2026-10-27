import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { PHOBIA_PRESETS, presetRules, presetPhobia } from '../scripts/campaigns/bastardhall-phobias.js';

function harness() {
  const source = readFileSync(new URL('../scripts/campaigns/bastardhall.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from [^;]+;\s*/gm, '').replace(/^export /gm, '');
  const merge = (base, incoming) => {
    for (const [key, value] of Object.entries(incoming)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) merge(base[key], value);
      else base[key] = structuredClone(value);
    }
    return base;
  };
  let serial = 0, stored;
  const hero = { type: 'character', uuid: 'Actor.hero', name: 'Герой' };
  const effect = { documentName: 'Item', uuid: 'Item.phobia', type: 'effect', name: 'Страх высоты', system: { description: { value: '<p>Штраф −2</p>' } } };
  class Element { constructor(target) { this.target = target; } closest() { return this.target; } }
  const context = vm.createContext({
    PHOBIA_PRESETS, presetRules, presetPhobia, phobiaEnvironment: () => ({}), cleanupPhobiaConditions: async () => {},
    MODULE_ID: 'test', SOCKET_CHANNEL: 'test', BASTION_TEXTURE_PRESET: 'test', TEXTURE_PRESET_FLAG: 'test', escapeHtml: value => String(value),
    Hooks: { on() {}, once() {} }, FormApplication: class {}, Element,
    foundry: { utils: { deepClone: structuredClone, mergeObject: merge, randomID: () => `id-${++serial}` } },
    game: { user: { id: 'gm', isGM: true }, users: { activeGM: { id: 'gm' } }, actors: { party: { members: [hero] }, contents: [hero] },
      settings: { get: () => stored, set: async (_module, _key, value) => { stored = value; } } },
    ui: { notifications: { warn() {} } }, TextEditor: { getDragEventData: () => ({ uuid: effect.uuid }) },
    fromUuid: async () => effect, console,
  });
  vm.runInContext('Math.clamp = (n, min, max) => Math.min(max, Math.max(min, n));', context);
  vm.runInContext(source + '\nthis.api = { createDefaultData, normalizeData, phobiaCharacters, BastardhallSheet, hydratePhobiaEffects, reconcilePhobiaEffects };', context);
  stored = context.api.createDefaultData();
  const drop = () => new context.api.BastardhallSheet()._onDrop({ preventDefault() {}, target: new Element({ dataset: { dropKind: 'phobia', actorUuid: hero.uuid } }) });
  return { context, api: context.api, get stored() { return stored; }, drop, effect };
}

test('old worlds, indexed arrays, custom descriptions, and fresh/reset defaults', () => {
  const { api } = harness();
  const old = api.normalizeData({ version: 27, collections: { arts: 9 } });
  assert.equal(old.version, 30);
  assert.equal(old.phobias.length, 0);
  assert.equal(old.collections.arts, 9);
  const migrated = api.normalizeData({ version: 27, phobias: { 0: { id: 'custom', actorUuid: 'Actor.hero', description: '<p>Свой штраф</p>' }, 1: null } });
  assert.equal(migrated.phobias.length, 1);
  assert.equal(migrated.phobias[0].description, '<p>Свой штраф</p>');
  assert.equal(api.normalizeData(migrated).phobias[0].id, 'custom');
  assert.equal(api.normalizeData(api.createDefaultData()).phobias.length, 0);
});

test('phobia effects apply rules, remain idempotent, update descriptions and clean up without touching other effects', async () => {
  const h = harness();
  const hero = h.context.game.actors.contents[0];
  let creates = 0, updates = 0;
  hero.items = [{ id: 'unrelated', getFlag: () => undefined }];
  hero.createEmbeddedDocuments = async (_type, sources) => {
    for (const source of sources) {
      creates++;
      hero.items.push({ ...structuredClone(source), id: `effect-${creates}`, _source: structuredClone(source),
        getFlag: () => source.flags.test.bastardhallEffect,
        async update(change) {
          updates++;
          this.name = change.name; this.img = change.img;
          this._source.system.description.value = change['system.description.value'];
          this._source.system.rules = change['system.rules'];
          this._source.system.tokenIcon.show = false;
        },
      });
    }
  };
  hero.deleteEmbeddedDocuments = async (_type, ids) => { hero.items = hero.items.filter(item => !ids.includes(item.id)); };
  h.effect.system.rules = [{ key: 'FlatModifier', selector: 'will', value: -2, type: 'status' }];
  h.effect.system.badge = { type: 'counter', value: 2 };
  await h.drop();
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(creates, 1);
  assert.equal(hero.items[1]._source.system.rules[0].value, -2);
  assert.equal(hero.items[1]._source.system.badge.value, 2);
  assert.equal(hero.items[1]._source.system.duration.unit, 'unlimited');
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(creates, 1); assert.equal(updates, 0);
  h.stored.phobias[0].description = '<p>Правка мастера</p>';
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(updates, 1);
  assert.equal(hero.items[1]._source.system.description.value, '<p>Правка мастера</p>');
  h.stored.phobias[0].presetId = 'agoraphobia';
  h.stored.phobias[0].outdoors = true;
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(hero.items[1]._source.system.rules[0].value, true, 'migrate the previous campaign checkbox');
  hero.items[1]._source.system.rules[0].value = false;
  const beforeToggleReconcile = updates;
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(hero.items[1]._source.system.rules[0].value, false, 'preserve the actor checkbox over legacy campaign state');
  assert.equal(updates, beforeToggleReconcile, 'actor toggle must not cause effect rewrites');
  await h.api.reconcilePhobiaEffects(h.stored, false);
  assert.equal(hero.items.length, 1);
  await h.api.reconcilePhobiaEffects(h.stored, true);
  assert.equal(creates, 2);
  await h.api.reconcilePhobiaEffects(h.api.createDefaultData(), true);
  assert.equal(hero.items.length, 1);
  assert.equal(hero.items[0].id, 'unrelated');
});

test('legacy phobias resolve source rules while preserving GM description', async () => {
  const h = harness();
  const data = h.api.normalizeData({ version: 28, phobias: [{ id: 'legacy', actorUuid: 'Actor.hero', sourceUuid: h.effect.uuid, description: 'Ручное описание' }] });
  assert.equal(data.phobias[0].effectSystem, null);
  h.effect.system.rules = [{ key: 'FlatModifier', selector: 'perception', value: -1 }];
  await h.api.hydratePhobiaEffects(data);
  assert.equal(h.stored.phobias[0].description, 'Ручное описание');
  assert.equal(h.stored.phobias[0].effectSystem.rules[0].value, -1);
});

test('effect drops copy description, reject duplicates and non-effects, and enforce primary GM', async () => {
  const h = harness();
  await h.drop();
  assert.equal(h.stored.phobias.length, 1);
  assert.equal(h.stored.phobias[0].description, '<p>Штраф −2</p>');
  h.stored.phobias[0].description = 'Правка мастера';
  await h.drop();
  assert.equal(h.stored.phobias.length, 1);
  assert.equal(h.stored.phobias[0].description, 'Правка мастера');
  h.effect.uuid = 'Item.other'; h.effect.type = 'weapon';
  await h.drop();
  assert.equal(h.stored.phobias.length, 1);
  h.effect.type = 'effect'; h.context.game.user.isGM = false;
  await h.drop();
  assert.equal(h.stored.phobias.length, 1);
  h.context.game.user.isGM = true; h.context.game.users.activeGM.id = 'another-gm';
  await h.drop();
  assert.equal(h.stored.phobias.length, 1);
  assert.equal(h.stored.inventory.length, 0);
});

test('roster uses active party, filters NPCs, and preserves absent characters’ records', () => {
  const h = harness();
  h.context.game.actors.party.members.push({ type: 'npc', uuid: 'Actor.npc' });
  assert.equal(h.api.phobiaCharacters().length, 1);
  const data = h.api.normalizeData({ version: 28, phobias: [{ id: 'old', actorUuid: 'Actor.absent', name: 'Фобия' }] });
  assert.equal(data.phobias.length, 1);
  h.context.game.actors.party.members = [];
  assert.equal(h.api.phobiaCharacters().length, 0);
});
