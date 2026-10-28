import pg from 'pg';
import {randomUUID} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000,statement_timeout:15000});
const token=process.env.TELEGRAM_BOT_TOKEN, chats=[...new Set((process.env.TELEGRAM_ADMIN_CHAT_IDS||'').split(',').map(s=>s.trim()).filter(s=>/^-?\d+$/.test(s)))];
let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
let lastMarketplaceSweep=0;
async function sweepMarketplace(client){
 const now=Date.now(),iso=new Date(now).toISOString(),bucket=Math.floor(now/900000),hour=Math.floor(now/3600000);
 await client.query(`INSERT INTO notices(id,user_id,order_id,text,created,dedupe_key)
 SELECT gen_random_uuid()::text,m.id,o.id,'Напоминание: заказ всё ещё открыт · '||COALESCE(c.name,'ваш город')||' · '||(o.details::jsonb->>'date')||', '||(o.details::jsonb->>'time'),$1,
 'offer-reminder:'||o.id||':'||m.id||':'||$2
 FROM orders o CROSS JOIN worker_profiles p JOIN members m ON m.id=p.member_id LEFT JOIN cities c ON c.id=p.city_id
 WHERE o.marketplace_version=1 AND o.status='offered' AND o.start_at>$3 AND (o.details::jsonb->>'quoteAccepted')='true'
 AND m.active=1 AND m.role IN ('cleaner','leader') AND p.enabled=1 AND p.verified=1 AND p.city_id=o.city_id AND length(trim(p.bio))>=30 AND EXISTS(SELECT 1 FROM cleaner_cards c WHERE c.member_id=p.member_id AND length(trim(c.display_name))>=2 AND c.avatar_key IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM order_skips s WHERE s.order_id=o.id AND s.worker_id=p.member_id AND s.snoozed_until>$3)
 ON CONFLICT DO NOTHING`,[iso,bucket,now]);
 await client.query(`WITH expired AS (
 UPDATE orders SET status='needs_reschedule',revision=revision+1,updated=$1
 WHERE marketplace_version=1 AND status='offered' AND start_at<=$2
 RETURNING id,client_id
 ), recipients AS (
 SELECT e.id,e.client_id AS user_id,'К выбранной дате исполнитель не успел принять заказ. Откройте карточку и выберите новое время — подбор продолжится.' AS text,'client' AS role FROM expired e
 UNION ALL SELECT e.id,m.id,'Просрочен открытый заказ: клиенту предложено выбрать новую дату.','admin' FROM expired e JOIN members m ON m.role='admin' AND m.active=1
 ) INSERT INTO notices(id,user_id,order_id,text,created,dedupe_key)
 SELECT gen_random_uuid()::text,user_id,id,text,$1,'reschedule:'||id||':'||role FROM recipients ON CONFLICT DO NOTHING`,[iso,now]);
 await client.query(`WITH unmatched AS MATERIALIZED (
 SELECT o.id,o.client_id FROM orders o WHERE o.marketplace_version=1 AND o.status='offered' AND o.start_at>$3 AND (o.details::jsonb->>'quoteAccepted')='true'
 AND NOT EXISTS(SELECT 1 FROM worker_profiles p JOIN members w ON w.id=p.member_id WHERE w.active=1 AND w.role IN ('cleaner','leader') AND p.enabled=1 AND p.verified=1 AND p.city_id=o.city_id AND length(trim(p.bio))>=30 AND EXISTS(SELECT 1 FROM cleaner_cards c WHERE c.member_id=p.member_id AND length(trim(c.display_name))>=2 AND c.avatar_key IS NOT NULL))
 ), recipients AS (
 SELECT o.id,m.id AS user_id,'Заказ пока ждёт исполнителя. Мы продолжаем подбор и сообщим, если потребуется новая дата.' AS text,'client' AS role FROM unmatched o JOIN members m ON m.id=o.client_id
 UNION ALL SELECT o.id,m.id,'Пока нет допущенных исполнителей в городе заказа. Проверьте профиль города и свяжитесь с клиентом.','admin' FROM unmatched o JOIN members m ON m.role='admin' AND m.active=1
 ) INSERT INTO notices(id,user_id,order_id,text,created,dedupe_key)
 SELECT gen_random_uuid()::text,user_id,id,text,$1,'offer-no-match:'||id||':'||role||':'||$2 FROM recipients ON CONFLICT DO NOTHING`,[iso,hour,now]);
}
async function tick(){const client=await pool.connect();try{
 await client.query('BEGIN');
 if(Date.now()-lastMarketplaceSweep>=60000){await sweepMarketplace(client);lastMarketplaceSweep=Date.now();}
 if(!token||!chats.length){await client.query('COMMIT');return;}
 // Backfill open tickets after configuration, without duplicating delivered messages.
 for(const chat of chats)await client.query(`INSERT INTO support_delivery(id,message_id,chat_id) SELECT gen_random_uuid()::text,s.id,$1 FROM support_messages s JOIN support_tickets t ON t.id=s.ticket_id JOIN members m ON m.id=s.sender_id WHERE t.status='open' AND m.role<>'admin' ON CONFLICT(message_id,chat_id) DO NOTHING`,[chat]);
 const {rows}=await client.query(`SELECT d.*,s.ticket_id FROM support_delivery d JOIN support_messages s ON s.id=d.message_id WHERE d.delivered_at IS NULL AND d.next_attempt<$1 AND d.chat_id=ANY($2) ORDER BY d.next_attempt LIMIT 1 FOR UPDATE OF d SKIP LOCKED`,[Date.now(),chats]);
 for(const d of rows){try{
 const origin=process.env.PUBLIC_ORIGIN||'https://blackandwhite-mos.ru';
 const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:d.chat_id,text:`Black to White · обращение ${d.ticket_id.slice(0,8)}\nНовое сообщение в поддержку.\n${origin}/#support`,disable_web_page_preview:true}),signal:AbortSignal.timeout(8000)});
 const result=await r.json();if(!r.ok||!result.ok)throw Error('Telegram response '+r.status);
 await client.query('UPDATE support_delivery SET delivered_at=$1,attempts=attempts+1,last_error=\'\' WHERE id=$2',[new Date().toISOString(),d.id]);
 }catch{await client.query('UPDATE support_delivery SET attempts=attempts+1,next_attempt=$1,last_error=$2 WHERE id=$3',[Date.now()+Math.min(3600000,30000*2**Math.min(d.attempts,7)),'Telegram недоступен; запланирована повторная попытка',d.id]);}}
 await client.query('COMMIT');
}catch{await client.query('ROLLBACK').catch(()=>{});console.error('Background delivery unavailable; retrying');}finally{client.release()}}
console.log(token&&chats.length?'Marketplace reminders and support delivery configured':'Marketplace reminders configured; Telegram support delivery waiting for configuration');
while(!stopping){await tick();await new Promise(r=>setTimeout(r,5000))}await pool.end();
