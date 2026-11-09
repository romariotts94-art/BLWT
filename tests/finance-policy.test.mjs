import test from 'node:test';
import assert from 'node:assert/strict';
import {allocation,applyFinanceEvidence} from '../lib/finance-policy.ts';
const initial=()=>({gross_cents:1000000,state:'unpaid',captured_cents:0,refunded_cents:0,available_cents:0,payout_cents:0,payout_state:'none'});
test('65/35 uses gross NPD revenue, preserves kopecks, tracks recovery after refund',()=>{
 assert.deepEqual(allocation(1000000),{gross:1000000,refunded:0,net:1000000,commission:350000,worker:650000,paid:0,payable:650000,recovery:0});
 const partial=allocation(1000001,200001,650000);assert.equal(partial.worker,520000);assert.equal(partial.commission,280000);assert.equal(partial.recovery,130000);assert.equal(partial.payable,0);
 assert.throws(()=>allocation(100,101));assert.throws(()=>allocation(1.5));
});
test('bank state cannot double capture, pay before settlement, or refund above captured funds',()=>{
 const f=applyFinanceEvidence(initial(),'captured',1000000);assert.throws(()=>applyFinanceEvidence(f,'captured',1000000));assert.throws(()=>applyFinanceEvidence(f,'paid',650000));
 const settled=applyFinanceEvidence(f,'settled',977100);const paid=applyFinanceEvidence(settled,'paid',650000);assert.equal(paid.payout_cents,650000);assert.throws(()=>applyFinanceEvidence(paid,'paid',650000));
 const refunded=applyFinanceEvidence(paid,'refunded',200000);assert.equal(allocation(refunded.captured_cents,refunded.refunded_cents,refunded.payout_cents).recovery,130000);assert.throws(()=>applyFinanceEvidence(refunded,'refunded',900000));
});
test('only a full, unexpired hold can be registered and reversed',()=>{
 assert.throws(()=>applyFinanceEvidence(initial(),'authorized',1000000,'2000-01-01'));
 const f=applyFinanceEvidence(initial(),'authorized',1000000,new Date(Date.now()+86400000).toISOString());assert.throws(()=>applyFinanceEvidence(f,'reversed',1));assert.equal(applyFinanceEvidence(f,'reversed',1000000).state,'reversed');
});
