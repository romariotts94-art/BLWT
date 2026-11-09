import {z} from 'zod';
import {currentUser,requireAdmin,one,all,guardOrigin,transaction,uid,now,HttpError,fail,json} from '../../../lib/server';
import {readJsonBody} from '../../../lib/request-body';
import {textHash} from '../../../lib/legal-content';
export const dynamic='force-dynamic';
const snapshot=(p:any)=>JSON.stringify([p.member_id,p.legal_name,p.claim_email,p.npd_inn]);
export async function GET(){try{const u=await currentUser();if(u.role!=='admin'&&!['cleaner','leader'].includes(u.role))throw new HttpError(403,'Нет доступа');const rows=u.role==='admin'?await all("SELECT p.member_id,p.legal_name,p.claim_email,p.legal_checked_at,p.npd_inn,m.name,m.email FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE m.role IN ('cleaner','leader') ORDER BY m.name"):await all('SELECT p.member_id,p.legal_name,p.claim_email,p.legal_checked_at,p.npd_inn,m.name,m.email FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=?',u.id);return json({workers:await Promise.all(rows.map(async p=>({...p,hash:await textHash(snapshot(p))}))),admin:u.role==='admin'});}catch(e){return fail(e);}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),b:any=await readJsonBody(req);const id=z.string().uuid().parse(b.workerId);if(u.role!=='admin'&&(u.id!==id||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Нет доступа');await transaction(async tx=>{
 const p=await tx.one('SELECT * FROM worker_profiles WHERE member_id=? FOR UPDATE',id);if(!p)throw new HttpError(404,'Анкета не найдена');
 if(await tx.one("SELECT id FROM orders WHERE assigned_worker_id=? AND status IN ('assigned','en_route','in_progress','review','contract_pending','admin_review')",id))throw new HttpError(409,'Изменение юридических сведений по активному заказу требует отдельного урегулирования');
 if(b.action==='save'){
  const name=z.string().trim().min(5).max(200).parse(b.legalName),email=z.string().email().max(250).parse(b.claimEmail);
  await tx.run('UPDATE worker_profiles SET legal_name=?,claim_email=?,legal_checked_at=NULL,verified=0,updated=? WHERE member_id=?',name,email,now(),id);
  await tx.run("UPDATE payout_recipients SET status='revoked' WHERE worker_id=?",id);
 }else if(b.action==='verify'){
  requireAdmin(u);const evidence=z.string().trim().min(15).max(1200).parse(b.evidence);
  if(!p.legal_name?.trim()||!p.claim_email||!/^\d{12}$/.test(p.npd_inn||''))throw new HttpError(409,'Сначала заполните ФИО, email для претензий и ИНН');
  if(b.hash!==await textHash(snapshot(p)))throw new HttpError(409,'Сведения изменились. Повторите проверку');
  await tx.run('UPDATE worker_profiles SET legal_checked_at=?,updated=? WHERE member_id=?',now(),now(),id);
  await tx.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','identity_verification:'+id,JSON.stringify({hash:b.hash,evidence,by:u.id,at:now()}));
 }else throw new HttpError(400,'Неизвестное действие');
 await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),null,u.id,'Юридические сведения '+id+': '+b.action,now());
 });return json({ok:true});}catch(e){return fail(e);}}
