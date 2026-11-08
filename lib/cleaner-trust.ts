import {all,one} from './server';
import {env} from 'cloudflare:workers';
import {isLaunchCity} from './marketplace-policy';
import {hasNonIpVerification} from './launch-policy.mjs';
import {profileSnapshot,trustCurrent,publicProfileReviews,rankedProfiles} from './cleaner-trust-policy';
export {profileSnapshot,trustCurrent};
export const trustKey=(id:string)=>'cleaner_trust:'+id;
export async function setting(key:string,fallback:any={}){const row=await one('SELECT value FROM settings WHERE key=?',key);try{return row?JSON.parse(row.value):fallback}catch{return fallback}}
export async function cleanerRow(id:string){return one(`SELECT m.id,m.active,m.role,p.city_id,p.bio,p.verified,p.contractor_type,p.npd_status,p.npd_checked_on,c.* FROM members m JOIN worker_profiles p ON p.member_id=m.id JOIN cleaner_cards c ON c.member_id=m.id WHERE m.id=?`,id);}
export async function publishedProfiles(id?:string){
 const rows=await all(`SELECT m.id,m.active,m.role,p.city_id,p.bio,p.verified,p.contractor_type,p.npd_inn,p.npd_status,p.npd_checked_on,c.*,s.value AS trust_json,n.value AS non_ip_json FROM members m JOIN worker_profiles p ON p.member_id=m.id JOIN cleaner_cards c ON c.member_id=m.id JOIN settings s ON s.key='cleaner_trust:' || m.id LEFT JOIN settings n ON n.key='non_ip_verification:' || m.id WHERE m.active=1 AND m.role IN ('cleaner','leader') AND p.verified=1 ${id?'AND m.id=?':''}`, ...(id?[id]:[]));
 const cards=[];
 for(const row of rows){let trust;try{trust=JSON.parse(row.trust_json)}catch{continue}if(!isLaunchCity(row.city_id)||row.contractor_type!=='npd'||Number(row.npd_status)!==1||!hasNonIpVerification(row.non_ip_json,row.npd_inn)||!row.avatar_key||!trustCurrent(row,trust))continue;
 const reviews=publicProfileReviews(await all("SELECT status,details FROM orders WHERE assigned_worker_id=? AND status='completed' ORDER BY created DESC",row.id));
 const allowed=Array.isArray(trust.portfolioIds)?trust.portfolioIds:[];
 const photos=(await all("SELECT id,name FROM documents WHERE worker_id=? AND name LIKE ? AND review_status='approved' ORDER BY created DESC",row.id,'Фото работы · %')).filter(p=>allowed.includes(p.id));
 cards.push({id:row.id,name:row.display_name,bio:row.bio,city:'Москва',experienceYears:Number(row.experience_years),specialties:row.specialties,languages:row.languages,equipment:row.equipment,verified:true,completed:0,
 avatar:'/api/cleaners/public-photo?worker='+encodeURIComponent(row.id)+'&v='+encodeURIComponent(trust.approvedAt),identityCheckedAt:trust.approvedAt,experienceCheckedAt:trust.approvedAt,npdCheckedOn:row.npd_checked_on,
 rating:reviews.length?Math.round(reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length*10)/10:null,reviews,
 workPhotos:photos.map(p=>({id:p.id,url:'/api/cleaners/public-photo?worker='+encodeURIComponent(row.id)+'&photo='+encodeURIComponent(p.id)}))});
 }
 return cards;
}
export async function showcase(){const config=await setting('cleaner_showcase',{mode:'rating',slots:['','','']});return {config,cards:rankedProfiles(await publishedProfiles(),config.mode==='manual'?config.slots:[])};}
export async function previewCleaner(id:string){
 if((env as any).TRUST_PREVIEW_WORKER_ID!==id)return null;
 const row=await one(`SELECT m.id,m.active,m.role,p.bio,p.city_id,c.* FROM members m JOIN worker_profiles p ON p.member_id=m.id JOIN cleaner_cards c ON c.member_id=m.id WHERE m.id=? AND m.active=1 AND m.role IN ('cleaner','leader')`,id);
 if(!row)return null;
 const questions=await setting('cleaner_questions:'+id,[]);
 const framing=await setting('cleaner_portrait_framing:'+id,{});
 return {id:row.id,name:row.display_name,bio:row.bio,city:'Москва',experienceYears:Number(row.experience_years||0),specialties:row.specialties,languages:row.languages,equipment:row.equipment,avatar:'/api/cleaners/public-photo?worker='+encodeURIComponent(id),portraitFraming:framing.avatarKey===row.avatar_key&&framing.mode==='portrait'?'portrait':'standard',reviews:[],workPhotos:[],completed:0,rating:null,verified:false,preview:true,questions:Array.isArray(questions)?questions:[]};
}
