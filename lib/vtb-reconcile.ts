import {timingSafeEqual} from 'node:crypto';

export const RECONCILE_BATCH_SIZE=5;
export const RECONCILE_MIN_AGE_MS=60_000;
export const RECONCILE_PASSIVE_AGE_MS=5*60_000;
export const RECONCILE_MAX_AGE_MS=7*24*60*60*1000;
export const RECONCILE_STATES=['registering','registration_unknown','registered','authorized','captured','partially_captured','partially_refunded'] as const;
export const RECONCILE_FAST_STATES=['registering','registration_unknown','registered','authorized'] as const;

export function validReconcileToken(presented:string|null,configured:string){
 if(!presented||!/^[a-f0-9]{64}$/i.test(configured)||!/^[a-f0-9]{64}$/i.test(presented))return false;
 return timingSafeEqual(Buffer.from(presented,'hex'),Buffer.from(configured,'hex'));
}

export function shouldReconcileAttempt(a:{state:string,provider_order_id:string|null,pending_action:string|null,created:string,updated:string},time=Date.now()){
 const created=Date.parse(a.created),updated=Date.parse(a.updated);
 const wait=a.pending_action||RECONCILE_FAST_STATES.includes(a.state as typeof RECONCILE_FAST_STATES[number])?RECONCILE_MIN_AGE_MS:RECONCILE_PASSIVE_AGE_MS;
 if(!Number.isFinite(created)||!Number.isFinite(updated)||created<time-RECONCILE_MAX_AGE_MS||updated>time-wait)return false;
 if(!a.provider_order_id&&!['registering','registration_unknown'].includes(a.state))return false;
 return RECONCILE_STATES.includes(a.state as typeof RECONCILE_STATES[number])||a.pending_action!==null;
}
