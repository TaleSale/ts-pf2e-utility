import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativePF2eChecks } from './helpers/pf2e-check-harness.mjs';
const ID='ts-pf2e-utility', hooks=new Map(), docs=new Map(), messages=[], errors=[];
const collection=(list=[])=>Object.assign(list,{get(id){return this.find(e=>e.id===id);}});
function emit(name,...args){let okay=true;for(const fn of [...(hooks.get(name)??[])])if(fn(...args)===false)okay=false;return okay;}
globalThis.Hooks={on(name,fn){hooks.set(name,[...(hooks.get(name)??[]),fn]);return fn;},once(name,fn){return this.on(name,fn);},off(name,id){hooks.set(name,(hooks.get(name)??[]).filter(f=>f!==id));},callAll:emit};
const drain=()=>new Promise(resolve=>setImmediate(resolve));
function get(o,p){return o?.[p]??p.split('.').reduce((v,k)=>v?.[k],o);}
function set(o,p,v){const keys=p.split('.'),last=keys.pop();for(const k of keys)o=o[k]??={};if(last.startsWith('-='))delete o[last.slice(2)];else o[last]=v;return true;}
let serial=0;
globalThis.foundry={utils:{getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined,randomID:()=>String(++serial)},applications:{api:{ApplicationV2:class{},DialogV2:{wait:async()=>null}}}};
function flagged(doc){return Object.assign(doc,{flags:{},getFlag(m,k){return this.flags[m]?.[k];},async setFlag(m,k,v){(this.flags[m]??={})[k]=structuredClone(v);},async unsetFlag(m,k){delete this.flags[m]?.[k];}});}
function actor(id){const a=flagged({id,uuid:'Actor.'+id,name:id,type:'character',items:collection(),isOwner:true,
 isOfType(...types){return types.includes(this.type)||types.includes('creature');},isAllyOf(o){return o.type===this.type;},isEnemyOf(o){return o.type!==this.type;},getResource:()=>null,testUserPermission:()=>true,
 getCondition(slug){return [...this.items].filter(i=>i.type==='condition'&&i.slug===slug).sort((a,b)=>b.value-a.value)[0]??null;},
 async createEmbeddedDocuments(_type,sources,options={}){const created=[];for(const source of sources){const item=flagged({...structuredClone(source),id:String(++serial),parent:this,
 get slug(){return this.system.slug;},get value(){return this.system.value?.value;},updateSource(change){for(const[p,v]of Object.entries(change))set(this,p,v);},
 async update(change,options={}){emit('preUpdateItem',this,change,options);this.updateSource(change);emit('updateItem',this,change,options);},
 });item.flags=structuredClone(source.flags??{});emit('preCreateItem',item,source,options);this.items.push(item);created.push(item);emit('createItem',item,options);}return created;},
 async updateEmbeddedDocuments(_type,changes,options={}){for(const change of changes)await this.items.get(change._id)?.update(change,options);},
 async deleteEmbeddedDocuments(_type,ids,options={}){for(const id of ids){const item=this.items.get(id);if(item&&emit('preDeleteItem',item,options)){this.items.splice(this.items.indexOf(item),1);emit('deleteItem',item,options);}}},
 });docs.set(a.uuid,a);return a;}
