import {currentUser,fail,HttpError,json,one,all,run,orderAccess,guardOrigin,transaction} from '../../../lib/server';
import {contractAction,contractSnapshot} from '../../../lib/order-contract';
import {readJsonBody} from '../../../lib/request-body';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const u=await currentUser(),id=new URL(req.url).searchParams.get('order');if(!id)throw new HttpError(400,'Не указан заказ');
 const o=await orderAccess(id,u);const c=await one('SELECT * FROM contract_versions WHERE order_id=? AND voided_at IS NULL',id);
 let stale=false;if(c){try{stale=c.fingerprint!==(await contractSnapshot(o,{one,all,run})).fingerprint;}catch{stale=true;}}
 return json({contract:c,stale,canSign:u.id===o.clientId||u.id===o.assignedWorkerId});
}catch(e){return fail(e);}}
export async function POST(req:Request){try{guardOrigin(req);const u=await currentUser(),b:any=await readJsonBody(req);if(typeof b.orderId!=='string')throw new HttpError(400,'Не указан заказ');return json({contract:await transaction(tx=>contractAction(u,b,tx)),stale:false,canSign:u.role!=='admin'});}catch(e){return fail(e);}}
