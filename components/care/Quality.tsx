'use client';
import React,{useMemo,useState} from 'react';
import {BookOpen,Check,Search,ShieldCheck,TriangleAlert} from 'lucide-react';
import {handbookVersion,products,handbookChapters,handbookSources} from '../../lib/cleaner-handbook';
import {careProducts,managerConditions,managerSurfaceGuidance,managerSurfaces,managerTaskGuidance,managerTasks} from '../../lib/care-guide';

const conditionGuidance:Record<string,string>={
 allergy:'Аллергия или чувствительность: заранее уточнить ограничения и состав. «Без запаха» не означает отсутствие аллергенов.',
 children:'Дети: согласовать доступ в помещение и к обработанным поверхностям до полного высыхания и выполнения инструкции средства.',
 pets:'Животные: не допускать к растворам и влажным поверхностям; проверить ограничения этикетки для зоны и питомца.',
 asthma:'Астма или чувствительность дыхательных путей: уточнить предпочтения, проветривание и исключить нежелательное распыление.',
 food:'Контакт с пищей: применять только разрешённый для такой поверхности продукт; смывать остатки, если велит инструкция.',
 'poor-ventilation':'Слабое проветривание: остановиться и выбрать безопасный способ после проверки этикетки и условий помещения.',
 delicate:'Новое или деликатное покрытие: сверить инструкцию изготовителя и сделать пробу в незаметном месте.'
};

