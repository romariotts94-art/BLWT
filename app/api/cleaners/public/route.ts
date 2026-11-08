import {env} from 'cloudflare:workers';
import {json,fail,HttpError} from '../../../../lib/server';
import {showcase,publishedProfiles,previewCleaner} from '../../../../lib/cleaner-trust';
import {demoCleaners} from '../../../../lib/demo-cleaners';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get('id');if(id){if((env as any).TRUST_DEMO_ENABLED==='true'){const example=demoCleaners.find(c=>c.id===id);if(example)return json({card:example})}const preview=await previewCleaner(id);if(preview)return json({card:preview});const card=(await publishedProfiles(id||undefined)).find(c=>c.id===id);if(!card)throw new HttpError(404,'Анкета сейчас не опубликована');return json({card})}const {cards}=await showcase(),previewId=(env as any).TRUST_PREVIEW_WORKER_ID,preview=previewId?await previewCleaner(previewId):null;return json({cards:preview?[{...preview,position:0},...cards.filter(c=>c.id!==preview.id).slice(0,2).map((c,i)=>({...c,position:i+1}))]:cards,demo:(env as any).TRUST_DEMO_ENABLED==='true'});}catch(e){return fail(e)}}
