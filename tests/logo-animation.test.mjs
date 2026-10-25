import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOGO_SCENE_DURATION,LOGO_SCENE_INTERVAL,LOGO_SCENE_REST,LOGO_STAGES as S,logoSceneFrame as frame,logoSceneGeometry as geometry} from '../lib/logo-animation.ts';

test('exact order: button, circle, wipe, put down, return to circle, draw, heart, collect, button',()=>{
 for(const phase of ['enter','wipe','park','drop','returnToInk','draw','walkToHeart','heart','pickup','exit'])assert.equal(frame(S[phase]).phase,phase);
 assert.equal(frame(S.end).phase,'idle');
});
test('entrance begins concealed at the measured calculator button, not at the left edge',()=>{
 for(const gate of [{left:700,y:0},{left:360,y:12},{left:115,y:65}]){
  const first=geometry(frame(0),180,54,gate);
  assert.ok(first.actorLeft>=gate.left);
  assert.equal(first.occlusion,1);assert.equal(first.actorY,gate.y);
  const emerged=geometry(frame(S.wipe*.25),180,54,gate);
  assert.ok(emerged.actorLeft+54<gate.left);assert.equal(emerged.occlusion,0);
  const arrived=geometry(frame(S.wipe),180,54,gate);
  assert.equal(arrived.actorLeft,-.86*54);assert.equal(arrived.actorY,0);
 }
});
test('wipe begins at the circle and moves left to right with rear-view frames',()=>{
 assert.equal(frame(S.wipe).x,0);
 const middle=frame((S.wipe+S.park)/2);
 assert.equal(middle.x,.5);assert.equal(middle.clip,'inset(0 0 0 50%)');
 assert.equal(frame(S.park).clip,'inset(0 0 0 100%)');
 for(let t=S.wipe;t<S.park;t+=50){assert.ok([0,1].includes(frame(t).sprite));assert.equal(frame(t).mirror,false)}
});
test('cat really walks all the way back to the circle while ink remains erased',()=>{
 const start=geometry(frame(S.returnToInk),180,54);
 const mid=frame((S.returnToInk+S.draw)/2);
 const end=geometry(frame(S.draw),180,54);
 assert.ok(start.actorLeft>180);
 assert.equal(mid.x,.5);assert.equal(mid.clip,'inset(0 0 0 100%)');assert.equal(mid.mirror,true);
 assert.equal(end.actorLeft,-.86*54);
 for(let t=S.returnToInk;t<S.draw;t+=10)assert.equal(frame(t).clip,'inset(0 0 0 100%)');
});
test('drawing also begins at the circle and restores left to right, never in reverse',()=>{
 assert.equal(frame(S.draw).x,0);assert.equal(frame(S.draw).clip,'inset(0 100% 0 0)');
 const middle=frame((S.draw+S.walkToHeart)/2);
 assert.equal(middle.x,.5);assert.equal(middle.clip,'inset(0 50% 0 0)');
 for(let t=S.draw;t<S.walkToHeart;t+=50){assert.ok([2,3].includes(frame(t).sprite));assert.equal(frame(t).mirror,false)}
 assert.equal(frame(S.walkToHeart).clip,'none');
});
test('mop and pencil follow the same left-to-right contact line at desktop and mobile sizes',()=>{
 for(const width of [135,180,245])for(const cat of [38,42,54])for(const [start,end] of [[S.wipe,S.park],[S.draw,S.walkToHeart]]){
  for(let t=start;t<end;t+=40){const f=frame(t),g=geometry(f,width,cat);assert.ok(Math.abs(g.actorLeft+.86*cat-f.x*width)<1e-8)}
 }
});
test('equipment stays parked during return, drawing and heart, then is collected before departure',()=>{
 assert.equal(frame(S.drop).propsOpacity,0);
 for(let t=S.returnToInk;t<S.pickup;t+=50)assert.equal(frame(t).propsOpacity,1);
 assert.equal(frame(S.exit).propsOpacity,0);
 assert.equal(new Set([S.returnToInk,S.draw,S.heart].map(t=>geometry(frame(t),180,54).propsLeft)).size,1);
});
test('heart remains after WHITE, without covering any lettering',()=>{
 for(const width of [135,180,245])for(const cat of [38,42,54]){
  const f=frame(S.heart+500),g=geometry(f,width,cat);
  assert.equal(f.sheet,'heart');assert.equal(f.clip,'none');
  assert.ok(g.actorLeft>width);assert.ok(g.actorLeft+cat<g.stageWidth);
  assert.ok(g.propsLeft+g.propsWidth<g.stageWidth);
 }
});
test('departure ends hidden behind actual calculator button including a wrapped mobile row',()=>{
 for(const gate of [{left:700,y:0},{left:360,y:12},{left:115,y:65}]){
  const beginning=geometry(frame(S.exit),180,54,gate);
  assert.equal(beginning.actorLeft,180+.08*54);assert.equal(beginning.occlusion,0);
  const end=geometry(frame(S.end-.001),180,54,gate);
  assert.ok(Math.abs(end.actorLeft-(gate.left+.08*54))<.01);
  assert.equal(end.actorY,gate.y);assert.equal(end.occlusion,1);
  assert.equal(end.mirror,false);
 }
});
test('side-profile frames carry the bucket and mop on both entrance and departure',()=>{
 for(const [start,end] of [[0,S.wipe],[S.exit,S.end]])for(let t=start;t<end;t+=50){
  assert.ok([4,5].includes(frame(t).sprite));assert.equal(frame(t).propsOpacity,0);
 }
 assert.equal(geometry(frame(100),180,54,{left:700,y:0}).mirror,true);
});
test('no position jumps between phases or the two parts of the button route',()=>{
 for(const gate of [{left:700,y:0},{left:115,y:65}])for(const t of [...Object.values(S).slice(1,-1),S.wipe*.25,S.exit+(S.end-S.exit)*.75]){
  const before=geometry(frame(t-.001),180,54,gate),after=geometry(frame(t),180,54,gate);
  assert.ok(Math.abs(before.actorLeft-after.actorLeft)<.02,'x '+t);
  assert.ok(Math.abs(before.actorY-after.actorY)<.02,'y '+t);
 }
});
test('masks, frames and alpha are bounded; five seconds separate full cycles',()=>{
 assert.equal(LOGO_SCENE_REST,5000);assert.equal(LOGO_SCENE_INTERVAL-LOGO_SCENE_DURATION,5000);
 for(let t=-200;t<21000;t+=10){const f=frame(t);assert.ok(f.x>=0&&f.x<=1);assert.ok(f.opacity>=0&&f.opacity<=1);assert.ok(f.propsOpacity>=0&&f.propsOpacity<=1);assert.ok(f.sprite>=0&&f.sprite<8)}
 for(const t of [S.end,Infinity,NaN]){assert.equal(frame(t).clip,'none');assert.equal(frame(t).opacity,0)}
});
test('UI measures the actual calculator and permits travel outside the logo wrapper',()=>{
 const component=readFileSync(new URL('../components/LogoScene.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/customer-experience.css',import.meta.url),'utf8');
 assert.ok(component.includes("querySelector<HTMLElement>('.bw-header-calc')"));
 assert.ok(component.includes('calculator.getBoundingClientRect()'));
 assert.ok(component.includes('actor.style.clipPath=geometry.actorClip'));
 assert.ok(component.includes('{children}</span>'));
 assert.ok(component.includes("original.style.removeProperty('clip-path')"));
 assert.ok(css.includes('overflow:visible'));
 assert.ok(!/\.bw-logo-scene\{[^}]*clip-path:/.test(css));
});
