import {z} from 'zod';
import {readJsonBody} from '../../../lib/request-body';
import {all,one,transaction,currentUser,guardOrigin,json,fail,HttpError,now,uid} from '../../../lib/server';
import {publishedProfiles,previewCleaner} from '../../../lib/cleaner-trust';
export const dynamic='force-dynamic';
const idSchema=z.string().uuid();
async function pair(user:any,workerId:string,clientId?:string){
 if(user.role==='client')return {clientId:user.id,workerId};
 if(['cleaner','leader'].includes(user.role)&&user.id===workerId&&clientId)return {clientId,workerId};
 throw new HttpError(403,'Нет доступа к переписке');
}
export async function GET(req:Request){try{const u=await currentUser(),url=new URL(req.url);
 if(url.searchParams.get('inbox')==='1'){if(!['cleaner','leader'].includes(u.role))throw new HttpError(403,'Переписка доступна исполнителю');const conversations=await all(`SELECT p.client_id,m.name AS client_name,MAX(p.created) AS last_at,(SELECT text FROM profile_messages x WHERE x.client_id=p.client_id AND x.worker_id=p.worker_id ORDER BY x.created DESC LIMIT 1) AS last_text FROM profile_messages p JOIN members m ON m.id=p.client_id WHERE p.worker_id=? GROUP BY p.client_id,p.worker_id,m.name ORDER BY last_at DESC LIMIT 100`,u.id);return json({conversations});}
 const workerId=idSchema.parse(url.searchParams.get('worker')),clientId=url.searchParams.get('client')||undefined;
 const ids=await pair(u,workerId,clientId);if(u.role==='client'&&!await one('SELECT id FROM profile_messages WHERE client_id=? AND worker_id=? LIMIT 1',ids.clientId,workerId)&&!(await publishedProfiles(workerId)).length&&!await previewCleaner(workerId))throw new HttpError(404,'Анкета недоступна');
 return json({me:u.id,messages:await all('SELECT id,sender_id,text,created FROM profile_messages WHERE client_id=? AND worker_id=? ORDER BY created DESC LIMIT 100',ids.clientId,ids.workerId)});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),body=z.object({workerId:idSchema,clientId:idSchema.optional(),text:z.string().trim().min(1).max(1000)}).parse(await readJsonBody(req));const ids=await pair(u,body.workerId,body.clientId);
 if(u.role==='client'&&!(await publishedProfiles(body.workerId)).length&&!await previewCleaner(body.workerId)&&!await one('SELECT id FROM profile_messages WHERE client_id=? AND worker_id=? LIMIT 1',ids.clientId,ids.workerId))throw new HttpError(404,'Анкета недоступна');
 if(u.role!=='client'&&!await one('SELECT id FROM profile_messages WHERE client_id=? AND worker_id=? LIMIT 1',ids.clientId,ids.workerId))throw new HttpError(403,'Сначала дождитесь сообщения клиента');
 await transaction(async tx=>{const since=new Date(Date.now()-3600000).toISOString();const count=await tx.one('SELECT COUNT(*) AS n FROM profile_messages WHERE sender_id=? AND created>?',u.id,since);if(Number(count.n)>=20)throw new HttpError(429,'Лимит сообщений за час. Попробуйте позже.');const recent=await tx.one('SELECT created FROM profile_messages WHERE sender_id=? ORDER BY created DESC LIMIT 1',u.id);if(recent&&Date.now()-Date.parse(recent.created)<1500)throw new HttpError(429,'Подождите пару секунд');await tx.run('INSERT INTO profile_messages(id,client_id,worker_id,sender_id,text,created) VALUES(?,?,?,?,?,?)',uid(),ids.clientId,ids.workerId,u.id,body.text,now());const recipient=u.id===ids.clientId?ids.workerId:ids.clientId;await tx.run('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)',uid(),recipient,'Новое сообщение в переписке с исполнителем',now());});return json({ok:true});
 }catch(e){return fail(e)}}
