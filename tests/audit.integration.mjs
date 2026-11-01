import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {cities} from '../lib/marketplace-policy.ts';
import {examFor} from '../lib/quality-bank.ts';
import {cleaningCatalog} from '../lib/cleaning-catalog.ts';

const database=process.env.QA_DATABASE_URL;
if(!database||!['localhost','127.0.0.1'].includes(new URL(database).hostname)||!new URL(database).pathname.includes('qa'))throw Error('Requires an isolated localhost QA database');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5185';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('QA HTTP must be local');
const db=new pg.Client({connectionString:database});await db.connect();
const secret=process.env.QA_AUTH_SECRET||'local-qa-session-secret',stamp=new Date().toISOString(),accounts={},runId=randomUUID();
const hash=s=>createHash('sha256').update(s).digest('hex');
let checks=0;const pass=label=>console.log(`PASS ${++checks}: ${label}`);
async function req(role,path,body,status=200,method=body?'POST':'GET'){
 const response=await fetch(base+path,{method,headers:{Origin:base,...(role?{Cookie:'bw_session='+accounts[role].token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify({path,action:body?.action,status:response.status,value}));return value;
}
const act=(role,body,status)=>req(role,'/api/platform',body,status);
try{
 for(const [key,role,name] of [['admin','admin','Администратор Аудит'],['client','client','Клиент Аудит'],['worker','cleaner','Исполнитель Аудит'],['worker2','cleaner','Второй Исполнитель'],['stranger','client','Другой Клиент']]){
  const result=await db.query('INSERT INTO members(id,email,name,role,created) VALUES($1,$2,$3,$4,$5) RETURNING id',[randomUUID(),key+'-'+runId+'@audit.invalid',name,role,stamp]);
  const id=result.rows[0].id,token=randomUUID();accounts[key]={id,token};
  await db.query('INSERT INTO auth_sessions(token_hash,member_id,expires_at,created_at) VALUES($1,$2,$3,$4)',[hash(secret+':'+token),id,Date.now()+86400000,Date.now()]);
 }
 await req(null,'/api/health');await req(null,'/api/platform',undefined,401);
 const forged=await fetch(base+'/api/platform',{headers:{'oai-authenticated-user-id':accounts.admin.id,'oai-authenticated-user-email':'admin@audit.invalid'}});assert.equal(forged.status,401);pass('Standalone server rejects forged identity headers');
 for(const path of ['/api/cleaners','/api/documents','/api/contracts','/api/files','/api/live','/api/order-messages','/api/management-messages','/api/staff-messages','/api/support','/api/npd'])await req(null,path,undefined,401);
 pass('Protected routes require authentication');
 await act('admin',{action:'rates'},400);await act('admin',{action:'active',userId:accounts.worker2.id,active:'false'},400);pass('Malformed administrator settings are rejected as input errors');
 await req('client','/api/admin/avatar',undefined,403);
 const malformed=await fetch(base+'/api/platform',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{bad'});assert.equal(malformed.status,400);
 const oversized=await fetch(base+'/api/platform',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:' '.repeat(129*1024)});assert.equal(oversized.status,413);pass('Invalid JSON and oversized request bodies return client errors');
 const city=cities.find(c=>c.name==='Москва'),date=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
 const npdDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
 for(const key of ['worker','worker2']){
  await req(key,'/api/platform');
  await act(key,{action:'workerProfile',profile:{cityId:city.id,bio:'Тестовый исполнитель для изолированной проверки приложения.',services:['standard','deep','custom'],extras:['oven'],minPayout:0,travelMinutes:60,acceptsVideo:false,enabled:true}});
  await db.query('UPDATE worker_profiles SET npd_inn=$1,npd_consent_at=$2,npd_status=1,npd_checked_on=$3 WHERE member_id=$4',['000000000000',stamp,npdDate,accounts[key].id]);
  await act(key,{action:'availability',slots:[{date,start:480,end:1320}]});
 }
 await db.query("UPDATE worker_profiles SET verified=1 WHERE member_id=ANY($1::text[])",[[accounts.worker.id,accounts.worker2.id]]);
 await act('admin',{action:'rules',rules:{operator:'QA Operator',requisites:'Isolated local test',penaltyPercent:0,termsApproved:true}});
 pass('Worker profile and schedule save without SQL errors');
 const profile={displayName:'Исполнитель Аудит',experienceYears:3,gender:'unspecified',languages:'Русский',specialties:'Уборка квартир',equipment:'Пылесос',fragranceFree:true,petFriendly:true,ownProducts:false};
 await req('worker','/api/cleaners',{profile});
 const card=(await req('worker','/api/cleaners?id='+accounts.worker.id)).card;assert.equal(card.fragranceFree,true);assert.equal(card.ownProducts,false);
 await req('stranger','/api/cleaners?id='+accounts.worker.id,undefined,403);pass('Cleaner card persists booleans and restricts profile access');
 const contacts=await req('client','/api/management-messages?contacts=1');assert(contacts.contacts.some(c=>c.id===accounts.admin.id&&c.active));pass('Client can select active administrators');
 const input={service:'standard',catalogService:'standard',area:60,dirt:0,frequency:0,urgent:false,extras:{},workers:1,name:'Клиент Аудит',phone:'+79990000001',cityId:city.id,address:'Тестовая улица, дом 1, учебный объект',date,time:'10:00',notes:'Тестовый заказ. Не выполнять.',liveConsent:false,terms:true};
 for(const service of cleaningCatalog){const quote=await act(null,{action:'quote',input:{...input,service:service.quoteService,catalogService:service.id}});assert(Number.isFinite(quote.total));assert(quote.hours>0);}pass('Every catalog service has a valid server quote');
 await act('client',{action:'book',input:{...input,date:'2030-02-31'},requestKey:randomUUID()},400);
 const requestKey=randomUUID(),raceBookings=await Promise.all([act('client',{action:'book',input,requestKey}),act('client',{action:'book',input,requestKey})]),created=raceBookings[0],id=created.id;
 assert.equal(raceBookings[1].id,id);
 assert.equal((await act('client',{action:'book',input,requestKey})).id,id);pass('Booking retry is idempotent');
 await req('stranger','/api/platform?order='+id,undefined,403);
 const offer=(await req('worker','/api/platform')).orders.find(o=>o.id===id);assert(offer);assert(!offer.phone&&!offer.name);assert.equal(offer.quote.total,4050);pass('Offers hide customer contacts and expose only worker compensation');
 await act('worker2',{action:'decline',id});assert(!(await req('worker2','/api/platform')).orders.some(o=>o.id===id));pass('Skip survives the next refresh');
 await db.query('DELETE FROM order_skips WHERE order_id=$1 AND worker_id=$2',[id,accounts.worker2.id]);
 const race=await Promise.all(['worker','worker2'].map(async key=>{const response=await fetch(base+'/api/platform',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:'bw_session='+accounts[key].token},body:JSON.stringify({action:'accept',id})});return {key,status:response.status,body:await response.json()};}));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409],JSON.stringify(race));const winner=race.find(r=>r.status===200).key;pass('Concurrent acceptance has exactly one winner');
 const clientOrder=(await req('client','/api/platform?order='+id)).orders.find(o=>o.id===id);assert.equal(clientOrder.canRequestReplacement,true);assert.equal(clientOrder.catalogService,'standard');
 assert((await req('client','/api/contracts?order='+id)).body);assert((await req(winner,'/api/contracts?order='+id)).body);await req('stranger','/api/contracts?order='+id,undefined,403);
 await req('client','/api/contracts',{order:id,role:'client'});await req(winner,'/api/contracts',{order:id,role:'client'},403);pass('Contract visibility, customer acceptance and replacement capability');
 const second=(await act('stranger',{action:'book',input,requestKey:randomUUID()})).id;await act(winner,{action:'accept',id:second},409);pass('Worker cannot accept overlapping bookings');
 await req('client','/api/order-messages',{orderId:id,participantId:accounts[winner].id,text:'Здравствуйте, проверяем заказ.'});
 await req(winner,'/api/order-messages',{orderId:id,participantId:accounts.client.id,text:'Заказ вижу, детали получил.'});
 const messages=await req('client',`/api/order-messages?orderId=${id}&contactId=${accounts[winner].id}`);assert.equal(messages.messages.length,2);
 await req('stranger',`/api/order-messages?orderId=${id}`,undefined,403);pass('Customer/worker conversation and third-party denial');
 await req('admin','/api/order-messages',{orderId:id,participantId:accounts.client.id,text:'Личное сообщение администратора клиенту.'});
 assert.equal((await req('client',`/api/order-messages?orderId=${id}&contactId=${accounts[winner].id}`)).messages.length,2);pass('Private admin message does not leak into worker conversation');
 assert((await req('client','/api/order-messages?orderId='+id)).contacts.some(contact=>contact.id===accounts.admin.id));const adminThread=await req('client',`/api/order-messages?orderId=${id}&contactId=${accounts.admin.id}`);assert.equal(adminThread.messages.length,1);assert.equal(adminThread.messages[0].text,'Личное сообщение администратора клиенту.');pass('Private administrator messages have a separate visible customer thread');
 await act(winner,{action:'status',id,status:'en_route'},409);
 await act(winner,{action:'status',id,status:'in_progress'},409);
 await db.query('UPDATE orders SET start_at=$1,end_at=$2 WHERE id=$3',[Date.now()-60000,Date.now()+3600000,id]);
 await act(winner,{action:'status',id,status:'en_route'});await act(winner,{action:'status',id,status:'in_progress'});await act(winner,{action:'status',id,status:'review'},400);
 let order=(await req(winner,'/api/platform?order='+id)).orders.find(o=>o.id===id);
 for(let index=0;index<order.checklist.length;index++)await act(winner,{action:'check',id,index,done:true});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2l8AAAAASUVORK5CYII=','base64');
 const adminAvatar=new FormData();adminAvatar.set('file',new Blob([png],{type:'image/png'}),'avatar.png');assert.equal((await fetch(base+'/api/admin/avatar',{method:'POST',headers:{Origin:base,Cookie:'bw_session='+accounts.admin.token},body:adminAvatar})).status,200);const avatarResponse=await fetch(base+'/api/admin/avatar',{headers:{Cookie:'bw_session='+accounts.admin.token}});assert.equal(avatarResponse.status,200);assert.equal(avatarResponse.headers.get('content-type'),'image/png');pass('Administrator avatar retains the uploaded MIME type');
 async function uploadWorker(path,includeFile=true){const form=new FormData();form.set('worker',accounts[winner].id);if(includeFile)form.set('file',new Blob([png],{type:'image/png'}),'audit.png');else form.set('action','submit');const response=await fetch(base+path,{method:'POST',headers:{Origin:base,Cookie:'bw_session='+accounts[winner].token},body:form});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
 const workPhoto=await uploadWorker('/api/cleaners/work-photo');
 const photoUrl='/api/cleaners/work-photo?id='+workPhoto.id;
 assert.equal((await fetch(base+photoUrl,{headers:{Cookie:'bw_session='+accounts.client.token}})).status,200);await req('stranger',photoUrl,undefined,403);
 await req(winner,photoUrl,undefined,200,'DELETE');await req(winner,photoUrl,undefined,404);pass('Portfolio photo uploads, access restrictions and physical deletion');
 await uploadWorker('/api/cleaners/avatar');assert.equal((await fetch(base+'/api/cleaners/avatar?id='+accounts[winner].id,{headers:{Cookie:'bw_session='+accounts.client.token}})).status,200);
 const doc=await uploadWorker('/api/documents');await uploadWorker('/api/documents',false);await req('client','/api/documents/file?id='+doc.id,undefined,403);await req(winner,'/api/documents',{id:doc.id,status:'approved'},403,'PATCH');await req('admin','/api/documents',{id:doc.id,status:'approved'},200,'PATCH');assert((await req(winner,'/api/documents?worker='+accounts[winner].id)).documents.some(d=>d.id===doc.id&&d.review_status==='approved'));pass('Avatar and worker document submission/review permissions');
 await req('client','/api/live?order='+id,undefined,403);pass('Live video denied without consent');
 async function upload(purpose){const form=new FormData();form.set('order',id);form.set('purpose',purpose);form.set('file',new Blob([png],{type:'image/png'}),'audit.png');const r=await fetch(base+'/api/files',{method:'POST',headers:{Origin:base,Cookie:'bw_session='+accounts[winner].token},body:form});assert.equal(r.status,200,await r.text());}
 await upload('report');await act(winner,{action:'status',id,status:'review'},400);await upload('products');await act(winner,{action:'productsUsed',id,text:'Тестовое средство / тестовая поверхность / по инструкции'});await act(winner,{action:'status',id,status:'review'});pass('Checklist, result photo and products report required before review');
 await act('client',{action:'issue',id,text:'Проверяем сценарий замечания по качеству'});await act('client',{action:'status',id,status:'completed'},400);
 await act('admin',{action:'resolve',id,text:'Замечание проверено и устранено'});await act('client',{action:'status',id,status:'completed'});await act('client',{action:'status',id,status:'completed'});
 assert.equal((await db.query("SELECT COUNT(*) FROM wallet_ledger WHERE order_id=$1 AND kind='earning'",[id])).rows[0].count,'1');pass('Quality issue blocks acceptance; completion credits earnings once');
 await act('client',{action:'review',id,rating:5,name:'Аудит',text:'Изолированная проверка полного цикла выполнена.',publishConsent:false});
 await req('client','/api/order-messages',{orderId:id,participantId:accounts[winner].id,text:'После закрытия'},403);pass('Review saved, closed order chat is read-only');
 await act('client',{action:'message',id,text:'Старый API чата тоже закрыт'},400);
 await act('stranger',{action:'status',id:second,status:'cancelled'});pass('Customer cancels their unassigned order');
 const ticket=await req('client','/api/support',{subject:'Аудит поддержки',text:'Тестовый вопрос'});await req('admin','/api/support',{ticketId:ticket.id,text:'Тестовый ответ'});assert.equal((await req('client','/api/support?ticket='+ticket.id)).messages.length,2);await req('stranger','/api/support?ticket='+ticket.id,undefined,403);await req('admin','/api/support',{ticketId:ticket.id,close:true});await req('client','/api/support',{ticketId:ticket.id,text:'Закрытый тикет'},409);pass('Support reply, access control, closure');
 await req('client','/api/management-messages',{contactId:accounts.admin.id,text:'Личное сообщение руководству'});await req('admin','/api/management-messages',{contactId:accounts.client.id,text:'Ответ руководства'});assert.equal((await req('client','/api/management-messages?contactId='+accounts.admin.id)).messages.length,2);await req('worker','/api/management-messages?contactId='+accounts.client.id,undefined,403);pass('Management messages are restricted to their participants');
 await db.query("INSERT INTO management_messages(id,sender_id,recipient_id,text,created) SELECT gen_random_uuid(),$1,$2,'archive-'||n,to_char(timestamp '2020-01-01'+n*interval '1 second','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') FROM generate_series(1,501) n",[accounts.client.id,accounts.admin.id]);
 const longChat=(await req('client','/api/management-messages?contactId='+accounts.admin.id)).messages;assert.equal(longChat.length,500);assert(longChat.some(m=>m.text==='Ответ руководства'));assert(!longChat.some(m=>m.text==='archive-1'));pass('Long conversations return recent messages');
 const photoOrder=(await act('client',{action:'book',input,requestKey:randomUUID(),expectedPhotos:1})).id;await act('client',{action:'publishBooking',id:photoOrder},400);await act('admin',{action:'dispatch',id:photoOrder},400);
 const brief=new FormData();brief.set('order',photoOrder);brief.set('purpose','brief');brief.set('file',new Blob([png],{type:'image/png'}),'brief.png');assert.equal((await fetch(base+'/api/files',{method:'POST',headers:{Origin:base,Cookie:'bw_session='+accounts.client.token},body:brief})).status,200);await act('client',{action:'publishBooking',id:photoOrder});await act('client',{action:'status',id:photoOrder,status:'cancelled'});pass('Booking cannot enter matching until promised photos upload');
 const estimated=(await act('client',{action:'book',input:{...input,service:'custom',catalogService:'commercial'},requestKey:randomUUID()})).id;await act('client',{action:'approve',id:estimated},400);await act('admin',{action:'estimate',id:estimated,total:9000,hours:3,workers:1});await act('stranger',{action:'approve',id:estimated},403);await act('client',{action:'approve',id:estimated});assert.equal((await req('client','/api/platform?order='+estimated)).orders.find(o=>o.id===estimated).quote.total,9000);await act('client',{action:'status',id:estimated,status:'cancelled'});pass('Manual estimate requires administrator pricing and customer approval');
 const replacement=(await act('stranger',{action:'book',input,requestKey:randomUUID()})).id;await act('worker',{action:'accept',id:replacement});await act('stranger',{action:'replaceWorker',id:replacement,reason:'Нужен другой исполнитель'});await act('worker',{action:'accept',id:replacement},409);await act('worker2',{action:'accept',id:replacement});await act('stranger',{action:'status',id:replacement,status:'cancelled'});pass('Customer replaces worker and old assignment is invalidated');
 const overdue=(await act('stranger',{action:'book',input,requestKey:randomUUID()})).id;await db.query('UPDATE orders SET start_at=$1,end_at=$2 WHERE id=$3',[Date.now()-3600000,Date.now()-1000,overdue]);assert.equal((await req('stranger','/api/platform?order='+overdue)).orders.find(o=>o.id===overdue).status,'needs_reschedule');await act('stranger',{action:'reschedule',id:overdue,date,time:'22:00'},400);await act('stranger',{action:'reschedule',id:overdue,date,time:'10:00'});await act('stranger',{action:'status',id:overdue,status:'cancelled'});pass('Expired offers move to rescheduling with workday validation');
 const own=(await act('worker',{action:'book',input,requestKey:randomUUID()})).id;await act('worker',{action:'accept',id:own},409);await act('worker',{action:'status',id:own,status:'cancelled'});pass('Worker cannot accept their own customer booking');
 await act('client',{action:'team',name:'Запрещённая команда'},403);await act('admin',{action:'team',name:'Аудит '+runId,skills:'Тест'});await act('client',{action:'active',userId:accounts.worker.id,active:false},403);await act('admin',{action:'active',userId:accounts.worker2.id,active:false});await req('worker2','/api/platform',undefined,401);await act('admin',{action:'active',userId:accounts.worker2.id,active:true});await req('worker2','/api/platform');await act('admin',{action:'active',userId:accounts.admin.id,active:false},400);pass('Admin team creation and account activation permissions');
 const training=(await req('worker','/api/platform')).training;await act('worker',{action:'qualityTest',week:training.week,answers:Object.fromEntries(examFor(training.week).map(q=>[q.id,q.answer]))});pass('Academy test records a result');
 const email='otp-'+randomUUID()+'@audit.invalid',code='123456';await db.query('INSERT INTO auth_codes(email,code_hash,expires_at,attempts,requested_at) VALUES($1,$2,$3,0,$4)',[email,hash(secret+':'+email+':'+code),Date.now()+600000,Date.now()]);
 const verify=()=>fetch(base+'/api/auth/verify',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,code,intent:'register'})});const codes=await Promise.all([verify(),verify()]);assert.deepEqual(codes.map(r=>r.status).sort(),[200,400]);pass('OTP can only be consumed once under concurrent requests');
 const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:'https://untrusted.invalid',Cookie:'bw_session='+accounts.client.token}});assert.equal(logout.status,403);pass('Cross-origin logout is rejected');
 const mailAddress='mail-'+runId+'@audit.invalid',sendCode=()=>fetch(base+'/api/auth/request',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:mailAddress})});
 const mailRequests=await Promise.all([sendCode(),sendCode()]);assert.deepEqual(mailRequests.map(r=>r.status).sort(),[200,429]);pass('Concurrent email requests send only one code through local SMTP');
 await req('client','/api/auth/logout',{},200);await req('client','/api/platform',undefined,401);pass('Logout invalidates the server session');
 console.log(`AUDIT PASSED: ${checks} groups; all fixtures are isolated in ${new URL(database).pathname}`);
}finally{await db.end();}
