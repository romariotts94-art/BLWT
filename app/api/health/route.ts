import {one} from '../../../lib/server';
export const dynamic='force-dynamic';

// Keep this check portable across the legacy D1 preview and the PostgreSQL VPS.
// A zero-row SELECT validates the required schema without reading customer data.
const REQUIRED_TABLES = [
  'members','invitations','teams','orders','notices','messages','audit','settings','channels','media',
  'auth_codes','auth_sessions','documents','contracts','cities','customer_profiles','customer_cities',
  'worker_profiles','worker_availability','order_skips','worker_agreements','quality_attempts',
  'wallet_ledger','withdrawal_requests','order_incidents','cleaner_cards','staff_messages',
  'support_tickets','support_messages','support_delivery',
];

export async function GET(){
  try{
    await one(`SELECT 1 FROM ${REQUIRED_TABLES.join(',')} LIMIT 0`);
    return Response.json({ok:true,version:'marketplace-2026-10-21'},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
