import type {Metadata} from 'next';
import CareGuide from '../../components/CareGuide';
export const metadata:Metadata={title:'Black to White — Академия уборки',description:'Как Академия уборки Black to White рекомендует выбирать средства, соблюдать дозировку и беречь дерево, камень, стекло и текстиль. Примеры составов и инструкции производителей.'};
export default function Page(){return <CareGuide/>}
