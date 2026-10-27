'use client';
import {useState} from 'react';
import {ArrowUpRight, Check, Droplets, ShieldCheck, Sparkles, TriangleAlert} from 'lucide-react';
import {careProducts, managerConditions, managerSurfaceGuidance, managerSurfaces, managerTaskGuidance, managerTasks} from '../lib/care-guide';

const conditionGuidance: Record<string,string> = {
  allergy: 'Если есть аллергия или чувствительность к запахам, расскажите нам, какие ограничения учесть. Отсутствие запаха само по себе не гарантирует, что средство подойдёт.',
  children: 'Если дома дети, заранее согласуем порядок уборки и возвращения в помещение. Для каждой поверхности соблюдаем инструкцию средства, включая высыхание и смывание.',
  pets: 'Если дома питомцы, учтём миски, лежанки и их доступ к комнатам. Подскажем, когда можно возвращаться к обработанным поверхностям по инструкции средства.',
  asthma: 'При астме или чувствительности дыхательных путей сообщите нам заранее. Учтём необходимость проветривания и не будем использовать распыление, если оно вам не подходит.',
  food: 'Для столешниц и других зон контакта с пищей выбираем средство и способ применения, разрешённые его этикеткой. Смываем остатки, если это требуется.',
  'poor-ventilation': 'Если помещение трудно проветрить, заранее скажите нам. Мы учтём это при выборе способа уборки и инструкции средства.',
  delicate: 'Для нового или деликатного покрытия сначала сверим рекомендации изготовителя и проверим средство на незаметном участке.',
};

