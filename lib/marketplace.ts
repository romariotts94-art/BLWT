import { z } from 'zod';
import { all,one,run,transaction,uid,now,HttpError,unpack,rates,requireAdmin,orderAccess,updateOrder,event,notify,admins } from './server';
import { bookingSchema,calculate,checklist,services,extras,transitions,publicQuote } from './domain';
import { cityById,cents,payoutFor,timeWindow,projectOrder,safeWorkerText,weekContext,lessons } from './marketplace-policy';
import { examFor } from './quality-bank';
import {matchesPreferences} from './care-policy';
type Tx={all:(sql:string,...p:any[])=>Promise<any[]>,one:(sql:string,...p:any[])=>Promise<any>,run:(sql:string,...p:any[])=>Promise<any>};
const read:Tx={all,one,run};
const worker=(u:any)=>{if(!['cleaner','leader'].includes(u.role))throw new HttpError(403,'Раздел доступен исполнителю');};
const validId=(v:any)=>z.string().uuid().parse(v);
const text=(v:any,max=2000)=>z.string().trim().min(1).max(max).parse(v);
const parse=(v:any,fallback:any)=>{try{return JSON.parse(v)}catch{return fallback}};
const workerLocalTime=(at:number,timezone:string)=>{
 const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(part=>[part.type,part.value]));
 return {date:`${values.year}-${values.month}-${values.day}`,minute:Number(values.hour)*60+Number(values.minute)};
};
const ruleDefaults={operator:'Black & White',requisites:'Будут заполнены позже',penaltyPercent:0,termsApproved:false,version:'placeholder-2026-10-21'};
export async function marketRules(tx:Tx=read){const s=await tx.one("SELECT value FROM settings WHERE key='marketplace_rules'");return {...ruleDefaults,...parse(s?.value,{})};}
async function log(tx:Tx,id:string|null,actor:string,action:string){await tx.run('INSERT INTO audit(id,order_id,actor,action,created) VALUES(?,?,?,?,?)',uid(),id,actor,action,now());}
async function tell(tx:Tx,ids:string[],order:string|null,message:string){for(const id of new Set(ids))await tx.run('INSERT INTO notices(id,user_id,order_id,text,created) VALUES(?,?,?,?,?)',uid(),id,order,message,now());}
async function adminIds(tx:Tx){return (await tx.all("SELECT id FROM members WHERE role='admin' AND active=1")).map(p=>p.id);}
async function patch(tx:Tx,o:any,delta:any,actor:string,action:string){
 const merged={...o,...delta};const {id,clientId,status,crew,target,revision,created,updated,cityId,startAt,endAt,grossCents,payoutCents,assignedWorkerId,claimUntil,marketplaceVersion,...details}=merged;
 const r=await tx.run('UPDATE orders SET status=?,crew=?,target=?,details=?,assigned_worker_id=?,claim_until=?,revision=revision+1,updated=? WHERE id=? AND revision=?',status,JSON.stringify(crew),target||null,JSON.stringify(details),assignedWorkerId||null,claimUntil||null,now(),id,o.revision);
 if(!r.meta.changes)throw new HttpError(409,'Заказ изменился. Обновите карточку.');await log(tx,id,actor,action);return merged;
}
// One shared SQL predicate is used by discovery, notifications and locked acceptance.
// This avoids N+1 queries and prevents offer/acceptance rules from diverging.
const eligibilityWhere=`
 o.marketplace_version=1 AND o.status='offered' AND (o.details::jsonb->>'quoteAccepted')::boolean=true AND o.start_at>?
 AND m.active=1 AND m.role IN ('cleaner','leader') AND p.enabled=1 AND p.verified=1
 AND (p.city_id=o.city_id OR jsonb_exists(p.service_city_ids::jsonb,o.city_id)
   OR (p.serve_region=1 AND EXISTS(
     SELECT 1 FROM cities home JOIN cities destination ON destination.id=o.city_id WHERE home.id=p.city_id
       AND (home.region=destination.region
         OR (home.region='Москва' AND destination.region='Московская область')
         OR (home.region='Санкт-Петербург' AND destination.region='Ленинградская область')
         OR (home.region='Севастополь' AND destination.region='Республика Крым')))))
 AND (COALESCE(o.details::jsonb->'preferences'->>'gender','any')='any' OR EXISTS (SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=p.member_id AND cc.gender=o.details::jsonb->'preferences'->>'gender'))
 AND (COALESCE((o.details::jsonb->'preferences'->>'fragranceFree')::boolean,false)=false OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=p.member_id AND cc.fragrance_free=true))
 AND (COALESCE((o.details::jsonb->'preferences'->>'pets')::boolean,false)=false OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=p.member_id AND cc.pet_friendly=true))
 AND (COALESCE((o.details::jsonb->'preferences'->>'ownProducts')::boolean,false)=false OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=p.member_id AND cc.own_products=true))
 AND p.capacity>=(o.details::jsonb->'quote'->>'workers')::integer AND p.min_payout_cents<=o.payout_cents
 AND (COALESCE((o.details::jsonb->>'liveConsent')::boolean,false)=false OR p.accepts_video=1)
 AND jsonb_exists(p.services::jsonb,o.details::jsonb->>'service')
 AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(o.details::jsonb->'extras') e WHERE e.value::numeric>0 AND NOT jsonb_exists(p.extras::jsonb,e.key))
 AND NOT EXISTS(SELECT 1 FROM order_skips s WHERE s.order_id=o.id AND s.worker_id=p.member_id)
 AND EXISTS(SELECT 1 FROM worker_availability a JOIN cities schedule_city ON schedule_city.id=p.city_id
   CROSS JOIN LATERAL (SELECT to_timestamp(o.start_at/1000.0) AT TIME ZONE schedule_city.timezone AS local_start,
     to_timestamp(o.end_at/1000.0) AT TIME ZONE schedule_city.timezone AS local_end) slot
   WHERE a.worker_id=p.member_id AND a.work_date=to_char(slot.local_start,'YYYY-MM-DD')
   AND (slot.local_start::date=slot.local_end::date OR
     (slot.local_end::date=slot.local_start::date+1 AND EXTRACT(HOUR FROM slot.local_end)=0 AND EXTRACT(MINUTE FROM slot.local_end)=0))
   AND a.start_min<=EXTRACT(HOUR FROM slot.local_start)*60+EXTRACT(MINUTE FROM slot.local_start)
   AND a.end_min>=CASE WHEN slot.local_end::date>slot.local_start::date THEN 1440
     ELSE EXTRACT(HOUR FROM slot.local_end)*60+EXTRACT(MINUTE FROM slot.local_end) END)
 AND NOT EXISTS(SELECT 1 FROM orders occupied WHERE occupied.id<>o.id AND (occupied.assigned_worker_id=p.member_id OR occupied.crew::jsonb @> jsonb_build_array(p.member_id))
   AND occupied.status IN ('contract_pending','admin_review','assigned','en_route','in_progress','review') AND (occupied.claim_until IS NULL OR occupied.claim_until>?)
   AND COALESCE(occupied.start_at,EXTRACT(EPOCH FROM ((occupied.details::jsonb->>'date')||'T'||(occupied.details::jsonb->>'time')||':00+03:00')::timestamptz)*1000)<o.end_at+p.travel_minutes*60000
   AND COALESCE(occupied.end_at,EXTRACT(EPOCH FROM ((occupied.details::jsonb->>'date')||'T'||(occupied.details::jsonb->>'time')||':00+03:00')::timestamptz)*1000+(occupied.details::jsonb->'quote'->>'hours')::numeric*3600000)>o.start_at-p.travel_minutes*60000)
`;
export async function eligible(o:any,id:string,tx:Tx=read,at=Date.now()){
 if(o.marketplaceVersion!==1||o.status!=='offered')return false;
 return !!await tx.one(`SELECT 1 FROM orders o CROSS JOIN worker_profiles p JOIN members m ON m.id=p.member_id WHERE o.id=? AND p.member_id=? AND ${eligibilityWhere}`,o.id,id,at,at);
}
export async function broadcast(tx:Tx,o:any){
 if(o.status!=='offered')return;
 const at=Date.now();await tx.run(`INSERT INTO notices(id,user_id,order_id,text,created,dedupe_key)
 SELECT gen_random_uuid()::text,p.member_id,o.id,?,?,('offer:'||o.id||':'||p.member_id)
 FROM orders o CROSS JOIN worker_profiles p JOIN members m ON m.id=p.member_id WHERE o.id=? AND ${eligibilityWhere} ON CONFLICT DO NOTHING`,
 `Новый заказ · ${o.city} · ${o.date}, ${o.time} · к получению ${o.payoutCents/100} ₽`,now(),o.id,at,at);
}
async function notifyWorkerOffers(tx:Tx,workerId:string){
 const at=Date.now();
 await tx.run(`INSERT INTO notices(id,user_id,order_id,text,created,dedupe_key)
 SELECT gen_random_uuid()::text,p.member_id,o.id,
   'Новый заказ · '||COALESCE(o.details::jsonb->>'city','город')||' · '||COALESCE(o.details::jsonb->>'date','')||', '||COALESCE(o.details::jsonb->>'time',''),
   ?,('offer:'||o.id||':'||p.member_id)
 FROM orders o CROSS JOIN worker_profiles p JOIN members m ON m.id=p.member_id
 WHERE p.member_id=? AND ${eligibilityWhere} ON CONFLICT DO NOTHING`,now(),workerId,at,at);
}
export async function expireClaims(){
 // Every mutation and refresh performs bounded cleanup. No reservation depends on an open browser.
 await transaction(async tx=>{const rows=await tx.all("SELECT * FROM orders WHERE status='contract_pending' AND claim_until<? ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 30",Date.now());
 for(const row of rows){const o=unpack(row);await tx.run("UPDATE worker_agreements SET state='void' WHERE order_id=? AND state='pending'",o.id);await tx.run('INSERT INTO order_skips(order_id,worker_id,created) VALUES(?,?,?) ON CONFLICT DO NOTHING',o.id,o.assignedWorkerId,now());await patch(tx,o,{status:'offered',crew:[],target:null,assignedWorkerId:null,claimUntil:null},o.assignedWorkerId,'Истекло время подтверждения договора');await tell(tx,[o.assignedWorkerId],o.id,'Время подтверждения договора истекло. Заказ снова доступен другим исполнителям.');}
 });
}
export async function marketAccess(id:string,u:any,allowOffer=false){
 const row=await one('SELECT * FROM orders WHERE id=?',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);
 if(u.role==='admin'||o.clientId===u.id||o.crew.includes(u.id))return o;
 if(allowOffer&&await eligible(o,u.id))return o;
 throw new HttpError(403,'Заказ недоступен');
}
function profile(p:any){return p?{...p,services:parse(p.services,[]),extras:parse(p.extras,[]),service_city_ids:parse(p.service_city_ids,[]),min_payout_cents:Number(p.min_payout_cents)}:null;}
export async function marketSnapshot(u:any,url:URL){
 await expireClaims();
 let rows:any[];
 if(u.role==='admin')rows=await all('SELECT * FROM orders ORDER BY created DESC LIMIT 1000');
 else if(u.role==='client')rows=await all('SELECT * FROM orders WHERE client_id=? ORDER BY created DESC LIMIT 1000',u.id);
 else {const at=Date.now();rows=await all(`SELECT o.* FROM orders o WHERE o.assigned_worker_id=? OR o.crew::jsonb @> ?::jsonb OR EXISTS(SELECT 1 FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=? AND ${eligibilityWhere}) ORDER BY o.created DESC LIMIT 1000`,u.id,JSON.stringify([u.id]),u.id,at,at);}
 const id=url.searchParams.get('order');let selected:any;if(id){selected=await marketAccess(validId(id),u,true);if(!rows.some(r=>r.id===id))rows.unshift(await one('SELECT * FROM orders WHERE id=?',id));}
 const result:any={user:u,orders:rows.map(unpack).map(o=>projectOrder(o,u)),people:[],teams:[],rates:await rates(),notifications:await all('SELECT * FROM notices WHERE user_id=? ORDER BY created DESC LIMIT 80',u.id),lessons};
 if(u.role==='admin'){
 result.matching=await all(`SELECT o.id,COUNT(*) AS count FROM orders o CROSS JOIN worker_profiles p JOIN members m ON m.id=p.member_id WHERE ${eligibilityWhere} GROUP BY o.id`,Date.now(),Date.now());
 result.people=await all('SELECT id,email,name,role,team_id,active FROM members ORDER BY name');result.teams=await all('SELECT * FROM teams');result.invitations=await all('SELECT * FROM invitations');result.audit=await all('SELECT * FROM audit ORDER BY created DESC LIMIT 60');
 result.workers=(await all("SELECT p.*,m.name,m.email,m.active,m.role,c.name AS city,c.region,(SELECT MAX(valid_until) FROM quality_attempts q WHERE q.worker_id=p.member_id AND q.passed=1) AS training_until FROM worker_profiles p JOIN members m ON m.id=p.member_id LEFT JOIN cities c ON c.id=p.city_id WHERE m.role IN ('cleaner','leader') ORDER BY m.name")).map(profile);
 result.customers=await all('SELECT p.*,m.email,c.id AS city_id,c.name AS city,c.region,cc.last_order_at,(SELECT COUNT(*) FROM orders o WHERE o.client_id=p.member_id) AS order_count FROM customer_profiles p JOIN members m ON m.id=p.member_id LEFT JOIN customer_cities cc ON cc.member_id=p.member_id LEFT JOIN cities c ON c.id=cc.city_id ORDER BY p.updated DESC LIMIT 1000');
 result.withdrawals=await all('SELECT w.*,m.name FROM withdrawal_requests w JOIN members m ON m.id=w.worker_id ORDER BY w.created DESC LIMIT 200');result.incidents=await all('SELECT i.*,m.name FROM order_incidents i JOIN members m ON m.id=i.worker_id ORDER BY i.created DESC LIMIT 200');result.rules=await marketRules();
 }
 if(['cleaner','leader'].includes(u.role)){
 await run('INSERT INTO worker_profiles(member_id,updated) VALUES(?,?) ON CONFLICT DO NOTHING',u.id,now());result.profile=profile(await one('SELECT * FROM worker_profiles WHERE member_id=?',u.id));result.availability=await all('SELECT * FROM worker_availability WHERE worker_id=? AND work_date>=? ORDER BY work_date,start_min',u.id,new Date().toISOString().slice(0,10));
 const city=cityById(result.profile.city_id),week=weekContext(city?.timezone);result.training={...week,attempts:await all('SELECT id,week,score,passed,valid_until,created FROM quality_attempts WHERE worker_id=? ORDER BY created DESC LIMIT 12',u.id),questions:examFor(week.week).map(({answer,...q})=>q)};
 result.wallet=await wallet(u.id);result.incidents=await all('SELECT * FROM order_incidents WHERE worker_id=? ORDER BY created DESC LIMIT 50',u.id);
 }
 if(selected){
 const client=selected.clientId===u.id,isOffer=!selected.crew.includes(u.id)&&u.role!=='admin'&&!client;
 result.media=(await all('SELECT id,name,mime,purpose,created FROM media WHERE order_id=? ORDER BY created',id)).filter(m=>!isOffer||m.purpose==='brief').map(m=>({...m,name:u.role==='admin'?m.name:'Фото заказа'}));
 result.messages=isOffer?[]:(await all('SELECT m.*,p.role AS author_role FROM messages m LEFT JOIN members p ON p.id=m.user_id WHERE order_id=? ORDER BY created LIMIT 300',id)).map(m=>u.role==='admin'?m:{id:m.id,text:client?(m.user_id===u.id?m.text:safeWorkerText(m.text,m.name)):safeWorkerText(m.text,selected.name),created:m.created,user_id:m.user_id===u.id?u.id:null,name:m.user_id===u.id?'Вы':client?(m.author_role==='admin'?'Поддержка Black & White':'Сотрудник Black & White'):(m.author_role==='client'?'Заказчик':'Поддержка Black & White')});
 if(u.role==='admin'||selected.crew.includes(u.id)){result.agreement=await one("SELECT * FROM worker_agreements WHERE order_id=? AND state<>'void' ORDER BY created DESC LIMIT 1",id);}
 }
 return result;
}
export async function wallet(id:string){
 const totals=await one("SELECT COALESCE(SUM(amount_cents),0) AS balance,COALESCE(SUM(amount_cents) FILTER (WHERE kind='earning'),0) AS earned,COALESCE(-SUM(amount_cents) FILTER (WHERE kind='payout'),0) AS paid FROM wallet_ledger WHERE worker_id=?",id);
 const reserved=await one("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM withdrawal_requests WHERE worker_id=? AND status='pending'",id);
 const pending=await one("SELECT COALESCE(SUM(payout_cents),0) AS amount FROM orders WHERE assigned_worker_id=? AND status IN ('admin_review','assigned','en_route','in_progress','review')",id);
 return {balance:Number(totals.balance),earned:Number(totals.earned),paid:Number(totals.paid),reserved:Number(reserved.amount),available:Number(totals.balance)-Number(reserved.amount),pending:Number(pending.amount),entries:await all('SELECT id,order_id,kind,amount_cents,note,created FROM wallet_ledger WHERE worker_id=? ORDER BY created DESC LIMIT 100',id),requests:await all('SELECT * FROM withdrawal_requests WHERE worker_id=? ORDER BY created DESC LIMIT 30',id)};
}
async function agreementBody(o:any,r:any){
 const body=!r.termsApproved?`ДОГОВОР — ВРЕМЕННАЯ ЗАГЛУШКА\n\nЗаказ BW-${o.id.slice(0,6).toUpperCase()}\nГород: ${o.city}\nДата и время: ${o.date}, ${o.time} (${o.timezone})\nРаботы: ${services[o.service as keyof typeof services].name}, ${o.area} м²\nПродолжительность: ${o.quote.hours} ч\nСостав: ${o.quote.workers} сотрудник(а)\nК получению за весь заказ: ${(o.payoutCents/100).toFixed(2)} ₽\n\nПолный договор и реквизиты будут добавлены позже. Сейчас кнопка подтверждает ознакомление с заданием и отправляет назначение на проверку администратору. Эта заглушка не устанавливает неустойку.\n\nЕсли не получается выполнить работу в согласованное время, сообщите об этом через карточку заказа.`:`ЗАДАНИЕ ИСПОЛНИТЕЛЮ BLACK & WHITE\nВерсия: ${r.version}\nЗаказ BW-${o.id.slice(0,6).toUpperCase()}\nОрганизатор: ${r.operator}\nРеквизиты: ${r.requisites}\n\nМесто: ${o.city}, ${safeWorkerText(o.address,o.name)}\nНачало: ${o.date}, ${o.time} (${o.timezone})\nСрок выполнения: ${o.quote.hours} ч с начала работ.\nРаботы: ${services[o.service as keyof typeof services].name}, ${o.area} м².\nДополнительно: ${Object.entries(o.extras||{}).filter(([,q])=>Number(q)>0).map(([k,q])=>`${extras[k as keyof typeof extras]?.name}: ${q}`).join('; ')||'нет'}.\nПримечания: ${safeWorkerText(o.notes,o.name)||'нет'}.\nСостав: ${o.quote.workers} сотрудник(а). Принявший задание отвечает за согласованный состав.\nВознаграждение за весь заказ: ${(o.payoutCents/100).toFixed(2)} ₽.\n\n1. Исполнитель обязуется выполнить указанные работы качественно и в срок, соблюдать инструкции по безопасности и конфиденциальность. Изменение состава, времени и дополнительных работ согласуется с Организатором.\n2. Задание вступает в исполнение после подтверждения администратором. До подтверждения заказ не считается окончательно назначенным.\n3. При угрозе срыва сроков Исполнитель без промедления сообщает причину через карточку заказа и предоставляет подтверждающие сведения. Организатор рассматривает обстоятельства и возражения Исполнителя.\n4. За неисполнение или нарушение срока без уважительной причины предусмотрена неустойка ${r.penaltyPercent}% от указанного вознаграждения за заказ, однократно, не более этой суммы. Уважительные причины и обстоятельства, исключающие ответственность, рассматриваются индивидуально. Решение, расчёт и обоснование фиксируются в карточке. Автоматического списания с банковской карты нет.\n5. Выполнение фиксируется чек-листом и фотоотчётом, результат принимает клиент или администратор. Начисление вознаграждения производится один раз после приёмки.\n6. Подтверждение в личном кабинете сохраняет версию, полный текст, контрольную сумму, пользователя и время согласия. Стороны применяют согласованный ими порядок электронного взаимодействия.\n\nПодтверждая, исполнитель ознакомился с полным текстом, сроком, вознаграждением и условиями ответственности.`;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));return {body,hash:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
export const marketActions=new Set(['replaceWorker','productsUsed','book','publishBooking','accept','decline','dispatch','signAgreement','approveAssignment','rejectAssignment','workerProfile','availability','verifyWorker','qualityTest','withdraw','reviewWithdrawal','rules','reportIncident','reviewIncident','status','estimate','approve','prepareLegacy']);
export async function marketAction(u:any,b:any){
 await expireClaims();
 if(b.action==='book'){
 const input=bookingSchema.extend({cityId:z.string().uuid()}).parse(b.input),city=cityById(input.cityId);if(!city)throw new HttpError(400,'Выберите город из справочника');
 const expectedPhotos=z.number().int().min(0).max(8).parse(b.expectedPhotos||0);const key=validId(b.requestKey),existing=await one('SELECT id FROM orders WHERE client_id=? AND request_key=?',u.id,key);if(existing)return {id:existing.id};
 const prelim=timeWindow(input.date,input.time,city.offset,1);if(prelim.start<Date.now()+3600000||prelim.start>Date.now()+180*86400000)throw new HttpError(400,'Дата заказа должна быть от часа до 180 дней вперёд по времени города');
 input.urgent=input.urgent||prelim.start-Date.now()<86400000;const quote=calculate(input,await rates()),span=timeWindow(input.date,input.time,city.offset,quote.hours);if(Number(input.time.slice(0,2))*60+Number(input.time.slice(3))+quote.hours*60>1440)throw new HttpError(400,'Объём не помещается в рабочий день. Увеличьте количество сотрудников или выберите более раннее время.');
 const id=uid(),data={...input,city:city.name,region:city.region,timezone:city.timezone,quote,payment:'stub',checklist:checklist.map(label=>({label,done:false})),quoteAccepted:!quote.needsEstimate,liveStates:{},issue:'',accessNote:'',termsVersion:'2026-10-21',photoPending:expectedPhotos>0,expectedPhotos};
 return transaction(async tx=>{
 await tx.one('SELECT id FROM members WHERE id=? FOR UPDATE',u.id);const duplicate=await tx.one('SELECT id FROM orders WHERE client_id=? AND request_key=?',u.id,key);if(duplicate)return {id:duplicate.id};if((await tx.all('SELECT id FROM orders WHERE client_id=? AND created>?',u.id,new Date(Date.now()-60000).toISOString())).length>=3)throw new HttpError(429,'Подождите минуту перед следующей заявкой');
 await tx.run('INSERT INTO orders(id,client_id,status,details,created,updated,marketplace_version,city_id,start_at,end_at,gross_cents,payout_cents,request_key) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?)',id,u.id,quote.needsEstimate||expectedPhotos>0?'requested':'offered',JSON.stringify(data),now(),now(),city.id,span.start,span.end,cents(quote.total),payoutFor(cents(quote.total)),key);
 await tx.run('INSERT INTO customer_profiles(member_id,name,phone,updated) VALUES(?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET name=excluded.name,phone=excluded.phone,updated=excluded.updated',u.id,input.name,input.phone,now());await tx.run('INSERT INTO customer_cities(member_id,city_id,last_order_at) VALUES(?,?,?) ON CONFLICT(member_id,city_id) DO UPDATE SET last_order_at=excluded.last_order_at',u.id,city.id,now());
 await log(tx,id,u.id,'Создан заказ · '+city.name);await tell(tx,await adminIds(tx),id,`Новая заявка · ${city.name} · ${input.date}`);await tell(tx,[u.id],id,'Заявка получена. Подбираем сотрудников в вашем городе.');await broadcast(tx,unpack(await tx.one('SELECT * FROM orders WHERE id=?',id)));return {id};});
 }
 if(b.action==='workerProfile'){
 worker(u);const p=z.object({cityId:z.string().uuid(),serviceCityIds:z.array(z.string().uuid()).max(50).optional(),serveRegion:z.boolean().optional(),bio:z.string().trim().max(1200),services:z.array(z.enum(['standard','deep','renovation','office','custom'])).min(1),extras:z.array(z.string()).refine(xs=>xs.every(k=>k in extras)),minPayout:z.number().min(0).max(1000000),travelMinutes:z.number().int().min(30).max(180),acceptsVideo:z.boolean(),enabled:z.boolean()}).parse(b.profile);
 if(!cityById(p.cityId)||p.serviceCityIds?.some(id=>!cityById(id))||p.serviceCityIds&&new Set(p.serviceCityIds).size!==p.serviceCityIds.length)throw new HttpError(400,'Проверьте выбранные города');
 await transaction(async tx=>{await tx.run('INSERT INTO worker_profiles(member_id,updated) VALUES(?,?) ON CONFLICT DO NOTHING',u.id,now());const old=await tx.one('SELECT * FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);const chosenCities=(p.serviceCityIds??parse(old.service_city_ids,[])).filter((id:string)=>id!==p.cityId);await tx.run('UPDATE worker_profiles SET city_id=?,service_city_ids=?,serve_region=?,bio=?,services=?,extras=?,min_payout_cents=?,travel_minutes=?,accepts_video=?,enabled=?,verified=?,updated=? WHERE member_id=?',p.cityId,JSON.stringify(chosenCities),p.serveRegion===undefined?old.serve_region:p.serveRegion?1:0,p.bio,JSON.stringify(p.services),JSON.stringify(p.extras),cents(p.minPayout),p.travelMinutes,p.acceptsVideo?1:0,p.enabled?1:0,old.city_id===p.cityId?old.verified:0,now(),u.id);if(old.city_id!==p.cityId)await tell(tx,await adminIds(tx),null,'Профиль исполнителя ожидает проверки города и специализации.');await log(tx,null,u.id,'Обновлена география и специализация исполнителя');await notifyWorkerOffers(tx,u.id);});return {ok:true};
 }
 if(b.action==='availability'){
 worker(u);const list=z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),start:z.number().int().min(0).max(1439),end:z.number().int().min(1).max(1440)})).max(500).parse(b.slots);const sorted=[...list].sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
 for(let i=0;i<sorted.length;i++){const s=sorted[i];if(s.end<=s.start||new Date(s.date+'T12:00:00Z').toISOString().slice(0,10)!==s.date||Date.parse(s.date+'T12:00:00Z')>Date.now()+181*86400000)throw new HttpError(400,'Проверьте дату и время смены');if(i&&sorted[i-1].date===s.date&&sorted[i-1].end>s.start)throw new HttpError(400,'Смены пересекаются');}
 await transaction(async tx=>{
  const workerProfile=await tx.one('SELECT city_id FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);
  const timezone=cityById(workerProfile?.city_id)?.timezone||'Europe/Moscow';
  const active=await tx.all("SELECT start_at,end_at,details FROM orders WHERE assigned_worker_id=? AND status IN ('contract_pending','admin_review','assigned','en_route','in_progress')",u.id);
  for(const row of active){
   const order=parse(row.details,{});
   let date=order.date,start=+order.time.slice(0,2)*60+ +order.time.slice(3),end=start+order.quote.hours*60;
   if(row.start_at&&row.end_at){const begin=workerLocalTime(Number(row.start_at),timezone),finish=workerLocalTime(Number(row.end_at),timezone);date=begin.date;start=begin.minute;end=finish.date===date?finish.minute:finish.minute===0?1440:Number.POSITIVE_INFINITY;}
   if(!sorted.some(slot=>slot.date===date&&slot.start<=start&&slot.end>=end))throw new HttpError(409,'Смена содержит принятый заказ. Сначала согласуйте перенос с администратором.');
  }
  await tx.run('DELETE FROM worker_availability WHERE worker_id=?',u.id);
  for(const slot of sorted)await tx.run('INSERT INTO worker_availability(id,worker_id,work_date,start_min,end_min) VALUES(?,?,?,?,?)',uid(),u.id,slot.date,slot.start,slot.end);
  await notifyWorkerOffers(tx,u.id);
 });return {ok:true};
 }
 if(b.action==='verifyWorker'){
 requireAdmin(u);const id=validId(b.workerId),capacity=z.number().int().min(1).max(12).parse(b.capacity);await transaction(async tx=>{const p=await tx.one('SELECT * FROM worker_profiles WHERE member_id=? FOR UPDATE',id);if(!p?.city_id)throw new HttpError(400,'Исполнитель должен заполнить город');await tx.run('UPDATE worker_profiles SET verified=?,capacity=?,updated=? WHERE member_id=?',b.verified===true?1:0,capacity,now(),id);await log(tx,null,u.id,'Проверен профиль исполнителя');await tell(tx,[id],null,b.verified?'Профиль проверен. Заполните календарь, чтобы получать подходящие заказы. Учебные материалы и тест доступны отдельно.':'Профиль направлен на повторную проверку');if(b.verified===true)await notifyWorkerOffers(tx,id);});return {ok:true};
 }
 if(b.action==='qualityTest'){
 worker(u);return transaction(async tx=>{const p=await tx.one('SELECT * FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);if(!p)throw new HttpError(400,'Сначала заполните профиль');const ctx=weekContext(cityById(p.city_id)?.timezone);if(b.week!==ctx.week)throw new HttpError(409,'Началась новая неделя. Обновите тест');const recent=await tx.one('SELECT created FROM quality_attempts WHERE worker_id=? ORDER BY created DESC LIMIT 1',u.id);if(recent&&Date.now()-Date.parse(recent.created)<30000)throw new HttpError(429,'Повторите тест через 30 секунд');const answers=z.record(z.number().int().min(0).max(2)).parse(b.answers),qs=examFor(ctx.week);if(qs.some(q=>answers[q.id]===undefined))throw new HttpError(400,'Ответьте на все вопросы');const score=qs.filter(q=>answers[q.id]===q.answer).length,passed=score>=4;await tx.run('INSERT INTO quality_attempts(id,worker_id,week,score,passed,valid_until,created) VALUES(?,?,?,?,?,?,?)',uid(),u.id,ctx.week,score,passed?1:0,ctx.validUntil,now());return {ok:true,score,passed};});
 }
 if(b.action==='rules'){requireAdmin(u);const r=z.object({operator:z.string().trim().min(3).max(300),requisites:z.string().trim().min(10).max(3000),penaltyPercent:z.number().min(0).max(100),termsApproved:z.literal(true)}).parse(b.rules);await run("INSERT INTO settings(key,value) VALUES('marketplace_rules',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({...r,version:now()}));await event(null,u.id,'Утверждена новая версия условий для исполнителей');return {ok:true};}
 if(b.action==='withdraw'){
 worker(u);const amount=cents(z.number().min(1).max(10000000).parse(b.amount));return transaction(async tx=>{await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);if(await tx.one("SELECT 1 FROM withdrawal_requests WHERE worker_id=? AND status='pending'",u.id))throw new HttpError(409,'У вас уже есть заявка на выплату');const balance=await tx.one('SELECT COALESCE(SUM(amount_cents),0) AS amount FROM wallet_ledger WHERE worker_id=?',u.id);if(amount>Number(balance.amount))throw new HttpError(400,'Недостаточно доступных средств');await tx.run('INSERT INTO withdrawal_requests(id,worker_id,amount_cents,created,updated) VALUES(?,?,?,?,?)',uid(),u.id,amount,now(),now());await tell(tx,await adminIds(tx),null,'Новая заявка исполнителя на выплату');return {ok:true};});
 }
 if(b.action==='reviewWithdrawal'){
 requireAdmin(u);const id=validId(b.requestId),decision=z.enum(['paid','rejected']).parse(b.decision),reference=decision==='paid'?text(b.reference,200):'',note=text(b.note,1000);return transaction(async tx=>{const initial=await tx.one('SELECT * FROM withdrawal_requests WHERE id=?',id);if(!initial)throw new HttpError(404,'Заявка не найдена');await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',initial.worker_id);const w=await tx.one('SELECT * FROM withdrawal_requests WHERE id=? FOR UPDATE',id);if(w.status!=='pending')throw new HttpError(409,'Выплата уже обработана');if(decision==='paid'){const balance=await tx.one('SELECT COALESCE(SUM(amount_cents),0) AS amount FROM wallet_ledger WHERE worker_id=?',w.worker_id);if(Number(balance.amount)<Number(w.amount_cents))throw new HttpError(409,'Баланс изменился. Отклоните заявку и согласуйте новую сумму');await tx.run("INSERT INTO wallet_ledger(id,worker_id,kind,amount_cents,reference,note,actor,created) VALUES(?,?,'payout',?,?,?,?,?)",uid(),w.worker_id,-Number(w.amount_cents),'payment:'+reference,note,u.id,now());}await tx.run('UPDATE withdrawal_requests SET status=?,reference=?,note=?,updated=? WHERE id=?',decision,reference,note,now(),id);await log(tx,null,u.id,'Обработана заявка на выплату');await tell(tx,[w.worker_id],null,decision==='paid'?'Выплата отмечена администратором как перечисленная':'Заявка на выплату отклонена: '+note);return {ok:true};});
 }
 const id=validId(b.id);
 if(b.action==='productsUsed'){return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);if(u.role!=='admin'&&!o.crew.includes(u.id))throw new HttpError(403,'Нет доступа');if(!['in_progress','review'].includes(o.status))throw new HttpError(409,'Отчёт доступен во время уборки');await patch(tx,o,{productsUsed:text(b.text,2000)},u.id,'Сохранён список использованных средств');return {ok:true};});}
 if(b.action==='replaceWorker'){return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);if(u.role!=='admin'&&o.clientId!==u.id)throw new HttpError(403,'Нет доступа');if(!o.assignedWorkerId||!['contract_pending','admin_review','assigned','en_route'].includes(o.status)||o.startAt<=Date.now())throw new HttpError(409,'Автоматическая замена доступна до начала заказа. Напишите поддержке.');const reason=text(b.reason,1000);await tx.run('INSERT INTO order_skips(order_id,worker_id,created) VALUES(?,?,?) ON CONFLICT DO NOTHING',id,o.assignedWorkerId,now());await tx.run("UPDATE worker_agreements SET state='void' WHERE order_id=? AND state<>'void'",id);await tx.run('DELETE FROM channels WHERE order_id=?',id);const next=await patch(tx,o,{status:'offered',crew:[],target:null,assignedWorkerId:null,claimUntil:null,liveStates:{}},u.id,'Запрошена замена исполнителя: '+reason);await tell(tx,[o.clientId,...o.crew,...await adminIds(tx)],id,'Клиент запросил замену исполнителя. Начат повторный подбор.');await broadcast(tx,next);return {ok:true};});}
 if(b.action==='publishBooking'){return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);if(o.clientId!==u.id&&u.role!=='admin')throw new HttpError(403,'Нет доступа');if(!o.photoPending)return {ok:true};if(o.status!=='requested')throw new HttpError(409,'Заказ изменён');const next=await patch(tx,o,{photoPending:false,status:o.quoteAccepted?'offered':'requested'},u.id,'Фотографии заявки готовы, начат подбор');await broadcast(tx,next);return {ok:true};});}

 if(b.action==='accept'){
 worker(u);return transaction(async tx=>{
 await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);
 if(o.assignedWorkerId===u.id&&['contract_pending','admin_review','assigned'].includes(o.status))return {ok:true};
 if(!await eligible(o,u.id,tx))throw new HttpError(409,'Заказ уже принят или больше не подходит вашему городу, графику либо допускам');
 const rules=await marketRules(tx);
 const {body,hash}=await agreementBody(o,rules),until=Math.min(Date.now()+30*60000,o.startAt);await tx.run('INSERT INTO worker_agreements(id,order_id,worker_id,version,body,body_hash,payout_cents,penalty_percent,created) VALUES(?,?,?,?,?,?,?,?,?)',uid(),id,u.id,rules.version,body,hash,o.payoutCents,rules.termsApproved?rules.penaltyPercent:0,now());
 await patch(tx,o,{status:'contract_pending',crew:[u.id],target:u.id,assignedWorkerId:u.id,claimUntil:until},u.id,'Исполнитель зарезервировал заказ для подтверждения договора');await tell(tx,[u.id],id,'Заказ зарезервирован на 30 минут. Прочитайте и подтвердите договор.');return {ok:true};});
 }
 if(b.action==='decline'){worker(u);await transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row||!await eligible(unpack(row),u.id,tx))throw new HttpError(409,'Предложение уже недоступно');await tx.run('INSERT INTO order_skips(order_id,worker_id,created) VALUES(?,?,?) ON CONFLICT DO NOTHING',id,u.id,now());});return {ok:true};}
 if(b.action==='signAgreement'){
 worker(u);if(b.accepted!==true)throw new HttpError(400,'Подтвердите согласие с полным текстом договора');return transaction(async tx=>{await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',u.id);const o=unpack(await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id)||{details:'{}',crew:'[]'});const a=await tx.one("SELECT * FROM worker_agreements WHERE id=? AND order_id=? AND worker_id=? AND state<>'void' FOR UPDATE",validId(b.agreementId),id,u.id);if(!a||a.body_hash!==b.bodyHash)throw new HttpError(409,'Версия договора изменилась. Откройте актуальный текст');if(a.state==='signed'&&o.assignedWorkerId===u.id)return {ok:true};if(o.status!=='contract_pending'||o.assignedWorkerId!==u.id||o.claimUntil<=Date.now())throw new HttpError(409,'Резерв заказа истёк');await tx.run("UPDATE worker_agreements SET state='signed',accepted_by=?,accepted_at=? WHERE id=?",u.id,now(),a.id);await patch(tx,o,{status:'admin_review',claimUntil:null},u.id,'Исполнитель подтвердил договор '+a.version);await tell(tx,await adminIds(tx),id,'Исполнитель принял заказ и подтвердил договор. Требуется проверка назначения.');return {ok:true};});
 }
 if(['approveAssignment','rejectAssignment'].includes(b.action)){
 requireAdmin(u);return transaction(async tx=>{const initial=await tx.one('SELECT assigned_worker_id FROM orders WHERE id=?',id);if(initial?.assigned_worker_id)await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',initial.assigned_worker_id);const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);if(!['admin_review','contract_pending'].includes(o.status))throw new HttpError(409,'Назначение уже обработано');if(b.action==='approveAssignment'){
 if(o.status!=='admin_review'||!await tx.one("SELECT id FROM worker_agreements WHERE order_id=? AND worker_id=? AND state='signed'",id,o.assignedWorkerId))throw new HttpError(400,'Сначала исполнитель должен подтвердить договор');
 const p=await tx.one('SELECT p.*,m.active FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE member_id=?',o.assignedWorkerId);const card=await tx.one('SELECT * FROM cleaner_cards WHERE member_id=?',o.assignedWorkerId);if(!matchesPreferences(o.preferences,card||{}))throw new HttpError(409,'Исполнитель больше не соответствует предпочтениям клиента');if(!p?.active||!p.verified||p.capacity<o.quote.workers||o.startAt<=Date.now())throw new HttpError(409,'Проверьте профиль, город, состав команды и дату заказа');if(!parse(p.services,[]).includes(o.service)||Object.entries(o.extras||{}).some(([k,v])=>Number(v)>0&&!parse(p.extras,[]).includes(k)))throw new HttpError(409,'Специализация исполнителя изменилась. Верните заказ в подбор.');
 await patch(tx,o,{status:'assigned'},u.id,'Администратор подтвердил назначение');await tell(tx,[o.clientId],id,'Заказ подтверждён. Сотрудники Black & White приедут в согласованное время.');await tell(tx,o.crew,id,'Администратор подтвердил заказ. Можно готовиться к выезду.');
 }else{const reason=text(b.reason,1000);await tx.run("UPDATE worker_agreements SET state='void' WHERE order_id=? AND state<>'void'",id);await tx.run('INSERT INTO order_skips(order_id,worker_id,created) VALUES(?,?,?) ON CONFLICT DO NOTHING',id,o.assignedWorkerId,now());const released=await patch(tx,o,{status:'offered',crew:[],target:null,assignedWorkerId:null,claimUntil:null},u.id,'Назначение отклонено: '+reason);await tell(tx,o.crew,id,'Назначение не подтверждено: '+reason);await broadcast(tx,released);}return {ok:true};});
 }
 if(b.action==='dispatch'){requireAdmin(u);return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');let o=unpack(row);if(!o.marketplaceVersion)throw new HttpError(400,'Для старой заявки сначала подтвердите город');if(!['requested','offered'].includes(o.status)||!o.quoteAccepted)throw new HttpError(400,'Сначала согласуйте смету');o=await patch(tx,o,{status:'offered',target:null},u.id,'Запущен подбор всех подходящих исполнителей');await broadcast(tx,o);return {ok:true};});}
 if(b.action==='prepareLegacy'){
 requireAdmin(u);const city=cityById(validId(b.cityId));if(!city)throw new HttpError(400,'Город не найден');return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row||row.marketplace_version||!['requested','offered'].includes(row.status))throw new HttpError(409,'Заявка уже обработана');const o=unpack(row),span=timeWindow(o.date,o.time,city.offset,o.quote.hours);if(span.start<=Date.now())throw new HttpError(400,'Дата старой заявки уже прошла');const details={...parse(row.details,{}),city:city.name,region:city.region,timezone:city.timezone,cityId:city.id};await tx.run('UPDATE orders SET marketplace_version=1,city_id=?,start_at=?,end_at=?,gross_cents=?,payout_cents=?,details=?,status=?,target=NULL,revision=revision+1 WHERE id=?',city.id,span.start,span.end,cents(o.quote.total),payoutFor(cents(o.quote.total)),JSON.stringify(details),o.quoteAccepted?'offered':'requested',id);await tx.run('INSERT INTO customer_cities(member_id,city_id,last_order_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',o.clientId,city.id,now());await log(tx,id,u.id,'Подтверждён город старой заявки: '+city.name);await broadcast(tx,unpack(await tx.one('SELECT * FROM orders WHERE id=?',id)));return {ok:true};});
 }
 if(b.action==='reportIncident'){
 worker(u);const o=await marketAccess(id,u);if(!o.crew.includes(u.id)||!['contract_pending','admin_review','assigned','en_route','in_progress','review'].includes(o.status))throw new HttpError(403,'Обращение доступно по принятому заказу');await transaction(async tx=>{await tx.one('SELECT id FROM orders WHERE id=? FOR UPDATE',id);if(await tx.one("SELECT id FROM order_incidents WHERE order_id=? AND worker_id=? AND status='pending'",id,u.id))throw new HttpError(409,'Обращение уже ожидает рассмотрения');await tx.run('INSERT INTO order_incidents(id,order_id,worker_id,reason,created) VALUES(?,?,?,?,?)',uid(),id,u.id,text(b.reason),now());await tell(tx,await adminIds(tx),id,'Исполнитель сообщил о невозможности выполнить заказ в срок');});return {ok:true};
 }
 if(b.action==='reviewIncident'){
 requireAdmin(u);const incidentId=validId(b.incidentId),decision=z.enum(['excused','penalty']).parse(b.decision),note=text(b.note);return transaction(async tx=>{const incident=await tx.one('SELECT * FROM order_incidents WHERE id=?',incidentId);if(!incident||incident.order_id!==id)throw new HttpError(404,'Обращение не найдено');await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',incident.worker_id);const i=await tx.one('SELECT * FROM order_incidents WHERE id=? FOR UPDATE',incidentId);if(i.status!=='pending')throw new HttpError(409,'Обращение уже рассмотрено');let amount=0;if(decision==='penalty'){const a=await tx.one("SELECT * FROM worker_agreements WHERE order_id=? AND worker_id=? AND accepted_at IS NOT NULL ORDER BY created DESC LIMIT 1",id,i.worker_id);if(!a)throw new HttpError(400,'Нет подтверждённого соглашения');amount=cents(z.number().positive().parse(b.amount));const previous=await tx.one("SELECT COALESCE(-SUM(amount_cents),0) AS amount FROM wallet_ledger WHERE order_id=? AND worker_id=? AND kind='penalty'",id,i.worker_id);if(amount+Number(previous.amount)>Math.floor(Number(a.payout_cents)*Number(a.penalty_percent)/100))throw new HttpError(400,'Неустойка превышает лимит подтверждённого договора');await tx.run("INSERT INTO wallet_ledger(id,worker_id,order_id,kind,amount_cents,reference,note,actor,created) VALUES(?,?,?,'penalty',?,?,?,?,?)",uid(),i.worker_id,id,-amount,'incident:'+i.id,note,u.id,now());}await tx.run('UPDATE order_incidents SET status=?,admin_note=?,penalty_cents=?,reviewed_at=? WHERE id=?',decision,note,amount,now(),i.id);await log(tx,id,u.id,decision==='excused'?'Причина признана уважительной':'Начислена неустойка с обоснованием');await tell(tx,[i.worker_id],id,(decision==='excused'?'Причина признана уважительной. ':'Рассмотрено нарушение. ')+note);return {ok:true};});
 }
 if(b.action==='status'){
 const status=z.string().parse(b.status);return transaction(async tx=>{
 const initial=await tx.one('SELECT assigned_worker_id FROM orders WHERE id=?',id);if(initial?.assigned_worker_id)await tx.one('SELECT member_id FROM worker_profiles WHERE member_id=? FOR UPDATE',initial.assigned_worker_id);
 const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row),crew=o.crew.includes(u.id),client=o.clientId===u.id;
 if(u.role!=='admin'&&!crew&&!client)throw new HttpError(403,'Нет доступа');if(o.status===status&&['completed','cancelled'].includes(status))return {ok:true};if(!transitions[o.status]?.includes(status))throw new HttpError(409,'Недопустимый переход статуса');
 if(!(u.role==='admin'||crew&&['en_route','in_progress','review'].includes(status)||client&&(status==='completed'||status==='cancelled'&&['requested','offered','contract_pending','admin_review','assigned','en_route'].includes(o.status))))throw new HttpError(403,'Нет прав на изменение статуса');
 if(['assigned','offered','admin_review','contract_pending'].includes(status))throw new HttpError(400,'Используйте процесс назначения');if(status==='review'&&(o.checklist.some((x:any)=>!x.done)||!await tx.one("SELECT id FROM media WHERE order_id=? AND purpose='report'",id)))throw new HttpError(400,'Завершите чек-лист и добавьте хотя бы одно фото результата');
 if(['review','completed'].includes(status)&&(!String(o.productsUsed||'').trim()||!await tx.one("SELECT id FROM media WHERE order_id=? AND purpose='products'",id)))throw new HttpError(400,'Укажите использованные средства и добавьте фото флаконов с читаемыми этикетками');
 if(status==='completed'&&o.issue)throw new HttpError(400,'Сначала рассмотрите обращение по качеству');
 await patch(tx,o,{status,claimUntil:null,liveStates:['completed','cancelled','review'].includes(status)?{}:o.liveStates},u.id,'Статус: '+status);
 if(status==='completed'&&o.marketplaceVersion===1&&o.assignedWorkerId&&o.payoutCents>0)await tx.run("INSERT INTO wallet_ledger(id,worker_id,order_id,kind,amount_cents,reference,note,actor,created) VALUES(?,?,?,'earning',?,?,?,?,?) ON CONFLICT DO NOTHING",uid(),o.assignedWorkerId,id,o.payoutCents,'earning:'+id,'Уборка принята',u.id,now());
 if(status==='cancelled'){await tx.run("UPDATE worker_agreements SET state='void' WHERE order_id=? AND state<>'void'",id);}if(['completed','cancelled','review'].includes(status))await tx.run('DELETE FROM channels WHERE order_id=?',id);
 const labels:any={en_route:'Сотрудники Black & White в пути',in_progress:'Уборка началась',review:'Уборка готова к приёмке',completed:'Результат принят. Заказ завершён',cancelled:'Заказ отменён'};await tell(tx,[o.clientId,...o.crew,...await adminIds(tx)],id,labels[status]||'Статус заказа обновлён');return {ok:true};});
 }
 if(['estimate','approve'].includes(b.action)){
 return transaction(async tx=>{const row=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!row)throw new HttpError(404,'Заказ не найден');const o=unpack(row);if(o.status!=='requested')throw new HttpError(409,'Смета доступна до начала подбора');if(b.action==='estimate'){
 requireAdmin(u);const total=z.number().int().min(1000).max(10000000).parse(b.total),hours=z.number().min(1).max(16).parse(b.hours),workers=z.number().int().min(1).max(12).parse(b.workers);if(+o.time.slice(0,2)+ +o.time.slice(3)/60+hours>24)throw new HttpError(400,'Работы должны помещаться в выбранный день');await patch(tx,o,{quote:{...o.quote,total,hours,workers,needsEstimate:false,manual:true},quoteAccepted:false},u.id,'Подготовлена индивидуальная смета');if(o.marketplaceVersion===1)await tx.run('UPDATE orders SET gross_cents=?,payout_cents=?,end_at=start_at+? WHERE id=?',cents(total),payoutFor(cents(total)),hours*3600000,id);await tell(tx,[o.clientId],id,'Смета готова. Подтвердите стоимость в карточке заказа');
 }else{if(o.clientId!==u.id)throw new HttpError(403,'Стоимость подтверждает заказчик');if(!o.quote.total||o.quote.needsEstimate)throw new HttpError(400,'Смета пока не готова');const next=await patch(tx,o,{quoteAccepted:true,status:o.marketplaceVersion===1?'offered':'requested'},u.id,'Заказчик подтвердил смету');await broadcast(tx,next);await tell(tx,await adminIds(tx),id,'Заказчик подтвердил смету');}return {ok:true};});
 }
 throw new HttpError(400,'Неизвестное действие');
}
