import type { Metadata } from 'next';
import './globals.css';
import './marketing.css';
import './operations.css';
import './academy-coverage.css';
import './care-modules.css';
import './customer-experience.css';
import './cleaning-game.css';
export const metadata:Metadata={title:'Black and White — от чёрного к белому',description:'Клининг в Москве с прозрачной сметой и приватной видеотрансляцией. Квартиры, дома, офисы и сложные объекты.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
