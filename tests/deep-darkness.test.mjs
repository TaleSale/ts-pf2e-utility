import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../scripts/utility/deep-darkness.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/m, '').replace(/export /g, '');
const box = [{x:10,y:10},{x:20,y:10},{x:20,y:20},{x:10,y:20}];
const scene = {id:'s',levels:{get:()=>({index:0})},getFlag:()=>({floors:[{style:'weather-deep-darkness',level:0,points:box}]})};
const token = (x,y,senses=[])=>({parent:scene,level:'ground',actor:{perception:{senses:new Set(senses)}},object:{center:{x,y}}});
const c = vm.createContext({MODULE_ID:'test',Hooks:{once:()=>{}}});
vm.runInContext(source,c);
test('ordinary darkvision cannot see targets inside or across deep darkness; greater can',()=>{
 const target=token(15,15);
 for(const senses of [[],['low-light-vision'],['darkvision']]) assert.equal(c.blockedByDeepDarkness(token(0,15,senses),target),true);
 assert.equal(c.blockedByDeepDarkness(token(0,15,['greater-darkvision']),target),false);
 assert.equal(c.blockedByDeepDarkness(token(0,15,['darkvision']),token(30,15)),true);
});
test('outside areas, other levels and scenes remain unchanged',()=>{
 assert.equal(c.blockedByDeepDarkness(token(0,0),token(30,0)),false);
 const target=token(15,15); target.level='up';
 assert.equal(c.blockedByDeepDarkness(token(0,15),target),false);
 target.level='ground'; target.parent={...scene,id:'other'};
 assert.equal(c.blockedByDeepDarkness(token(0,15),target),false);
});
test('observer inside deep darkness cannot see outside without greater darkvision',()=>{
 assert.equal(c.blockedByDeepDarkness(token(15,15,['darkvision']),token(30,15)),true);
 assert.equal(c.blockedByDeepDarkness(token(15,15,['greater-darkvision']),token(30,15)),false);
});
test('Flat Check Helper rule creates hidden only for affected observer and target',()=>{
 const origin = token(0,15,['darkvision']); origin.actor.items={contents:[{}]};
 const target = token(15,15); const placeables=[{id:'o',actor:origin.actor,document:origin,controlled:true},{id:'t',actor:target.actor,document:target}];
 const ctx=vm.createContext({MODULE_ID:'test',Hooks:{once:()=>{}},canvas:{tokens:{placeables,get:id=>placeables.find(t=>t.id===id)}},game:{pf2e:{RuleElements:{custom:{'fc-TreatAs':class {constructor(data){Object.assign(this,data);}}}}}}});
 vm.runInContext(source,ctx);
 ctx.actor=origin.actor;
 const rule=vm.runInContext('createFlatCheckRule(actor)',ctx);
 assert.equal(rule.getData(['target:tsu-darkness-token:t']).treatAs,'hidden');
 assert.equal(rule.getData([]),null);
 origin.actor.perception.senses.add('greater-darkvision');
 assert.equal(rule.getData(['target:tsu-darkness-token:t']),null);
 origin.actor.perception.senses.delete('greater-darkvision');
 target.object.center={x:0,y:5};
 assert.equal(rule.getData(['target:tsu-darkness-token:t']),null);
});

function spellScene({ bottom=0, top=20, hole=false }={}) {
 const tree=[{points:box.flatMap(p=>[p.x,p.y])}];
 const inner=[{x:12,y:12},{x:18,y:12},{x:18,y:18},{x:12,y:18}];
 if(hole)tree.push({points:inner.flatMap(p=>[p.x,p.y]),isHole:true});
 tree.testPoint=p=>c.containsPoint(p,box)&&(!hole||!c.containsPoint(p,inner));
 return {...scene,getFlag:()=>({floors:[]}),regions:[{
  flags:{test:{spellFloor:{style:'weather-deep-darkness',persistent:true}}},
  levels:['ground'],elevation:{bottom,top,topInclusive:false},polygonTree:tree,
 }]};
}

