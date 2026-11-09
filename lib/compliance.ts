import {env} from 'cloudflare:workers';
import {one} from './server';
export const complianceChecks=[
 ['ip','Документы ИП и актуальные реквизиты'],['tax','Режим налогообложения и бухгалтерская схема'],['domain','Право на домен и договор хостинга'],['acquiring','Договор эквайринга и завершённые тесты RBS'],['payouts','Договор выплат и решение СБ/финмониторинга'],['fiscal','ККТ, ОФД и проверенные агентские чеки'],['privacy','Локализация данных, уведомление РКН и договоры обработки'],['operations','Возвраты, претензии, сверка и резерв денежных средств']
] as const;
export async function complianceStatus(){
 const saved=await one("SELECT value FROM settings WHERE key='compliance_evidence'");let evidence:any={};try{evidence=JSON.parse(saved?.value||'{}')}catch{}
 return {checks:complianceChecks.map(([id,title])=>({id,title,...(evidence[id]||{status:'pending',reference:'',at:null})})),paymentsEnabled:false,bankAdapterReady:false,fiscalAdapterReady:false,reconciliationEnabled:(env as any).BANK_RECONCILIATION_ENABLED==='true',message:'Реестр подтверждений готов. Приём платежей и отправка выплат остаются выключены до внедрения и проверки банковского и кассового подключения.'};
}
