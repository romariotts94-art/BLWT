import PublicCleanerPage from '../../../components/PublicCleanerPage';
export const dynamic='force-dynamic';
export const metadata={title:'Анкета исполнителя | Black to White',robots:{index:false,follow:true},alternates:{canonical:null}};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicCleanerPage id={id}/>}
