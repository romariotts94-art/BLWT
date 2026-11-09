import content from './legal-documents.json';
export const operator=content.operator;
export const legalDocuments=content.documents;
export type LegalId=keyof typeof legalDocuments;
export function legalDocument(id:string){return Object.hasOwn(legalDocuments,id)?legalDocuments[id as LegalId]:null;}
export async function textHash(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function legalBody(id:LegalId){const d=legalDocuments[id];return `${d.title}\nРедакция ${d.version}\n\n${d.paragraphs.join('\n\n')}`;}
