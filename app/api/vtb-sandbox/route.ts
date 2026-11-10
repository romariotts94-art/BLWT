import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {currentUser,orderAccess,one,all,run,unpack,json,fail,HttpError,isOwner,guardOrigin,transaction,uid,now} from '../../../lib/server';
import {currentSignedContract} from '../../../lib/order-contract';
import {readJsonBody} from '../../../lib/request-body';
import {registerPreAuth,getOrderStatus,getOrderStatusByNumber,capture,reverse,refund} from '../../../lib/vtb-rbs';
import {checkedBankStatus,confirmedAmounts,allowedAction,type AttemptState} from '../../../lib/vtb-sandbox-policy';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const UUID=z.string().uuid();
type Attempt={id:string,order_id:string,order_number:string,amount_cents:number|string,provider_order_id:string|null,form_url:string|null,state:AttemptState,bank_status:number|null,captured_cents:number|string,refunded_cents:number|string,pending_action:string|null,pending_action_id:string|null,pending_amount_cents:number|string|null,created:string,updated:string};
const credentials=()=>({userName:String((env as any).VTB_SANDBOX_USER_NAME||''),password:String((env as any).VTB_SANDBOX_PASSWORD||'')});

async function stageOrigin(){
 if((env as any).VTB_SANDBOX_ENABLED!=='true'||(await one("SELECT value FROM settings WHERE key='deployment_mode'"))?.value!=='vtb-sandbox')throw new HttpError(404,'Тестовая оплата недоступна');
 let url:URL;try{url=new URL(String((env as any).VTB_SANDBOX_RETURN_ORIGIN||''))}catch{throw new HttpError(503,'Не задан адрес тестового стенда')}
 if(!['http:','https:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost'].includes(url.hostname)||['blacktowhite.ru','www.blacktowhite.ru'].includes(url.hostname))throw new HttpError(503,'Некорректный адрес тестового стенда');
 if(!credentials().userName||!credentials().password)throw new HttpError(503,'Не заданы тестовые учётные данные ВТБ');
 return url.origin;
}
function expose(a:Attempt){return {id:a.id,orderId:a.order_id,amountCents:Number(a.amount_cents),state:a.state,bankStatus:a.bank_status==null?null:Number(a.bank_status),capturedCents:Number(a.captured_cents),refundedCents:Number(a.refunded_cents),pendingAction:a.pending_action,formUrl:a.state==='registered'?a.form_url:null,created:a.created,updated:a.updated}}
function bankError(e:unknown){return new HttpError(502,e instanceof Error?e.message:'ВТБ не ответил')}
async function record(attemptId:string,action:string,result:string,amount:number|null,bankStatus:number|null){await run('INSERT INTO vtb_sandbox_events(id,attempt_id,action,amount_cents,result,bank_status,created) VALUES(?,?,?,?,?,?,?)',uid(),attemptId,action,amount,result,bankStatus,now())}