test('spell darkness blocks ordinary darkvision at region height; greater darkvision bypasses it',()=>{
 const world=spellScene();
 const observer=token(0,15,['darkvision']),target=token(15,15);
 observer.parent=target.parent=world;
 observer.elevation=target.elevation=10;
 assert.equal(c.blockedByDeepDarkness(observer,target),true);
 observer.actor.perception.senses.add('greater-darkvision');
 assert.equal(c.blockedByDeepDarkness(observer,target),false);
 observer.actor.perception.senses.delete('greater-darkvision');
 for(const height of [-5,20,30]){
  observer.elevation=target.elevation=height;
  assert.equal(c.blockedByDeepDarkness(observer,target),false);
 }
 observer.elevation=target.elevation=10;
 world.regions=[];
 assert.equal(c.blockedByDeepDarkness(observer,target),false);
});

test('spell darkness respects holes, sloping sight rays and temporary placement regions',()=>{
 const world=spellScene({hole:true});
 const observer=token(13,15),target=token(17,15);
 observer.parent=target.parent=world;
 assert.equal(c.blockedByDeepDarkness(observer,target),false);
 target.object.center={x:19,y:15};
 assert.equal(c.blockedByDeepDarkness(observer,target),true);
 world.regions[0].flags.test.spellFloor.placement=true;
 assert.equal(c.blockedByDeepDarkness(observer,target),false);
 world.regions[0].flags.test.spellFloor.placement=false;
 observer.object.center={x:0,y:15};target.object.center={x:30,y:15};
 observer.elevation=30;target.elevation=-10;
 assert.equal(c.blockedByDeepDarkness(observer,target),true);
});

test('vision boundary hides map within and behind darkness, retaining unobstructed sight',()=>{
 const origin={x:0,y:15};
 const volume={contours:[box],contains:p=>c.containsPoint(p,box)};
 const flat=c.darknessVisionBoundary(origin,[volume],100);
 const polygon=Array.from({length:flat.length/2},(_,i)=>({x:flat[i*2],y:flat[i*2+1]}));
 assert.equal(c.containsPoint({x:5,y:15},polygon),true);
 assert.equal(c.containsPoint({x:15,y:15},polygon),false);
 assert.equal(c.containsPoint({x:30,y:15},polygon),false);
 assert.equal(c.containsPoint({x:0,y:40},polygon),true);
 assert.equal(c.darknessVisionBoundary({x:15,y:15},[volume],100).length,0);
});

test('vision wrapper constrains LOS, field of view and light perception only for affected observers',()=>{
 class Vision {
  constructor(document){this.object={document};this.x=0;this.y=15;this.elevation=10;}
  _createShapes(){this.los=this.shape=this.light={applyConstraint:boundary=>({boundary})};return 'native';}
 }
 const ctx=vm.createContext({MODULE_ID:'test',Hooks:{once:()=>{}},CONFIG:{Canvas:{visionSourceClass:Vision}},
  PIXI:{Polygon:class {constructor(points){this.points=points;}}},canvas:{dimensions:{width:100,height:100,maxR:150}}});
 vm.runInContext(source,ctx);vm.runInContext('installDarknessVisionBoundary()',ctx);
 const observer=token(0,15,['darkvision']);observer.parent=spellScene();
 const vision=new Vision(observer);
 assert.equal(vision._createShapes(),'native');
 assert.ok(vision.los.boundary);assert.equal(vision.los,vision.shape);assert.equal(vision.light,vision.shape);
 observer.actor.perception.senses.add('greater-darkvision');vision._createShapes();
 assert.equal(vision.los.boundary,undefined);
 observer.actor.perception.senses.delete('greater-darkvision');observer.parent.regions=[];vision._createShapes();
 assert.equal(vision.los.boundary,undefined);
});

