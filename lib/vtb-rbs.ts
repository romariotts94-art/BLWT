// Adapter for the currently supplied VTB RBS test terminal only. A production
// terminal must be integrated against its own bank-issued specification.
const SANDBOX_ORIGIN='https://vtb.rbsuat.com';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export type RbsCredentials={userName:string,password:string};
export type RbsStatus={orderStatus:number,amount:number,currency:string|null,orderNumber:string,actionCode:number,depositedAmount:number|null,refundedAmount:number|null,providerOrderId:string|null};
function providerId(id:string){if(!UUID.test(id))throw Error('Некорректный идентификатор ВТБ');return id;}
function positiveAmount(amount:number){if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Некорректная сумма в копейках');return String(amount);}
async function call(method:string,params:Record<string,string>,credentials:RbsCredentials,fetcher:typeof fetch=fetch){
 if(!credentials.userName||!credentials.password)throw Error('Не заданы тестовые учётные данные ВТБ');
 const response=await fetcher(`${SANDBOX_ORIGIN}/payment/rest/${method}.do`,{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({userName:credentials.userName,password:credentials.password,language:'ru',...params}),
  signal:AbortSignal.timeout(15000),
 });
 let data:any;try{data=await response.json()}catch{throw Error('ВТБ вернул ответ не в формате JSON')}
 // RBS omits errorCode on a successful registration, returning orderId and
 // formUrl instead. The caller validates both before persisting the attempt.
 const registrationSuccess=method==='registerPreAuth'&&data?.errorCode==null&&data?.orderId&&data?.formUrl;
 if(!response.ok||data?.success===false||(!registrationSuccess&&String(data?.errorCode)!=='0'))throw Error('ВТБ: '+String(data?.errorMessage||`HTTP ${response.status}; нет подтверждения успешной обработки`).slice(0,200));
 return data;
}
export async function registerPreAuth(input:{orderNumber:string,amountCents:number,returnUrl:string,failUrl:string},credentials:RbsCredentials,fetcher:typeof fetch=fetch){
 if(!/^[A-Za-z0-9_-]{1,36}$/.test(input.orderNumber))throw Error('Некорректный номер тестового заказа');
 for(const value of [input.returnUrl,input.failUrl]){const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw Error('Некорректный адрес возврата')}
 const data=await call('registerPreAuth',{orderNumber:input.orderNumber,amount:positiveAmount(input.amountCents),currency:'643',returnUrl:input.returnUrl,failUrl:input.failUrl,description:`BLWT sandbox ${input.orderNumber}`},credentials,fetcher);
 const orderId=String(data.orderId||''),formUrl=String(data.formUrl||'');
 let parsed:URL;try{parsed=new URL(formUrl)}catch{throw Error('ВТБ вернул некорректную ссылку на оплату')}
 if(!UUID.test(orderId)||parsed.origin!==SANDBOX_ORIGIN)throw Error('ВТБ вернул некорректную ссылку на оплату');
 return {orderId,formUrl};
}
function parseStatus(data:any):RbsStatus{
 const amounts=data.paymentAmountInfo||{};
 const deposited=amounts.depositedAmount??data.depositedAmount;
 const refunded=amounts.refundedAmount??data.refundedAmount;
 const currency=data.currency??amounts.currency;
 const status={orderStatus:Number(data.orderStatus),amount:Number(data.amount),currency:currency==null?null:String(currency),orderNumber:String(data.orderNumber||''),actionCode:Number(data.actionCode),depositedAmount:deposited==null?null:Number(deposited),refundedAmount:refunded==null?null:Number(refunded),providerOrderId:data.orderId?String(data.orderId):null};
 if(!Number.isInteger(status.orderStatus)||!Number.isSafeInteger(status.amount)||!Number.isInteger(status.actionCode))throw Error('ВТБ вернул некорректный статус');
 if(status.depositedAmount!==null&&(!Number.isSafeInteger(status.depositedAmount)||status.depositedAmount<0||status.depositedAmount>status.amount))throw Error('ВТБ вернул некорректную сумму списания');
 if(status.refundedAmount!==null&&(!Number.isSafeInteger(status.refundedAmount)||status.refundedAmount<0||status.refundedAmount>status.amount))throw Error('ВТБ вернул некорректную сумму возврата');
 return status;
}
export async function getOrderStatus(orderId:string,credentials:RbsCredentials,fetcher:typeof fetch=fetch):Promise<RbsStatus>{
 return parseStatus(await call('getOrderStatusExtended',{orderId:providerId(orderId)},credentials,fetcher));
}
export async function getOrderStatusByNumber(orderNumber:string,credentials:RbsCredentials,fetcher:typeof fetch=fetch):Promise<RbsStatus>{
 if(!/^[A-Za-z0-9_-]{1,36}$/.test(orderNumber))throw Error('Некорректный номер тестового заказа');
 return parseStatus(await call('getOrderStatusExtended',{orderNumber},credentials,fetcher));
}
export async function capture(orderId:string,amountCents:number,credentials:RbsCredentials,fetcher:typeof fetch=fetch){await call('deposit',{orderId:providerId(orderId),amount:positiveAmount(amountCents),currency:'643'},credentials,fetcher)}
export async function reverse(orderId:string,credentials:RbsCredentials,fetcher:typeof fetch=fetch){await call('reverse',{orderId:providerId(orderId),currency:'643'},credentials,fetcher)}
export async function decline(orderId:string,orderNumber:string,credentials:RbsCredentials,fetcher:typeof fetch=fetch){
 if(!/^[A-Za-z0-9_-]{1,36}$/.test(orderNumber))throw Error('Некорректный номер тестового заказа');
 await call('decline',{orderId:providerId(orderId),orderNumber},credentials,fetcher);
}
export async function refund(orderId:string,amountCents:number,operationId:string,expectedDepositedAmount:number,credentials:RbsCredentials,fetcher:typeof fetch=fetch){
 if(!UUID.test(operationId))throw Error('Некорректный номер возврата');
 await call('refund',{orderId:providerId(orderId),amount:positiveAmount(amountCents),currency:'643',externalRefundId:operationId,expectedDepositedAmount:positiveAmount(expectedDepositedAmount)},credentials,fetcher);
}
