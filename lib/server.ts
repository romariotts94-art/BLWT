import { headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { getEmailSessionUser } from './email-auth';
import { defaultRates, publicQuote, normalizeRates } from './domain';
import { projectOrder } from './marketplace-policy';
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export const db=()=>{if(!env.DB)throw new HttpError(503,'База данных недоступна');return env.DB;};
export const uid=()=>crypto.randomUUID();export const now=()=>new Date().toISOString();
export async function all(sql:string,...params:any[]){return (await db().prepare(sql).bind(...params).all()).results as any[];}
export async function one(sql:string,...params:any[]){return db().prepare(sql).bind(...params).first<any>();}
export async function run(sql:string,...params:any[]){return db().prepare(sql).bind(...params).run();}
export async function authenticatedUser(){
 const a=await getChatGPTUser();
 if(!a){const sessionUser=await getEmailSessionUser();if(!sessionUser)throw new HttpError(401,'Войдите, чтобы продолжить');return sessionUser;}
 const admins=String((env as any).ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim());
 let u=await one('SELECT * FROM members WHERE id=?',a.userId);
 const admin=admins.includes(a.email.toLowerCase());
 if(!u){const invite=await one('SELECT * FROM invitations WHERE email=?',a.email.toLowerCase());await run('INSERT OR IGNORE INTO members (id,email,name,role,team_id,active,created) VALUES (?,?,?,?,?,1,?)',a.userId,a.email.toLowerCase(),invite?.name||a.displayName,admin?'admin':invite?.role||'client',invite?.team_id||null,now());u=await one('SELECT * FROM members WHERE id=?',a.userId);}
 if(admin&&u.role!=='admin'){await run('UPDATE members SET role=? WHERE id=?','admin',u.id);u.role='admin';}
 if(!u.active)throw new HttpError(403,'Доступ приостановлен администратором');return u;
}
export async function transaction<T>(callback:(tx:{all:(sql:string,...params:any[])=>Promise<any[]>,one:(sql:string,...params:any[])=>Promise<any>,run:(sql:string,...params:any[])=>Promise<any>})=>Promise<T>):Promise<T>{
 const database:any=db();
 if(typeof database.transaction==='function')return database.transaction(callback);
 // Older local D1 runtimes expose prepare/batch but not transaction().
 // Callers that need a race-safe claim use a conditional UPDATE on the order row.
 return callback({all,one,run});
}
export function requireAdmin(u:any){if(u.role!=='admin')throw new HttpError(403,'Доступно только администратору');}
export function ownerEmails(){
 const configured=String((env as any).OWNER_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 if(configured.length)return configured;
 return String((env as any).ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean).slice(0,1);
}
export function isOwner(u:any){return ownerEmails().includes(String(u?.email||'').toLowerCase());}
export async function rates(){const r=await one('SELECT value FROM settings WHERE key=?','rates');return normalizeRates(r?JSON.parse(r.value):defaultRates);}
export async function demoReviews(){if((env as any).DEMO_REVIEWS_ENABLED!=='true')return [];return all('SELECT client_id,client_name AS name,rating,text,service,created AS date FROM demo_reviews ORDER BY sort_order');}
export function unpack(o:any){return {...JSON.parse(o.details),id:o.id,clientId:o.client_id,status:o.status,crew:JSON.parse(o.crew),target:o.target,revision:o.revision,created:o.created,updated:o.updated,marketplaceVersion:o.marketplace_version||0,cityId:o.city_id||null,startAt:Number(o.start_at),endAt:Number(o.end_at),grossCents:Number(o.gross_cents??0),payoutCents:o.payout_cents==null?undefined:Number(o.payout_cents),assignedWorkerId:o.assigned_worker_id||null,claimUntil:o.claim_until?Number(o.claim_until):null};}
export async function orderAccess(id:string,u:any,allowOffer=false){const {marketAccess}=await import('./marketplace');return marketAccess(id,u,allowOffer);}
export function expose(o:any,u:any){return projectOrder(o,u);}
export async function updateOrder(o:any,patch:any,u:any,action:string){const {id,clientId,status,crew,target,revision,created,updated,marketplaceVersion,cityId,startAt,endAt,grossCents,payoutCents,assignedWorkerId,claimUntil,...details}={...o,...patch};const result=await run('UPDATE orders SET status=?,details=?,crew=?,target=?,revision=revision+1,updated=? WHERE id=? AND revision=?',status,JSON.stringify(details),JSON.stringify(crew),target||null,now(),id,o.revision);if(!result.meta.changes)throw new HttpError(409,'Заказ уже изменён. Обновите страницу.');await event(id,u.id,action);return {...o,...patch,revision:o.revision+1};}
export async function event(id:string|null,actor:string,action:string){await run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),id,actor,action,now());}
export async function notify(ids:string[],orderId:string|null,text:string){const list=[...new Set(ids)];if(list.length)await db().batch(list.map(id=>db().prepare('INSERT INTO notices(id,user_id,order_id,text,created) VALUES(?,?,?,?,?)').bind(uid(),id,orderId,text,now())));}
export async function admins(){return (await all("SELECT id FROM members WHERE role='admin' AND active=1")).map(u=>u.id);}
export function guardOrigin(req:Request){const origin=req.headers.get('origin');if(!origin)return;const requestOrigin=new URL(req.url).origin,configured=(env as any).PUBLIC_ORIGIN,expected=configured?new URL(configured).origin:requestOrigin;if(origin!==expected&&origin!==requestOrigin)throw new HttpError(403,'Недопустимый источник запроса');}
export function fail(e:any){console.error('API',e?.message);const status=e.status||(e.issues?400:e.code==='23505'?409:e.code==='23503'?409:500);const message=e?.issues?.[0]?.message||(e.status?e.message:e.code==='23505'?'Операция уже выполнена. Обновите страницу.':e.code==='23503'?'Связанные данные изменились. Обновите страницу.':'Не удалось выполнить запрос. Попробуйте ещё раз.');return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export function json(data:any){return Response.json(data,{headers:{'Cache-Control':'no-store'}});}

export async function currentUser(){
 const actor=await authenticatedUser();
 if(actor.role!=='admin')return actor;
 const cookie=(await headers()).get('cookie')||'';
 const mode=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('bw_view_mode='))?.split('=')[1];
 if(mode==='client'||mode==='worker'){
  const target=await one('SELECT * FROM members WHERE email=?',mode==='client'?'developer-client@blackandwhite.local':'developer-worker@blackandwhite.local');
  if(target&&target.active&&target.role===(mode==='client'?'client':'cleaner'))return {...target,canSwitchMode:true,viewMode:mode};
 }
 return {...actor,canSwitchMode:true,viewMode:'admin'};
}
