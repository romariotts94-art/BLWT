export const LOGO_SCENE_DURATION=15950;
export const LOGO_SCENE_REST=5000;
export const LOGO_SCENE_INTERVAL=LOGO_SCENE_DURATION+LOGO_SCENE_REST;
export const LOGO_STAGES={enter:0,wipe:2000,park:5000,drop:5500,returnToInk:6100,draw:7600,walkToHeart:11100,heart:11600,pickup:13300,exit:13950,end:LOGO_SCENE_DURATION} as const;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const progress=(t:number,start:number,end:number)=>clamp((t-start)/(end-start));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export type LogoPhase='idle'|'enter'|'wipe'|'park'|'drop'|'returnToInk'|'draw'|'walkToHeart'|'heart'|'pickup'|'exit';
export type LogoFrame={phase:LogoPhase;clip:string;x:number;offset:number;y:number;opacity:number;propsOpacity:number;sheet:'actions'|'heart';sprite:number;mirror:boolean;travel:number};
export type LogoGate={left:number;y:number};
const hidden='inset(0 0 0 100%)';
/** Both work passes begin at the circle. The return walk never reveals ink. */
export function logoSceneFrame(elapsed:number):LogoFrame {
 const t=Math.max(0,Number.isFinite(elapsed)?elapsed:LOGO_SCENE_DURATION),s=LOGO_STAGES;
 const frame:LogoFrame={phase:'idle',clip:'none',x:0,offset:0,y:0,opacity:1,propsOpacity:0,sheet:'actions',sprite:6,mirror:false,travel:0};
 const gait=(start:number)=>Math.floor((t-start)/170)%2;
 if(t>=s.end)return {...frame,opacity:0};
 if(t<s.wipe)return {...frame,phase:'enter',offset:-.86,sprite:4+gait(0),mirror:true,travel:progress(t,0,s.wipe)};
 if(t<s.park){
  const p=progress(t,s.wipe,s.park);
  return {...frame,phase:'wipe',clip:`inset(0 0 0 ${p*100}%)`,x:p,offset:-.86,sprite:gait(s.wipe),y:Math.sin(p*Math.PI*18)*4};
 }
 if(t<s.drop){
  const p=progress(t,s.park,s.drop);
  return {...frame,phase:'park',clip:hidden,x:1,offset:lerp(-.86,.08,p),sprite:4+gait(s.park),y:Math.sin(p*Math.PI*4)};
 }
 if(t<s.returnToInk)return {...frame,phase:'drop',clip:hidden,x:1,offset:.08,sprite:7,propsOpacity:progress(t,s.drop+100,s.returnToInk-100)};
 if(t<s.draw){
  const p=progress(t,s.returnToInk,s.draw);
  return {...frame,phase:'returnToInk',clip:hidden,x:1-p,offset:lerp(.08,-.86,p),sprite:6,mirror:true,propsOpacity:1,y:Math.sin(p*Math.PI*12)};
 }
 if(t<s.walkToHeart){
  const p=progress(t,s.draw,s.walkToHeart);
  return {...frame,phase:'draw',clip:`inset(0 ${(1-p)*100}% 0 0)`,x:p,offset:-.86,sprite:2+gait(s.draw),propsOpacity:1,y:Math.sin(p*Math.PI*28)*5};
 }
 if(t<s.heart){
  const p=progress(t,s.walkToHeart,s.heart);
  return {...frame,phase:'walkToHeart',x:1,offset:lerp(-.86,.08,p),sprite:6,propsOpacity:1,y:Math.sin(p*Math.PI*4)};
 }
 if(t<s.pickup)return {...frame,phase:'heart',x:1,offset:.08,sheet:'heart',sprite:t<s.heart+200?1:t<s.heart+1100?2:3,propsOpacity:1};
 if(t<s.exit)return {...frame,phase:'pickup',x:1,offset:.08,sprite:7,propsOpacity:1-progress(t,s.pickup+200,s.exit)};
 return {...frame,phase:'exit',x:1,offset:.08,sprite:4+gait(s.exit),travel:progress(t,s.exit,s.end)};
}
/** Gate is measured from the actual calculator button, relative to the logo. */
export function logoSceneGeometry(frame:LogoFrame,inkWidth:number,catWidth:number,gate:LogoGate={left:inkWidth+2.4*catWidth,y:0}){
 const circle=-.86*catWidth,heart=inkWidth+.08*catWidth;
 const concealed=gate.left+.08*catWidth,approach=gate.left-1.12*catWidth;
 let actorLeft=frame.x*inkWidth+frame.offset*catWidth,actorY=0,mirror=frame.mirror,occlusion=0;
 const p=frame.travel;
 if(frame.phase==='enter'){
  if(p<.25){actorLeft=lerp(concealed,approach,p/.25);actorY=gate.y;mirror=true;occlusion=clamp((actorLeft+catWidth-gate.left)/catWidth)}
  else{actorLeft=lerp(approach,circle,(p-.25)/.75);actorY=lerp(gate.y,0,(p-.25)/.75);mirror=circle<approach}
 }
 if(frame.phase==='exit'){
  if(p<.75){actorLeft=lerp(heart,approach,p/.75);actorY=lerp(0,gate.y,p/.75);mirror=approach<heart}
  else{actorLeft=lerp(approach,concealed,(p-.75)/.25);actorY=gate.y;mirror=false;occlusion=clamp((actorLeft+catWidth-gate.left)/catWidth)}
 }
 return {actorLeft,actorY,mirror,actorClip:occlusion?`inset(0 ${occlusion*100}% 0 0)`:'none',occlusion,propsLeft:inkWidth+.55*catWidth,propsWidth:.75*catWidth,stageWidth:inkWidth+1.35*catWidth};
}
