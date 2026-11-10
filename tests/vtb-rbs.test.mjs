import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPreAuth,getOrderStatus,capture,decline,refund} from '../lib/vtb-rbs.ts';
import {bankState,checkedBankStatus,confirmedAmounts,allowedAction} from '../lib/vtb-sandbox-policy.ts';
const id='11111111-2222-4333-8444-555555555555';
const credentials={userName:'sandbox-user',password:'private-test-value'};
function mock(body,status=200){let request;return {fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})},get request(){return request}}}
test('RBS registration binds amount/order and never puts credentials in URL',async()=>{
 const bank=mock({orderId:id,formUrl:'https://vtb.rbsuat.com/payment/test'});
 const result=await registerPreAuth({orderNumber:id,amountCents:470000,returnUrl:'http://127.0.0.1:5175/vtb-test/return',failUrl:'http://127.0.0.1:5175/vtb-test/return'},credentials,bank.fetcher);
 assert.equal(result.orderId,id);assert.equal(bank.request.url,'https://vtb.rbsuat.com/payment/rest/registerPreAuth.do');
 const params=new URLSearchParams(bank.request.options.body);assert.equal(params.get('amount'),'470000');assert.equal(params.get('orderNumber'),id);
 assert.equal(params.get('password'),credentials.password);assert.equal(bank.request.url.includes(credentials.password),false);
 const wrong=mock({errorCode:'0',orderId:id,formUrl:'https://attacker.invalid/pay'});
 await assert.rejects(()=>registerPreAuth({orderNumber:id,amountCents:1,returnUrl:'http://127.0.0.1:5175/',failUrl:'http://127.0.0.1:5175/'},credentials,wrong.fetcher),/некорректную ссылку/);
});
test('RBS status uses nested bank-confirmed amount totals',async()=>{
 const bank=mock({errorCode:'0',orderStatus:2,amount:470000,orderNumber:id,actionCode:0,paymentAmountInfo:{depositedAmount:470000,refundedAmount:0}});
 const status=await getOrderStatus(id,credentials,bank.fetcher);assert.equal(status.depositedAmount,470000);assert.equal(status.refundedAmount,0);
 assert.equal(checkedBankStatus(status,{order_number:id,amount_cents:470000,captured_cents:0,refunded_cents:0}),'captured');
 assert.throws(()=>checkedBankStatus({...status,amount:470001},{order_number:id,amount_cents:470000,captured_cents:0,refunded_cents:0}),/не совпали/);
 assert.throws(()=>checkedBankStatus({...status,depositedAmount:null},{order_number:id,amount_cents:470000,captured_cents:0,refunded_cents:0}),/не подтвердил/);
 assert.equal(bankState({...status,refundedAmount:20000},{captured_cents:470000,refunded_cents:0}),'partially_refunded');
});
test('capture and refund amounts are bounded, refund has retry identity',async()=>{
 assert.doesNotThrow(()=>allowedAction('capture','authorized',200000,470000));
 assert.throws(()=>allowedAction('capture','captured',100000,470000));
 assert.doesNotThrow(()=>allowedAction('refund','captured',200000,470000,470000,100000));
 assert.throws(()=>allowedAction('refund','captured',400001,470000,470000,100000));
 const captured=mock({errorCode:0});await capture(id,200000,credentials,captured.fetcher);
 assert.equal(new URLSearchParams(captured.request.options.body).get('amount'),'200000');
 const returned=mock({errorCode:0});await refund(id,200000,id,470000,credentials,returned.fetcher);
 const params=new URLSearchParams(returned.request.options.body);assert.equal(params.get('externalRefundId'),id);assert.equal(params.get('expectedDepositedAmount'),'470000');
});
test('decline is limited to an unpaid registered order and binds both bank and merchant IDs',async()=>{
 assert.doesNotThrow(()=>allowedAction('decline','registered',470000,470000));
 assert.throws(()=>allowedAction('decline','authorized',470000,470000));
 const bank=mock({errorCode:0});await decline(id,id,credentials,bank.fetcher);
 assert.equal(bank.request.url,'https://vtb.rbsuat.com/payment/rest/decline.do');
 const params=new URLSearchParams(bank.request.options.body);
 assert.equal(params.get('orderId'),id);assert.equal(params.get('orderNumber'),id);
});
test('full refund preserves historical captured amount and records the bank-confirmed refund',()=>{
 const status={orderStatus:4,amount:470000,currency:'643',orderNumber:id,actionCode:0,depositedAmount:0,refundedAmount:470000,providerOrderId:null};
 const prior={order_number:id,amount_cents:470000,captured_cents:470000,refunded_cents:0};
 assert.equal(checkedBankStatus(status,prior),'refunded');
 assert.deepEqual(confirmedAmounts(status,prior),{captured:470000,refunded:470000});
 assert.throws(()=>confirmedAmounts({...status,refundedAmount:470001},prior),/противоречат/);
});
