import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {currentUser,all,one,transaction,guardOrigin,requireAdmin,fail,json,HttpError,uid,now} from '../../../lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const u=await currentUser(),id=new URL(req.url).searchParams.get('ticket');
 if(id){const t=await one('SELECT * FROM support_tickets WHERE id=?',id);if(!t||u.role!=='admin'&&t.user_id!==u.id)throw new HttpError(403,'Обращение недоступно');return json({ticket:t,messages:await all("SELECT s.id,s.text,s.created,CASE WHEN m.role='admin' THEN 'Поддержка' ELSE m.name END AS name FROM support_messages s JOIN members m ON m.id=s.sender_id WHERE ticket_id=? ORDER BY created LIMIT 500",id)});}
 return json({tickets:await all(`SELECT t.*,m.name FROM support_tickets t JOIN members m ON m.id=t.user_id ${u.role==='admin'?'':'WHERE user_id=?'} ORDER BY updated DESC LIMIT 100`,...(u.role==='admin'?[]:[u.id])),telegram:u.role==='admin'?{configured:!!((env as any).TELEGRAM_BOT_TOKEN&&(env as any).TELEGRAM_ADMIN_CHAT_IDS),pending:(await one('SELECT COUNT(*) AS n FROM support_delivery WHERE delivered_at IS NULL')).n}:undefined});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),b=z.object({ticketId:z.string().uuid().optional(),subject:z.string().trim().min(3).max(120).optional(),text:z.string().trim().min(1).max(3000).optional(),close:z.boolean().optional()}).parse(await req.json());
 return json(await transaction(async tx=>{
 await tx.one('SELECT id FROM members WHERE id=? FOR UPDATE',u.id);
 let id=b.ticketId;if(id){const t=await tx.one('SELECT * FROM support_tickets WHERE id=? FOR UPDATE',id);if(!t||u.role!=='admin'&&t.user_id!==u.id)throw new HttpError(403,'Обращение недоступно');if(b.close!==undefined){requireAdmin(u);await tx.run('UPDATE support_tickets SET status=?,updated=? WHERE id=?',b.close?'closed':'open',now(),id);return {id};}if(t.status==='closed')throw new HttpError(409,'Обращение закрыто. Создайте новое.');}
 if(!b.text)throw new HttpError(400,'Введите сообщение');
 const recent=await tx.all('SELECT id FROM support_messages WHERE sender_id=? AND created>?',u.id,new Date(Date.now()-60000).toISOString());if(recent.length>=5)throw new HttpError(429,'Не больше пяти сообщений в минуту');
 if(!id){id=uid();await tx.run('INSERT INTO support_tickets(id,user_id,subject,created,updated) VALUES(?,?,?,?,?)',id,u.id,b.subject||'Помощь по заказу',now(),now());}
 const mid=uid();await tx.run('INSERT INTO support_messages(id,ticket_id,sender_id,text,created) VALUES(?,?,?,?,?)',mid,id,u.id,b.text,now());await tx.run('UPDATE support_tickets SET updated=? WHERE id=?',now(),id);
 if(u.role!=='admin'){
 const chats=String((env as any).TELEGRAM_ADMIN_CHAT_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^-?\d+$/.test(x));
 // Unconfigured messages are backfilled by the delivery worker when Telegram is connected.
 for(const chat of new Set(chats))await tx.run('INSERT INTO support_delivery(id,message_id,chat_id) VALUES(?,?,?)',uid(),mid,chat);
 for(const a of await tx.all("SELECT id FROM members WHERE role='admin' AND active=1"))await tx.run('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)',uid(),a.id,'Новое обращение в поддержку',now());
 }else{const t=await tx.one('SELECT user_id FROM support_tickets WHERE id=?',id);await tx.run('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)',uid(),t.user_id,'Поддержка ответила на ваше обращение',now());}
 return {id,saved:true};
 }));}catch(e){return fail(e)}}
