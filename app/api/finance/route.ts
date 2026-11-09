import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {currentUser,orderAccess,one,all,run,unpack,json,fail,HttpError,isOwner,guardOrigin,transaction,uid,now} from '../../../lib/server';
import {hasNonIpVerification} from '../../../lib/launch-policy.mjs';
import {allocation,applyFinanceEvidence} from '../../../lib/finance-policy';
import {currentSignedContract} from '../../../lib/order-contract';
import {readJsonBody} from '../../../lib/request-body';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=await currentUser(),id=new URL(req.url).searchParams.get('order');if(!id)throw new HttpError(400,'Не указан заказ');const o=await orderAccess(id,u),f=await one('SELECT * FROM order_finance WHERE order_id=?',id);return json({finance:f?{state:f.state,grossCents:Number(f.gross_cents),capturedCents:Number(f.captured_cents),refundedCents:Number(f.refunded_cents),paidCents:Number(f.payout_cents),mode:f.mode}:null,allocation:f?allocation(Number(f.captured_cents),Number(f.refunded_cents),Number(f.payout_cents)):null,refunds:await all('SELECT id,reason,requested_cents,state,resolution,created FROM refund_requests WHERE order_id=? ORDER BY created DESC',id),receipts:await all('SELECT id,kind,provider_reference,receipt_url,amount_cents,created FROM fiscal_documents WHERE order_id=? ORDER BY created',id),paymentsEnabled:false,recipients:u.role==='admin'?await all("SELECT id,masked_details,legal_name FROM payout_recipients WHERE worker_id=? AND status='verified'",o.assignedWorkerId):[],canReconcile:u.role==='admin'&&isOwner(u)&&(env as any).BANK_RECONCILIATION_ENABLED==='true'});}catch(e){return fail(e);}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),b:any=await readJsonBody(req);z.string().uuid().parse(b.orderId);return json(await transaction(async tx=>{
 const initial=await tx.one('SELECT assigned_worker_id FROM orders WHERE id=?',b.orderId);if(initial?.assigned_worker_id)await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',initial.assigned_worker_id);
 const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',b.orderId);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);
 if(u.role!=='admin'&&o.clientId!==u.id&&o.assignedWorkerId!==u.id)throw new HttpError(403,'Нет доступа');
 if(b.action==='requestRefund'){
  if(o.clientId!==u.id)throw new HttpError(403,'Возврат запрашивает заказчик');
  const reason=z.string().trim().min(3).max(2000).parse(b.reason),amount=z.number().int().positive().max(o.grossCents).parse(b.amountCents);
  const pending=await tx.one("SELECT id FROM refund_requests WHERE order_id=? AND state='requested'",o.id);if(pending)return {ok:true,id:pending.id};
  const id=uid();await tx.run('INSERT INTO refund_requests(id,order_id,member_id,reason,requested_cents,created,updated) VALUES(?,?,?,?,?,?,?)',id,o.id,u.id,reason,amount,now(),now());
  const admins=await tx.all("SELECT id FROM members WHERE role='admin' AND active=1");for(const admin of admins)await tx.run('INSERT INTO notices(id,user_id,order_id,text,created) VALUES(?,?,?,?,?)',uid(),admin.id,o.id,'Запрос возврата по заказу: '+reason,now());
  await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Запрошен возврат '+id,now());return {ok:true,id};
 }
 if(u.role!=='admin'||!isOwner(u))throw new HttpError(403,'Сверка доступна владельцу');
 if((env as any).BANK_RECONCILIATION_ENABLED!=='true')throw new HttpError(409,'Сверка банковских операций пока не подключена');
 if(b.action==='recipient'){
  const p=await tx.one('SELECT * FROM worker_profiles WHERE member_id=?',o.assignedWorkerId);if(!p?.legal_checked_at)throw new HttpError(409,'Сначала проверьте юридические сведения исполнителя');
  const token=z.string().trim().min(3).max(200).regex(/^[a-zA-Z0-9_.:-]+$/).parse(b.bankToken),masked=z.string().trim().min(4).max(120).parse(b.maskedDetails),evidence=z.string().trim().min(15).max(1200).parse(b.evidence);
  if(/\d{12,}/.test(token)||/\d{8,}/.test(masked))throw new HttpError(400,'Используйте идентификатор получателя банка и маскированные реквизиты, без полного номера карты');
  const prior=await tx.one("SELECT id FROM payout_recipients WHERE worker_id=? AND bank_token=? AND status='verified'",o.assignedWorkerId,token);if(prior)return {ok:true,id:prior.id};
  const id=uid();await tx.run('INSERT INTO payout_recipients(id,worker_id,legal_name,inn,bank_token,masked_details,status,evidence,verified_by,verified_at,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,o.assignedWorkerId,p.legal_name,p.npd_inn,token,masked,'verified',evidence,u.id,now(),now());await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Сверен получатель выплаты '+id,now());return {ok:true,id};
 }
 if(b.action==='resolveRefund'){
  const request=await tx.one("SELECT * FROM refund_requests WHERE id=? AND order_id=? AND state='requested'",b.refundId,o.id);if(!request)throw new HttpError(409,'Обращение уже рассмотрено');
  const resolution=z.string().trim().min(15).max(2000).parse(b.resolution),state=z.enum(['resolved','declined']).parse(b.state);
  const bankReference=state==='resolved'?z.string().trim().min(4).max(160).parse(b.reference):null;if(state==='resolved'&&!await tx.one("SELECT id FROM finance_events WHERE order_id=? AND reference=? AND kind IN ('refunded','reversed') AND amount_cents>=?",o.id,bankReference,Number(request.requested_cents)))throw new HttpError(409,'Укажите зарегистрированную банковскую операцию на сумму возврата');
  await tx.run('UPDATE refund_requests SET state=?,resolution=?,bank_reference=?,updated=? WHERE id=?',state,resolution,bankReference,now(),request.id);await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Решение по возврату '+request.id+': '+state+' '+resolution,now());return {ok:true};
 }
 const reference=z.string().trim().min(4).max(160).parse(b.reference),evidence=z.string().trim().min(12).max(2000).parse(b.evidence),amount=z.number().int().positive().safe().parse(b.amountCents);
 if(b.action==='receipt'){
  const kind=z.enum(['customer','commission','refund','npd']).parse(b.kind),url=z.string().url().startsWith('https://').max(1500).parse(b.url);
  const old=await tx.one('SELECT * FROM fiscal_documents WHERE provider_reference=?',reference);if(old){if(old.order_id!==o.id||old.kind!==kind||Number(old.amount_cents)!==amount||old.receipt_url!==url)throw new HttpError(409,'Номер чека уже зарегистрирован с другими данными');return {ok:true};}
  await tx.run('INSERT INTO fiscal_documents(id,order_id,kind,provider_reference,receipt_url,amount_cents,mode,actor,created) VALUES(?,?,?,?,?,?,?,?,?)',uid(),o.id,kind,reference,url,amount,'live',u.id,now());
  await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Зарегистрирован чек '+reference+'; основание сверки: '+evidence,now());return {ok:true};
 }
 if(b.action!=='evidence')throw new HttpError(400,'Неизвестная операция');
 const kind=z.enum(['authorized','captured','settled','refunded','reversed','paid']).parse(b.kind);
 const payload=JSON.stringify({kind,amount,evidence,expiresAt:b.expiresAt||null,recipientId:b.recipientId||null});
 const prior=await tx.one('SELECT * FROM finance_events WHERE reference=?',reference);if(prior){if(prior.order_id!==o.id||prior.body!==payload)throw new HttpError(409,'Банковский идентификатор уже связан с другой записью');return {ok:true};}
 let f=await tx.one('SELECT * FROM order_finance WHERE order_id=? FOR UPDATE',o.id);
 if(!f){if(!await currentSignedContract(o,tx))throw new HttpError(409,'Нужен договор с подтверждениями обеих сторон');f={order_id:o.id,gross_cents:o.grossCents,state:'unpaid',captured_cents:0,refunded_cents:0,available_cents:0,payout_cents:0,payout_state:'none',authorization_expires_at:null};await tx.run('INSERT INTO order_finance(order_id,mode,request_key,gross_cents,created,updated) VALUES(?,?,?,?,?,?)',o.id,'live',uid(),o.grossCents,now(),now());}
 if(kind==='captured'&&o.status!=='completed')throw new HttpError(409,'Списание по действующей карточной схеме возможно после приёмки');
 if(kind==='paid'){
  if(o.status!=='completed'||o.issue)throw new HttpError(409,'Сначала завершите приёмку и рассмотрение обращения по качеству');
  const pending=await tx.one("SELECT COALESCE(SUM(requested_cents),0) AS amount FROM refund_requests WHERE order_id=? AND state='requested'",o.id);const payable=allocation(Number(f.captured_cents),Number(f.refunded_cents),Number(f.payout_cents)).payable;if(amount>Math.max(0,payable-Number(pending.amount)))throw new HttpError(409,'Зарезервируйте спорную сумму до рассмотрения запроса возврата');
  const p=await tx.one('SELECT * FROM worker_profiles WHERE member_id=?',o.assignedWorkerId),day=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
  if(p?.contractor_type!=='npd'||Number(p.npd_status)!==1||p.npd_checked_on!==day)throw new HttpError(409,'Перед выплатой нужна сегодняшняя проверка НПД');
  const proof=await tx.one('SELECT value FROM settings WHERE key=?','non_ip_verification:'+o.assignedWorkerId);if(!hasNonIpVerification(proof?.value,p.npd_inn))throw new HttpError(409,'Подтвердите отсутствие статуса ИП');
  const recipient=await tx.one("SELECT * FROM payout_recipients WHERE id=? AND worker_id=? AND status='verified'",b.recipientId,o.assignedWorkerId);if(!recipient||recipient.inn!==p.npd_inn||recipient.legal_name!==p.legal_name)throw new HttpError(409,'Получатель выплаты не подтверждён');
  const customer=await tx.one("SELECT id FROM fiscal_documents WHERE order_id=? AND kind='customer' AND mode='live' AND amount_cents=?",o.id,Number(f.captured_cents));
  const commission=await tx.one("SELECT id FROM fiscal_documents WHERE order_id=? AND kind='commission' AND mode='live' AND amount_cents=?",o.id,allocation(Number(f.captured_cents),Number(f.refunded_cents)).commission);
  if(!customer||!commission)throw new HttpError(409,'Сверьте чек клиенту и чек агентского вознаграждения');
 }
 let n:any;try{n=applyFinanceEvidence(f,kind,amount,b.expiresAt);}catch(e:any){throw new HttpError(409,e.message);}
 await tx.run('UPDATE order_finance SET state=?,captured_cents=?,refunded_cents=?,available_cents=?,payout_cents=?,payout_state=?,authorization_expires_at=?,recipient_id=COALESCE(?,recipient_id),updated=? WHERE order_id=?',n.state,n.captured_cents,n.refunded_cents,n.available_cents,n.payout_cents,n.payout_state,n.authorization_expires_at,b.recipientId||null,now(),o.id);
 await tx.run('INSERT INTO finance_events(id,order_id,kind,amount_cents,reference,body,actor,created) VALUES(?,?,?,?,?,?,?,?)',uid(),o.id,kind,amount,reference,payload,u.id,now());return {ok:true};
 }));}catch(e){return fail(e);}}
