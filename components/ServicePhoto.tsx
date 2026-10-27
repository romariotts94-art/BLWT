import type {ServicePhotos} from '../lib/cleaning-visuals';

/** Clip a paired photo in SVG so both scenes keep their original proportions. */
export default function ServicePhoto({photos,phase,className='',hidden=false}:{photos:ServicePhotos;phase:'before'|'after';className?:string;hidden?:boolean}){
 const label=`${photos.room} ${phase==='before'?'до':'после'} уборки`;
 const classes=`bw-service-photo ${className}`;
 if(!photos.atlas)return <img className={classes} src={photos[phase]} alt={hidden?'':label} aria-hidden={hidden}/>;
 const {width,height}=photos.atlas;
 return <svg className={classes} viewBox={`0 ${phase==='before'?0:height/2} ${width} ${height/2}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={hidden?undefined:label} aria-hidden={hidden} focusable="false">
  <image href={photos[phase]} width={width} height={height}/>
 </svg>;
}
