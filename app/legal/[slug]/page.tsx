import {legalDocument,legalDocuments} from '../../../lib/legal-content';
import {notFound} from 'next/navigation';
export default async function LegalPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const doc=legalDocument(slug);if(!doc)notFound();
 return <main style={{maxWidth:860,margin:'0 auto',padding:'40px 24px',lineHeight:1.75,color:'#202523',background:'#fff'}}><a href="/">Black to White</a><h1 style={{fontSize:'clamp(25px,4vw,38px)',lineHeight:1.2,margin:'32px 0 12px'}}>{doc.title}</h1><p>Редакция {doc.version}</p>{doc.paragraphs.map((p,i)=><p key={i} style={{margin:'18px 0',color:'#343c36'}}>{p}</p>)}<hr/><nav aria-label="Правовые документы" style={{display:'flex',gap:16,flexWrap:'wrap'}}>{Object.values(legalDocuments).filter(d=>d.id!==slug).map(d=><a key={d.id} href={'/legal/'+d.id}>{d.title}</a>)}</nav></main>;
}