const hero=actor('hero'),absent=actor('absent'),bystander=actor('bystander'),enemy=actor('enemy');enemy.type='npc';
const scene=flagged({id:'scene',active:true,grid:{size:100},levels:collection(),tokens:collection()});
const token={id:'token',uuid:'Scene.scene.Token.token',parent:scene,actor:hero,x:0,y:0,width:1,height:1,level:null};scene.tokens.push(token);
const party=flagged({id:'party',uuid:'Actor.party',type:'party',members:[hero,absent]});
const settings=new Map(),values=new Map(),user={id:'gm',isGM:true,active:true,viewedScene:scene.id,settings:{showCheckDialogs:false}};
globalThis.ui={notifications:{error:m=>errors.push(m),warn(){},info(){}}};
globalThis.game={user,userId:user.id,users:Object.assign(collection([user]),{activeGM:user}),time:{worldTime:0,async advance(value){this.worldTime+=value;emit('updateWorldTime');}},
 actors:Object.assign(collection([hero,absent,bystander,enemy]),{party}),scenes:collection([scene]),combats:collection(),tables:collection(),socket:{on(_channel,fn){this.receive=fn;}},
 i18n:{lang:'ru',format:(key,data={})=>key+JSON.stringify(data)},
 settings:{register(_m,key,config){settings.set(key,config);values.set(key,config.default);},registerMenu(_m,key,config){settings.set(key,config);},get(_m,key){return values.get(key);},async set(_m,key,v){values.set(key,v);settings.get(key)?.onChange?.(v);}},
 pf2e:{settings:{metagame:{secretChecks:true,breakdowns:true},variants:{pwol:{enabled:false}}},ConditionManager:{getCondition(){return{toObject:()=>({name:'Страх',type:'condition',img:'systems/pf2e/icons/conditions/frightened.webp',system:{slug:'frightened',value:{value:1,isValued:true},rules:[{key:'FlatModifier',selector:'all',type:'status',value:'-@item.badge.value'}]}})};}}}};
globalThis.canvas={scene,tokens:{placeables:[]}};
globalThis.fromUuid=async id=>docs.get(id);globalThis.fromUuidSync=id=>docs.get(id);
const native=loadNativePF2eChecks({emit,messages});Object.assign(game.pf2e,{Check:native.Check,Predicate:native.Predicate});
const registrations=new Set();
if(!process.env.TSU_TEST_NO_LIBWRAPPER)globalThis.libWrapper={register(module,path,wrapper,type){assert.equal(type,'WRAPPER');assert.ok(!registrations.has(path));registrations.add(path);const key=path.split('.').at(-1),original=game.pf2e.Check[key];game.pf2e.Check[key]=function(...args){return wrapper.call(this,original.bind(this),...args);};}};
await import('../scripts/utility/obstructing-forest.js');
const horror=await import('../scripts/utility/horror-mode.js');emit('init');emit('ready');await drain();
const fear=async(a,value)=>{const item=a.getCondition('frightened');if(item)await item.update({'system.value.value':value},{tsuHorrorWrite:true});else{const data=game.pf2e.ConditionManager.getCondition('frightened').toObject();data.system.value.value=value;await a.createEmbeddedDocuments('Item',[data],{tsuHorrorWrite:true});}};
const dreadItem=a=>a.items.find(i=>i.type==='effect'&&i.getFlag(ID,'horrorDread'));
const dread=async(a,value)=>{await a.setFlag(ID,'horrorMode',{...a.getFlag(ID,'horrorMode'),value,counterVersion:2});const item=dreadItem(a);if(item)await item.update({'system.badge.value':value},{tsuHorrorWrite:true});};
async function check(die,{actor=hero,target=null,modifier=20,dc=15,type='skill-check',...extra}={}){
 native.dice.push(...(Array.isArray(die)?die:[die]));let callback;
 const context={actor,origin:{actor,self:true},target:target?{actor:target,self:false}:null,type,dc:{value:dc},createMessage:false,skipDialog:true,title:'<h4>Test</h4>',...extra};
 const roll=await game.pf2e.Check.roll({slug:'test',totalModifier:modifier,modifiers:[]},context,null,(roll,outcome,message)=>callback={roll,outcome,message});
 return {roll,...callback,context};
}

