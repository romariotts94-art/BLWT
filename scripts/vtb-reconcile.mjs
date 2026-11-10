const enabled=process.env.VTB_SANDBOX_ENABLED==='true';
const token=process.env.VTB_RECONCILE_TOKEN||'';
const intervalMs=60_000;
const endpoint='http://app:3000/api/vtb-sandbox';

async function poll(){
 if(!enabled||!/^[a-f0-9]{64}$/i.test(token))return;
 const response=await fetch(endpoint,{
  method:'POST',
  headers:{'content-type':'application/json','x-vtb-reconcile-token':token},
  body:JSON.stringify({action:'reconcile'}),
  signal:AbortSignal.timeout(100_000),
 });
 if(!response.ok)throw Error(`VTB reconciliation HTTP ${response.status}`);
 const result=await response.json();
 if(result.failed)console.error(`VTB reconciliation: ${result.checked} checked, ${result.failed} failed`);
 else if(result.checked)console.info(`VTB reconciliation: ${result.checked} checked`);
}

if(!enabled||!/^[a-f0-9]{64}$/i.test(token))console.info('VTB reconciliation disabled');
for(;;){
 try{await poll()}catch(error){console.error(error instanceof Error?error.message:'VTB reconciliation failed')}
 await new Promise(resolve=>setTimeout(resolve,intervalMs));
}
