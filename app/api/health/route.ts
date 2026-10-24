import {one} from '../../../lib/server';
export const dynamic='force-dynamic';
export async function GET(){try{const r=await one("SELECT to_regclass('worker_profiles') AS schema");if(!r?.schema)throw Error('Migration pending');return Response.json({ok:true,version:'marketplace-2026-10-21'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
