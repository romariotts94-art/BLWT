import type {RbsStatus} from './vtb-rbs';

export type AttemptState='registering'|'registration_unknown'|'registered'|'authorized'|'captured'|'partially_captured'|'reversed'|'refunded'|'partially_refunded'|'declined';
// RBS depositedAmount is the amount still deposited after refunds, not the
// historical total capture. A full refund can therefore report deposited=0.
export function confirmedAmounts(status:RbsStatus,prior:{captured_cents:number|string,refunded_cents:number|string}){
 const oldCaptured=Number(prior.captured_cents),oldRefunded=Number(prior.refunded_cents);
 if(status.depositedAmount===null||status.refundedAmount===null){
  if([2,4,8].includes(status.orderStatus))throw Error('ВТБ не вернул точные суммы списания и возврата');
  return {captured:oldCaptured,refunded:oldRefunded};
 }
 const captured=status.depositedAmount+status.refundedAmount,refunded=status.refundedAmount;
 if(!Number.isSafeInteger(captured)||captured>status.amount||captured<oldCaptured||refunded<oldRefunded||refunded>captured)throw Error('Суммы ВТБ противоречат истории платежа');
 return {captured,refunded};
}
export function bankState(status:RbsStatus,prior:{captured_cents:number|string,refunded_cents:number|string}):AttemptState{
 if(status.orderStatus===2&&status.refundedAmount!==null&&status.refundedAmount>0){
  return status.depositedAmount===0?'refunded':'partially_refunded';
 }
 if(status.orderStatus===2&&status.depositedAmount!==null&&status.depositedAmount>0&&status.depositedAmount<status.amount)return 'partially_captured';
 switch(status.orderStatus){
  case 0:return 'registered';
  case 1:return 'authorized';
  case 2:return 'captured';
  case 3:return 'reversed';
  case 4:
   if(status.refundedAmount===0)throw Error('ВТБ сообщил возврат без суммы');
   return status.depositedAmount!==null&&status.depositedAmount>0?'partially_refunded':'refunded';
  case 6:return 'declined';
  case 5:case 7:return 'registered';
  case 8:
   if(status.refundedAmount!==null&&status.refundedAmount>Number(prior.refunded_cents))return 'partially_refunded';
   if(status.depositedAmount!==null&&status.depositedAmount>0&&status.depositedAmount<status.amount)return 'partially_captured';
   throw Error('Промежуточный статус ВТБ требует подтверждённой суммы');
  default:throw Error(`Неизвестный статус ВТБ: ${status.orderStatus}`);
 }
}
export function checkedBankStatus(status:RbsStatus,attempt:{order_number:string,amount_cents:number|string,captured_cents:number|string,refunded_cents:number|string}){
 if(status.orderNumber!==attempt.order_number||status.amount!==Number(attempt.amount_cents))throw Error('Данные заказа ВТБ не совпали с тестовым заказом BLWT');
 if(status.currency!==null&&status.currency!=='643')throw Error('ВТБ вернул другую валюту');
 if(status.orderStatus===2&&status.depositedAmount===null)throw Error('ВТБ не подтвердил сумму списания');
 if(status.orderStatus===4&&status.refundedAmount===null)throw Error('ВТБ не подтвердил сумму возврата');
 confirmedAmounts(status,attempt);
 return bankState(status,attempt);
}
export function allowedAction(action:string,state:AttemptState,amount:number,gross:number,captured=0,refunded=0){
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(gross)||gross<=0)throw Error('Некорректная сумма операции');
 if(action==='capture'&&state==='authorized'&&amount<=gross)return;
 if(action==='reverse'&&state==='authorized'&&amount===gross)return;
 if(action==='refund'&&['captured','partially_captured','partially_refunded'].includes(state)&&amount<=captured-refunded)return;
 throw Error('Операция недоступна в текущем состоянии тестового платежа');
}
