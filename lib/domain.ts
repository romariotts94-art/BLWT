import { z } from 'zod';
export const services = {
  standard:{name:'Поддерживающая',description:'Свежесть и порядок на каждый день',rate:90,min:3900,speed:25},
  deep:{name:'Генеральная',description:'Каждый угол, каждая поверхность',rate:190,min:9500,speed:12},
  renovation:{name:'После ремонта',description:'От строительной пыли — к новому дому',rate:230,min:11500,speed:10},
  office:{name:'Уборка офиса',description:'Пространство, в котором приятно работать',rate:55,min:4500,speed:35},
  custom:{name:'Особый объект',description:'Склад, ресторан, фасад — по смете',rate:0,min:0,speed:20},
};
export const extras = {
  "windows": {
    "name": "Створки окон",
    "price": 450,
    "minutes": 25,
    "unit": "створка",
    "description": "Стекло с двух сторон, рама и подоконник"
  },
  "oven": {
    "name": "Духовка",
    "price": 990,
    "minutes": 45,
    "unit": "шт.",
    "description": "Внутренние поверхности и противень"
  },
  "fridge": {
    "name": "Холодильник",
    "price": 890,
    "minutes": 40,
    "unit": "шт.",
    "description": "Полки, ящики и стенки изнутри, без продуктов"
  },
  "sofa": {
    "name": "Диван, 2 места",
    "price": 2900,
    "minutes": 90,
    "unit": "шт.",
    "description": "Экстракционная чистка после пробы ткани"
  },
  "ironing": {
    "name": "Глажка",
    "price": 1200,
    "minutes": 60,
    "unit": "час",
    "description": "Одежда и бельё по рекомендациям на ярлыке"
  },
  "balcony": {
    "name": "Уборка балкона",
    "price": 1200,
    "minutes": 60,
    "unit": "балкон",
    "description": "Полы, пыль и доступные поверхности"
  },
  "balconyGlass": {
    "name": "Остекление балкона",
    "price": 1800,
    "minutes": 80,
    "unit": "балкон",
    "description": "Доступные стёкла, до 6 створок, без высотных работ"
  },
  "hood": {
    "name": "Вытяжка",
    "price": 790,
    "minutes": 40,
    "unit": "шт.",
    "description": "Корпус и съёмный фильтр, без разборки мотора"
  },
  "microwave": {
    "name": "Микроволновая печь",
    "price": 490,
    "minutes": 25,
    "unit": "шт.",
    "description": "Внутри и снаружи, без абразивов"
  },
  "dishwasher": {
    "name": "Посудомоечная машина",
    "price": 690,
    "minutes": 35,
    "unit": "шт.",
    "description": "Дверца, корзины и доступный фильтр"
  },
  "cabinets": {
    "name": "Кухонные шкафы внутри",
    "price": 990,
    "minutes": 50,
    "unit": "м.п.",
    "description": "Пустые полки и ящики внутри шкафов"
  },
  "mattress": {
    "name": "Матрас, одна сторона",
    "price": 1900,
    "minutes": 60,
    "unit": "шт.",
    "description": "Химчистка с учётом состава и состояния"
  },
  "chair": {
    "name": "Мягкий стул",
    "price": 590,
    "minutes": 25,
    "unit": "шт.",
    "description": "Сиденье и спинка, проба средства на ткани"
  },
  "carpet": {
    "name": "Ковровое покрытие",
    "price": 350,
    "minutes": 15,
    "unit": "м²",
    "description": "Экстракционная чистка подходящих покрытий"
  },
  "blinds": {
    "name": "Жалюзи",
    "price": 450,
    "minutes": 25,
    "unit": "м²",
    "description": "Доступные ламели без демонтажа"
  },
  "radiators": {
    "name": "Радиаторы",
    "price": 390,
    "minutes": 20,
    "unit": "шт.",
    "description": "Удаление пыли в доступных участках"
  },
  "linen": {
    "name": "Смена постельного белья",
    "price": 350,
    "minutes": 15,
    "unit": "комплект",
    "description": "Свежее бельё предоставляет клиент"
  },
  "petHair": {
    "name": "Уборка шерсти",
    "price": 790,
    "minutes": 40,
    "unit": "комната",
    "description": "Дополнительная обработка пола и обивки"
  },
  "doors": {
    "name": "Межкомнатные двери",
    "price": 290,
    "minutes": 15,
    "unit": "шт.",
    "description": "Полотно, ручки и коробка двери"
  },
  "wardrobe": {
    "name": "Шкаф внутри",
    "price": 790,
    "minutes": 40,
    "unit": "шт.",
    "description": "Пустой шкаф до 3 секций, без разбора вещей"
  }
};
export const extraGroups:Record<string,string>={"windows": "Окна и балкон", "oven": "Кухня", "fridge": "Кухня", "sofa": "Текстиль", "ironing": "Дом", "balcony": "Окна и балкон", "balconyGlass": "Окна и балкон", "hood": "Кухня", "microwave": "Кухня", "dishwasher": "Кухня", "cabinets": "Кухня", "mattress": "Текстиль", "chair": "Текстиль", "carpet": "Текстиль", "blinds": "Окна и балкон", "radiators": "Дом", "linen": "Дом", "petHair": "Дом", "doors": "Дом", "wardrobe": "Дом"};
export const defaultRates={version:'2026-10-18',services,extras,dirt:[1,1.25,1.5],frequency:[1,0.9,0.85],urgent:1.2,hourlyPay:550,transport:500,suppliesPercent:6,overheadPercent:8,taxReservePercent:6,videoPerPerson:80};
export function normalizeRates(saved:any={}){
 const merged:any={...defaultRates,...saved,services:{},extras:{}};
 for(const [k,v] of Object.entries(services))merged.services[k]={...v,...saved?.services?.[k]};
 for(const [k,v] of Object.entries(extras))merged.extras[k]={...v,...saved?.extras?.[k]};
 return merged;
}
export const reviewSchema=z.object({rating:z.number().int().min(1).max(5),name:z.string().trim().min(2).max(40),text:z.string().trim().min(20).max(1500),publishConsent:z.boolean()});
export function publicReviews(records:any[]){return records.filter(o=>o.status==='completed'&&o.review?.publishConsent===true).map(o=>({name:o.review.name,rating:o.review.rating,text:o.review.text,service:o.service,date:o.review.created}));}