test('enabling applies independent Dread to all characters without floors; disabling preserves values',async()=>{
 await horror.toggleHorrorMode();const item=dreadItem(hero);assert.equal(item.system.badge.value,1);assert.equal(item.type,'effect');assert.deepEqual(item.system.rules,[]);
 assert.equal(hero.getCondition('frightened'),null);assert.equal(horror.dreadValue(absent),1);assert.equal(horror.dreadValue(bystander),1);assert.equal(horror.dreadValue(enemy),0);
 await horror.toggleHorrorMode();assert.equal(dreadItem(hero),undefined);assert.equal(horror.dreadValue(hero),1);
 await horror.toggleHorrorMode();assert.equal(dreadItem(hero).system.badge.value,1);
});
test('DC uses active Party members, including an absent member, and excludes bystanders',async()=>{
 await dread(hero,2);await dread(absent,3);await dread(bystander,5);
 scene.tokens.push({...token,id:'bystander-token',actor:bystander});party.members.push(hero);
 assert.equal(horror.horrorDC(),6);assert.equal(horror.horrorPartyMembers().length,2);assert.equal(settings.has('horrorWillDC'),false);
 party.members.pop();scene.tokens.pop();
});
test('native PF2e Check.roll and DegreeOfSuccess apply all Dread critical ranges to result and callback',async()=>{
 for(let value=1;value<=5;value++){
  await dread(hero,value);
  for(let die=1;die<=20;die++){
   const result=await check(die,{modifier:40});
   const expected=die<=value?'criticalFailure':'criticalSuccess';
   assert.equal(result.outcome,expected,`Dread ${value}, d20 ${die}`);
   assert.equal(result.message.flags.pf2e.context.outcome,expected);assert.equal(result.roll.degreeOfSuccess,die<=value?0:3);assert.equal(result.roll.total,die+40);
  }
 }
});
test('native enemy Strike uses target Dread before PF2e renders damage cues',async()=>{
 for(let value=1;value<=5;value++){
  await dread(hero,value);
  for(let die=1;die<=20;die++){
   const result=await check(die,{actor:enemy,target:hero,type:'attack-roll',modifier:-20,dc:25});
   assert.equal(result.roll.degreeOfSuccess,die>=21-value?3:0,`target ${value}, d20 ${die}`);
   assert.equal(result.message.rolls[0].options.degreeOfSuccess,result.roll.degreeOfSuccess);
  }
 }
 const ally=await check(18,{actor:absent,target:hero,type:'attack-roll',modifier:-20,dc:25});assert.equal(ally.roll.degreeOfSuccess,0);
});
test('fortune and misfortune use only the retained natural; deterministic substitutions do not trigger Horror',async()=>{
 await dread(hero,3);
 assert.equal((await check([2,14],{rollTwice:'keep-higher',modifier:30})).roll.degreeOfSuccess,3);
 assert.equal((await check([2,14],{rollTwice:'keep-lower',modifier:30})).roll.degreeOfSuccess,0);
 const result=await check([],{substitutions:[{selected:true,required:true,value:2,effectType:'fortune',label:'Substitution'}],modifier:40});
 assert.equal(result.roll.degreeOfSuccess,3);
});
test('native rerolls recalculate the adjustment, preserve keep rules, and update native callbacks',async()=>{
 await dread(hero,3);let prior=(await check(2,{modifier:40})).message;prior.flags.pf2e.treatWoundsMacroFlag={bonus:0};
 native.dice.push(12);await game.pf2e.Check.rerollFromMessage(prior,{keep:'new'});let replacement=messages.at(-1);
 assert.equal(replacement.flags.pf2e.context.outcome,'criticalSuccess');assert.equal(replacement.rolls[0].degreeOfSuccess,3);assert.equal(native.sandbox.lastTreatWounds.outcome,'criticalSuccess');assert.equal(prior.deleted,true);
 prior=(await check(12,{modifier:40})).message;native.dice.push(2);await game.pf2e.Check.rerollFromMessage(prior,{keep:'new'});replacement=messages.at(-1);
 assert.equal(replacement.flags.pf2e.context.outcome,'criticalFailure');assert.equal(replacement.rolls[0].degreeOfSuccess,0);
 prior=(await check(12,{modifier:40})).message;native.dice.push(2);await game.pf2e.Check.rerollFromMessage(prior,{keep:'higher'});assert.equal(messages.at(-1).flags.pf2e.context.outcome,'criticalSuccess');
 await dread(hero,0);prior=(await check(12,{modifier:40})).message;await dread(hero,3);native.dice.push(2);await game.pf2e.Check.rerollFromMessage(prior,{keep:'new'});assert.equal(messages.at(-1).flags.pf2e.context.outcome,'criticalFailure');
 await drain();assert.deepEqual(errors,[]);
});
test('manual counter changes are used immediately; minimum 1 and overflow 5 are enforced',async()=>{
 const item=dreadItem(hero);await item.update({'system.badge.value':3});await drain();assert.equal(horror.dreadValue(hero),3);
 assert.equal((await check(3,{modifier:40})).outcome,'criticalFailure');
 await item.update({'system.badge.value':0});await drain();assert.equal(horror.dreadValue(hero),1);
 await hero.deleteEmbeddedDocuments('Item',hero.items.map(i=>i.id));await drain();assert.equal(horror.dreadValue(hero),1);
 await item.update({'system.badge.value':6});await drain();assert.equal(horror.dreadValue(hero),5);assert.ok(messages.at(-1).content.includes('Nightmare'));
});
test('critical triggers share round cap and overflow nightmares cannot repeat in the same round',async()=>{
 const combat=flagged({id:'battle',started:true,round:1,scene,combatants:[{actor:hero}]});game.combats.push(combat);
 await dread(hero,4);await hero.setFlag(ID,'horrorMode',{value:4,tracked:true,counterVersion:2});
 const message=id=>{const m=flagged({id,actor:hero,speaker:{},rolls:[{dice:[{faces:20,results:[{active:true,result:1}]}]}]});m.flags.pf2e={context:{type:'skill-check',outcome:'criticalFailure'}};return m;};
 const first=message('first');emit('createChatMessage',first);emit('createChatMessage',first);await drain();assert.equal(horror.dreadValue(hero),5);
 const before=messages.length;emit('createChatMessage',message('second'));await drain();assert.equal(messages.length,before);
 combat.round=2;emit('createChatMessage',message('third'));await drain();assert.equal(messages.length,before+1);game.combats.length=0;
});
test('movement and time cannot reset Dread; new characters receive the enabled minimum',async()=>{
 await dread(hero,3);token.x=500;emit('updateToken',token,{x:500});game.time.worldTime=219;emit('updateWorldTime');await drain();
 assert.equal(horror.dreadValue(hero),3);assert.equal(horror.dreadValue(absent),3);
 const newcomer=actor('newcomer');game.actors.push(newcomer);emit('createActor',newcomer);await drain();assert.equal(horror.dreadValue(newcomer),1);
 assert.equal(hero.getFlag(ID,'horrorMode').leftAt,undefined);
});
test('native edited RollTable is reused; Scare DC includes an off-scene party member',async()=>{
 let opened=0,drawn=0;const table=flagged({id:'scares',sheet:{render(){opened++;}},async draw(options){drawn++;assert.equal(options.messageMode,'gm');assert.equal(this.results[0].description,'EDITED');},results:[{description:'EDITED'}]});
 await table.setFlag(ID,'horrorScareTable',true);game.tables.push(table);
 await horror.openHorrorScareTable();assert.equal(opened,1);await dread(hero,2);await dread(absent,3);
 native.dice.push(6);await horror.rollScare();assert.equal(drawn,0);native.dice.push(5);await horror.rollScare();assert.equal(drawn,1);
 assert.equal(table.results[0].description,'EDITED');
});
test('disabled Horror leaves ordinary frightened and native results intact and gates Scares',async()=>{
 const old=(await check(1,{modifier:40})).message;await horror.toggleHorrorMode();
 await fear(hero,3);assert.equal((await check(3,{modifier:40})).outcome,'criticalSuccess');
 native.dice.push(3);await game.pf2e.Check.rerollFromMessage(old,{keep:'new'});assert.equal(messages.at(-1).flags.pf2e.context.outcome,'criticalSuccess');
 const before=messages.length;await horror.rollScare();assert.equal(messages.length,before);assert.deepEqual(errors,[]);
});

