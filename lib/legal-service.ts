import {legalDocument,legalBody,textHash,LegalId} from './legal-content';
import {one,run,uid,now,HttpError} from './server';
export async function legalSnapshot(memberId:string|null,key:LegalId,tx:any={one}){
 const doc=legalDocument(key)!;let body=legalBody(key);
 if(key==='partner'&&memberId){
  const p=await tx.one('SELECT p.legal_name,p.legal_checked_at,p.npd_inn,m.email FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=?',memberId);
  if(!p?.legal_checked_at||!p.legal_name?.trim()||!/^\d{12}$/.test(p.npd_inn||''))throw new HttpError(409,'Для агентского договора нужны проверенные ФИО и ИНН в анкете');
  body=`АНКЕТА ПРИСОЕДИНЕНИЯ\nПринципал: ${p.legal_name}. ИНН: ${p.npd_inn}. Email: ${p.email}. Личный кабинет: ${memberId}.\n\n${body}`;
 }
 return {...doc,body,hash:await textHash(body)};
}
export async function acceptanceStatus(memberId:string,key:LegalId,tx:any={one}){
 const doc=await legalSnapshot(memberId,key,tx);
 return tx.one('SELECT id,accepted_at FROM legal_acceptances WHERE member_id=? AND document_key=? AND version=? AND body_hash=? AND revoked_at IS NULL',memberId,key,doc.version,doc.hash);
}
export async function acceptLegal(memberId:string,key:string,version:string,hash:string,tx:any={one,run}){
 if(!legalDocument(key))throw new HttpError(404,'Документ не найден');
 const doc=await legalSnapshot(memberId,key as LegalId,tx);
 if(doc.version!==version||doc.hash!==hash)throw new HttpError(409,'Документ обновлён. Откройте актуальную редакцию.');
 await tx.run('INSERT INTO legal_acceptances(id,member_id,document_key,version,body,body_hash,accepted_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(member_id,document_key,version,body_hash) DO UPDATE SET accepted_at=excluded.accepted_at,revoked_at=NULL WHERE legal_acceptances.revoked_at IS NOT NULL',uid(),memberId,key,version,doc.body,hash,now());
}
