import citiesData from './cities.json';
export const cities = citiesData;
export const cityById = (id:string) => cities.find(c=>c.id===id);
export const cents = (rubles:number) => Math.round(rubles*100);
export const payoutFor = (gross:number) => Math.floor(gross*75/100);
export const activeStatuses = ['contract_pending','admin_review','assigned','en_route','in_progress','review'];
export function timeWindow(date:string,time:string,offset:string,hours:number){
 const start=Date.parse(`${date}T${time}:00${offset}`);
 const validDate=Number.isFinite(start)&&new Date(Date.parse(`${date}T12:00:00Z`)).toISOString().slice(0,10)===date;
 if(!validDate||!Number.isFinite(hours)||hours<=0)throw new Error('Некорректная дата или длительность');
 return {start,end:start+Math.ceil(hours*3600000)};
}
export function safeWorkerText(text:unknown,name=''){
 let value=String(text||'').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'[контакт скрыт]').replace(/[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}/gi,'[контакт скрыт]').replace(/(?:https?:\/\/|www\.|t\.me\/|@[a-zA-Z_])[\S]+/g,'[контакт скрыт]');
 for(const word of name.split(/\s+/).filter(w=>w.length>2))value=value.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'),'[имя скрыто]');
 return value;
}
// Explicit role projections: adding a database column cannot silently expose it to another role.
export function projectOrder(o:any,u:any){
 const isAdmin=u.role==='admin',client=o.clientId===u.id;
 if(isAdmin)return o;
 const worker=!client, isAssigned=['assigned','en_route','in_progress','review','completed'].includes(o.status),assignedWorker=worker&&(o.assignedWorkerId===u.id||o.crew.includes(u.id))&&isAssigned;
 const q=worker?{total:Number(o.payoutCents??payoutFor(cents(o.quote.total)))/100,hours:o.quote.hours,workers:o.quote.workers,needsEstimate:o.quote.needsEstimate}:{total:o.quote.total,base:o.quote.base,multiplier:o.quote.multiplier,additions:o.quote.additions,hours:o.quote.hours,workers:o.quote.workers,needsEstimate:o.quote.needsEstimate};
 const common:any={id:o.id,status:client&&['contract_pending','admin_review'].includes(o.status)?'offered':o.status,created:o.created,updated:o.updated,revision:o.revision,cityId:o.cityId,city:o.city,region:o.region,timezone:o.timezone,date:o.date,time:o.time,service:o.service,area:o.area,dirt:o.dirt,frequency:o.frequency,extras:o.extras,urgent:o.urgent,quote:q,quoteAccepted:o.quoteAccepted,checklist:o.checklist,liveConsent:o.liveConsent,payment:o.payment,photoPending:client?o.photoPending:undefined,preferences:o.preferences||{},productsUsed:o.productsUsed||'',marketplaceVersion:o.marketplaceVersion,clientId:client?u.id:undefined,crew:worker&&o.crew.includes(u.id)?[u.id]:[],target:worker&&o.crew.includes(u.id)?u.id:null,companyTeam:isAssigned?(o.quote.workers>1?'Команда Black to White':'Сотрудник Black to White'):null,claimUntil:worker?o.claimUntil:undefined,liveStates:worker?o.liveStates:{}};
 if(client)return {...common,name:o.name,phone:o.phone,address:o.address,notes:o.notes,accessNote:o.accessNote,issue:o.issue,issueResolution:o.issueResolution,review:o.review};
 return {...common,address:assignedWorker?safeWorkerText(o.address,o.name):`${o.city||'Город заказа'} · точный адрес после принятия`,notes:assignedWorker?safeWorkerText(o.notes,o.name):'',issue:assignedWorker?safeWorkerText(o.issue,o.name):'',issueResolution:assignedWorker?safeWorkerText(o.issueResolution,o.name):'',accessNote:assignedWorker?safeWorkerText(o.accessNote,o.name):''};
}
export function weekContext(timezone='Europe/Moscow',at=Date.now()){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
 const d=new Date(date+'T00:00:00Z'),dow=(d.getUTCDay()+6)%7;
 d.setUTCDate(d.getUTCDate()-dow);const week=d.toISOString().slice(0,10);
 const next=new Date(d.getTime()+7*86400000).toISOString().slice(0,10);
 // Find the offset for this city's next Monday, including historical/DST zones.
 const parts=new Intl.DateTimeFormat('en',{timeZone:timezone,timeZoneName:'longOffset'}).formatToParts(new Date(next+'T12:00:00Z'));
 const offset=parts.find(p=>p.type==='timeZoneName')?.value.replace('GMT','')||'+00:00';
 return {week,validUntil:Date.parse(next+'T00:00:00'+offset)};
}
export const lessons=[
 {id:'safety',title:'Средства и поверхности',category:'01 / БЕЗОПАСНОСТЬ',minutes:4,imagePosition:'0% 0%',lead:'Хороший результат начинается с безопасного выбора средства. Даже привычная бытовая химия требует внимания.',steps:[{title:'Прочитайте этикетку',text:'Проверьте назначение, допустимые поверхности, дозировку, время действия и способ смывания. Не используйте средство без понятной инструкции.'},{title:'Не смешивайте составы',text:'Особенно опасно сочетать хлорсодержащие средства с кислотами или аммиаком. Для нового средства берите чистый инвентарь и воду, если это допускает инструкция.'},{title:'Защитите себя и объект',text:'Используйте перчатки и проветривание по инструкции. На неизвестном покрытии сначала проверьте средство на незаметном участке. Если появились резкий запах или раздражение, прекратите работу и сообщите диспетчеру.'}],takeaway:'Сначала инструкция и проба, затем обработка всей поверхности.',source:'https://zpp.rospotrebnadzor.ru/news/regional/573305'},
 {id:'sequence',title:'Маршрут уборки',category:'02 / ТЕХНИКА',minutes:5,imagePosition:'100% 0%',lead:'Порядок работы помогает не переносить загрязнения и укладываться в согласованное время.',steps:[{title:'Подготовьте зоны',text:'Сверьте заказ и доступные комнаты. Разделите инвентарь для жилых помещений, кухни и санузла. Не переносите использованные салфетки из санузла в другие зоны.'},{title:'Двигайтесь сверху вниз',text:'Начните с верхних поверхностей и сухой пыли, затем переходите к более низким поверхностям и влажной уборке. Пол оставьте ближе к завершению.'},{title:'Сверяйтесь с объёмом заказа',text:'Отмечайте выполненные пункты по ходу работы. Для генеральной уборки, офиса и квартиры состав задач различается — ориентируйтесь на карточку конкретного заказа.'}],takeaway:'У каждой зоны свой инвентарь; маршрут — от верхних поверхностей к полу.'},
 {id:'care',title:'Сервис и доверие',category:'03 / СЕРВИС',minutes:4,imagePosition:'0% 100%',lead:'В Москве и городах области важны точное время прибытия, спокойное общение и уважение к личному пространству.',steps:[{title:'Проверьте дорогу и доступ',text:'Накануне посмотрите город, время и примечания в карточке. Заложите дорогу и запас на проходную, парковку или лифт. При риске опоздания сразу сообщите диспетчеру.'},{title:'Уважайте вещи клиента',text:'Не открывайте шкафы и не перемещайте документы или ценности без согласования. Замеченные до начала работ повреждения зафиксируйте и передайте администратору.'},{title:'Согласуйте изменения',text:'Если клиент просит работу вне заказа, заранее согласуйте состав, время и стоимость через администратора. Не обещайте доплату или перенос самостоятельно.'}],takeaway:'Любое изменение задания сначала согласуется, затем выполняется.'},
 {id:'finish',title:'Проверка результата',category:'04 / КАЧЕСТВО',minutes:4,imagePosition:'100% 100%',lead:'Последние минуты заказа нужны для проверки деталей, а не для поспешного ухода.',steps:[{title:'Пройдите чек-лист',text:'Осмотрите поверхности, пол, кухню, санузел и дополнительные работы, которые были в заказе. Проверьте углы, следы средства и оставшийся мусор.'},{title:'Сделайте корректный фотоотчёт',text:'Покажите результат и нужные ракурсы без лиц, документов, экранов и личных данных. Уберите инвентарь и проверьте, что ничего не забыли.'},{title:'Передайте на приёмку',text:'Отметьте выполненные пункты, сообщите о спорных местах и отправьте результат через карточку. Завершение заказа фиксируется после проверки.'}],takeaway:'Чек-лист и приватный фотоотчёт завершают качественную работу.'}
];