test('ordinary Frightened remains independent on enabling, edits, and disabling Horror',async()=>{
 const before=hero.getCondition('frightened');assert.equal(before.value,3);const value=horror.dreadValue(hero);
 await horror.toggleHorrorMode();assert.equal(hero.getCondition('frightened').id,before.id);assert.equal(horror.dreadValue(hero),value);
 await before.update({'system.value.value':7});await drain();assert.equal(before.value,7);assert.equal(horror.dreadValue(hero),value);
 await before.update({'system.value.value':0});await drain();assert.equal(horror.dreadValue(hero),value);
 await horror.toggleHorrorMode();assert.equal(before.value,0);assert.equal(before.getFlag(ID,'horrorDread'),undefined);
});
test('migrates only Horror-owned Frightened, restores borrowed baseline, and preserves old separate counters',async()=>{
 const owned=actor('owned'),borrowed=actor('borrowed'),original=actor('original');game.actors.push(owned,borrowed,original);
 const source=value=>{const data=game.pf2e.ConditionManager.getCondition('frightened').toObject();data.system.value.value=value;return data;};
 const managed=source(4);managed.flags={[ID]:{horrorDread:true}};
 await owned.createEmbeddedDocuments('Item',[managed,source(2)],{tsuHorrorWrite:true});await owned.setFlag(ID,'horrorMode',{value:3,conditionVersion:1});
 const previous=source(5);previous.flags={[ID]:{horrorDread:true,horrorOriginalFrightened:2}};
 await borrowed.createEmbeddedDocuments('Item',[previous],{tsuHorrorWrite:true});await borrowed.setFlag(ID,'horrorMode',{value:5,conditionVersion:1});
 await original.setFlag(ID,'horrorMode',{value:3});await fear(original,4);
 emit('canvasReady');await drain();
 assert.equal(horror.dreadValue(owned),4);assert.equal(owned.getCondition('frightened').value,2);assert.equal(owned.items.length,1);
 assert.equal(horror.dreadValue(borrowed),5);assert.equal(borrowed.getCondition('frightened').value,2);assert.equal(borrowed.getCondition('frightened').getFlag(ID,'horrorDread'),undefined);
 assert.equal(horror.dreadValue(original),3);assert.equal(original.getCondition('frightened').value,4);
 await horror.toggleHorrorMode();
 for(const [a,value]of [[owned,4],[borrowed,5],[original,3]]){assert.equal(dreadItem(a).system.badge.value,value);assert.deepEqual(dreadItem(a).system.rules,[]);assert.equal(a.getFlag(ID,'horrorMode').counterVersion,2);}
 emit('canvasReady');await drain();assert.equal(horror.dreadValue(borrowed),5);assert.equal(borrowed.getCondition('frightened').value,2);
 await horror.toggleHorrorMode();
});
test('Scare editor creates a native 20-row table once and preserves later edits',async()=>{
 game.tables.length=0;values.set('horrorScareTableId','missing');values.set('horrorScares','Legacy first row');let creates=0;
 globalThis.RollTable={async create(data){creates++;assert.equal(data.formula,'1d20');assert.equal(data.results.length,20);assert.equal(data.results[0].type,'text');assert.deepEqual(data.results[19].range,[20,20]);
 const table=flagged({...data,id:'new-table',sheet:{render(){}}});table.flags=data.flags;game.tables.push(table);return table;}};
 await Promise.all([horror.openHorrorScareTable(),horror.openHorrorScareTable()]);assert.equal(creates,1);
 const table=game.tables[0];assert.ok(table.results[0].description.includes('Legacy first row'));table.results[0].description='Custom scare';
 await horror.openHorrorScareTable();assert.equal(creates,1);assert.equal(table.results[0].description,'Custom scare');
});