async function syncFinance(a:Attempt,bankStatus:number,captured:number,refunded:number){
 if(![1,2,3,4,8].includes(bankStatus)&&refunded===Number(a.refunded_cents))return;
 await transaction(async tx=>{
  const row=await tx.one('SELECT gross_cents FROM orders WHERE id=? FOR UPDATE',a.order_id);
  if(!row||Number(row.gross_cents)!==Number(a.amount_cents))throw new HttpError(409,'Цена тестового заказа изменилась');
  let f=await tx.one('SELECT * FROM order_finance WHERE order_id=? FOR UPDATE',a.order_id);
  if(f&&(f.mode!=='sandbox'||f.provider_order_id&&f.provider_order_id!==a.provider_order_id))throw new HttpError(409,'У заказа есть другая финансовая операция');
  if(!f){const at=now();await tx.run('INSERT INTO order_finance(order_id,mode,provider_order_id,request_key,gross_cents,created,updated) VALUES(?,?,?,?,?,?,?)',a.order_id,'sandbox',a.provider_order_id,a.id,Number(a.amount_cents),at,at);f={state:'unpaid',captured_cents:0,refunded_cents:0};}
  const priorCaptured=Number(f.captured_cents||0),priorRefunded=Number(f.refunded_cents||0);
  const events:{kind:string,amount:number,total:number}[]=[];
  if(bankStatus===1&&f.state==='unpaid'){
   // Conservative local TTL. The bank remains the source of authorization status.
   await tx.run('UPDATE order_finance SET state=?,authorization_expires_at=?,updated=? WHERE order_id=?','authorized',new Date(Date.now()+3600000).toISOString(),now(),a.order_id);events.push({kind:'authorized',amount:Number(a.amount_cents),total:0});
  }else if([2,4,8].includes(bankStatus)){
   if(captured<priorCaptured)throw new HttpError(502,'Сумма списания ВТБ уменьшилась');
   if(captured>priorCaptured){await tx.run('UPDATE order_finance SET state=?,captured_cents=?,authorization_expires_at=NULL,updated=? WHERE order_id=?','captured',captured,now(),a.order_id);events.push({kind:'captured',amount:captured-priorCaptured,total:captured});}
  }else if(bankStatus===3&&['unpaid','authorized'].includes(f.state)){
   await tx.run('UPDATE order_finance SET state=?,authorization_expires_at=NULL,updated=? WHERE order_id=?','reversed',now(),a.order_id);events.push({kind:'reversed',amount:Number(a.amount_cents),total:0});
  }
  if(refunded>priorRefunded){
   if(refunded>captured)throw new HttpError(502,'Возврат ВТБ превышает подтверждённое списание');
   await tx.run('UPDATE order_finance SET state=?,refunded_cents=?,updated=? WHERE order_id=?',refunded===captured?'refunded':'partially_refunded',refunded,now(),a.order_id);events.push({kind:'refunded',amount:refunded-priorRefunded,total:refunded});
  }
  for(const event of events)await tx.run('INSERT INTO finance_events(id,order_id,kind,amount_cents,reference,body,actor,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(reference) DO NOTHING',uid(),a.order_id,event.kind,event.amount,`vtb-sandbox:${a.provider_order_id}:${event.kind}:${event.total}`,JSON.stringify({mode:'sandbox',bankStatus}),'vtb-sandbox',now());
 });
}
async function refresh(a:Attempt):Promise<Attempt>{
 let status;try{status=a.provider_order_id?await getOrderStatus(a.provider_order_id,credentials()):a.state==='registration_unknown'?await getOrderStatusByNumber(a.order_number,credentials()):null}catch(e){throw bankError(e)}
 if(!status)return a;
 if(!a.provider_order_id){
  if(!status.providerOrderId)throw new HttpError(409,'ВТБ подтвердил тестовый заказ, но не вернул его ID. Владелец должен сверить ID в кабинете банка. Повторная регистрация заблокирована.');
  a={...a,provider_order_id:status.providerOrderId};
  await run('UPDATE vtb_sandbox_attempts SET provider_order_id=?,updated=? WHERE id=?',status.providerOrderId,now(),a.id);
 }
 let state:AttemptState;try{state=checkedBankStatus(status,a)}catch(e){throw bankError(e)}
 if(['captured','partially_captured','partially_refunded','refunded','reversed'].includes(a.state)&&['registered','authorized'].includes(state))throw new HttpError(502,'Статус ВТБ вернулся к ранней стадии');
 const {captured,refunded}=confirmedAmounts(status,a);
 if(refunded>captured)throw new HttpError(502,'Возврат ВТБ превышает списание');
 if(a.pending_action==='capture'&&captured>Number(a.captured_cents)+Number(a.pending_amount_cents||0))throw new HttpError(502,'ВТБ подтвердил списание больше запрошенного');
 if(a.pending_action==='refund'&&refunded>Number(a.refunded_cents)+Number(a.pending_amount_cents||0))throw new HttpError(502,'ВТБ подтвердил возврат больше запрошенного');
 await syncFinance(a,status.orderStatus,captured,refunded);
 const pendingResolved=a.pending_action==='capture'?captured>=Number(a.captured_cents)+Number(a.pending_amount_cents||0):a.pending_action==='reverse'?state==='reversed':a.pending_action==='refund'?refunded>=Number(a.refunded_cents)+Number(a.pending_amount_cents||0):false;
 await run('UPDATE vtb_sandbox_attempts SET state=?,bank_status=?,captured_cents=?,refunded_cents=?,pending_action=CASE WHEN ? THEN NULL ELSE pending_action END,pending_action_id=CASE WHEN ? THEN NULL ELSE pending_action_id END,pending_amount_cents=CASE WHEN ? THEN NULL ELSE pending_amount_cents END,updated=? WHERE id=?',state,status.orderStatus,captured,refunded,pendingResolved,pendingResolved,pendingResolved,now(),a.id);
 if(state!==a.state||status.orderStatus!==a.bank_status)await record(a.id,'status','confirmed',null,status.orderStatus);
 return (await one('SELECT * FROM vtb_sandbox_attempts WHERE id=?',a.id)) as Attempt;
}
async function access(a:Attempt,u:any){const o=await orderAccess(a.order_id,u);if(o.clientId!==u.id&&!(u.role==='admin'&&isOwner(u)))throw new HttpError(403,'Тестовый платёж недоступен');return o}

