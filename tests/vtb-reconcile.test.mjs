import test from 'node:test';
import assert from 'node:assert/strict';
import {RECONCILE_BATCH_SIZE,validReconcileToken,shouldReconcileAttempt} from '../lib/vtb-reconcile.ts';

test('internal reconciliation requires a strong exact token',()=>{
 const token='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
 assert.equal(validReconcileToken(token,token),true);
 assert.equal(validReconcileToken(token.slice(0,-1)+'0',token),false);
 assert.equal(validReconcileToken(null,token),false);
 assert.equal(validReconcileToken('short','short'),false);
 assert.equal(validReconcileToken('0'.repeat(64),'0'.repeat(64)),true);
 assert.equal(validReconcileToken('x'.repeat(64),'x'.repeat(64)),false);
});

test('polling is limited to recent, stale, nonterminal bank attempts',()=>{
 const time=Date.parse('2026-11-10T12:00:00.000Z');
 const attempt={state:'authorized',provider_order_id:'bank-id',pending_action:null,created:'2026-11-10T10:00:00.000Z',updated:'2026-11-10T11:58:00.000Z'};
 assert.equal(RECONCILE_BATCH_SIZE,5);
 assert.equal(shouldReconcileAttempt(attempt,time),true);
 assert.equal(shouldReconcileAttempt({...attempt,updated:'2026-11-10T11:59:30.000Z'},time),false);
 assert.equal(shouldReconcileAttempt({...attempt,created:'2026-09-01T00:00:00.000Z'},time),false);
 assert.equal(shouldReconcileAttempt({...attempt,state:'refunded'},time),false);
 assert.equal(shouldReconcileAttempt({...attempt,state:'refunded',pending_action:'refund'},time),true);
 assert.equal(shouldReconcileAttempt({...attempt,state:'captured'},time),false);
 assert.equal(shouldReconcileAttempt({...attempt,state:'captured',updated:'2026-11-10T11:54:00.000Z'},time),true);
 assert.equal(shouldReconcileAttempt({...attempt,state:'registration_unknown',provider_order_id:null},time),true);
 assert.equal(shouldReconcileAttempt({...attempt,state:'registered',provider_order_id:null},time),false);
});
