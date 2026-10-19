import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaultRates,normalizeRates,reviewSchema,publicReviews} from '../lib/domain.ts';
const input={service:'standard',area:60,dirt:0,frequency:0,urgent:false,extras:{},workers:0};
test('Старые сохранённые тарифы поддерживают новые услуги, сохраняя настроенные цены',()=>{
 const saved={...defaultRates,extras:{oven:{price:1500,minutes:50}}};
 const r=normalizeRates(saved);assert.equal(r.extras.oven.price,1500);assert.equal(r.extras.oven.unit,'шт.');
 const q=calculate({...input,extras:{hood:2,oven:1}},saved);assert.equal(q.additions,3080);assert.equal(q.total,8500);
});
test('Все новые услуги участвуют в расчёте времени и цены',()=>{
 for(const k of Object.keys(defaultRates.extras)){
  const q=calculate({...input,extras:{[k]:1}});assert.ok(q.total>calculate(input).total);assert.ok(q.personHours>calculate(input).personHours);
 }
});
test('Публикуются только отзывы завершённых заказов с явным согласием',()=>{
 const review={name:'Анна',rating:4,text:'Уборка выполнена, пожелания учтены.',publishConsent:true,created:'2026-10-19'};
 const rows=publicReviews([{status:'completed',service:'deep',review,phone:'SECRET',address:'SECRET',clientId:'SECRET'},{status:'in_progress',review},{status:'completed',review:{...review,publishConsent:false}}]);
 assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['date','name','rating','service','text']);assert.ok(!JSON.stringify(rows).includes('SECRET'));
});
test('Отзыв требует валидной оценки, текста и явного решения о публикации',()=>{
 assert.equal(reviewSchema.safeParse({rating:6,name:'Анна',text:'Хорошо',publishConsent:true}).success,false);
 assert.equal(reviewSchema.safeParse({rating:5,name:'Анна',text:'Все задачи выполнены в согласованное время.'}).success,false);
});
