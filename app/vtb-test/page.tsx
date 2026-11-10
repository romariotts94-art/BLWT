import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {currentUser,isOwner} from '../../lib/server';
import VtbTestPage from './client';
export const dynamic='force-dynamic';
export default async function Page(){
 if((env as any).VTB_SANDBOX_ENABLED!=='true')notFound();
 try{const u=await currentUser();if(u.role!=='admin'||!isOwner(u))notFound()}catch{notFound()}
 return <VtbTestPage/>;
}
