import type { Metadata } from 'next';
import './globals.css';
import './marketing.css';
import './operations.css';
import './academy-coverage.css';
import './care-modules.css';
import './customer-experience.css';
import './cleaning-game.css';
import './workspace-polish.css';
import './visual-story.css';
export const metadata:Metadata={metadataBase:new URL('https://blacktowhite.ru'),title:'Заказать уборку в Москве — подбор исполнителя | Black to White',description:'Подберите независимого исполнителя для уборки квартиры или дома в Москве. Состав работ и предварительная стоимость видны до отправки заявки.',alternates:{canonical:'/'},openGraph:{type:'website',locale:'ru_RU',url:'https://blacktowhite.ru/',siteName:'Black to White',title:'Black to White — подбор исполнителя для уборки в Москве',description:'Выберите уборку, посмотрите состав работ и предварительную стоимость. Платформа поможет найти независимого исполнителя в Москве.',images:[{url:'/media/living-room-bright-after.webp',alt:'Светлая комната после уборки'}]},icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><head><link rel="preload" as="image" href="/media/living-room-bright-after-thumb.webp"/><link rel="preload" as="image" href="/media/living-room-bright-after.webp"/></head><body>{children}</body></html>}
