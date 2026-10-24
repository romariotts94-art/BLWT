import {z} from 'zod';
import {all,one,run,currentUser,requireAdmin,guardOrigin,json,fail,HttpError,now,uid,transaction} from '../../../lib/server';
import {cardSchema,publicCard} from '../../../lib/care-policy';
export const dynamic='force-dynamic';
export async function cleanerAccess(u:any,id:string){
 if(u.role==='admin'||u.id===id&&['cleaner','leader'].includes(u.role))return;
 if(!await one("SELECT id FROM orders WHERE client_id=? AND assigned_worker_id=? AND status NOT IN ('cancelled','requested','offered') LIMIT 1",u.id,id))throw new HttpError(403,'Профиль доступен по вашему заказу');
}
export async function GET(req:Request){try{
 const u=await currentUser(),url=new URL(req.url);let id=url.searchParams.get('id');
 if(url.searchParams.get('order')){const o=await one('SELECT client_id,assigned_worker_id FROM orders WHERE id=?',url.searchParams.get('order'));if(!o||u.role!=='admin'&&o.client_id!==u.id)throw new HttpError(403,'Нет доступа');id=o.assigned_worker_id;if(!id)return json({card:null});}
 if(!id){requireAdmin(u);const rows=await all("SELECT m.id,m.name,m.active,c.display_name,c.specialties,c.experience_years,c.avatar_key,p.verified,p.city_id,city.name AS city FROM members m LEFT JOIN worker_profiles p ON p.member_id=m.id LEFT JOIN cleaner_cards c ON c.member_id=m.id LEFT JOIN cities city ON city.id=p.city_id WHERE m.role IN ('cleaner','leader') ORDER BY m.name");return json({workers:rows});}
 await cleanerAccess(u,id);const row=await one("SELECT m.name,p.*,c.display_name,c.experience_years,c.languages,c.specialties,c.equipment,c.avatar_key,c.fragrance_free,c.pet_friendly,c.own_products,c.gender,city.name AS city,(SELECT COUNT(*) FROM orders o WHERE o.assigned_worker_id=m.id AND o.status='completed') AS completed FROM members m LEFT JOIN worker_profiles p ON p.member_id=m.id LEFT JOIN cleaner_cards c ON c.member_id=m.id LEFT JOIN cities city ON city.id=p.city_id WHERE m.id=? AND m.role IN ('cleaner','leader')",id);
 if(!row)throw new HttpError(404,'Исполнитель не найден');row.member_id=id;
 const reviews=(await all("SELECT details FROM orders WHERE assigned_worker_id=? AND status='completed' ORDER BY updated DESC LIMIT 200",id)).map(r=>JSON.parse(r.details).review).filter(r=>r?.publishConsent);
 return json({card:publicCard(row,reviews),editable:u.role==='admin'||u.id===id,profile:u.role==='admin'||u.id===id?row:undefined});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{
 guardOrigin(req);const u=await currentUser(),b:any=await req.json(),id=b.workerId||u.id;
 if(u.role!=='admin'&&(u.id!==id||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Нет доступа');
 if(!await one("SELECT id FROM members WHERE id=? AND role IN ('cleaner','leader')",id))throw new HttpError(404,'Исполнитель не найден');
 const c=cardSchema.parse(b.profile);await run(`INSERT INTO cleaner_cards(member_id,display_name,experience_years,gender,languages,specialties,equipment,fragrance_free,pet_friendly,own_products,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET display_name=excluded.display_name,experience_years=excluded.experience_years,gender=excluded.gender,languages=excluded.languages,specialties=excluded.specialties,equipment=excluded.equipment,fragrance_free=excluded.fragrance_free,pet_friendly=excluded.pet_friendly,own_products=excluded.own_products,updated=excluded.updated`,id,c.displayName,c.experienceYears,c.gender,c.languages,c.specialties,c.equipment,c.fragranceFree,c.petFriendly,c.ownProducts,now());
 return json({ok:true});
 }catch(e){return fail(e)}}
