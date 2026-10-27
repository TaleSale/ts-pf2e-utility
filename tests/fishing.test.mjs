import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const data=fs.readFileSync(new URL('../scripts/games/fishing-data.js',import.meta.url),'utf8').replaceAll('export ','');
const source=fs.readFileSync(new URL('../scripts/games/fishing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
function harness(){
 let rollResult=2;let copper=10000;let tick=0;let id=0;const items=new Map();
 const actor={id:'hero',name:'Рыболов',type:'character',skills:{nature:{label:'Природа'},survival:{label:'Выживание'},athletics:{label:'Атлетика'}},items,inventory:{coins:{copperValue:copper},async removeCoins({cp}){if(cp>copper)return false;copper-=cp;return true;},async addCoins({cp}){copper+=cp;}},getStatistic(){return {roll:async()=>rollResult===null?null:{degreeOfSuccess:rollResult}};},async createEmbeddedDocuments(_type,docs){return docs.map(doc=>{const item={...structuredClone(doc),id:`item${++id}`,getFlag(_m,key){return this.flags?.['ts-pf2e-utility']?.[key]},async setFlag(_m,key,value){this.flags['ts-pf2e-utility'][key]=value;},async update(change){for(const [k,v] of Object.entries(change))if(k==='system.quantity')this.system.quantity=v;},toObject(){return structuredClone({name:this.name,type:this.type,system:this.system,flags:this.flags});},async delete(){items.delete(this.id);}};items.set(item.id,item);return item;});}};
 items.filter=fn=>[...items.values()].filter(fn);
 const user={id:'player',isGM:false};const gm={id:'gm',isGM:true};const actors=new Map([['hero',actor]]);actors.filter=fn=>[actor].filter(fn);
 const context=vm.createContext({console,MODULE_ID:'ts-pf2e-utility',esc:s=>String(s??'').replaceAll('<','&lt;'),Application:class{},$:s=>s,userCanControlActor:()=>true,getGameState:()=>null,requestGameAction:()=>{},game:{user:gm,users:new Map([['player',user],['gm',gm]]),actors,time:{get worldTime(){return tick},advance:async n=>{tick+=n}},pf2e:{Modifier:class{constructor(o){Object.assign(this,o)}}}},Roll:class{constructor(formula){this.formula=formula;this.total=12;}async evaluate(){return this}async toMessage(){}},ChatMessage:{getSpeaker:()=>({}),create:async()=>{}},foundry:{utils:{mergeObject:()=>({})}}});
 vm.runInContext(data+'\n'+source+'\nglobalThis.api={createFishingGameDefinition,FishingApplication,fishPrice,catchForRoll,degree,initialState,DC,LOCATIONS};',context);
 const api=context.api;const state=api.initialState();const definition=api.createFishingGameDefinition();
 const run=(action,d={},senderId='player')=>definition.handleAction({action,data:{actorId:'hero',...d},state,senderId,canUserControlActor:(a,u)=>a==='hero'&&(u==='player'||u==='gm')});
 return {api,context,actor,state,run,items,get copper(){return copper},setRoll:r=>{rollResult=r},setTime:t=>{tick=t}};
}
test('all location thresholds, boat overflow, magic sizes and prices',()=>{
 const h=harness();for(const l of Object.keys(h.api.LOCATIONS))for(let r=1;r<=22;r++){const f=h.api.catchForRoll(l,11,r);assert.ok(f.size>=1&&f.size<=6);assert.equal(Boolean(f.combat),r>=20);}
 assert.equal(h.api.fishPrice(11,3),600);assert.equal(h.api.fishPrice(11,3,true),1800);assert.equal(h.api.fishPrice(11,0,true),0);
 assert.equal(h.api.catchForRoll('magic',20,10,{spellRank:10}).size,5);
 assert.equal(h.api.catchForRoll('magic',0,1).value,1);
 assert.equal(h.api.degree(14,14,1),1);assert.equal(h.api.degree(24,14,20),3);
});
test('only GM can configure, invalid configuration rejected',async()=>{const h=harness();const d={location:'sea',level:11,combatSize:4,baitLevel:-1};assert.equal(await h.run('configure',d),false);assert.equal(h.state.level,0);assert.equal(await h.run('configure',d,'gm'),true);assert.equal(h.state.level,11);assert.equal(await h.run('configure',{...d,level:99},'gm'),false);assert.equal(await h.run('buy',{actorId:'other',product:'rod'}),false);});
test('purchase, fish, trophy and sale update inventory and money exactly once',async()=>{const h=harness();await h.run('buy',{product:'professional'});await h.run('buy',{product:'bait'});assert.equal(h.copper,4490);const [rod,bait]=[...h.items.values()];await h.run('fish',{rodId:rod.id,baitId:bait.id,skill:'nature',spellRank:0});assert.ok(h.state.pending.hero);assert.equal(bait.system.quantity,9);assert.equal(await h.run('fish',{rodId:rod.id,baitId:bait.id,skill:'nature',spellRank:0}),false);h.setRoll(3);await h.run('reel',{skill:'athletics'});assert.equal(h.state.pending.hero,undefined);const fish=[...h.items.values()].find(i=>i.getFlag('', 'fishing').kind==='fish');assert.equal(fish.getFlag('','fishing').trophy,true);assert.equal(fish.getFlag('','fishing').size,3);await h.run('sell',{itemId:fish.id});assert.equal(h.copper,4505);assert.equal(await h.run('sell',{itemId:fish.id}),false);assert.equal(h.copper,4505);});
test('cancelled roll consumes no bait; critical failure blocks all fishing for an hour',async()=>{const h=harness();await h.run('buy',{product:'rod'});await h.run('buy',{product:'bait'});const [rod,bait]=[...h.items.values()];const d={rodId:rod.id,baitId:bait.id,skill:'nature',spellRank:0};h.setRoll(null);assert.equal(await h.run('fish',d),false);assert.equal(bait.system.quantity,10);h.setRoll(0);await h.run('fish',d);assert.equal(h.state.blockedUntil,3600);assert.equal(await h.run('fish',d),false);h.setTime(3600);h.setRoll(2);assert.equal(await h.run('fish',d),true);});
test('expired fish cannot be sold or frozen',async()=>{const h=harness();await h.run('fish',{skill:'nature',spellRank:2});await h.run('reel',{skill:'survival'});const fish=[...h.items.values()][0];h.setTime(86400);assert.equal(await h.run('freeze',{itemId:fish.id}),false);await h.run('sell',{itemId:fish.id});assert.equal(h.copper,10000);assert.equal(fish.getFlag('','fishing').value,0);});
test('shop failures refund money; insufficient money does not create items',async()=>{const h=harness();h.actor.createEmbeddedDocuments=async()=>{throw Error('creation failed')};await assert.rejects(h.run('buy',{product:'rod'}));assert.equal(h.copper,10000);h.actor.inventory.removeCoins=async()=>false;assert.equal(await h.run('buy',{product:'rod'}),false);assert.equal(h.items.size,0);});
test('GM-only footer is absent from player HTML; produce local UI preview',async()=>{const h=harness();const app=new h.api.FishingApplication();const html=await app._renderInner();assert.match(html,/name="location"/);h.context.game.user={id:'player',isGM:false};assert.doesNotMatch(await app._renderInner(),/name="location"/);fs.mkdirSync(new URL('../tmp/fishing/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../tmp/fishing/preview.html',import.meta.url),`<!doctype html><html lang="ru"><meta charset="utf-8"><style>body{margin:0;background:#081e25}#tsu-fishing{height:780px;width:1120px;margin:20px auto} .window-content{height:100%}*{box-sizing:border-box}button,select,input{font:inherit}button{width:100%;cursor:pointer}h3{margin-top:12px}</style><div id="tsu-fishing"><div class="window-content">${html}</div></div></html>`);});
test('fishing requests route to only the primary GM while other games keep their behavior',async()=>{
 const core=fs.readFileSync(new URL('../scripts/core.js',import.meta.url),'utf8');
 const requestSource=core.slice(core.indexOf('export async function requestGameAction('),core.indexOf('\nfunction getGameActionQueueKey')).replace('export ','');
 const handled=[],sent=[];
 const context=vm.createContext({MODULE_ID:'module',SOCKET_CHANNEL:'channel',SOCKET_ACTIONS:{playerAction:'player-action'},getGameDefinition:id=>({primaryGMOnly:id==='fishing'}),enqueueGameAction:async p=>handled.push(p),game:{user:{id:'assistant',isGM:true},users:{activeGM:{id:'gm'}},socket:{emit:(_c,p)=>sent.push(p)}}});
 vm.runInContext(requestSource,context);
 await context.requestGameAction('fishing','buy',{});assert.equal(sent.length,1);assert.equal(handled.length,0);
 context.game.user.id='gm';await context.requestGameAction('fishing','buy',{});assert.equal(handled.length,1);
 context.game.user.id='assistant';await context.requestGameAction('duel-combat','action',{});assert.equal(handled.length,2);
});
test('a captured creature starts an encounter and never creates saleable fish',async()=>{
 const h=harness();h.state.pending.hero={...h.api.catchForRoll('lake',11,20,{combatSize:5}),professional:false};h.setRoll(3);assert.equal(await h.run('reel',{skill:'athletics'}),true);assert.equal(h.items.size,0);assert.match(h.state.log[0],/Ошеломлён 3/);assert.match(h.state.log[0],/13/);
});
test('cooking consumes one fish, produces portions, cannot duplicate or cook spoiled fish',async()=>{
 const h=harness();await h.run('fish',{skill:'nature',spellRank:4});await h.run('reel',{skill:'survival'});
 const fish=[...h.items.values()][0];const size=fish.getFlag('','fishing').size;
 assert.equal(await h.run('cook',{itemId:fish.id}),true);
 assert.equal(h.items.has(fish.id),false);
 const meal=[...h.items.values()][0];assert.equal(meal.getFlag('','fishing').kind,'meal');assert.equal(meal.system.quantity,size);assert.equal(meal.getFlag('','fishing').readyAt,size*600);
 assert.equal(await h.run('cook',{itemId:fish.id}),false);assert.equal(await h.run('sell',{itemId:meal.id}),false);
 await h.run('fish',{skill:'nature',spellRank:4});await h.run('reel',{skill:'survival'});
 const fresh=[...h.items.values()].find(i=>i.getFlag('','fishing').kind==='fish');h.setTime(86400);await h.run('cook',{itemId:fresh.id});assert.equal(h.items.has(fresh.id),true);assert.equal([...h.items.values()].filter(i=>i.getFlag('','fishing').kind==='meal').length,1);
});
test('commerce sends targeted notifications, successful catch posts a fish picture',async()=>{
 const h=harness(),messages=[],notifications=[];
 h.context.ChatMessage.create=async data=>messages.push(data);
 h.context.game.socket={emit:(channel,payload)=>notifications.push({channel,payload})};
 await h.run('buy',{product:'bait'});assert.equal(messages.length,0);assert.equal(notifications[0].payload.userId,'player');assert.match(notifications[0].payload.message,/покупка/);
 await h.run('fish',{skill:'nature',spellRank:2});await h.run('reel',{skill:'survival'});
 assert.equal(messages.length,1);assert.match(messages[0].content,/<img/);assert.match(messages[0].content,/fish-whole-blue/);
 const fish=[...h.items.values()].find(i=>i.getFlag('','fishing').kind==='fish');await h.run('sell',{itemId:fish.id});assert.equal(messages.length,1);assert.match(notifications.at(-1).payload.message,/продана/);
});
test('three tab previews preserve GM controls and show cooking in catch tab',async()=>{
 const h=harness();await h.run('buy',{product:'rod'});await h.run('buy',{product:'bait'});await h.run('fish',{skill:'nature',spellRank:2});await h.run('reel',{skill:'survival'});
 const app=new h.api.FishingApplication();
 h.context.getGameState=()=>h.state;
 for(const tab of ['gear','fishing','catch']){
  app.activeTab=tab;const html=await app._renderInner();assert.match(html,new RegExp(`data-pane="${tab}" >`));
  fs.writeFileSync(new URL(`../tmp/fishing/${tab}.html`,import.meta.url),`<!doctype html><html lang="ru"><meta charset="utf-8"><style>body{margin:0;background:#0c0c10}#tsu-fishing{height:700px;width:960px;margin:12px auto}.window-content{height:100%}*{box-sizing:border-box}</style><div id="tsu-fishing"><div class="window-content">${html}</div></div></html>`);
 }
});
