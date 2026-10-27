import type {Metadata} from 'next';
import CareGuide from '../../components/CareGuide';
export const metadata:Metadata={title:'Бережный уход за домом — Академия Black & White',description:'Как академия Black & White рекомендует выбирать средства, соблюдать дозировку и беречь дерево, камень, стекло и текстиль. Примеры составов и инструкции производителей.'};
export default function Page(){return <CareGuide/>}
