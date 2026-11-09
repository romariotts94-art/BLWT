import {one,run,all,uid,now,HttpError,unpack} from './server';
import {legalBody,legalDocuments,operator,textHash} from './legal-content';
import {acceptanceStatus} from './legal-service';
import {services,extras} from './domain';
type Tx={one:typeof one,run:typeof run,all:typeof all};
export async function contractSnapshot(o:any,tx:Tx){
 if(!o.assignedWorkerId)throw new HttpError(409,'Сначала выберите исполнителя');
 const p=await tx.one('SELECT p.*,m.email FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=?',o.assignedWorkerId);
 if(!p?.legal_checked_at||!p.legal_name?.trim()||!/^\d{12}$/.test(p.npd_inn||''))throw new HttpError(409,'Для договора нужны проверенные ФИО и ИНН исполнителя');
 const client=await tx.one('SELECT email FROM members WHERE id=?',o.clientId);
 const facts={clientId:o.clientId,name:o.name,phone:o.phone,email:client.email,workerId:o.assignedWorkerId,workerName:p.legal_name,workerInn:p.npd_inn,workerEmail:p.claim_email||p.email,address:o.address,city:o.city,date:o.date,time:o.time,start:o.startAt,end:o.endAt,service:o.service,catalogService:o.catalogService,area:o.area,extras:o.extras,notes:o.notes,preferences:o.preferences,checklist:(o.checklist||[]).map((x:any)=>x.label),gross:o.grossCents,payout:o.payoutCents,version:legalDocuments.order.version,conditions:await textHash(legalBody('order')+legalBody('payment'))};
 if(!o.quoteAccepted||o.grossCents<=0)throw new HttpError(409,'Сначала согласуйте цену заказа');
 const money=(v:number)=>(v/100).toFixed(2)+' руб.';
 const body=[`ДОГОВОР БЫТОВОЙ УБОРКИ № ${o.id}`,
 `Заказчик: ${facts.name}. Email: ${facts.email}. Телефон: ${facts.phone}.`,
 `Исполнитель: ${facts.workerName}, ИНН ${facts.workerInn}, самозанятый без статуса ИП. Для претензий: ${facts.workerEmail}.`,
 `Агент исполнителя: ${operator.name}, ИНН ${operator.inn}, ОГРНИП ${operator.ogrnip}. ${operator.address}. ${operator.email}.`,
 `Объект: ${facts.city}, ${facts.address}. Дата и начало: ${facts.date}, ${facts.time} (Москва). Окончание согласованного интервала: ${new Date(o.endAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}.`,
 `Услуга: ${services[o.service as keyof typeof services]?.name||o.service}, ${o.area} м². Один исполнитель.`,
 `Дополнения: ${Object.entries(o.extras||{}).filter(([,n])=>Number(n)>0).map(([k,n])=>`${extras[k as keyof typeof extras]?.name||k}: ${n}`).join('; ')||'нет'}.`,
 `Состав работ: ${facts.checklist.join('; ')}. Пожелания: ${o.notes||'нет'}. Дополнительные условия: ${JSON.stringify(o.preferences||{})}.`,
 `Цена услуги для клиента: ${money(o.grossCents)}. Агентское вознаграждение за счёт исполнителя: ${money(o.grossCents-o.payoutCents)}. Исполнителю до его налога: ${money(o.payoutCents)}. Налоговый доход НПД включает полную цену услуги.`,
 legalBody('order'),legalBody('payment'),
 'Договор заключается после явного подтверждения обеими сторонами в своих личных кабинетах. Сохраняются полный текст, контрольная сумма SHA-256, идентификаторы сторон и время подтверждений. Замена исполнителя или изменение существенных условий требует новой редакции и повторных подтверждений.'].join('\n\n');
 return {body,hash:await textHash(body),fingerprint:await textHash(JSON.stringify(facts))};
}
export async function currentSignedContract(o:any,tx:Tx){
 const c=await tx.one('SELECT * FROM contract_versions WHERE order_id=? AND voided_at IS NULL',o.id);
 if(!c||c.worker_id!==o.assignedWorkerId||!c.client_accepted_at||!c.worker_accepted_at)return null;
 const snapshot=await contractSnapshot(o,tx);return snapshot.fingerprint===c.fingerprint?c:null;
}
export async function contractAction(u:any,b:any,tx:Tx){
 // Match marketplace lock order: worker, then order; recheck assignment after locking.
 const initial=await tx.one('SELECT assigned_worker_id FROM orders WHERE id=?',b.orderId);
 if(initial?.assigned_worker_id)await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',initial.assigned_worker_id);
 const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',b.orderId);
 if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);
 if(o.clientId!==u.id&&o.assignedWorkerId!==u.id&&u.role!=='admin')throw new HttpError(403,'Нет доступа');
 if(initial.assigned_worker_id!==o.assignedWorkerId)throw new HttpError(409,'Исполнитель изменился. Обновите заказ');
 if(!['assigned','contract_pending','admin_review'].includes(o.status))throw new HttpError(409,'Условия можно подтвердить до начала выполнения заказа');
 const s=await contractSnapshot(o,tx);let c=await tx.one('SELECT * FROM contract_versions WHERE order_id=? AND voided_at IS NULL',o.id);
 if(b.action==='prepare'){
  if(c&&c.fingerprint===s.fingerprint)return c;
  const f=await tx.one('SELECT * FROM order_finance WHERE order_id=?',o.id);
  if(f&&(Number(f.captured_cents)>Number(f.refunded_cents)||f.state==='authorized'))throw new HttpError(409,'Сначала урегулируйте оплату прежних условий');
  await tx.run('UPDATE contract_versions SET voided_at=? WHERE order_id=? AND voided_at IS NULL',now(),o.id);
  await tx.run('DELETE FROM contracts WHERE order_id=?',o.id);
  const id=uid(),at=now();
  await tx.run('INSERT INTO contract_versions(id,order_id,worker_id,client_id,version,body,body_hash,fingerprint,created) VALUES(?,?,?,?,?,?,?,?,?)',id,o.id,o.assignedWorkerId,o.clientId,legalDocuments.order.version,s.body,s.hash,s.fingerprint,at);
  await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Сформирован договор '+id+' SHA256 '+s.hash,at);
  return tx.one('SELECT * FROM contract_versions WHERE id=?',id);
 }
 if(b.action!=='sign'||b.accepted!==true)throw new HttpError(400,'Подтвердите прочитанный договор');
 if(!c||c.id!==b.contractId||c.body_hash!==b.hash||c.fingerprint!==s.fingerprint)throw new HttpError(409,'Условия изменились. Откройте новую редакцию');
 if(u.id!==o.clientId&&u.id!==o.assignedWorkerId)throw new HttpError(403,'Подтверждение доступно только стороне договора');
 if(u.id===o.assignedWorkerId&&!await acceptanceStatus(u.id,'partner',tx))throw new HttpError(409,'Сначала подтвердите агентский договор');
 const column=u.id===o.clientId?'client_accepted_at':'worker_accepted_at';
 if(!c[column]){
  await tx.run(`UPDATE contract_versions SET ${column}=? WHERE id=?`,now(),c.id);
  await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),o.id,u.id,'Подтверждён договор '+c.id+' SHA256 '+c.body_hash,now());
 }
 c=await tx.one('SELECT * FROM contract_versions WHERE id=?',c.id);
 await tx.run('INSERT INTO contracts(id,order_id,version,body,client_accepted_by,client_accepted_at,worker_accepted_by,worker_accepted_at,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET version=excluded.version,body=excluded.body,client_accepted_by=excluded.client_accepted_by,client_accepted_at=excluded.client_accepted_at,worker_accepted_by=excluded.worker_accepted_by,worker_accepted_at=excluded.worker_accepted_at,updated=excluded.updated',c.id,o.id,c.version,c.body,c.client_accepted_at?o.clientId:null,c.client_accepted_at,c.worker_accepted_at?o.assignedWorkerId:null,c.worker_accepted_at,c.created,now());
 return c;
}
