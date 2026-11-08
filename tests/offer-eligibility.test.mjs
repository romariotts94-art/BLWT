import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { offerEligibilityWhere } from '../lib/offer-eligibility.mjs';
import { isPersonalLaunchOrder,hasNonIpVerification } from '../lib/launch-policy.mjs';

for (const postgres of [true, false]) {
 test(`offer query bindings stay aligned (${postgres?'PostgreSQL':'SQLite'})`,()=>{
  const where=offerEligibilityWhere(postgres,'moscow-id');
  assert.equal((where.match(/\?/g)||[]).length,3);
  assert.doesNotMatch(where,/ip_checked_on|wp\.services|wp\.extras/);
 });
}

const today='2026-11-07';
const order={service:'standard',catalogService:'standard',personalUse:true,quoteAccepted:true,quote:{workers:1,hours:2},date:'2026-11-10',time:'10:00',preferences:{}};
const proof={inn:'123456789012',checkedOn:today,reference:'Справка ЕГРИП от 07.11.2026',verifiedBy:'admin'};
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE orders(id TEXT,client_id TEXT,marketplace_version INTEGER,status TEXT,city_id TEXT,start_at INTEGER,payout_cents INTEGER,details TEXT);
 CREATE TABLE members(id TEXT,active INTEGER,role TEXT);
 CREATE TABLE worker_profiles(member_id TEXT,city_id TEXT,enabled INTEGER,verified INTEGER,capacity INTEGER,min_payout_cents INTEGER,accepts_video INTEGER,contractor_type TEXT,npd_inn TEXT,npd_status INTEGER,npd_checked_on TEXT);
 CREATE TABLE worker_availability(worker_id TEXT,work_date TEXT,start_min INTEGER,end_min INTEGER);
 CREATE TABLE cleaner_cards(member_id TEXT,gender TEXT,fragrance_free BOOLEAN,pet_friendly BOOLEAN,own_products BOOLEAN);
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE order_skips(order_id TEXT,worker_id TEXT,snoozed_until INTEGER);`);
 db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)').run('order','client',1,'offered','moscow-id',10000,650000,JSON.stringify(order));
 db.exec("INSERT INTO members VALUES('worker',1,'cleaner'); INSERT INTO worker_availability VALUES('worker','2026-11-10',480,1200)");
 db.prepare('INSERT INTO worker_profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('worker','moscow-id',1,1,1,0,0,'npd',proof.inn,1,today);
 db.prepare('INSERT INTO settings VALUES(?,?)').run('non_ip_verification:worker',JSON.stringify(proof));
 const eligible=()=>!!db.prepare(`SELECT 1 FROM orders o JOIN members m ON ${offerEligibilityWhere(false,'moscow-id')}`).get(1,today,1);
 return {db,eligible};
}
test('eligible private order is offered to one verified Moscow NPD individual',()=>{
 const {db,eligible}=fixture();try{assert.equal(eligible(),true);}finally{db.close();}
});
for(const [name,change] of [
 ['no personal confirmation',{personalUse:undefined}],['business purpose',{personalUse:false}],
 ['office category',{service:'office'}],['commercial catalog',{catalogService:'commercial'}],['rental catalog',{catalogService:'rental'}],
 ['multiple workers',{quote:{workers:2,hours:2}}],
])test(`offer blocks ${name}`,()=>{const {db,eligible}=fixture();try{db.prepare('UPDATE orders SET details=?').run(JSON.stringify({...order,...change}));assert.equal(eligible(),false);}finally{db.close();}});
for(const [name,sql] of [
 ['IP contractor',"UPDATE worker_profiles SET contractor_type='ip'"],
 ['expired NPD check',"UPDATE worker_profiles SET npd_checked_on='2026-11-06'"],
 ['missing non-IP check','DELETE FROM settings'],
 ['changed INN',"UPDATE worker_profiles SET npd_inn='000000000000'"],
 ['team capacity','UPDATE worker_profiles SET capacity=2'],
 ['unverified profile','UPDATE worker_profiles SET verified=0'],
 ['other city',"UPDATE worker_profiles SET city_id='orel-id'"],
])test(`offer blocks ${name}`,()=>{const {db,eligible}=fixture();try{db.exec(sql);assert.equal(eligible(),false);}finally{db.close();}});
test('non-IP evidence is specific to an INN and needs a dated source and actor',()=>{
 assert.equal(hasNonIpVerification(JSON.stringify(proof),proof.inn),true);
 for(const bad of [null,'not JSON',{...proof,inn:'other'},{...proof,reference:''},{...proof,checkedOn:''},{...proof,verifiedBy:''}])assert.equal(hasNonIpVerification(bad,proof.inn),false);
});
test('launch purpose validation rejects forged office and commercial requests',()=>{
 assert.equal(isPersonalLaunchOrder(order),true);
 assert.equal(isPersonalLaunchOrder({...order,personalUse:'true'}),false);
 assert.equal(isPersonalLaunchOrder({...order,service:'office'}),false);
 assert.equal(isPersonalLaunchOrder({...order,catalogService:'commercial'}),false);
});
