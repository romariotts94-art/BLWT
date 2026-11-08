'use client';
import {useState} from 'react';
import {ArrowUpRight, Check, Droplets, ShieldCheck, GraduationCap, ScanLine, TriangleAlert} from 'lucide-react';
import {careProducts, managerConditions, managerSurfaceGuidance, managerSurfaces, managerTaskGuidance, managerTasks} from '../lib/care-guide';
import PencilVignette from './PencilVignette';

const conditionGuidance: Record<string,string> = {
  allergy: 'Если есть аллергия или чувствительность к запахам, расскажите нам, какие ограничения учесть. Отсутствие запаха само по себе не гарантирует, что средство подойдёт.',
  children: 'Если дома дети, заранее согласуем порядок уборки и возвращения в помещение. Для каждой поверхности соблюдаем инструкцию средства, включая высыхание и смывание.',
  pets: 'Если дома питомцы, учтём миски, лежанки и их доступ к комнатам. Подскажем, когда можно возвращаться к обработанным поверхностям по инструкции средства.',
  asthma: 'При астме или чувствительности дыхательных путей сообщите нам заранее. Учтём необходимость проветривания и не будем использовать распыление, если оно вам не подходит.',
  food: 'Для столешниц и других зон контакта с пищей выбираем средство и способ применения, разрешённые его этикеткой. Смываем остатки, если это требуется.',
  'poor-ventilation': 'Если помещение трудно проветрить, заранее скажите нам. Мы учтём это при выборе способа уборки и инструкции средства.',
  delicate: 'Для нового или деликатного покрытия сначала сверим рекомендации изготовителя и проверим средство на незаметном участке.',
};