export function SurfaceSelector(){
 const [surfaceId,setSurfaceId]=useState(managerSurfaces[0].id),[taskId,setTaskId]=useState(managerTasks[0].id),[conditions,setConditions]=useState<string[]>([]),[query,setQuery]=useState('');
 const surface=managerSurfaces.find(item=>item.id===surfaceId)||managerSurfaces[0],task=managerTasks.find(item=>item.id===taskId)||managerTasks[0];
 const productId=(surface.productByTask as Record<string,string>)[taskId],matchedProduct=careProducts.find(item=>item.id===productId);
 const needsManualCheck=conditions.some(id=>['allergy','asthma','poor-ventilation','delicate'].includes(id));
 const product=needsManualCheck?undefined:matchedProduct;
 const results=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('ru-RU');if(!q)return [];
  const surfaces=managerSurfaces.filter(x=>(x.name+' '+x.group).toLocaleLowerCase('ru-RU').includes(q)).slice(0,5).map(x=>({type:'surface' as const,id:x.id,label:x.name,meta:x.group}));
  const tasks=managerTasks.filter(x=>x.name.toLocaleLowerCase('ru-RU').includes(q)).slice(0,4).map(x=>({type:'task' as const,id:x.id,label:x.name,meta:'задача'}));
  return [...surfaces,...tasks];
 },[query]);
 function toggle(id:string){setConditions(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
 return <section className="care-selector" id="care-finder">
  <div className="care-selector-controls"><span className="op-eyebrow">ИНТЕРАКТИВНЫЙ ПОИСК · {managerSurfaces.length*managerTasks.length} СОЧЕТАНИЙ</span><h2>Найдите метод и средство</h2><p>Выберите материал и задачу. Если совместимость не подтверждена, мы покажем безопасный порядок действий без автоматического назначения химии.</p>
   <label className="field care-search-field"><span>Быстрый поиск</span><div><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: мрамор, жир, стекло"/></div></label>
   {query&&<div className="care-search-results" aria-live="polite">{results.length?results.map(r=><button key={r.type+r.id} type="button" onClick={()=>r.type==='surface'?setSurfaceId(r.id):setTaskId(r.id)}><span>{r.label}</span><small>{r.meta}</small></button>):<p>Совпадений нет. Попробуйте другой материал или задачу.</p>}</div>}
   <label className="field">Поверхность и материал<select value={surface.id} onChange={e=>setSurfaceId(e.target.value)}>{Array.from(new Set(managerSurfaces.map(item=>item.group))).map(group=><optgroup key={group} label={group}>{managerSurfaces.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
   <label className="field">Задача уборки<select value={task.id} onChange={e=>setTaskId(e.target.value)}>{managerTasks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <fieldset className="care-condition-picks"><legend>Что важно учесть дома</legend><div>{managerConditions.map(item=><button type="button" key={item.id} aria-pressed={conditions.includes(item.id)} onClick={()=>toggle(item.id)}>{conditions.includes(item.id)?<Check size={14}/>:<span aria-hidden="true">+</span>}{item.label}</button>)}</div></fieldset>
  </div>
  <article className={'care-method '+(product?'':'needs-check')} aria-live="polite">
   <span className="op-eyebrow">{product?'УЧЕБНЫЙ ПРИМЕР СРЕДСТВА':'БЕЗОПАСНЫЙ ПЛАН БЕЗ АВТОПОДБОРА'} · {surface.name}</span>
   <h2>{product?`${product.brand} ${product.name}`:`Как убрать: ${task.name.toLocaleLowerCase('ru-RU')}`}</h2>
   {product?<><p>{product.description}</p><div className="care-dose"><b>Метод</b><p>{product.method}</p></div><p className="care-caution"><b>Перед началом:</b> {product.caution}</p><a target="_blank" rel="noreferrer" href={product.source}>Актуальная карточка производителя ↗</a></>:<><p>{needsManualCheck?'С учётом выбранных условий автоматическую рекомендацию средства отключили. Сначала согласуйте ограничения и сверьте инструкцию продукта.':`Для пары «${surface.name} · ${task.name.toLocaleLowerCase('ru-RU')}» нет подтверждённого соответствия средству. Не заменяйте его универсальным составом.`}</p><div className="care-dose"><b>Порядок для поверхности</b><p>{managerSurfaceGuidance[surface.id]}</p></div><div className="care-dose"><b>Метод для задачи</b><p>{managerTaskGuidance[task.id]}</p></div></>}
   {conditions.length>0&&<div className="care-selected-conditions"><b>Учитываем ваши условия</b>{conditions.map(id=><p key={id}><Check size={15}/>{conditionGuidance[id]}</p>)}</div>}
   <p className="care-finder-note"><TriangleAlert size={17}/>Это учебный справочник. Перед работой исполнитель проверяет маркировку средства, паспорт безопасности, материал и пожелания клиента. Этикетка и инструкция изготовителя имеют приоритет.</p>
  </article>
 </section>
}

const standards=[
 ['До подтверждения заказа','Проверьте состав работ, дату, доступ и особые пожелания. Уточните материал и покрытие, домашних животных, чувствительность к запахам и ограничения доступа. Не обещайте дополнительные работы без согласования.'],
 ['Осмотр и границы','До начала зафиксируйте уже существующие повреждения и спорные участки. Не трогайте документы, лекарства, ценности и электронику без разрешения. Не начинайте высотные или специализированные работы без нужного оборудования и допуска.'],
 ['Средства и защита','Читайте этикетку и паспорт безопасности: назначение, способ нанесения, разведение, время выдержки, смывание, хранение и нужные СИЗ. Не переливайте средство в тару для напитков. Не смешивайте продукты. Проветривайте по инструкции.'],
 ['Уборка и дезинфекция','Обычная уборка удаляет загрязнения; дезинфекция — отдельная задача и не нужна автоматически при каждом визите. Если она заказана, сначала очистите поверхность, затем используйте продукт для требуемой задачи и выдержите указанное время влажного контакта.'],
 ['Чистый инвентарь','Разделяйте салфетки и насадки по зонам, в первую очередь санузел и кухня. Меняйте загрязнённые стороны и салфетки; двигайтесь от чистого к грязному и сверху вниз. Микрофибру стирайте по инструкции изготовителя, не добавляйте кондиционер, если он запрещён.'],
 ['Стоп-сигналы','Неизвестное покрытие, разлив химии, симптомы раздражения, иглы, биологические загрязнения, обширная плесень или подозрение на опасный материал — повод остановиться, оградить зону и связаться с администрацией. Не пытайтесь устранять опасность неподходящей бытовой химией.'],
 ['Проверка перед сдачей','Пройдите согласованный чек-лист, уберите остатки и инвентарь, отметьте исключённые участки. Загрузите фото результата и использованных средств по правилам сервиса; не снимайте лица, документы, экраны и личные фотографии. Сообщите клиенту о незавершённых пунктах.']
];

export default function Quality({academy=false}:{academy?:boolean}){
 const [query,setQuery]=useState('');
 const chapters=handbookChapters.filter(c=>(c.title+' '+c.items.join(' ')).toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU')));
 return <div className="care-quality">
  <header className="care-quality-hero"><span className="op-eyebrow">BLACK TO WHITE / {academy?'АКАДЕМИЯ ИСПОЛНИТЕЛЯ':'СТАНДАРТ РАБОТЫ'}</span><h1>{academy?'Кодекс клинера.':'Безопасность и качество.'}</h1><p>{academy?'Практические рекомендации для каждого заказа: от осмотра объекта до фотоотчёта.':'Короткие правила для исполнителя перед принятием и выполнением заказа.'}</p><div className="care-chips"><span>Материал → метод → проверка</span><span>Безопасность клиента и исполнителя</span><span>Версия {handbookVersion}</span></div></header>
  <section className="op-panel care-quality-standards"><span className="op-eyebrow">ПЕРЕД ТЕМ КАК ПРИНЯТЬ ЗАКАЗ</span><h2><ShieldCheck size={25}/> Рекомендации исполнителю</h2><p className="care-standards-intro">Используйте этот порядок как рабочий ориентир. Он составлен по рекомендациям CDC/NIOSH, OSHA, отраслевым материалам ISSA и открытым регламентам клининговых компаний; это не медицинская гарантия или сертификат обучения.</p><div className="care-standard-grid">{standards.map((item,i)=><article key={item[0]}><span>0{i+1}</span><b>{item[0]}</b><p>{item[1]}</p></article>)}</div><p className="care-caution">Всегда следуйте маркировке конкретного средства и требованиям изготовителя поверхности. При противоречии или неизвестном материале остановитесь и уточните безопасный способ до применения.</p></section>
  <section className="care-finder-intro"><span className="op-eyebrow">ИНСТРУМЕНТ ДЛЯ БЫСТРОГО ПОИСКА</span><h2>Подберите рекомендацию по методу и средству</h2><p>Ниже — интерактивный справочник: найдите поверхность или задачу, отметьте условия дома и получите подходящий учебный пример. Если данных недостаточно, он покажет метод и попросит ручную проверку вместо случайного подбора химии.</p></section>
  <SurfaceSelector/>
  <section className="op-panel care-editorial"><h2><BookOpen size={25}/> Подробное руководство</h2><p>Раскройте нужный этап или найдите правило по слову. Материал основан на руководствах по химической безопасности и предотвращению переноса загрязнений, а также на практике профессионального клининга: план работ, последовательность по зонам, контроль результата и регулярное обучение.</p><label className="field">Найти рекомендацию<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: мрамор, фотоотчёт, животные"/></label>{chapters.map(c=><details key={c.title} className="care-chapter" open={!!query}><summary>{c.title}</summary><ol>{c.items.map(s=><li key={s}>{s}</li>)}</ol></details>)}{query&&!chapters.length&&<p>Ничего не найдено. Попробуйте другое слово.</p>}</section>
  <section className="op-panel"><h2>Примеры средств и инструкции производителей</h2><p>Примеры нужны для обучения и выбора. Они не означают, что средство обязательно есть у исполнителя или подходит конкретному объекту. Наличие, состав и инструкцию следует проверять по актуальной упаковке.</p><div className="care-product-grid">{products.map(p=><details key={p.id}><summary>{p.name}</summary><p>{p.use}</p><p>{p.dose}</p><p className="care-caution">{p.caution}</p><a target="_blank" rel="noreferrer" href={p.url}>Карточка производителя ↗</a></details>)}</div></section>
  <section className="op-panel"><h2>Источники и обновление</h2><p>Материалы сверены 29 октября 2026 года. Руководства и рекомендации помогают сформировать базовый процесс; инструкция конкретного продукта и поверхности остаётся решающей.</p>{handbookSources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a></p>)}</section>
 </div>
}
