import {readJsonBody} from '../../../lib/request-body';
import {z} from 'zod';
import {currentUser,all,one,transaction,guardOrigin,fail,json,HttpError,uid,now,notify} from '../../../lib/server';

export const dynamic='force-dynamic';

export async function GET(req:Request){try{
 const u=await currentUser(),url=new URL(req.url);
 if(url.searchParams.get('contacts')==='1'){
  const contacts=u.role==='admin'&&url.searchParams.get('directory')==='1'
   ?await all("SELECT id,name,role,active FROM members WHERE role IN ('client','cleaner','leader') AND id<>? ORDER BY CASE WHEN role='cleaner' THEN 0 WHEN role='leader' THEN 1 ELSE 2 END,name",u.id)
   :u.role==='admin'
    ?await all("SELECT id,name,role,active FROM members WHERE role='admin' AND active=1 AND id<>? ORDER BY name",u.id)
   :await all("SELECT id,name,role,active FROM members WHERE role='admin' AND active=1 ORDER BY name");
  return json({contacts});
 }
 const contactId=z.string().min(1).parse(url.searchParams.get('contactId'));
 const contact=await one('SELECT id,role,active FROM members WHERE id=?',contactId);
 if(!contact||!contact.active||contact.id===u.id)throw new HttpError(404,'Собеседник не найден');
 if(u.role!=='admin'&&contact.role!=='admin')throw new HttpError(403,'Можно написать только руководителю');
 const messages=await all(`SELECT x.id,x.sender_id,x.recipient_id,x.text,x.created,m.name
   FROM management_messages x JOIN members m ON m.id=x.sender_id
   WHERE (x.sender_id=? AND x.recipient_id=?) OR (x.sender_id=? AND x.recipient_id=?)
   ORDER BY x.created DESC,x.id DESC LIMIT 500`,u.id,contactId,contactId,u.id);
 return json({messages:messages.reverse(),contactId});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 guardOrigin(req);const u=await currentUser(),body=z.object({contactId:z.string().min(1),text:z.string().trim().min(1).max(2000)}).parse(await readJsonBody(req));
 const contact=await one('SELECT id,role,active FROM members WHERE id=?',body.contactId);
 if(!contact||!contact.active||contact.id===u.id)throw new HttpError(404,'Собеседник не найден');
 if(u.role!=='admin'&&contact.role!=='admin')throw new HttpError(403,'Можно написать только руководителю');
 const created=now(),id=uid();
 await transaction(async tx=>{
  if(await tx.one('SELECT id FROM management_messages WHERE sender_id=? AND created>? LIMIT 1',u.id,new Date(Date.now()-2000).toISOString()))throw new HttpError(429,'Подождите пару секунд перед следующим сообщением');
  await tx.run('INSERT INTO management_messages(id,sender_id,recipient_id,text,created) VALUES(?,?,?,?,?)',id,u.id,contact.id,body.text,created);
 });
 await notify([contact.id],null,'Новое сообщение от '+u.name);
 return json({ok:true,id,created});
}catch(e){return fail(e)}}

export async function DELETE(req:Request){try{
 guardOrigin(req);const u=await currentUser();if(u.role!=='admin')throw new HttpError(403,'Удалить переписку может только администратор');
 const contactId=z.string().min(1).parse(new URL(req.url).searchParams.get('contactId'));
 const contact=await one('SELECT id FROM members WHERE id=?',contactId);if(!contact)throw new HttpError(404,'Собеседник не найден');
 await transaction(async tx=>{
  await tx.run('DELETE FROM management_messages WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)',u.id,contactId,contactId,u.id);
  await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),null,u.id,'Удалена личная переписка с участником '+contactId,now());
 });
 return json({ok:true});
}catch(e){return fail(e)}}