export default function EquipmentShowcase() {
  const [surfaceId,setSurfaceId]=useState(managerSurfaces[0].id);
  const [taskId,setTaskId]=useState(managerTasks[0].id);
  const [conditions,setConditions]=useState<string[]>([]);
  const needsManualCheck=conditions.some(id=>['allergy','asthma','poor-ventilation','delicate'].includes(id));
  const surface=managerSurfaces.find(item=>item.id===surfaceId) || managerSurfaces[0];
  const task=managerTasks.find(item=>item.id===taskId) || managerTasks[0];
  const productId=(surface.productByTask as Record<string,string>)[taskId];
  const matchedProduct=careProducts.find(item=>item.id===productId);
  const product=needsManualCheck?undefined:matchedProduct;

  function toggleCondition(id:string) {
    setConditions(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  }

  return <section id="equipment" className="bw-section bw-equipment bw-manager-guide">
    <div className="bw-section-heading bw-manager-heading">
      <div><span className="eyebrow">04 / АКАДЕМИЯ УБОРКИ</span><h2>Как мы обучаем менеджеров<br/><em>выбирать средства для дома</em></h2></div>
      <p>Выберите поверхность, задачу и условия дома. Матрица покажет подходящий учебный пример и объяснит, что проверить перед применением. На объекте менеджер дополнительно сверит материал и инструкцию производителя.</p>
    </div>

    <div className="bw-manager-stats" aria-label="Размер базы рекомендаций">
      <span><b>{managerSurfaces.length*managerTasks.length}</b> сочетаний в матрице</span>
      <span><b>{managerSurfaces.length}</b> типов поверхностей</span>
      <span><b>{managerTasks.length}</b> задач уборки</span>
      <span><b>{careProducts.length}</b> средств в подборке</span>
    </div>

    <div className="bw-manager-choice"><p>Пользуйтесь матрицей сами или доверьте подбор средств нашим специалистам.</p><a href="#quick-book">Подобрать уборку <ArrowUpRight size={16}/></a></div>

    <div className="bw-manager-constructor">
      <div className="bw-manager-constructor-top"><img className="bw-manager-graduate-cat" src="/media/academy-graduate-kitten.webp" alt="Котик-выпускник Академии уборки"/><div><span className="eyebrow">АКАДЕМИЯ УБОРКИ</span><h3>Подбор средств для вашей задачи</h3></div><span className="bw-manager-step-count">01—03</span></div>
      <div className="bw-manager-fields">
        <label><span><i>01</i> Поверхность и материал</span><select value={surfaceId} onChange={e=>setSurfaceId(e.target.value)}>{Array.from(new Set(managerSurfaces.map(item=>item.group))).map(group=><optgroup key={group} label={group}>{managerSurfaces.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
        <label><span><i>02</i> Задача уборки</span><select value={taskId} onChange={e=>setTaskId(e.target.value)}>{managerTasks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <fieldset className="bw-manager-conditions"><legend><i>03</i> Что важно учесть</legend><div>{managerConditions.map(item=><button type="button" key={item.id} aria-pressed={conditions.includes(item.id)} className={conditions.includes(item.id)?'active':''} onClick={()=>toggleCondition(item.id)}>{conditions.includes(item.id)?<Check size={14}/>:<span className="bw-condition-plus">+</span>}{item.label}</button>)}</div></fieldset>
      <div className="bw-manager-matrix-note"><span>МАТРИЦА ПОДБОРА</span><p>Не каждое средство подходит ко всем поверхностям. Если в этой паре совместимость не подтверждена — конструктор не подставляет универсальный состав.</p></div>
    </div>

    <div className={'bw-manager-result '+(product?'has-product':'needs-check')} aria-live="polite">
      {product?<>
        <div className="bw-manager-result-icon"><ShieldCheck size={23}/></div>
        <div className="bw-manager-result-main"><span className="eyebrow">СРЕДСТВО ДЛЯ ПОВЕРХНОСТИ · {surface.name.toLocaleUpperCase('ru-RU')}</span><div className="bw-manager-product"><img src={product.image} alt={`${product.brand} ${product.name} — фото упаковки средства`} loading="lazy" decoding="async"/><div><h3>{product.brand} {product.name}</h3><p className="bw-manager-why"><b>Для задачи:</b> {task.name.toLocaleLowerCase('ru-RU')}. {product.description}</p></div></div><div className="bw-manager-method"><b><Droplets size={16}/> Как использовать</b><p>{product.method}</p></div><div className="bw-manager-caution"><TriangleAlert size={17}/><p><b>Перед уборкой проверьте:</b> {product.caution}</p></div><a href={product.source} target="_blank" rel="noreferrer">Инструкция производителя <ArrowUpRight size={16}/></a></div>
      </>:<>
        <div className="bw-manager-result-icon"><TriangleAlert size={23}/></div>
        <div className="bw-manager-result-main"><span className="eyebrow">ПЛАН УХОДА · {surface.name.toLocaleUpperCase('ru-RU')}</span><h3>{needsManualCheck?'Сначала согласуем ваши ограничения':`Как убрать: ${task.name.toLocaleLowerCase('ru-RU')}`}</h3><p className="bw-manager-why"><b>{surface.name} · {task.name.toLocaleLowerCase('ru-RU')}.</b> {needsManualCheck?'При выбранных ограничениях не подставляем средство автоматически. Уточним чувствительность и сверим состав и способ применения до уборки.':managerTaskGuidance[taskId]}</p><div className="bw-manager-method"><b><ShieldCheck size={16}/> Для этой поверхности</b><p>{managerSurfaceGuidance[surfaceId]}</p></div></div>
      </>}
    </div>

    {conditions.length>0&&<div className="bw-manager-condition-guidance"><span className="eyebrow">УЧИТЫВАЕМ ВАШИ УСЛОВИЯ</span>{conditions.map(id=><p key={id}><Check size={15}/>{conditionGuidance[id]}</p>)}</div>}

    <div className="bw-manager-safety"><ShieldCheck size={24}/><div><b>Сначала материал и инструкция</b><p>Матрица даёт учебные примеры, а не заменяет осмотр. Перед работой специалист сверяет покрытие с инструкцией и паспортом безопасности средства, соблюдает дозировку и нужное время выдержки, не смешивает составы. Если материал или ограничения неизвестны, сначала уточняет их и проверяет средство на незаметном участке.</p></div></div>
  </section>;
}
