import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catAppearance,catPose,clickRoom,cleanedItems,gamePlaces,newCleaningGame,tickCleaningGame} from '../lib/cleaning-game.ts';

const started=()=>({...newCleaningGame(),status:'playing'});
const next=game=>tickCleaningGame(game,game.job.duration-game.job.elapsed);
function settle(game){for(let i=0;game.job&&i<12;i++)game=next(game);assert.equal(game.job,null);return game}
const placePoint=task=>{const b=gamePlaces[task].bounds;return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2}};
const grab=(game,id)=>settle(clickRoom(game,game.items[id]));
test('level retains twelve objects of six different kinds',()=>{
 const game=started();assert.equal(game.items.length,12);
 for(let task=0;task<6;task++)assert.equal(game.items.filter(i=>i.task===task).length,2);
 assert.equal(game.heldId,null);
});
test('clicking an arbitrary empty point makes the cat go there',()=>{
 let game=clickRoom(started(),{x:76,y:95});
 assert.equal(game.job.action,'none');
 game=settle(game);
 assert.deepEqual(game.cat,{x:76,y:95});
 assert.equal(cleanedItems(game),0);
 assert.equal(catAppearance(game).frame,0);
 assert.equal(catPose(game).direction,'front');
});
test('cat walks to an object, grasps it, then waits for player to choose a place',()=>{
 let game=clickRoom(started(),started().items[0]);
 assert.equal(game.heldId,null);
 game=next(game);assert.equal(game.job.kind,'pickup');
 assert.equal(game.heldId,null);
 game=next(game);assert.equal(game.heldId,0);
 assert.equal(game.job,null);
 assert.equal(game.items[0].done,false);
 assert.equal(catAppearance(game).frame,6);
 assert.equal(catPose(game).direction,'front');
});
test('wrong place does not reveal the right one, drop the object or count success',()=>{
 let game=grab(started(),0);
 game=settle(clickRoom(game,placePoint(5)));
 assert.equal(game.heldId,0);
 assert.equal(cleanedItems(game),0);
 assert.deepEqual(game.cat,{x:82,y:58});
 assert.equal(catAppearance(game).frame,6);
 game=settle(clickRoom(game,{x:85,y:95}));
 assert.equal(game.heldId,0);
});
test('a correct place commits only after arrival and placement, then waves facing front',()=>{
 let game=grab(started(),0);
 game=clickRoom(game,placePoint(0));assert.equal(cleanedItems(game),0);
 game=next(game);assert.equal(game.job.kind,'place');
 assert.equal(game.heldId,0);
 game=next(game);assert.equal(game.job.kind,'cheer');
 assert.equal(game.heldId,null);assert.equal(cleanedItems(game),1);
 assert.equal(catPose(game).direction,'front');assert.equal(catAppearance(game).frame,4);
 game=tickCleaningGame(game,250);assert.equal(catAppearance(game).frame,5);
 game=settle(game);assert.equal(catAppearance(game).frame,0);
 assert.equal(game.status,'playing');
});
test('walking can be redirected from its current position without teleporting',()=>{
 let game=clickRoom(started(),{x:90,y:90});
 game=tickCleaningGame(game,600);
 const before=catPose(game);
 game=clickRoom(game,{x:12,y:76});
 assert.deepEqual(game.job.from,before);
 assert.equal(catPose(game).x,before.x);
 assert.equal(catPose(game).y,before.y);
 assert.deepEqual(settle(game).cat,{x:12,y:76});
});
test('redirecting a delivery before arrival does not silently place the item',()=>{
 let game=clickRoom(grab(started(),0),placePoint(0));
 game=tickCleaningGame(game,200);
 game=settle(clickRoom(game,{x:90,y:95}));
 assert.equal(game.heldId,0);assert.equal(cleanedItems(game),0);
});
test('an input during grasp is queued and preserves the held object',()=>{
 let game=next(clickRoom(started(),started().items[0]));
 game=clickRoom(game,{x:85,y:92});
 assert.deepEqual(game.pending,{x:85,y:92});
 game=settle(game);
 assert.equal(game.heldId,0);
 assert.deepEqual(game.cat,{x:85,y:92});
});
test('paused animations do not advance or accept clicks',()=>{
 let game=tickCleaningGame(clickRoom(started(),{x:70,y:82}),350);
 const paused={...game,status:'paused'};
 assert.equal(tickCleaningGame(paused,100000),paused);
 assert.equal(clickRoom(paused,{x:25,y:80}),paused);
 assert.deepEqual(catPose(paused),catPose(game));
 game=tickCleaningGame({...paused,status:'playing'},100);
 assert.equal(game.job.elapsed,450);
});
test('already stored objects cannot be collected twice',()=>{
 let game=settle(clickRoom(grab(started(),0),placePoint(0)));
 game=settle(clickRoom(game,game.items[0]));
 assert.equal(game.heldId,null);assert.equal(cleanedItems(game),1);
});
test('all twelve deliveries are required before salary; last cheer precedes milk',()=>{
 let game=started();
 for(const item of game.items){
  game=grab(game,item.id);
  assert.equal(game.heldId,item.id);
  game=clickRoom(game,placePoint(item.task));
  game=next(game);game=next(game);
  assert.equal(game.job.kind,'cheer');
  assert.equal(game.status,'playing');
  assert.equal(cleanedItems(game),item.id+1);
  if(item.id===11){
   assert.equal(clickRoom(game,{x:1,y:1}),game);
   game=next(game);assert.equal(game.job.action,'reward');
   assert.equal(game.status,'playing');
  }
  game=settle(game);
 }
 assert.equal(game.status,'won');assert.equal(game.heldId,null);
 assert.equal(catPose(game).phase,'milk');
 assert.equal(catAppearance(game).sheet,'milk');
 assert.deepEqual(game.cat,{x:50,y:82});
 assert.equal(clickRoom(game,{x:5,y:80}),game);
});
test('directional poses turn away only while moving and return to the viewer on arrival',()=>{
 const game=started();
 let left=clickRoom({...game,cat:{x:90,y:80}},{x:10,y:80});
 left=tickCleaningGame(left,250);assert.equal(catPose(left).direction,'left');assert.equal(catAppearance(left).sheet,'walk');
 let right=tickCleaningGame(clickRoom(game,{x:80,y:94}),250);
 assert.equal(catAppearance(right).mirror,true);
 let back=tickCleaningGame(clickRoom({...game,cat:{x:14,y:95}},placePoint(0)),250);
 assert.equal(catPose(back).direction,'back');assert.equal(catAppearance(back).frame,3);
 for(const g of [left,right,back]){const stopped=settle(g);assert.equal(catPose(stopped).direction,'front');assert.equal(catAppearance(stopped).mirror,false);assert.equal(catAppearance(stopped).frame,0)}
});
test('invalid inputs cannot corrupt game state',()=>{
 const game=clickRoom(started(),{x:50,y:75});
 for(const delta of [-1,0,NaN,Infinity])assert.equal(tickCleaningGame(game,delta),game);
 assert.equal(clickRoom(game,{x:NaN,y:30}),game);
 assert.equal(clickRoom(newCleaningGame(),{x:15,y:80}).job,null);
 assert.equal(newCleaningGame().heldId,null);
});
test('game UI does not include tool inventory, target markers, matching highlights or solution text',()=>{
 const ui=readFileSync(new URL('../components/CleaningGame.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/cleaning-game.css',import.meta.url),'utf8');
 for(const forbidden of ['cg-tools','cg-destination','is-matching','cg-held-tool','ToolIcon','Sparkles','Книги — на полку','Вешалка в лапках']){
  assert.equal(ui.includes(forbidden),false,forbidden);
  assert.equal(css.includes(forbidden),false,forbidden);
 }
 assert.ok(ui.includes('НАГРАДА В ИГРЕ'));
 assert.ok(ui.includes('BW-монет'));
});
