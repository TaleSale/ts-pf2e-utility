import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const MODULE = 'ts-pf2e-utility';
function harness() {
  const hooks = new Map(), docs = new Map(), warnings = [], rolls = [], errors = [];
  const collection = (values = []) => Object.defineProperty(Object.assign(values, { get(id) { return this.find(value => value.id === id); } }), 'contents', { get() { return this; } });
  const emit = (event, ...args) => (hooks.get(event) ?? []).map(fn => fn(...args));
  let serial = 0, enabled = true, rollCount = 0;
  const data = { phobias: [] };
  function flaggable(object) {
    object.flags ??= {};
    return Object.assign(object, {
      getFlag(module, key) { return this.flags[module]?.[key]; },
      async setFlag(module, key, value) { (this.flags[module] ??= {})[key] = structuredClone(value); },
      async unsetFlag(module, key) { delete this.flags[module]?.[key]; },
    });
  }
  function apply(object, change) {
    for (const [path, value] of Object.entries(change)) {
      const keys = path.split('.'), last = keys.pop(); let target = object;
      for (const key of keys) target = target[key] ??= {};
      target[last] = value;
    }
  }
  function actor(id, name = id, type = 'character') {
    const result = flaggable({ id, uuid: `Actor.${id}`, name, type, items: collection(), attributes: { immunities: [], resistances: [], weaknesses: [] },
      isOwner: true, isImmuneTo: () => false, isAffectedBy: () => true,
      isEnemyOf(other) { return this.type !== other?.type; }, isAllyOf(other) { return this.type === other?.type; },
      testUserPermission: () => true,
      getCondition(slug) { return this.items.filter(item => item.system.slug === slug).sort((a, b) => b.value - a.value)[0]; },
      async createEmbeddedDocuments(_type, sources) {
        for (const source of sources) {
          const item = flaggable({ ...structuredClone(source), id: `item${++serial}`, parent: this,
            get slug() { return this.system.slug; }, get value() { return this.system.value?.value; },
            async update(change) { apply(this, change); emit('updateItem', this, change, {}); },
          });
          this.items.push(item); emit('createItem', item, {});
        }
      },
      async deleteEmbeddedDocuments(_type, ids) {
        const removed = this.items.filter(item => ids.includes(item.id));
        this.items = collection(this.items.filter(item => !ids.includes(item.id)));
        for (const item of removed) emit('deleteItem', item, {});
      },
      saves: { will: { check: { roll: async () => { rollCount++; return { degreeOfSuccess: rolls.shift() ?? 2 }; } } } },
    });
    docs.set(result.uuid, result); return result;
  }
  const hero = actor('hero'), ally = actor('ally'), spider = actor('gN7Ma8swV60FX7wf', 'Анофилекс', 'npc'), monster = actor('monster', 'Вольдрак', 'npc');
  const actors = collection([hero, ally, spider, monster]);
  const users = collection([{ id: 'gm', isGM: true, active: true, targets: new Set() }, { id: 'player', active: true, isGM: false }]);
  const messages = collection(), combats = collection();
  function message(flags = {}, extra = {}) {
    const result = flaggable({ id: `message${++serial}`, flags, actor: ally, content: '', ...extra });
    result.updateSource = change => apply(result, change);
    messages.push(result); return result;
  }
  const context = vm.createContext({ MODULE_ID: MODULE, SOCKET_CHANNEL: `module.${MODULE}`, escapeHtml: value => String(value),
    console: { error: (...args) => errors.push(args), warn() {} }, setTimeout() {},
    Hooks: { on(event, fn) { hooks.set(event, [...hooks.get(event) ?? [], fn]); } },
    foundry: { utils: { randomID: () => `id${++serial}` } },
    registerCheckRollWrapper: (_key, fn) => { context.checkWrapper = fn; },
    CONFIG: { PF2E: { damageTypes: { fire: 'fire' }, Actor: { documentClasses: { character: class {
      async applyDamage(params) {
        const msg = message({pf2e:{context:{type:'damage-taken',options:[...params.rollOptions ?? []]},appliedDamage:{uuid:this.uuid,updates:[{path:'system.attributes.hp.value',value:4}]}}});
        emit('preCreateChatMessage',msg); emit('createChatMessage',msg); return this;
      }
    } } } } },
    game: { user: users[0], actors, combats, users, messages, settings: { get: () => enabled },
      i18n: { localize: value => value }, socket: { on(_channel, fn) { context.socketReceiver = fn; }, emit() {} },
      pf2e: { settings: { iwr: true }, ConditionManager: { getCondition: slug => ({ toObject: () => ({ type: 'condition', name: slug, system: { slug, value: { value: 1 } }, flags: {} }) }) } },
    },
    canvas: { ready: true, tokens: { placeables: [] }, effects: { getDarknessLevel: () => .9, lightSources: new Map() } },
    fromUuid: async uuid => docs.get(uuid), fromUuidSync: uuid => docs.get(uuid),
    ui: { notifications: { warn: value => warnings.push(value) } },
    ChatMessage: { getSpeaker: ({ actor }) => ({ actor: actor.id }), create: async source => { const result = message(source.flags, source); emit('createChatMessage', result); return result; } },
    document: { createElement: () => ({ innerHTML: '', querySelector: () => null }) },
  });
  const source = readFileSync(new URL('../scripts/campaigns/bastardhall-phobias.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(source + '\nthis.api = {PHOBIA_PRESETS,presetPhobia,presetRules,isSpider,isMonster,tokenLightPenalty,phobiaEnvironment,ensurePhobiaCondition,cleanupPhobiaConditions,processPhobiaCombat,processPhobiaMessage,hasAppliedFire,fireDamageReceived,installPhobiaRuntime,invalidatePhobiaRuntime,requestPhobiaConsent}; this.flush = async () => { for(let i=0;i<12;i++) await queue; }; this.reconcile = reconcileRuntime;', context);
  context.api.installPhobiaRuntime({ getData: () => data, isPrimaryGM: () => context.game.user.id === 'gm', queueReconcile: async () => {} });
  const add = (id, target = hero) => { const entry = context.api.presetPhobia(id, target.uuid); data.phobias.push(entry); context.api.invalidatePhobiaRuntime(); return entry; };
  const combat = () => {
    const result = flaggable({ id: `combat${++serial}`, started: true, combatants: collection([{ actor: hero }, { actor: monster }]) });
    combats.push(result); return result;
  };
  return { context, api: context.api, hero, ally, spider, monster, add, data, combat, message, emit, errors, warnings, rolls, get rollCount() { return rollCount; }, flush: context.flush, disable: () => { enabled = false; } };
}

test('nine distinct presets and valid standard rule shapes; swim only and Aid/flanking blocked', () => {
  const h = harness();
  assert.equal(h.api.PHOBIA_PRESETS.length, 9);
  assert.equal(new Set(h.api.PHOBIA_PRESETS.map(e => e.id)).size, 9);
  const swim = h.api.presetRules(h.add('thalassophobia'))[0];
  assert.equal(swim.value, -2); assert.equal(swim.type, 'status'); assert.equal(swim.selector, 'athletics'); assert.equal(swim.predicate[0], 'action:swim');
  const betrayal = h.api.presetRules(h.add('proditiophobia'));
  assert.equal(betrayal[0].path, 'system.attributes.flanking.canFlank'); assert.equal(betrayal[0].value, false);
  assert.equal(betrayal[1].suppress, true);
});

test('lighting uses real light sources, respects walls and produces one status Will penalty', () => {
  const h = harness(), token = { center: { x: 10, y: 10 }, document: { elevation: 0 } };
  assert.equal(h.api.tokenLightPenalty(token), 2);
  const globalLight = { active: true, testPoint: () => true, data: { bright: 0 }, constructor: { sourceType: 'GlobalLight' } };
  h.context.canvas.effects.lightSources.set('global', globalLight);
  assert.equal(h.api.tokenLightPenalty(token), 2, 'global illumination must not turn darkness into dim light');
  h.context.canvas.effects.lightSources.set('dim', { active: true, testPoint: () => true, data: { bright: 0 }, x: 10, y: 10 });
  assert.equal(h.api.tokenLightPenalty(token), 1);
  h.context.canvas.effects.lightSources.set('bright', { active: true, testPoint: () => true, data: { bright: 30 }, x: 0, y: 0 });
  assert.equal(h.api.tokenLightPenalty(token), 0);
  h.context.canvas.effects.lightSources.get('bright').testPoint = () => false;
  assert.equal(h.api.tokenLightPenalty(token), 1);
  const entry = h.add('nyctophobia');
  assert.equal(h.api.presetRules(entry, { light: 2 })[0].value, -2);
  assert.equal(h.api.presetRules(entry, { light: 2 })[0].type, 'status');
  assert.equal(h.api.presetRules(entry, { light: 1 }).length, 1);
  assert.equal(h.api.presetRules(entry, { light: 0 }).length, 0);
  h.context.canvas.effects.testInsideDarkness = () => true;
  assert.equal(h.api.tokenLightPenalty(token), 2, 'darkness source overrides ambient illumination');
});

test('agoraphobia toggle and spider combat grant only temporary in-memory off-guard', () => {
  const h = harness(), open = h.add('agoraphobia'), spiders = h.add('arachnophobia');
  assert.equal(h.api.presetRules(open)[0].key, 'RollOption');
  assert.equal(h.api.presetRules(open)[0].value, false);
  open.outdoors = true;
  assert.equal(h.api.presetRules(open)[0].value, true);
  assert.equal(h.api.presetRules(open, { outdoors: false })[0].value, false);
  assert.equal(h.api.presetRules(open)[1].inMemoryOnly, true);
  assert.equal(h.api.presetRules(open)[1].predicate[0], h.api.presetRules(open)[0].option);
  assert.equal(h.api.presetRules(spiders, { spiders: true })[0].uuid, 'Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg');
  const combat = h.combat(); combat.combatants.push({ actor: h.spider });
  assert.equal(h.api.phobiaEnvironment(h.hero).spiders, true);
  combat.started = false;
  assert.equal(h.api.phobiaEnvironment(h.hero).spiders, false);
  assert.equal(h.api.isSpider({ name: 'Gogiteth' }), true);
  assert.equal(h.api.isSpider({ id: 'zEQf2FhTJ1kpbBjo', name: 'Переименован' }), true);
  assert.equal(h.api.isMonster({ name: 'Zaurgaulus' }), true);
});

test('Swim check repairs missing action modifiers once and respects existing native rules', async () => {
  const h = harness(), entry = h.add('thalassophobia');
  h.context.game.pf2e.Modifier = class { constructor(data) { Object.assign(this, data); } };
  const check = { modifiers: [], push(modifier) { this.modifiers.push(modifier); }, calculateTotal() {} };
  const wrapped = async () => {};
  const context = { actor: h.hero, options: new Set(['action:swim']) };
  await h.context.checkWrapper(wrapped, check, context);
  await h.context.checkWrapper(wrapped, check, context);
  assert.equal(check.modifiers.length, 1);
  assert.equal(check.modifiers[0].modifier, -2);
  assert.equal(check.modifiers[0].type, 'status');
  check.modifiers = [{ rule: { item: { getFlag: () => `phobia:${entry.id}` } } }];
  await h.context.checkWrapper(wrapped, check, context);
  assert.equal(check.modifiers.length, 1);
  check.modifiers = [];
  await h.context.checkWrapper(wrapped, check, { ...context, options: new Set(['action:climb']) });
  assert.equal(check.modifiers.length, 0);
});

test('token names match partial bilingual creature names in encounters and critical Strikes', async () => {
  const h = harness(); h.add('arachnophobia'); h.add('teraphobia');
  h.monster.name = 'Безымянное существо';
  const combat = h.combat();
  combat.combatants[1].token = { name: 'Элитный Заургалус / Zaurgaulus 2' };
  await h.api.processPhobiaCombat(combat);
  await h.api.processPhobiaCombat(combat);
  assert.equal(h.rollCount, 1);
  combat.combatants[1].token.name = 'Гогитэт / Gogiteth (Bastion of Blasphemies)';
  assert.equal(h.api.phobiaEnvironment(h.hero).spiders, true);
  const critical = h.message({ pf2e: { context: { type: 'attack-roll', target: { actor: h.hero.uuid }, options: ['action:strike'] } } },
    { actor: h.monster, token: combat.combatants[1].token, rolls: [{ degreeOfSuccess: 3 }] });
  await h.api.processPhobiaMessage(critical);
  await h.api.processPhobiaMessage(critical);
  assert.equal(h.hero.getCondition('slowed')?.value, 1);
  assert.equal(h.hero.items.filter(item => item.slug === 'slowed').length, 1);
  combat.combatants[1].isDefeated = true;
  assert.equal(h.api.phobiaEnvironment(h.hero).spiders, false);
});

test('failed web saves slow the saving character once; successful saves do not', async () => {
  const h = harness(); h.add('arachnophobia');
  const save = outcome => h.message({ pf2e: { context: { type: 'saving-throw', outcome } } },
    { actor: h.hero, item: { name: 'Паутина', slug: 'web' } });
  await h.api.processPhobiaMessage(save('success'));
  assert.equal(h.hero.items.length, 0);
  const failure = save('failure');
  await h.api.processPhobiaMessage(failure);
  await h.api.processPhobiaMessage(failure);
  assert.equal(h.hero.getCondition('slowed')?.value, 1);
  assert.equal(h.hero.items.length, 1);
});

test('same trigger cannot stack conditions, never lowers existing higher value, and cleans only owned effects', async () => {
  const h = harness(), entry = h.add('pyrophobia');
  await Promise.all(Array.from({length: 5}, () => h.api.ensurePhobiaCondition(h.hero, entry, 'frightened', 1)));
  await h.flush(); assert.equal(h.hero.items.length, 1);
  h.hero.items[0].system.value.value = 3;
  await h.api.ensurePhobiaCondition(h.hero, entry, 'frightened', 1);
  assert.equal(h.hero.items[0].value, 3);
  await h.hero.createEmbeddedDocuments('Item', [{type:'condition',system:{slug:'sickened',value:{value:2}}}]);
  h.data.phobias = []; h.api.invalidatePhobiaRuntime();
  await h.api.cleanupPhobiaConditions(h.data, true);
  assert.equal(h.hero.items.length, 1); assert.equal(h.hero.items[0].slug, 'sickened');
});

test('off-guard transition triggers frightened once, persists its latch, and rearms after removal', async () => {
  const h = harness(); h.add('enochlophobia');
  await h.hero.createEmbeddedDocuments('Item', [{type:'condition',system:{slug:'off-guard',value:{value:1}}}]);
  await h.flush();
  assert.equal(h.hero.getCondition('frightened').value, 1);
  const off = h.hero.getCondition('off-guard');
  await h.hero.deleteEmbeddedDocuments('Item', [h.hero.getCondition('frightened').id]); await h.flush();
  h.emit('updateActor', h.hero); await h.flush();
  assert.equal(h.hero.getCondition('frightened'), undefined);
  assert.equal(h.hero.getFlag(MODULE, 'bastardhallPhobiaOffGuard').active, true);
  await h.hero.deleteEmbeddedDocuments('Item', [off.id]); await h.flush();
  await h.hero.createEmbeddedDocuments('Item', [{type:'condition',system:{slug:'off-guard',value:{value:1}}}]); await h.flush();
  assert.equal(h.hero.getCondition('frightened').value, 1);
});

test('bleeding and critical hit trigger sickened, spider critical Strike and web trigger slowed', async () => {
  const h = harness(); h.add('hemophobia'); h.add('arachnophobia');
  await h.hero.createEmbeddedDocuments('Item', [{type:'condition',system:{slug:'persistent-damage',persistent:{damageType:'bleed'},value:{value:1}}}]); await h.flush();
  assert.equal(h.hero.getCondition('sickened').value, 1);
  const message = h.message({ pf2e: { context: { type:'attack-roll',outcome:'criticalSuccess',target:{actor:h.hero.uuid},options:['action:strike'] } } }, { actor:h.spider });
  await h.api.processPhobiaMessage(message); await h.api.processPhobiaMessage(message); await h.flush();
  assert.equal(h.hero.items.filter(i=>i.slug==='slowed').length, 1);
  await h.hero.createEmbeddedDocuments('Item', [{type:'effect',name:'Паутина',system:{slug:'effect-web'}}]); await h.flush();
  assert.equal(h.hero.items.filter(i=>i.slug==='slowed').length, 1);
});

test('teraphobia rolls once per combat, applies failure/critical failure and removes only combat-owned conditions', async () => {
  const h = harness(); h.add('teraphobia'); const combat = h.combat(); h.rolls.push(0);
  await h.api.processPhobiaCombat(combat); await h.api.processPhobiaCombat(combat); await h.flush();
  assert.equal(h.rollCount, 1);
  assert.equal(h.hero.getCondition('stunned').value, 3); assert.equal(h.hero.getCondition('slowed').value, 1);
  combat.started = false; await h.api.cleanupPhobiaConditions(h.data, true);
  assert.equal(h.hero.items.length, 0);
  const next = h.combat(); h.rolls.push(1); await h.api.processPhobiaCombat(next); await h.flush();
  assert.equal(h.rollCount, 2); assert.equal(h.hero.getCondition('stunned'), undefined); assert.equal(h.hero.getCondition('slowed').value, 1);
  await h.api.cleanupPhobiaConditions(h.data, false); assert.equal(h.hero.items.length, 0);
});

test('teraphobia ignores unrelated foes and rolls once when specified monster joins later', async () => {
  const h = harness(); h.add('teraphobia'); const combat = h.combat(); combat.combatants.pop();
  await h.api.processPhobiaCombat(combat); assert.equal(h.rollCount, 0);
  combat.combatants.push({actor:h.monster}); await h.api.processPhobiaCombat(combat); await h.api.processPhobiaCombat(combat);
  assert.equal(h.rollCount, 1); assert.equal(h.hero.items.length, 0);
});

test('pyrophobia requires actual received fire, accounts for immunity/resistance and evaluated persistent damage', async () => {
  const h = harness(); h.add('pyrophobia');
  const roll = { instances:[{type:'fire',total:5,formalDescription:['damage:type:fire'],options:{}}] };
  assert.equal(h.api.hasAppliedFire(h.hero,roll), true);
  h.hero.attributes.immunities = [{type:'fire',test:()=>true}]; assert.equal(h.api.hasAppliedFire(h.hero,roll), false);
  h.hero.attributes.immunities = []; h.hero.attributes.resistances = [{type:'all-damage',value:5,test:()=>true}]; assert.equal(h.api.hasAppliedFire(h.hero,roll), false);
  h.hero.attributes.resistances = []; roll.instances[0].persistent = true; assert.equal(h.api.hasAppliedFire(h.hero,roll), false);
  roll.instances[0].options.evaluatePersistent = true; assert.equal(h.api.hasAppliedFire(h.hero,roll), true);
  const damage = h.message({ pf2e:{context:{type:'damage-taken'},appliedDamage:{uuid:h.hero.uuid,updates:[{path:'system.attributes.hp.value',value:4}]}}, [MODULE]:{phobiaDamage:{fire:true}} });
  await h.api.processPhobiaMessage(damage); await h.api.processPhobiaMessage(damage); await h.flush();
  assert.equal(h.hero.items.filter(i=>i.slug==='frightened').length, 1);
  damage.flags.pf2e.appliedDamage.isReverted = true; assert.equal(h.api.fireDamageReceived(damage), false);
});

test('prodition consent uses snapshotted targets and one authenticated roll per button, Aid is blocked', async () => {
  const h = harness(); h.add('proditiophobia');
  const source = h.message({pf2e:{context:{type:'skill-check'}},[MODULE]:{phobiaTargets:[h.hero.uuid]}});
  await h.api.processPhobiaMessage(source); await h.api.processPhobiaMessage(source); await h.flush();
  const prompts = h.context.game.messages.filter(m=>m.getFlag(MODULE,'phobiaConsent'));
  assert.equal(prompts.length,1); assert.ok(prompts[0].content.includes('Воли КС 26'));
  h.context.socketReceiver({type:'bastardhall-phobia-consent',messageId:prompts[0].id,senderId:'player'});
  h.context.socketReceiver({type:'bastardhall-phobia-consent',messageId:prompts[0].id,senderId:'player'});
  await h.flush(); assert.equal(h.rollCount,1); assert.equal(prompts[0].getFlag(MODULE,'phobiaConsent').state,'success');
  let calls = 0;
  await h.context.checkWrapper(()=>{calls++;}, {}, {options:new Set(['action:aid:athletics']),target:{actor:h.hero}});
  assert.equal(calls,0); assert.equal(h.warnings.length,1);
  assert.ok(h.emit('preCreateItem',{parent:h.hero,type:'effect',slug:'effect-aid'}).includes(false));
  assert.deepEqual(h.errors,[]);
});

test('non-primary clients and disabled feature never mutate actors', async () => {
  const h = harness(), entry = h.add('pyrophobia'); h.context.game.user = h.context.game.users[1];
  await h.api.ensurePhobiaCondition(h.hero,entry,'frightened',1); assert.equal(h.hero.items.length,0);
  h.context.game.user = h.context.game.users[0]; h.disable();
  await h.api.ensurePhobiaCondition(h.hero,entry,'frightened',1); assert.equal(h.hero.items.length,0);
});

test('actual applyDamage observer transports per-application fire metadata through native chat hooks', async () => {
  const h = harness(); h.add('pyrophobia');
  const originalOptions = new Set(['item:trait:fire']);
  await h.context.CONFIG.PF2E.Actor.documentClasses.character.prototype.applyDamage.call(h.hero, {damage:{instances:[{type:'fire',total:8,formalDescription:['damage:type:fire'],options:{}}]},rollOptions:originalOptions});
  await h.flush();
  assert.equal(h.hero.getCondition('frightened').value,1);
  assert.equal(originalOptions.size,1);
  assert.equal(h.context.game.messages.at(-1).getFlag(MODULE,'phobiaDamage').fire,true);
  assert.deepEqual(h.errors,[]);
});