export const statuses:Record<string,string>={requested:'Новая заявка',offered:'Подбор команды',assigned:'Подтверждён',en_route:'Команда в пути',in_progress:'Уборка идёт',review:'Приёмка',completed:'Завершён',cancelled:'Отменён'};
export const steps=['requested','offered','assigned','en_route','in_progress','review','completed'];
export const transitions:Record<string,string[]>={requested:['offered','cancelled'],offered:['offered','assigned','cancelled'],assigned:['en_route','cancelled'],en_route:['in_progress','cancelled'],in_progress:['review'],review:['completed','in_progress'],completed:[],cancelled:[]};
export const quoteSchema=z.object({service:z.enum(['standard','deep','renovation','office','custom']),area:z.number().min(15).max(10000),dirt:z.number().int().min(0).max(2),frequency:z.number().int().min(0).max(2),urgent:z.boolean(),extras:z.record(z.number().int().min(0).max(30)).refine(v=>Object.keys(v).every(k=>k in extras),'Неизвестная дополнительная услуга'),workers:z.number().int().min(0).max(12)});
export type QuoteInput=z.infer<typeof quoteSchema>;
export function calculate(input:QuoteInput,rates:any=defaultRates){
 rates=normalizeRates(rates);
 const p=quoteSchema.parse(input),s=rates.services[p.service];
 const base=Math.max(s.min,p.area*s.rate);const multiplier=rates.dirt[p.dirt]*rates.frequency[p.frequency]*(p.urgent?rates.urgent:1);
 const additions=Object.entries(p.extras).reduce((n,[key,qty])=>n+rates.extras[key].price*qty,0);
 const personHours=Math.ceil((p.area/s.speed*rates.dirt[p.dirt]+Object.entries(p.extras).reduce((n,[key,q])=>n+rates.extras[key].minutes*q/60,0))*2)/2;
 const workers=p.workers||Math.max(1,Math.min(12,Math.ceil(personHours/4))); const hours=Math.max(1,Math.ceil(personHours/workers*2)/2);
 const total=p.service==='custom'?0:Math.ceil((base*multiplier+additions)/100)*100;
 const payroll=Math.round(personHours*rates.hourlyPay),transport=workers*rates.transport,video=workers*rates.videoPerPerson;
 const supplies=Math.round(total*rates.suppliesPercent/100),overhead=Math.round(total*rates.overheadPercent/100),taxReserve=Math.round(total*rates.taxReservePercent/100);
 const cost=payroll+transport+video+supplies+overhead+taxReserve;
 return {base,multiplier,additions,total,personHours,workers,hours,payroll,transport,video,supplies,overhead,taxReserve,cost,contribution:total-cost,margin:total?Math.round((total-cost)/total*100):0,needsEstimate:p.service==='custom',version:rates.version};
}
export const bookingSchema=quoteSchema.extend({name:z.string().trim().min(2).max(100),phone:z.string().regex(/^\+?[\d\s()\-]{10,22}$/,'Укажите корректный телефон'),address:z.string().trim().min(8).max(400),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^(0[8-9]|1\d|20):[03]0$/),notes:z.string().max(2000),liveConsent:z.boolean(),terms:z.literal(true)});
export const checklist=['Полы и плинтусы','Пыль и поверхности','Кухня и рабочие зоны','Санузлы и сантехника','Зеркала и стекло','Мусор и финальная проверка'];
export const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export function publicQuote(q:any){const {payroll,transport,video,supplies,overhead,taxReserve,cost,contribution,margin,...rest}=q;return rest;}
export function overlaps(a:any,b:any){const start=(o:any)=>new Date(`${o.date}T${o.time}:00+03:00`).getTime();return start(a)<start(b)+(b.quote.hours+1)*3600000&&start(b)<start(a)+(a.quote.hours+1)*3600000;}
