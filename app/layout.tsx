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
export const metadata:Metadata={title:'Black to White — клининг в Москве',description:'Клининг в Москве с прозрачной сметой. Квартиры, дома, офисы и дополнительные задачи.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><head><link rel="preload" as="image" href="/media/living-room-bright-after-thumb.webp"/><link rel="preload" as="image" href="/media/living-room-bright-after.webp"/></head><body>{children}</body></html>}
