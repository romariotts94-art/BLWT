// Integer kopecks throughout; no external transfer is initiated by this module.
export function allocation(gross:number,refunded=0,paid=0){
 if(![gross,refunded,paid].every(n=>Number.isSafeInteger(n)&&n>=0)||refunded>gross)throw Error('Некорректные суммы расчёта');
 const net=gross-refunded,worker=Math.floor(net*65/100);
 return {gross,refunded,net,commission:net-worker,worker,paid,payable:Math.max(0,worker-paid),recovery:Math.max(0,paid-worker)};
}
export function applyFinanceEvidence(f:any,kind:string,amount:number,expiresAt?:string){
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Сумма должна быть положительной в копейках');
 const n={...f};for(const k of ['gross_cents','captured_cents','refunded_cents','available_cents','payout_cents'])n[k]=Number(n[k]||0);
 if(kind==='authorized'){
  if(n.state!=='unpaid'||amount!==n.gross_cents||!expiresAt||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())throw Error('Недопустимое подтверждение резерва');
  n.state='authorized';n.authorization_expires_at=expiresAt;
 }else if(kind==='captured'){
  if(!['unpaid','authorized'].includes(n.state)||n.captured_cents||amount>n.gross_cents)throw Error('Недопустимое подтверждение списания');
  n.captured_cents=amount;n.state='captured';
 }else if(kind==='settled'){
  if(!n.captured_cents||n.available_cents||amount>n.captured_cents)throw Error('Сверьте поступление с суммой списания');
  n.available_cents=amount;
 }else if(kind==='refunded'){
  if(amount>n.captured_cents-n.refunded_cents)throw Error('Возврат превышает невозвращённую оплату');
  n.refunded_cents+=amount;n.state=n.refunded_cents===n.captured_cents?'refunded':'partially_refunded';
 }else if(kind==='reversed'){
  if(n.state!=='authorized'||amount!==n.gross_cents)throw Error('Отмена доступна только для действующего резерва');
  n.state='reversed';n.authorization_expires_at=null;
 }else if(kind==='paid'){
  const a=allocation(n.captured_cents,n.refunded_cents,n.payout_cents);
  if(amount>a.payable||amount>n.available_cents-n.refunded_cents-n.payout_cents)throw Error('Сумма выплаты не соответствует доступным средствам и доле исполнителя');
  n.payout_cents+=amount;n.payout_state=amount===a.payable?'paid':'partial';
 }else throw Error('Неизвестный вид операции');
 return n;
}
