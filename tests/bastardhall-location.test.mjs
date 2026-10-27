import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/campaigns/bastardhall.js', import.meta.url), 'utf8');
const names = ['phantomRank', 'phantomLocationEffect', 'phantomPermanentEffect', 'managedEffects', 'managedEffect', 'syncEffect'];
const context = vm.createContext({ MODULE_ID: 'test', EFFECT_FLAG: 'managed' });
vm.runInContext(names.map(name => source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0]).join('\n'), context);
const data = { phantoms: ['aron', 'esmira', 'ilana', 'shireyl'].map(id => ({ id, found: true, rank: 2 })) };
const item = (key, rules) => ({ id: key, getFlag: () => key, _source: { system: { rules } } });

test('one selector provides all available buildings and preserves bonus predicates', () => {
  const rule = context.phantomLocationEffect(data, { items: [] }).rules[0];
  assert.equal(rule.value, false);
  assert.equal(rule.suboptions.length, 4);
  for (const [index, phantom] of data.phantoms.entries()) {
    const support = context.phantomPermanentEffect(phantom.id, phantom.rank);
    assert.equal(support.rules.some(r => r.key === 'RollOption'), false);
    assert.equal(support.rules[0].predicate[0], `${rule.option}:${rule.suboptions[index].value}`);
  }
  assert.equal(context.phantomLocationEffect({ phantoms: [] }, { items: [] }), null);
});

test('legacy checkbox migrates; selected building and checkbox persist; lost building disables bonuses', () => {
  const actor = { items: [item('phantom-ilana', [{ key: 'RollOption', option: 'bastardhall:location:ilana-workshop', value: true }])] };
  const migrated = context.phantomLocationEffect(data, actor).rules;
  assert.equal(migrated[0].selection, 'ilana-workshop');
  assert.equal(migrated[0].value, true);
  actor.items.push(item('phantom-location', migrated));
  assert.deepEqual(context.phantomLocationEffect(data, actor).rules, migrated);
  migrated[0].value = false;
  assert.equal(context.phantomLocationEffect(data, actor).rules[0].value, false);
  migrated[0].value = true;
  const reduced = { phantoms: data.phantoms.filter(p => p.id !== 'ilana') };
  const changed = context.phantomLocationEffect(reduced, actor).rules[0];
  assert.equal(changed.value, false);
  assert.equal(changed.suboptions.length, 3);
});

test('location effect activates idempotently and is removed on cleanup', async () => {
  let creates = 0;
  const effect = context.phantomLocationEffect(data, { items: [] });
  const src = { ...effect, system: { rules: effect.rules, description: { value: effect.description }, tokenIcon: { show: false } } };
  const actor = {
    items: [],
    async createEmbeddedDocuments(_type, sources) {
      creates++;
      this.items.push({ ...sources[0], ...item('phantom-location', sources[0].system.rules), _source: sources[0], update() { assert.fail('Unchanged effect updated'); } });
    },
    async deleteEmbeddedDocuments(_type, ids) { this.items = this.items.filter(i => !ids.includes(i.id)); },
  };
  await context.syncEffect(actor, 'phantom-location', true, () => src);
  await context.syncEffect(actor, 'phantom-location', true, () => src);
  assert.equal(creates, 1);
  await context.syncEffect(actor, 'phantom-location', false, () => null);
  assert.equal(actor.items.length, 0);
});
