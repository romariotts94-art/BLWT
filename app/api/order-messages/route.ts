import {readJsonBody} from '../../../lib/request-body';
import {z} from 'zod';
import {currentUser,all,one,run,transaction,orderAccess,guardOrigin,requireAdmin,fail,json,HttpError,uid,now,notify,admins} from '../../../lib/server';
export const dynamic='force-dynamic';

async function resolveThread(orderId:string,u:any,requestedParticipant?:string){
 const order=await orderAccess(orderId,u);
 const contactId=requestedParticipant;
 if(!contactId)throw new HttpError(400,'Выберите собеседника');
 const participants=[order.clientId,...order.crew];
 const administrator=await one("SELECT id FROM members WHERE id=? AND role='admin'",contactId);
 if(!participants.includes(contactId)&&!administrator)throw new HttpError(403,'Этот собеседник не участвует в заказе');
 if(u.role!=='admin'&&(!participants.includes(u.id)||contactId===u.id))throw new HttpError(403,'Можно написать только другому участнику заказа');
 if(u.role!=='admin'&&!['assigned','en_route','in_progress','review','completed','cancelled'].includes(order.status))throw new HttpError(403,'Переписка откроется после подтверждения исполнителя клиентом');
 return {order,contactId};
}

export async function GET(req:Request){try{
 const u=await currentUser(),url=new URL(req.url),orderId=z.string().uuid().parse(url.searchParams.get('orderId'));
 if(!url.searchParams.get('contactId')&&!url.searchParams.get('participantId')){
  const order=await orderAccess(orderId,u),ids=u.role==='admin'?[order.clientId,...order.crew]:order.clientId===u.id?order.crew:[order.clientId];
  if(u.role!=='admin'){
   const administrators=await all(`SELECT DISTINCT m.id FROM members m JOIN order_direct_messages d
    ON (d.sender_id=m.id AND d.participant_id=?) OR (d.participant_id=m.id AND d.sender_id=?)
    WHERE d.order_id=? AND m.role='admin'`,u.id,u.id,orderId);
   ids.push(...administrators.map(person=>person.id));
  }
  const unique=[...new Set(ids.filter(Boolean))],people=unique.length?await all(`SELECT m.id,m.name,m.role,COALESCE(c.display_name,m.name) AS display_name FROM members m LEFT JOIN cleaner_cards c ON c.member_id=m.id WHERE m.id IN (${unique.map(()=>'?').join(',')})`,...unique):[];
  return json({contacts:people.map((person:any)=>({id:person.id,name:u.role==='admin'&&person.id===order.clientId?order.name:u.role!=='admin'&&u.role!=='client'&&person.id===order.clientId?'Заказчик':person.display_name,role:person.role}))});
 }
 const thread=await resolveThread(orderId,u,url.searchParams.get('contactId')||url.searchParams.get('participantId')||undefined);
 if(u.role==='admin'&&url.searchParams.get('auditView')==='1')await run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),orderId,u.id,'Администратор открыл переписку участников заказа',now());
 const pair=u.role==='admin'
  ?await all(`SELECT d.id,d.participant_id,d.sender_id,d.text,d.created,m.name
    FROM order_direct_messages d JOIN members m ON m.id=d.sender_id
    WHERE d.order_id=? AND (d.sender_id=? OR d.participant_id=?) ORDER BY d.created DESC,d.id DESC LIMIT 500`,orderId,thread.contactId,thread.contactId)
  :await all(`SELECT d.id,d.participant_id,d.sender_id,d.text,d.created,m.name
    FROM order_direct_messages d JOIN members m ON m.id=d.sender_id
    WHERE d.order_id=? AND ((d.sender_id=? AND d.participant_id=?) OR (d.sender_id=? AND d.participant_id=?))
    ORDER BY d.created DESC,d.id DESC LIMIT 500`,orderId,u.id,thread.contactId,thread.contactId,u.id);
 const group=await all(`SELECT m.id,m.user_id AS sender_id,m.text,m.created,p.name,p.role AS sender_role
   FROM messages m JOIN members p ON p.id=m.user_id WHERE m.order_id=? ORDER BY m.created DESC,m.id DESC LIMIT 500`,orderId);
 const safeGroup=group.map((message:any)=>({...message,name:u.role==='admin'?message.name:message.sender_id===u.id?'Вы':u.role==='client'?message.sender_role==='admin'?'Поддержка Black to White':'Исполнитель':message.sender_role==='admin'?'Поддержка Black to White':'Заказчик'}));
 const messages=[...new Map([...safeGroup,...pair].map(message=>[message.id,message])).values()].sort((a:any,b:any)=>String(a.created).localeCompare(String(b.created))).slice(-500);
 return json({messages,contactId:thread.contactId});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 guardOrigin(req);const u=await currentUser(),body=z.object({orderId:z.string().uuid(),participantId:z.string().uuid(),text:z.string().trim().min(1).max(2000)}).parse(await readJsonBody(req));
 const thread=await resolveThread(body.orderId,u,body.participantId);
 if(['completed','cancelled'].includes(thread.order.status))throw new HttpError(403,'Заказ завершён. Переписка доступна для просмотра.');
 const id=uid(),created=now();
 await transaction(async tx=>{
  if(await tx.one('SELECT id FROM order_direct_messages WHERE sender_id=? AND created>? LIMIT 1',u.id,new Date(Date.now()-2000).toISOString()))throw new HttpError(429,'Подождите пару секунд перед следующим сообщением');
 await tx.run('INSERT INTO order_direct_messages(id,order_id,participant_id,sender_id,text,created) VALUES(?,?,?,?,?,?)',id,body.orderId,thread.contactId,u.id,body.text,created);
 });
 const recipients=[thread.contactId];
 await notify(recipients.filter((recipient:string)=>recipient!==u.id),body.orderId,u.role==='admin'?'Новое личное сообщение администратора по заказу':'Новое сообщение по заказу');
 return json({ok:true,id,created});
}catch(e){return fail(e)}}
