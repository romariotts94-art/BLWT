import type {Metadata} from 'next';
import CareGuide from '../../components/CareGuide';
export const metadata:Metadata={title:'Бережная уборка: средства и поверхности | Black to White',description:'Как выбирать средства для разных поверхностей, соблюдать дозировку и обсуждать ограничения перед уборкой. Учебные материалы Black to White.',alternates:{canonical:'/care-guide'},openGraph:{type:'article',locale:'ru_RU',url:'https://blacktowhite.ru/care-guide',title:'Бережная уборка: средства и поверхности | Black to White',description:'Практические материалы по выбору средств и уходу за поверхностями.'}};
export default function Page(){return <CareGuide/>}
