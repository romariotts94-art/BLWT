'use client';

import React, {useId} from 'react';
import '../app/workflow-infographics.css';

export type WorkflowInfographicProps = {step: number; compact?: boolean};
const descriptions = [
  'План дома: комнаты, материалы поверхностей и ваши пожелания к уборке.',
  'Согласование: удобная дата, задачи и предварительная смета в одном месте.',
  'Приватный эфир: вид с камеры, доступ по заказу и сообщения исполнителю.',
  'Приёмка результата: чек-лист, фотографии и возможность отметить замечания.',
];

function Tick({x,y,size=14}:{x:number;y:number;size?:number}) {
  return <path d={`M${x-size*.3} ${y}l${size*.2} ${size*.2} ${size*.43} ${-size*.43}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>;
}
function Spark({x,y,small=false}:{x:number;y:number;small?:boolean}) {
  const r=small?4:7;
  return <path d={`M${x-r} ${y}h${r*2}M${x} ${y-r}v${r*2}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>;
}
function Plant({x,y,scale=1}:{x:number;y:number;scale?:number}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 0v-24" stroke="#6c8a67" strokeWidth="2"/><path d="M0-13C-17-14-17-28-13-29C-2-28 1-20 0-13Z" fill="#b9cda3"/><path d="M1-20C0-33 13-37 16-31C17-23 8-20 1-20Z" fill="#87a47d"/><path d="M-10-2h21l-3 17H-7Z" fill="#dfc5ad"/><path d="M-9 1h19" stroke="#c3a487" strokeWidth="1.5"/></g>;
}

export default function WorkflowInfographic({step,compact=false}:WorkflowInfographicProps) {
  const index=Number.isInteger(step)&&step>=0&&step<4?step:0;
  const filterId='bw-workflow-shadow-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const label=descriptions[index];
  return <div className={'bw-workflow-graphic bw-workflow-graphic--'+index+(compact?' bw-workflow-graphic--compact':'')} aria-hidden={compact||undefined}>
    <svg viewBox="0 0 400 260" role={compact?undefined:'img'} aria-label={compact?undefined:label} focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id={filterId} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#3d583a" floodOpacity=".09"/></filter></defs>
      <ellipse cx="200" cy="226" rx="135" ry="11" fill="#dce5d1" opacity=".55"/>
      <circle cx="202" cy="129" r="100" fill="var(--wf-halo)"/>
      <circle cx="200" cy="129" r="119" fill="none" stroke="#d1ddc5" strokeDasharray="2 8" strokeLinecap="round"/>
      <g className="wf-accents"><Spark x={58} y={43}/><Spark x={342} y={205}/><Spark x={343} y={56} small/><circle cx="53" cy="185" r="3" fill="currentColor" opacity=".55"/></g>
      {index===0&&<>
        <g filter={`url(#${filterId})`}><rect x="82" y="35" width="239" height="180" rx="15" fill="#fffef9" stroke="#cdd8c1"/>
          <path d="M96 61h209" stroke="#e0e7d7"/>
          <circle cx="98" cy="49" r="3" fill="#b8cba3"/><circle cx="110" cy="49" r="3" fill="#e3c5ad"/><circle cx="122" cy="49" r="3" fill="#c6c4db"/>
          {!compact&&<text x="154" y="53" className="wf-small">ВАШ ДОМ</text>}
          <rect x="97" y="75" width="103" height="122" rx="5" fill="#e8efdb"/><rect x="208" y="75" width="98" height="57" rx="5" fill="#f3e5d8"/><rect x="208" y="140" width="98" height="57" rx="5" fill="#e8e8f2"/>
          <path d="M200 75v49m0 27v46m8-65h35m26 0h37" stroke="#789070" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M201 151a25 25 0 0 0 25-25h-25M243 132v-25a25 25 0 0 1 25 25" stroke="#9eb38e" strokeWidth="1.4" fill="none"/>
          <rect x="112" y="111" width="28" height="57" rx="5" fill="#c4d4b5" stroke="#8ca27b"/>
          <path d="M112 139h28m-20-28v57" stroke="#93aa81"/>
          <rect x="156" y="121" width="28" height="38" rx="13" fill="#fffef7" stroke="#c3d0b6"/>
          <rect x="226" y="85" width="61" height="16" rx="4" fill="#fff9ef" stroke="#c4ac92"/><circle cx="274" cy="93" r="4" fill="#ded0bd"/>
          <rect x="228" y="152" width="54" height="31" rx="5" fill="#fff" stroke="#bbb7d0"/><path d="M240 152v31" stroke="#c9c5da"/><rect x="231" y="155" width="6" height="10" rx="2" fill="#d9d5e6"/><rect x="231" y="170" width="6" height="9" rx="2" fill="#d9d5e6"/>
          <path d="M146 75h33m127 81v25" stroke="#afd2cf" strokeWidth="4" strokeLinecap="round"/>
        </g>
        <g filter={`url(#${filterId})`}><rect x="27" y="153" width={compact?77:119} height="48" rx="11" fill="#fff" stroke="#d8e2ce"/><circle cx="48" cy="177" r="10" fill="#e6efdc"/><path d="M43 178v-5l5-4 5 4v5m-7 0v-4h4v4" stroke="#6c8a56" fill="none" strokeWidth="1.4" strokeLinejoin="round"/>{!compact&&<text x="66" y="181" className="wf-label">Особенности</text>}{compact&&<path d="M65 173h22m-22 8h14" stroke="#bdcdb0" strokeWidth="3" strokeLinecap="round"/>}</g>
        <Plant x={321} y={203} scale={.9}/>
      </>}
      {index===1&&<>
        <g filter={`url(#${filterId})`}><rect x="63" y="43" width="200" height="173" rx="15" fill="#fffef9" stroke="#cdd8c1"/><path d="M63 82h200" stroke="#d9e3cf"/><path d="M98 35v17m130-17v17" stroke="#78916b" strokeWidth="5" strokeLinecap="round"/>
          {!compact?<text x="111" y="68" className="wf-heading">Удобная дата</text>:<path d="M119 64h53" stroke="#99ae84" strokeWidth="4" strokeLinecap="round"/>}
          {Array.from({length:21},(_,i)=>{const x=88+(i%7)*24,y=105+Math.floor(i/7)*34;return <g key={i}>{i===10?<><circle cx={x} cy={y} r="12" fill="#a8c382"/><g color="#fff"><Tick x={x} y={y} size={14}/></g></>:<circle cx={x} cy={y} r="3" fill={i<3?'#dce5d1':'#aabf98'}/>}</g>})}
          {!compact&&<text x="84" y="198" className="wf-small">ВРЕМЯ ОБСУДИМ ВМЕСТЕ</text>}
        </g>
        <g filter={`url(#${filterId})`}><rect x="233" y="97" width="123" height="114" rx="13" fill="#fff" stroke="#d7dfcd"/>
          {!compact?<text x="250" y="120" className="wf-heading">Детали уборки</text>:<path d="M251 116h62" stroke="#8ea67d" strokeWidth="4" strokeLinecap="round"/>}
          {[145,172].map((y,i)=><g key={y}><circle cx="252" cy={y} r="8" fill={i?'#f4e6d7':'#e9efdc'}/><g color="#799660"><Tick x={252} y={y} size={10}/></g><path d={`M269 ${y-2}h58m-58 6h35`} stroke="#becdb3" strokeWidth="3" strokeLinecap="round"/></g>)}
          <path d="M250 192h87" stroke="#e5eadf"/>
        </g>
        <g transform="translate(55 116)"><circle r="17" fill="#efd9c3"/><path d="M-6 0l4 4 9-9" fill="none" stroke="#a07752" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></g>
      </>}
      {index===2&&<>
        <g filter={`url(#${filterId})`}><rect x="121" y="21" width="153" height="216" rx="23" fill="#fefef9" stroke="#9aaf89" strokeWidth="2"/><rect x="170" y="31" width="55" height="4" rx="2" fill="#c1cfb6"/>
          <rect x="131" y="45" width="133" height="139" rx="10" fill="#edf1e5"/>
          <path d="M132 153h131v20a10 10 0 0 1-10 10H142a10 10 0 0 1-10-10Z" fill="#ddcbb5"/>
          <rect x="145" y="61" width="47" height="57" rx="3" fill="#fffdf2" stroke="#c2d2b8"/><path d="M168 61v57m-23-29h47" stroke="#c4d6c3" strokeWidth="2"/>
          <path d="M182 150v-15a7 7 0 0 1 7-7h47a7 7 0 0 1 7 7v15" fill="#c3d4b2" stroke="#91aa7d"/><rect x="178" y="144" width="68" height="17" rx="5" fill="#b6cba0" stroke="#91aa7d"/><path d="M186 161v8m52-8v8" stroke="#8a9f79" strokeWidth="2"/>
          <Plant x={218} y={112} scale={.55}/>
          <rect x="142" y="193" width="111" height="25" rx="8" fill="#e4ecd7"/><path d="M150 201h12v8h-12Zm12 2 5-3v10l-5-3" stroke="#6d8659" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
          {!compact?<text x="176" y="209" className="wf-small">ДЕМО ЭФИРА</text>:<path d="M178 205h59" stroke="#aec29a" strokeWidth="3" strokeLinecap="round"/>}
        </g>
        <g filter={`url(#${filterId})`}><rect x="35" y="65" width={compact?99:121} height="51" rx="12" fill="#fff" stroke="#d4dfc9"/><rect x="49" y="87" width="13" height="12" rx="3" fill="#dfe9d2" stroke="#7f996c"/><path d="M52 87v-4a4 4 0 0 1 8 0v4" fill="none" stroke="#7f996c" strokeWidth="1.4"/>{!compact?<><text x="73" y="86" className="wf-label">Доступ</text><text x="73" y="101" className="wf-small">ПО ЗАКАЗУ</text></>:<path d="M73 86h43m-43 9h30" stroke="#bacdaf" strokeWidth="3" strokeLinecap="round"/>}</g>
        <g filter={`url(#${filterId})`}><path d="M258 145h80a12 12 0 0 1 12 12v29a12 12 0 0 1-12 12h-62l-15 12v-12h-3a12 12 0 0 1-12-12v-29a12 12 0 0 1 12-12Z" fill="#f3e4d4" stroke="#d9bda1"/>{!compact?<text x="261" y="167" className="wf-label">Пожелания</text>:<path d="M260 164h69" stroke="#b79b7d" strokeWidth="3" strokeLinecap="round"/>}<path d="M261 180h49" stroke="#c6ad93" strokeWidth="3" strokeLinecap="round"/></g>
      </>}
      {index===3&&<>
        <g filter={`url(#${filterId})`}><rect x="113" y="37" width="173" height="190" rx="15" fill="#fffef9" stroke="#cdd8c1"/><rect x="159" y="28" width="81" height="22" rx="7" fill="#c7d7b7" stroke="#9db68b"/><path d="M181 38h37" stroke="#8fa77d" strokeWidth="3" strokeLinecap="round"/>
          {!compact?<text x="141" y="77" className="wf-heading">Проверим вместе</text>:<path d="M143 74h112" stroke="#8ca67a" strokeWidth="4" strokeLinecap="round"/>}
          {[103,137,171].map((y,i)=><g key={y}><rect x="136" y={y-9} width="18" height="18" rx="5" fill={i===2?'#fff':'#e8efdb'} stroke={i===2?'#c1cdb5':'#b5cba1'}/>{i!==2&&<g color="#73945b"><Tick x={145} y={y} size={13}/></g>}<path d={`M166 ${y-3}h89m-89 8h${i===1?65:49}`} stroke="#bdcdb2" strokeWidth="3" strokeLinecap="round"/></g>)}
          <path d="M136 201h128" stroke="#e0e8d7"/>
        </g>
        <g filter={`url(#${filterId})`} transform="rotate(-9 79 159)"><rect x="27" y="119" width="100" height="90" rx="9" fill="#fff" stroke="#d3deca"/><rect x="35" y="128" width="84" height="54" rx="5" fill="#e9efdf"/><path d="M35 167h84v10a5 5 0 0 1-5 5H40a5 5 0 0 1-5-5Z" fill="#ddc8af"/><rect x="48" y="139" width="23" height="26" rx="2" fill="#fffaf0" stroke="#bcd0b4"/><path d="M60 139v26" stroke="#cbdcbe"/><rect x="80" y="157" width="25" height="12" rx="4" fill="#abc494"/><circle cx="47" cy="196" r="3" fill="#a0b98a"/><path d="M57 196h48" stroke="#c9d6bc" strokeWidth="3" strokeLinecap="round"/></g>
        <g filter={`url(#${filterId})`}><circle cx="294" cy="100" r="25" fill="#e3edcc" stroke="#bed19b"/><path d="M294 83l12 5v11c0 8-12 15-12 15s-12-7-12-15V88Z" fill="#fbfdf3" stroke="#8fae6d" strokeWidth="1.6"/><g color="#749951"><Tick x={294} y={98} size={17}/></g></g>
      </>}
    </svg>
    {!compact&&<span className="bw-workflow-graphic-caption">{['Комнаты · материалы · пожелания','Дата · задачи · предварительная смета','Камера · приватность · связь','Чек-лист · фото · замечания'][index]}</span>}
  </div>;
}
