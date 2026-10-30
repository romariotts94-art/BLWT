import {z} from 'zod';
import {currentUser,one,all,transaction,guardOrigin,fail,json,HttpError,uid,now} from '../../../lib/server';
export const dynamic='force-dynamic';
async function access(u:any,id:string){if(u.role!=='admin'&&(u.id!==id||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Переписка доступна сотруднику и администраторам');if(!await one("SELECT id FROM members WHERE id=? AND role IN ('cleaner','leader')",id))throw new HttpError(404,'Исполнитель не найден');}
export async function GET(req:Request){try{
 const u=await currentUser(),url=new URL(req.url);
 if(url.searchParams.get('contacts')==='1'){
  if(u.role==='admin')return json({contacts:await all(`SELECT m.id,COALESCE(c.display_name,m.name) AS name,m.active,city.name AS city,
   (SELECT s.text FROM staff_messages s WHERE s.worker_id=m.id ORDER BY s.created DESC LIMIT 1) AS last_text,
   (SELECT MAX(s.created) FROM staff_messages s WHERE s.worker_id=m.id) AS last_at
   FROM members m LEFT JOIN cleaner_cards c ON c.member_id=m.id LEFT JOIN worker_profiles p ON p.member_id=m.id
   LEFT JOIN cities city ON city.id=p.city_id WHERE m.role IN ('cleaner','leader') ORDER BY last_at DESC,m.name`)});
  if(!['cleaner','leader'].includes(u.role))throw new HttpError(403,'Переписка доступна только сотрудникам и администрации');
  return json({contacts:await all("SELECT id,name FROM members WHERE role='admin' AND active=1 ORDER BY name")});
 }
 const id=url.searchParams.get('worker')||u.id;await access(u,id);
 return json({messages:await all('SELECT s.*,m.name FROM staff_messages s JOIN members m ON m.id=s.sender_id WHERE worker_id=? ORDER BY created DESC LIMIT 200',id)});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),b=z.object({workerId:z.string(),text:z.string().trim().min(1).max(2000)}).parse(await req.json());await access(u,b.workerId);await transaction(async tx=>{if(await tx.one('SELECT id FROM staff_messages WHERE sender_id=? AND created>?',u.id,new Date(Date.now()-2000).toISOString()))throw new HttpError(429,'Подождите пару секунд');await tx.run('INSERT INTO staff_messages(id,worker_id,sender_id,text,created) VALUES(?,?,?,?,?)',uid(),b.workerId,u.id,b.text,now());const ids=u.role==='admin'?[b.workerId]:(await tx.all("SELECT id FROM members WHERE role='admin' AND active=1")).map(m=>m.id);for(const id of ids)await tx.run('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)',uid(),id,'Новое сообщение в переписке сотрудника',now());});return json({ok:true});}catch(e){return fail(e)}}
