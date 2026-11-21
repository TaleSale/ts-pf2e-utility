import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import path from 'node:path';

// Exercise the same clipping and triangulation libraries as the installed client.
const app = process.env.FOUNDRY_APP;
test('darkness removes only its area from light meshes, preserving islands, holes and edge fading', {skip: !app}, () => {
 const require=createRequire(import.meta.url);
 const ClipperLib=require(path.join(app,'public/scripts/clipper/clipper.js'));
 const earcut=require(path.join(app,'node_modules/earcut/src/earcut.js'));
 const ctx=vm.createContext({MODULE_ID:'test',Hooks:{once:()=>{}},ClipperLib,PIXI:{utils:{earcut}}});
 const source=fs.readFileSync(new URL('../scripts/utility/deep-darkness.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/m,'').replace(/export /g,'');
 vm.runInContext(source,ctx);
 const rect=(x1,y1,x2,y2)=>[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
 const positions=[0,0,40,0,40,40,0,40], indices=[0,1,2,0,2,3];
 const area=mesh=>{
  let sum=0;
  for(let i=0;i<mesh.indices.length;i+=3){
   const [a,b,c]=mesh.indices.slice(i,i+3).map(index=>mesh.positions.slice(index*2,index*2+2));
   sum+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  }
  return sum;
 };
 const run=(contours,expected,origin={x:0,y:0})=>{
  const normalized=positions.map((v,i)=>(v-(i%2?origin.y:origin.x))/40);
  const mesh=ctx.maskDarknessGeometry(normalized,[0,1,1,0],indices,origin,40,contours.map(contours=>({contours})));
  assert.ok(Math.abs(area(mesh)*1600-expected)<0.01);
  for(let i=0;i<mesh.depth.length;i++) assert.ok(Math.abs(mesh.depth[i]-(mesh.positions[i*2]+origin.x/40))<1e-5);
  return mesh;
 };
 const box=rect(10,10,20,20);
 run([[box]],1500);
 run([[box]],1500,{x:15,y:15}); // A source inside darkness retains outside illumination.
 run([[rect(10,-10,20,50)]],1200); // Both disconnected illuminated sides survive.
 run([[box,rect(12,12,18,18)]],1536); // Region holes remain illuminated.
 run([[box],[rect(15,10,25,20)]],1450); // Overlap is removed once.
 run([[rect(-1,-1,41,41)]],0);
 const magic={active:true,level:{id:'ground'},data:{},object:{document:{actor:{rules:[{
  key:'TokenLight',test:()=>true,item:{type:'effect',slug:'spell-effect-light',traits:new Set()},
 }]}}},shape:{points:[12,12,18,12,18,18,12,18]}};
 ctx.canvas={effects:{lightSources:new Map([['light',magic]])}};
 const volume={contours:[box],contains:p=>ctx.containsPoint(p,box),bottom:0,top:20};
 const token={level:'ground'};
 const remaining=ctx.unlitDarknessVolumes(token,[volume]);
 assert.equal(remaining[0].contains({x:15,y:15}),false);
 assert.equal(remaining[0].contains({x:11,y:15}),true);
 assert.equal(ctx.crossesDarknessVolume({x:13,y:15},{x:17,y:15},10,10,remaining[0]),false);
 magic.object.document.actor.rules[0].item={type:'equipment',slug:'everlight-crystal',traits:new Set()};
 assert.equal(ctx.unlitDarknessVolumes(token,[volume])[0].contains({x:15,y:15}),false);
 magic.active=false;
 assert.equal(ctx.unlitDarknessVolumes(token,[volume])[0].contains({x:15,y:15}),true);
 magic.active=true;magic.level.id='up';
 assert.equal(ctx.unlitDarknessVolumes(token,[volume])[0].contains({x:15,y:15}),true);
 magic.level.id='ground';magic.object.document.actor.rules[0].item.slug='torch';
 assert.equal(ctx.unlitDarknessVolumes(token,[volume])[0].contains({x:15,y:15}),true);
});
