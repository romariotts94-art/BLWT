import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import VtbTestPage from './client';
export const dynamic='force-dynamic';
export default function Page(){if((env as any).VTB_SANDBOX_ENABLED!=='true')notFound();return <VtbTestPage/>}