export async function GET(req:Request){try{
 if((env as any).VTB_SANDBOX_ENABLED!=='true')return json({enabled:false});
 await stageOrigin();const u=await currentUser(),url=new URL(req.url),id=url.searchParams.get('attempt'),orderId=url.searchParams.get('order');
 if(!id&&!orderId)throw new HttpError(400,'Не указан тестовый заказ');
 const a=id?await one('SELECT * FROM vtb_sandbox_attempts WHERE id=?',UUID.parse(id)):await one('SELECT * FROM vtb_sandbox_attempts WHERE order_id=? ORDER BY created DESC LIMIT 1',UUID.parse(orderId));
 const o=await orderAccess(String(a?.order_id||orderId||''),u);if(o.clientId!==u.id&&!(u.role==='admin'&&isOwner(u)))throw new HttpError(403,'Тестовый платёж недоступен');
 return json(a?{enabled:true,orderId:o.id,attempt:expose(await refresh(a))}:{enabled:true,orderId:o.id,attempt:null});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 guardOrigin(req);const origin=await stageOrigin(),u=await currentUser(),b:any=await readJsonBody(req);
 if(b.action==='start'){
  const id=UUID.parse(b.orderId),o=await orderAccess(id,u);
  if(o.clientId!==u.id&&!(u.role==='admin'&&isOwner(u)))throw new HttpError(403,'Тестовую оплату запускает заказчик');
  if(!o.assignedWorkerId||!o.quoteAccepted||!Number.isSafeInteger(o.grossCents)||o.grossCents<=0)throw new HttpError(409,'Сначала согласуйте заказ и исполнителя');
  if(!await currentSignedContract(o,{one,run,all}))throw new HttpError(409,'Сначала обе стороны должны подтвердить договор');
  const claim=await transaction(async tx=>{
   const locked=await tx.one('SELECT * FROM orders WHERE id=? FOR UPDATE',id);if(!locked||Number(locked.gross_cents)!==o.grossCents||locked.assigned_worker_id!==o.assignedWorkerId)throw new HttpError(409,'Условия заказа изменились');
   if(!await currentSignedContract(unpack(locked),tx))throw new HttpError(409,'Договор изменился');
   const existing=await tx.one('SELECT * FROM vtb_sandbox_attempts WHERE order_id=? ORDER BY created DESC LIMIT 1',id);
   if(existing&&['registering','registration_unknown','registered','authorized','partially_captured','captured','partially_refunded'].includes(existing.state))return {existing};
   const finance=await tx.one('SELECT mode FROM order_finance WHERE order_id=?',id);if(finance)throw new HttpError(409,'У заказа уже есть финансовая операция');
   const attemptId=uid(),at=now();await tx.run('INSERT INTO vtb_sandbox_attempts(id,order_id,order_number,amount_cents,state,created,updated) VALUES(?,?,?,?,?,?,?)',attemptId,id,attemptId,o.grossCents,'registering',at,at);return {attemptId};
  });
  if('existing' in claim){
   const a=await refresh(claim.existing as Attempt);
   if(a.state==='registered'&&a.form_url)return json({attempt:expose(a),formUrl:a.form_url});
   throw new HttpError(409,'Тестовый платёж уже создан или требует сверки с ВТБ; новый платёж не создан');
  }
  const attemptId=claim.attemptId,returnUrl=`${origin}/vtb-test/return?attempt=${encodeURIComponent(attemptId)}`;
  try{const bank=await registerPreAuth({orderNumber:attemptId,amountCents:o.grossCents,returnUrl,failUrl:returnUrl},credentials());
   await run('UPDATE vtb_sandbox_attempts SET provider_order_id=?,form_url=?,state=?,bank_status=?,updated=? WHERE id=?',bank.orderId,bank.formUrl,'registered',0,now(),attemptId);await record(attemptId,'register','confirmed',o.grossCents,0);return json({attemptId,formUrl:bank.formUrl});
  }catch(e){await run('UPDATE vtb_sandbox_attempts SET state=?,updated=? WHERE id=?','registration_unknown',now(),attemptId);await record(attemptId,'register','unknown',o.grossCents,null);throw bankError(e)}
 }
 if(b.action==='recover'){
  if(u.role!=='admin'||!isOwner(u))throw new HttpError(403,'Сверка доступна владельцу тестового стенда');
  const id=UUID.parse(b.attemptId),a=await one('SELECT * FROM vtb_sandbox_attempts WHERE id=?',id) as Attempt;
  if(!a||a.state!=='registration_unknown'||a.provider_order_id)throw new HttpError(409,'Нет неопределённой регистрации для сверки');
  await access(a,u);
  const providerOrderId=UUID.parse(b.providerOrderId);
  let status;try{status=await getOrderStatus(providerOrderId,credentials());checkedBankStatus(status,a)}catch(e){throw bankError(e)}
  const updated=await transaction(async tx=>{const locked=await tx.one('SELECT * FROM vtb_sandbox_attempts WHERE id=? FOR UPDATE',id);if(locked.state!=='registration_unknown'||locked.provider_order_id)throw new HttpError(409,'Регистрация уже сверена');await tx.run('UPDATE vtb_sandbox_attempts SET provider_order_id=?,updated=? WHERE id=?',providerOrderId,now(),id);return {...locked,provider_order_id:providerOrderId} as Attempt});
  await record(id,'recover','confirmed',null,status.orderStatus);
  return json({attempt:expose(await refresh(updated))});
 }
 if(['capture','reverse','refund'].includes(b.action)){
  if(u.role!=='admin'||!isOwner(u))throw new HttpError(403,'Операция доступна владельцу тестового стенда');
  const id=UUID.parse(b.attemptId),a=await one('SELECT * FROM vtb_sandbox_attempts WHERE id=?',id) as Attempt;
  if(!a)throw new HttpError(404,'Тестовый платёж не найден');await access(a,u);
  const current=await refresh(a);if(current.pending_action)throw new HttpError(409,'Сначала сверните результат предыдущей операции с ВТБ');
  const amount=b.action==='reverse'?Number(current.amount_cents):z.number().int().positive().safe().parse(b.amountCents);
  try{allowedAction(b.action,current.state,amount,Number(current.amount_cents),Number(current.captured_cents),Number(current.refunded_cents))}catch(e){throw new HttpError(409,(e as Error).message)}
  const operationId=uid();const claim=await transaction(async tx=>{const locked=await tx.one('SELECT * FROM vtb_sandbox_attempts WHERE id=? FOR UPDATE',id);if(locked.pending_action||locked.state!==current.state)throw new HttpError(409,'Состояние платежа изменилось');await tx.run('UPDATE vtb_sandbox_attempts SET pending_action=?,pending_action_id=?,pending_amount_cents=?,updated=? WHERE id=?',b.action,operationId,amount,now(),id);return locked as Attempt});
  try{if(b.action==='capture')await capture(claim.provider_order_id!,amount,credentials());else if(b.action==='reverse')await reverse(claim.provider_order_id!,credentials());else await refund(claim.provider_order_id!,amount,operationId,Number(claim.captured_cents)-Number(claim.refunded_cents),credentials());
   await record(id,b.action,'accepted',amount,null);
  }catch(e){await record(id,b.action,'unknown',amount,null);throw bankError(e)}
  // A successful POST only acknowledges the bank request. A separate status
  // query confirms whether money moved; unresolved actions stay pending.
  try{return json({attempt:expose(await refresh({...current,pending_action:b.action,pending_amount_cents:amount}))})}
  catch{return json({accepted:true,pending:true,attemptId:id})}
 }
 throw new HttpError(400,'Неизвестная тестовая операция');
}catch(e){return fail(e)}}
