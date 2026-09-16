import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = fs.readFileSync(new URL('../scripts/utility/floor-textures.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function declaration(name) {
 const start=source.indexOf(`function ${name}(`);
 assert.ok(start>=0,name);
 return source.slice(start,source.indexOf('\n}\n',start)+2);
}
function fixture() {
 class Container { children=[]; addChild(s){this.children.push(s);} }
 class Sprite { constructor({texture}){this.texture=texture;} anchor={set(){}}; position={set:(x,y)=>{this.x=x;this.y=y;}}; }
 const context=vm.createContext({PIXI:{Container,Sprite,Texture:{from:src=>src}}, MODULE_ID:'ts-pf2e-utility',DIFFICULT_TERRAIN_COST:2,GREATER_DIFFICULT_TERRAIN_COST:3,resolvePresetTexture:s=>s,
 canvas:{dimensions:{size:100},grid:{getOffset:({x,y})=>({i:Math.floor((y-20)/100),j:Math.floor((x-30)/100)}),getCenterPoint:({i,j})=>({x:30+(j+.5)*100,y:20+(i+.5)*100})}}});
 for(const name of ['warehouseAsset','polygonBounds','pointInPolygon','stableNoise','seededRandom','createCrowdFill','floorMovementCost']) vm.runInContext(declaration(name),context);
 const start=source.indexOf('const CROWD_GROUPS');
 vm.runInContext(source.slice(start,source.indexOf('const FLOOR_STYLES',start))+'\nconst FLOOR_STYLES=CROWD_STYLES; globalThis.styles=CROWD_STYLES;',context);
 return context;
}
test('all 63 crowd combinations are unique overlays with double movement cost',()=>{
 const f=fixture(); const styles=Object.entries(f.styles);assert.equal(styles.length,63);
 for(const [key,style] of styles){assert.equal(style.overlay,true);assert.equal(f.floorMovementCost({style:key}),2);assert.ok(style.rubble.assets.length>=1);}
 assert.equal(styles.filter(([,s])=>s.rubble.assets.length===1).length,6);
 assert.equal(styles.filter(([,s])=>s.rubble.assets.length===6).length,1);
});
test('crowds occupy native grid centers once per cell, balance classes and stay deterministic',()=>{
 const f=fixture(); const assets=Object.values(f.styles).at(-1).rubble.assets;
 const polygon=[{x:30,y:20},{x:630,y:20},{x:630,y:320},{x:30,y:320}];
 const run=()=>f.createCrowdFill(polygon,assets,'same-floor').children;
 const sprites=run();assert.equal(sprites.length,18);assert.equal(new Set(sprites.map(s=>`${s.x},${s.y}`)).size,18);
 const counts=new Map();for(const s of sprites){assert.equal((s.x-80)%100,0);assert.equal((s.y-70)%100,0);assert.equal(s.width,100);assert.equal(s.height,100);counts.set(s.texture,(counts.get(s.texture)||0)+1);}
 assert.equal(counts.size,6);assert.ok([...counts.values()].every(n=>n===3));
 assert.deepEqual(sprites.map(s=>[s.x,s.y,s.texture,s.rotation]),run().map(s=>[s.x,s.y,s.texture,s.rotation]));
});

test('crowds leave cells outside concave selections empty and handle single cells',()=>{
 const f=fixture(); const assets=Object.values(f.styles)[0].rubble.assets;
 const one=[{x:30,y:20},{x:130,y:20},{x:130,y:120},{x:30,y:120}];
 assert.equal(f.createCrowdFill(one,assets,'one').children.length,1);
 const concave=[{x:30,y:20},{x:330,y:20},{x:330,y:120},{x:130,y:120},{x:130,y:320},{x:30,y:320}];
 const sprites=f.createCrowdFill(concave,assets,'L').children;
 assert.equal(sprites.length,5);
 for(const s of sprites) assert.ok(s.x===80 || s.y===70);
});
