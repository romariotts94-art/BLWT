import pg from 'pg';
import {randomUUID} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000,statement_timeout:15000});
const token=process.env.TELEGRAM_BOT_TOKEN, chats=[...new Set((process.env.TELEGRAM_ADMIN_CHAT_IDS||'').split(',').map(s=>s.trim()).filter(s=>/^-?\d+$/.test(s)))];
let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
async function tick(){if(!token||!chats.length)return;const client=await pool.connect();try{
 await client.query('BEGIN');
 // Backfill open tickets after configuration, without duplicating delivered messages.
 for(const chat of chats)await client.query(`INSERT INTO support_delivery(id,message_id,chat_id) SELECT gen_random_uuid()::text,s.id,$1 FROM support_messages s JOIN support_tickets t ON t.id=s.ticket_id JOIN members m ON m.id=s.sender_id WHERE t.status='open' AND m.role<>'admin' ON CONFLICT(message_id,chat_id) DO NOTHING`,[chat]);
 const {rows}=await client.query(`SELECT d.*,s.ticket_id FROM support_delivery d JOIN support_messages s ON s.id=d.message_id WHERE d.delivered_at IS NULL AND d.next_attempt<$1 AND d.chat_id=ANY($2) ORDER BY d.next_attempt LIMIT 1 FOR UPDATE OF d SKIP LOCKED`,[Date.now(),chats]);
 for(const d of rows){try{
 const origin=process.env.PUBLIC_ORIGIN||'https://blackandwhite-mos.ru';
 const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:d.chat_id,text:`BLACK & WHITE · обращение ${d.ticket_id.slice(0,8)}\nНовое сообщение в поддержку.\n${origin}/#support`,disable_web_page_preview:true}),signal:AbortSignal.timeout(8000)});
 const result=await r.json();if(!r.ok||!result.ok)throw Error('Telegram response '+r.status);
 await client.query('UPDATE support_delivery SET delivered_at=$1,attempts=attempts+1,last_error=\'\' WHERE id=$2',[new Date().toISOString(),d.id]);
 }catch{await client.query('UPDATE support_delivery SET attempts=attempts+1,next_attempt=$1,last_error=$2 WHERE id=$3',[Date.now()+Math.min(3600000,30000*2**Math.min(d.attempts,7)),'Telegram недоступен; запланирована повторная попытка',d.id]);}}
 await client.query('COMMIT');
 }catch{await client.query('ROLLBACK').catch(()=>{});console.error('Support delivery unavailable; retrying');}finally{client.release()}}
console.log(token&&chats.length?'Support delivery configured':'Support delivery waiting for Telegram configuration');
while(!stopping){await tick();await new Promise(r=>setTimeout(r,5000))}await pool.end();
