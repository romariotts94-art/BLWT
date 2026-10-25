import React from 'react';
import {CheckCircle2,Leaf} from 'lucide-react';
import {cleaningDetails} from '../lib/cleaning-catalog';

export default function CleaningScope({id}:{id:string}) {
 const details=cleaningDetails(id);
 return <section className="bw-order-scope" aria-label="Состав выбранной уборки">
  <h3>Что и как уберёт команда</h3><p>{details.description}</p>
  <ul>{details.checks.map(text=><li key={text}><CheckCircle2 size={17}/><span>{text}</span></li>)}</ul>
  <div className="bw-order-materials"><Leaf size={18}/><div><strong>Средства и инвентарь</strong><p>{details.materials}</p></div></div>
  <small>До выезда менеджер уточнит поверхности, ограничения и состав работ. Конкретные средства и окончательную стоимость согласуем с вами.</small>
 </section>;
}
