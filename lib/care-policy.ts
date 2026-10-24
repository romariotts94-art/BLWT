import {z} from 'zod';
export const preferencesSchema=z.object({
 gender:z.enum(['any','female','male']).default('any'),
 fragranceFree:z.boolean().default(false), pets:z.boolean().default(false),
 ownProducts:z.boolean().default(false), delicate:z.boolean().default(false),
 instructions:z.string().trim().max(1000).default('')
}).default({});
export const cardSchema=z.object({
 displayName:z.string().trim().min(2).max(80),experienceYears:z.number().int().min(0).max(60),
 gender:z.enum(['female','male','unspecified']), languages:z.string().trim().max(200),
 specialties:z.string().trim().max(600),equipment:z.string().trim().max(600),
 fragranceFree:z.boolean(),petFriendly:z.boolean(),ownProducts:z.boolean()
});
export function preferenceLabels(p:any={}){return [p.gender==='female'?'Только женщина':p.gender==='male'?'Только мужчина':null,p.fragranceFree?'Средства без отдушки; согласовать состав':null,p.pets?'В доме животные':null,p.ownProducts?'Средства заказчика':null,p.delicate?'Деликатные поверхности':null,p.instructions].filter(Boolean) as string[];}
export function matchesPreferences(p:any={},c:any={}){return (p.gender===undefined||p.gender==='any'||p.gender===c.gender)&&(!p.fragranceFree||c.fragrance_free===true)&&(!p.pets||c.pet_friendly===true)&&(!p.ownProducts||c.own_products===true);}
export function publicCard(row:any,reviews:any[]=[]){return {
 id:row.member_id,name:row.display_name||row.name,bio:row.bio||'',city:row.city||'',
 experienceYears:row.experience_years||0,languages:row.languages||'',specialties:row.specialties||'',
 equipment:row.equipment||'',verified:!!row.verified,completed:Number(row.completed||0),
 avatar:row.avatar_key?'/api/cleaners/avatar?id='+encodeURIComponent(row.member_id):null,
 services:typeof row.services==='string'?JSON.parse(row.services):row.services||[],
 rating:reviews.length?Math.round(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length*10)/10:null,
 reviews:reviews.map(r=>({rating:r.rating,text:r.text,created:r.created})),
 fragranceFree:!!row.fragrance_free,petFriendly:!!row.pet_friendly,ownProducts:!!row.own_products
};}
