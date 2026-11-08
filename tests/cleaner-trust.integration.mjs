// Run against an isolated empty QA database and app, never a production copy.
import pg from 'pg';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
const url=process.env.TRUST_QA_DATABASE_URL,base=process.env.TRUST_QA_ORIGIN||'http://127.0.0.1:5185',secret=process.env.TRUST_QA_SECRET||'local-trust-qa-only';
if(!url||!new URL(url).pathname.endsWith('_qa')||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!base.startsWith('http://127.0.0.1:'))throw Error('Isolated local QA only');
const db=new pg.Client({connectionString:url});await db.connect();const actors={},stamp=new Date().toISOString();
const city=(await db.query("SELECT id FROM cities WHERE name='Москва' AND region='Москва' LIMIT 1")).rows[0].id;
for(const [key,role] of [['admin','admin'],['client','client'],['stranger','client'],['worker','cleaner']]){const id=randomUUID(),token=randomUUID();actors[key]={id,token};await db.query('INSERT INTO members(id,email,name,role,created) VALUES($1,$2,$3,$4,$5)',[id,id+'@qa.invalid','QA '+key,role,stamp]);await db.query('INSERT INTO auth_sessions(token_hash,member_id,expires_at,created_at) VALUES($1,$2,$3,$4)',[createHash('sha256').update(secret+':'+token).digest('hex'),id,Date.now()+3600000,Date.now()]);}
const id=actors.worker.id;
await db.query('INSERT INTO worker_profiles(member_id,city_id,bio,verified,npd_status,npd_checked_on,updated) VALUES($1,$2,$3,1,1,$4,$5)',[id,city,'Careful cleaning, experienced and attentive to details.',stamp.slice(0,10),stamp]);
await db.query('UPDATE worker_profiles SET npd_inn=$1 WHERE member_id=$2',['123456789012',id]);
await db.query('INSERT INTO settings(key,value) VALUES($1,$2)',['non_ip_verification:'+id,JSON.stringify({inn:'123456789012',checkedOn:stamp.slice(0,10),reference:'QA verification reference',verifiedBy:actors.admin.id})]);
await db.query('INSERT INTO cleaner_cards(member_id,display_name,experience_years,updated) VALUES($1,$2,3,$3)',[id,'QA Cleaner',stamp]);
async function req(actor,path,body,status=200,method){const response=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{...(actor?{Cookie:'bw_session='+actors[actor].token}:{}),Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
const trust=(actor,body,status)=>req(actor,'/api/cleaners/trust',{workerId:id,...body},status);
await req(null,'/api/cleaners/trust',undefined,401);await req('client','/api/cleaners/trust',undefined,403);await trust('worker',{action:'approve'},403);await trust('stranger',{action:'consent',consent:true},403);
async function upload(){const form=new FormData();form.set('worker',id);form.set('file',new Blob([await fs.readFile(new URL('../public/media/trust-anna-demo.webp',import.meta.url))],{type:'image/webp'}),'qa.webp');const r=await fetch(base+'/api/cleaners/avatar',{method:'POST',headers:{Cookie:'bw_session='+actors.admin.token,Origin:base},body:form});assert.equal(r.status,200,await r.text());}
await upload();const proof={action:'approve',identity:'Private identity check reference',passportChecked:true,experience:'Private experience reference'};
await trust('admin',proof,400);await trust('admin',{...proof,passportChecked:false},400);await trust('worker',{action:'consent',consent:true});await trust('admin',proof);
let card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.name,'QA Cleaner');assert.equal(card.rating,null);assert.equal(card.reviews.length,0);assert(!JSON.stringify(card).includes('Private'));assert(!('email' in card));assert(!('npd_inn' in card));
assert.equal((await fetch(base+card.avatar)).status,200);await req(null,card.avatar+'&photo=private-passport',undefined,404);await req('client','/api/documents?worker='+id,undefined,403);
await req('admin','/api/cleaners/trust',{action:'showcase',mode:'manual',slots:['',id,'']});await req('admin','/api/cleaners/trust',{action:'showcase',mode:'manual',slots:[id,id,'']},400);await req('client','/api/cleaners/trust',{action:'showcase',mode:'rating',slots:['','','']},403);
console.log('PASS: publication, consent, private evidence, avatar access and admin-only showcase');
const orderId=randomUUID(),details={service:'standard',personalUse:true,name:'QA Client',quote:{total:5000,hours:2,workers:1},checklist:[],liveConsent:false};
await db.query('INSERT INTO orders(id,client_id,status,details,crew,assigned_worker_id,created,updated) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[orderId,actors.client.id,'assigned',JSON.stringify(details),JSON.stringify([id]),id,stamp]);
const review={action:'review',id:orderId,name:'QA Client',text:'The cleaning was completed carefully and on time.',rating:5,publishConsent:true,profilePublishConsent:true};
await req('client','/api/platform',review,403);await db.query("UPDATE orders SET status='completed' WHERE id=$1",[orderId]);await req(null,'/api/platform',review,401);await req('stranger','/api/platform',review,403);await req('worker','/api/platform',review,403);await req('admin','/api/platform',review,403);await req('client','/api/platform',{...review,rating:6},400);await req('client','/api/platform',review);
card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.reviews.length,1);assert.equal(card.rating,5);const originalDate=card.reviews[0].created;
await req('client','/api/platform',{...review,rating:4});card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.rating,4);assert.equal(card.reviews.length,1);assert.equal(card.reviews[0].created,originalDate);
await req('client','/api/platform',{...review,publishConsent:false});card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.reviews.length,0);assert.equal(card.rating,null);
await req('client','/api/platform',{...review,profilePublishConsent:false});card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.reviews.length,0);
await req('client','/api/platform',review);console.log('PASS: only order owner after completion can review; edit, rating, consent withdrawal');
await upload();await req(null,'/api/cleaners/public?id='+id,undefined,404);await trust('admin',proof,400);await trust('admin',{...proof,passportChecked:false},400);await trust('worker',{action:'consent',consent:true});await trust('admin',proof);await trust('worker',{action:'revoke'});await req(null,'/api/cleaners/public?id='+id,undefined,404);assert.equal((await fetch(base+card.avatar)).status,404);
await trust('admin',{...proof,consentReference:'QA written consent reference, 2026-11-08'});await db.query('UPDATE members SET active=0 WHERE id=$1',[id]);await req(null,'/api/cleaners/public?id='+id,undefined,404);await db.query('UPDATE members SET active=1 WHERE id=$1',[id]);
console.log('PASS: changed photo and revoked consent immediately hide profile and photo; inactive members hidden');
const workForm=new FormData();workForm.set('worker',id);workForm.set('file',new Blob([await fs.readFile(new URL('../public/media/trust-anna-demo.webp',import.meta.url))],{type:'image/webp'}),'portfolio-qa.webp');
const workResponse=await fetch(base+'/api/cleaners/work-photo',{method:'POST',headers:{Cookie:'bw_session='+actors.admin.token,Origin:base},body:workForm});assert.equal(workResponse.status,200);const photo=(await workResponse.json()).id;
await trust('admin',{...proof,portfolioIds:[photo]},400);
await trust('worker',{action:'consent',consent:true,portfolioIds:[photo]});await trust('admin',{...proof,portfolioIds:[photo]});
card=(await req(null,'/api/cleaners/public?id='+id)).card;assert.equal(card.workPhotos.length,1);assert.equal((await fetch(base+card.workPhotos[0].url)).status,200);
const avatarKey=(await db.query('SELECT avatar_key FROM cleaner_cards WHERE member_id=$1',[id])).rows[0].avatar_key;
await trust('admin',{...proof,consentReference:'QA updated consent reference',portfolioIds:[avatarKey]},400);
await db.query("UPDATE documents SET review_status='pending' WHERE id=$1",[photo]);assert.equal((await fetch(base+card.workPhotos[0].url)).status,404);await db.query("UPDATE documents SET review_status='approved' WHERE id=$1",[photo]);
console.log('PASS: portfolio needs explicit consent and approval; other documents cannot be published');
if(process.env.TRUST_QA_SESSION_FILE)await fs.writeFile(process.env.TRUST_QA_SESSION_FILE,JSON.stringify({actors,workerId:id,orderId}),{mode:0o600});
await db.end();