export default function EquipmentShowcase({sectionNumber='03'}:{sectionNumber?:string}) {
  const [surfaceId,setSurfaceId]=useState(managerSurfaces[0].id);
  const [taskId,setTaskId]=useState(managerTasks[0].id);
  const [conditions,setConditions]=useState<string[]>([]);
  const needsManualCheck=conditions.some(id=>['allergy','asthma','poor-ventilation','delicate'].includes(id));
  const surface=managerSurfaces.find(item=>item.id===surfaceId) || managerSurfaces[0];
  const task=managerTasks.find(item=>item.id===taskId) || managerTasks[0];
  const productId=(surface.productByTask as Record<string,string>)[taskId];
  const matchedProduct=careProducts.find(item=>item.id===productId);
  const product=matchedProduct;

  function toggleCondition(id:string) {
    setConditions(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  }

  return <section id="equipment" className="bw-section bw-equipment bw-manager-guide">
    <div className="bw-section-heading bw-manager-heading">
      <div><div className="bw-heading-copy"><span className="eyebrow">{sectionNumber} / АКАДЕМИЯ УБОРКИ</span><h2>Чистота начинается<br/><em>со знаний</em></h2></div><PencilVignette kind="academy"/></div>
    </div>
    <div className="bw-academy-story">
      <article><span className="bw-story-icon"><GraduationCap size={25}/></span><span className="eyebrow">01 / ЗНАНИЯ</span><h3>Знания для<br/>бережной уборки</h3><p>Исполнителям доступны интерактивные задания, инструкции по уходу и проверка знаний. Допуск к заказам зависит от проверки профиля и статуса НПД без статуса ИП.</p></article>
      <article><span className="bw-story-icon"><ScanLine size={25}/></span><span className="eyebrow">02 / ТОЧНОСТЬ</span><h3>Каждой поверхности —<br/>свой подход</h3><p>Материал, задача, условия дома. Исполнитель использует матрицу, чтобы подобрать средство и способ ухода.</p></article>
      <article><span className="bw-story-icon"><ShieldCheck size={25}/></span><span className="eyebrow">03 / БЕРЕЖНОСТЬ</span><h3>Качество —<br/>в деталях</h3><p>Средства с инструкциями производителей, точная дозировка и проверка покрытия перед применением.</p></article>
    </div>

    <div className="bw-manager-choice"><p>Исполнители сервиса используют эту матрицу для точного подбора ухода за вашим домом. Посмотрите, как это работает.</p><a href="#quick-book">Подобрать уборку <ArrowUpRight size={16}/></a></div>

    <div className="bw-manager-constructor">
      <div className="bw-manager-constructor-top"><img className="bw-manager-graduate-cat" src="/media/academy-graduate-kitten.webp" alt="Котик-выпускник Академии уборки"/><div><span className="eyebrow">ИНТЕРАКТИВНЫЙ ПОДБОР</span><h3>Ваш материал — подходящее средство</h3><p>Независимый исполнитель подбирает уход по правилам платформы: с учётом покрытия, задачи и инструкции средства.</p></div><span className="bw-manager-step-count">01—03</span></div>
      <div className="bw-manager-fields">
        <label><span><i>01</i> Поверхность и материал</span><select value={surfaceId} onChange={e=>setSurfaceId(e.target.value)}>{Array.from(new Set(managerSurfaces.map(item=>item.group))).map(group=><optgroup key={group} label={group}>{managerSurfaces.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
        <label><span><i>02</i> Задача уборки</span><select value={taskId} onChange={e=>setTaskId(e.target.value)}>{managerTasks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <fieldset className="bw-manager-conditions"><legend><i>03</i> Что важно учесть</legend><div>{managerConditions.map(item=><button type="button" key={item.id} aria-pressed={conditions.includes(item.id)} className={conditions.includes(item.id)?'active':''} onClick={()=>toggleCondition(item.id)}>{conditions.includes(item.id)?<Check size={14}/>:<span className="bw-condition-plus">+</span>}{item.label}</button>)}</div></fieldset>
    </div>

    <div className={'bw-manager-result '+(product?'has-product':'needs-check')} aria-live="polite">
      {product?<>
        <div className="bw-product-stage"><span className="bw-manager-result-icon" title="Инструкция производителя"><ShieldCheck size={26}/></span><img src={product.image} alt={`${product.brand} ${product.name} — упаковка средства`} loading="lazy" decoding="async"/><span className="bw-product-fact">{product.fact}<small>{product.factLabel}</small></span></div>
        <div className="bw-manager-result-main"><span className="eyebrow">{needsManualCheck?'ПРИМЕР · НУЖНА ПРОВЕРКА ОГРАНИЧЕНИЙ':'ПОДБОР ПО МАТЕРИАЛУ'} · {surface.name.toLocaleUpperCase('ru-RU')}</span><span className="bw-product-brand">{product.brand}</span><h3>{product.name}</h3><p className="bw-manager-why"><b>{task.name}.</b> {product.description}</p>{needsManualCheck&&<p className="bw-personal-check">Перед выбором этого средства исполнитель проверит состав и способ применения с учётом отмеченных вами ограничений.</p>}<div className="bw-manager-method"><b><Droplets size={16}/> Способ применения</b><p>{product.method}</p></div><div className="bw-manager-caution"><TriangleAlert size={17}/><p><b>Для сохранности покрытия:</b> {product.caution}</p></div><a href={product.source} target="_blank" rel="noreferrer">Инструкция производителя <ArrowUpRight size={16}/></a></div>
      </>:<>
        <div className="bw-product-stage bw-care-plan-art"><span className="bw-manager-result-icon"><ScanLine size={26}/></span><img src="/academy-care.svg" alt="Бережный уход за поверхностью" loading="lazy"/><span className="bw-product-fact">Индивидуальный уход<small>Сначала материал, затем состав</small></span></div>
        <div className="bw-manager-result-main"><span className="eyebrow">ПЛАН УХОДА · {surface.name.toLocaleUpperCase('ru-RU')}</span><h3>Бережное решение<br/>для вашей задачи</h3><p className="bw-manager-why"><b>{task.name}.</b> {managerTaskGuidance[taskId]}</p><div className="bw-manager-method"><b><ShieldCheck size={16}/> {surface.name}</b><p>{managerSurfaceGuidance[surfaceId]}</p></div><div className="bw-manager-caution"><TriangleAlert size={17}/><p>Для этой пары нет подтверждённого средства в подборке. Исполнитель уточнит покрытие и согласует совместимый состав до начала работы.</p></div></div>
      </>}
    </div>

    {conditions.length>0&&<div className="bw-manager-condition-guidance"><span className="eyebrow">УЧИТЫВАЕМ ВАШИ УСЛОВИЯ</span>{conditions.map(id=><p key={id}><Check size={15}/>{conditionGuidance[id]}</p>)}</div>}

  </section>;
}
