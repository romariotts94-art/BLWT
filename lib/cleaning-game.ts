export type Point = { x: number; y: number };
// These regions are collision geometry, never displayed as hints or markers.
export const gamePlaces = [
 { name:'Гардероб', x:14, y:53, putX:13, putY:32, bounds:[5,18,21,50] },
 { name:'Корзина', x:27, y:51, putX:26, putY:39, bounds:[22,34,31,48] },
 { name:'Полка', x:43, y:50, putX:42, putY:37, bounds:[35,28,52,45] },
 { name:'Ящик', x:55, y:51, putX:55, putY:40, bounds:[52,37,59,47] },
 { name:'Столик', x:62, y:52, putX:61, putY:33, bounds:[59,31,64,47] },
 { name:'Диван', x:82, y:58, putX:80, putY:37, bounds:[64,29,98,54] },
] as const;
export type GameItem = Point & { id:number; task:number; angle:number; done:boolean };
export type Job = { kind:'walk'|'pickup'|'place'|'cheer'; from:Point; to:Point; elapsed:number; duration:number; action:'none'|'pickup'|'place'|'reward'; itemId?:number };
export type CleaningGameState = {
 status:'intro'|'playing'|'paused'|'won'; items:GameItem[]; cat:Point;
 heldId:number|null; job:Job|null; pending:Point|null;
};
export const TURN_MS=150, PICKUP_MS=550, PUTDOWN_MS=500, CHEER_MS=1250;
const positions=[[24,68],[73,85],[43,60],[17,87],[57,72],[45,91],[83,63],[33,78],[64,59],[88,82],[10,66],[59,90]];
export function newCleaningGame():CleaningGameState {
 return {status:'intro',items:positions.map(([x,y],id)=>({id,task:Math.floor(id/2),x,y,angle:id%2?14:-12,done:false})),cat:{x:8,y:94},heldId:null,job:null,pending:null};
}
export const cleanedItems=(game:CleaningGameState)=>game.items.filter(item=>item.done).length;
const lerp=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function catPose(game:CleaningGameState) {
 const job=game.job;
 if(!job)return {...game.cat,phase:game.status==='won'?'milk' as const:'idle' as const,direction:'front' as const,elapsed:0};
 if(job.kind!=='walk')return {...job.to,phase:job.kind,direction:'front' as const,elapsed:job.elapsed};
 const dx=job.to.x-job.from.x,dy=job.to.y-job.from.y;
 const direction=dy < -Math.abs(dx)*.9?'back':dy > Math.abs(dx)*1.2?'front':dx>0?'right':'left';
 const fraction=Math.max(0,Math.min(1,(job.elapsed-TURN_MS)/(job.duration-TURN_MS*2)));
 return {...lerp(job.from,job.to,fraction),phase:job.elapsed<TURN_MS?'turn' as const:job.elapsed>job.duration-TURN_MS?'settle' as const:'walk' as const,direction,elapsed:job.elapsed};
}
export function catAppearance(game:CleaningGameState) {
 const pose=catPose(game);
 if(pose.phase==='milk')return {sheet:'milk',frame:0,mirror:false};
 if(pose.phase==='cheer')return {sheet:'expressions',frame:4+Math.floor(pose.elapsed/220)%2,mirror:false};
 if(pose.phase==='pickup'||pose.phase==='place')return {sheet:'expressions',frame:7,mirror:false};
 if(pose.phase==='turn'||pose.phase==='settle')return {sheet:'expressions',frame:2,mirror:pose.direction==='right'};
 if(pose.phase==='walk'){
  if(pose.direction==='back')return {sheet:'expressions',frame:3,mirror:false};
  if(pose.direction==='front')return {sheet:'expressions',frame:game.heldId===null?0:6,mirror:false};
  return {sheet:'walk',frame:Math.floor(pose.elapsed/160)%2,mirror:pose.direction==='right'};
 }
 return {sheet:'expressions',frame:game.heldId===null?0:6,mirror:false};
}
const walking=(from:Point,to:Point,action:Job['action']='none',itemId?:number):Job=>({
 kind:'walk',from,to,elapsed:0,duration:Math.max(350,Math.hypot(to.x-from.x,to.y-from.y)*26)+TURN_MS*2,action,itemId
});
export function clickRoom(game:CleaningGameState,point:Point):CleaningGameState {
 if(game.status!=='playing'||!Number.isFinite(point.x)||!Number.isFinite(point.y)||cleanedItems(game)===game.items.length)return game;
 const p={x:Math.max(0,Math.min(100,point.x)),y:Math.max(0,Math.min(100,point.y))};
 // Finish a grasp/place atomically; walking can be redirected immediately.
 if(game.job&&game.job.kind!=='walk')return {...game,pending:p};
 const from=catPose(game);
 const item=game.items.find(item=>!item.done&&item.id!==game.heldId&&Math.hypot((item.x-p.x)/5,(item.y-p.y)/7.5)<=1);
 const destination=gamePlaces.findIndex(place=>p.x>=place.bounds[0]&&p.x<=place.bounds[2]&&p.y>=place.bounds[1]&&p.y<=place.bounds[3]);
 let to:Point={x:Math.max(6,Math.min(94,p.x)),y:Math.max(54,Math.min(96,p.y))};
 let action:Job['action']='none',itemId:number|undefined;
 if(game.heldId===null&&item){to=item;action='pickup';itemId=item.id}
 else if(destination>=0){
  to=gamePlaces[destination];
  const held=game.items.find(item=>item.id===game.heldId);
  if(held&&held.task===destination){action='place';itemId=held.id}
 }
 return {...game,cat:{x:from.x,y:from.y},job:walking(from,to,action,itemId),pending:null};
}
const resumePending=(game:CleaningGameState):CleaningGameState=>game.pending?clickRoom({...game,pending:null},game.pending):game;
export function tickCleaningGame(game:CleaningGameState,delta:number):CleaningGameState {
 if(game.status!=='playing'||!game.job||!Number.isFinite(delta)||delta<=0)return game;
 const job={...game.job,elapsed:game.job.elapsed+delta};
 if(job.elapsed<job.duration)return {...game,job};
 const stopped={...game,cat:{x:job.to.x,y:job.to.y},job:null};
 if(job.kind==='walk'){
  if(job.action==='reward')return {...stopped,status:'won',pending:null};
  if(job.action==='pickup'||job.action==='place')return {...stopped,job:{...job,kind:job.action,from:job.to,elapsed:0,duration:job.action==='pickup'?PICKUP_MS:PUTDOWN_MS}};
  return resumePending(stopped);
 }
 if(job.kind==='pickup')return resumePending({...stopped,heldId:job.itemId!});
 if(job.kind==='place'){
  const items=game.items.map(item=>item.id===job.itemId?{...item,done:true}:item);
  return {...stopped,items,heldId:null,job:{...job,kind:'cheer',elapsed:0,duration:CHEER_MS}};
 }
 if(cleanedItems(stopped)===stopped.items.length)return {...stopped,pending:null,job:walking(stopped.cat,{x:50,y:82},'reward')};
 return resumePending(stopped);
}
