import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOrder,timeWindow} from '../lib/marketplace-policy.ts';
import {matchesPreferences} from '../lib/care-policy.ts';
import {statuses,transitions} from '../lib/domain.ts';

const order={id:'order-1',status:'offered',assignedWorkerId:null,crew:[],clientId:'client-1',city:'Москва',cityId:'city-1',region:'Москва',timezone:'Europe/Moscow',date:'2030-01-10',time:'10:00',service:'standard',area:60,dirt:0,frequency:0,extras:{},urgent:false,quote:{total:5400,hours:3,workers:1,needsEstimate:false},payoutCents:351000,quoteAccepted:true,checklist:[],liveConsent:false,payment:'stub',marketplaceVersion:1,address:'улица Тестовая, дом 12, квартира 8',name:'Клиент QA',phone:'+7 999 123-45-67',notes:'Код домофона 1234',accessNote:'Подъезд 2'};

test('до принятия исполнитель видит город, но не адрес и комментарии',()=>{
 const view=projectOrder(order,{id:'worker-1',role:'cleaner'});
 assert.equal(view.city,'Москва');assert.equal(view.address,'Точный адрес после принятия');
 assert.equal(view.notes,'');assert.equal(view.accessNote,'');
 assert.equal(view.name,undefined);assert.equal(view.phone,undefined);
});

test('свободная инструкция с телефоном скрыта до принятия заказа',()=>{
 const withInstruction={...order,preferences:{gender:'any',instructions:'Позвоните +7 999 123-45-67, код 1234'}};
 const offer=projectOrder(withInstruction,{id:'worker-1',role:'cleaner'});
 assert.equal(offer.preferences.instructions,'');
 assert.equal(offer.preferences.gender,'any');
 const assigned={...withInstruction,status:'assigned',assignedWorkerId:'worker-1',crew:['worker-1']};
 assert.equal(projectOrder(assigned,{id:'worker-1',role:'cleaner'}).preferences.instructions,withInstruction.preferences.instructions);
});

test('точный адрес открывается только исполнителю, за которым закреплён заказ',()=>{
 const assigned={...order,status:'assigned',assignedWorkerId:'worker-1',crew:['worker-1']};
 assert.equal(projectOrder(assigned,{id:'worker-1',role:'cleaner'}).address,order.address);
 assert.equal(projectOrder(assigned,{id:'worker-2',role:'cleaner'}).address,'Точный адрес после принятия');
});

test('имя клиента маскируется в заметках, но не портит адрес объекта',()=>{
 const assigned={...order,status:'assigned',assignedWorkerId:'worker-1',crew:['worker-1'],name:'Анна Тестовая',address:'улица Тестовая, дом 12',notes:'Позвонить Анне Тестовой перед приездом'};
 const view=projectOrder(assigned,{id:'worker-1',role:'cleaner'});
 assert.equal(view.address,'улица Тестовая, дом 12');
 assert(!view.notes.includes('Анна Тестовая'));
});

test('просроченный открытый заказ может перейти на повторный подбор',()=>{
 assert.equal(statuses.needs_reschedule,'Нужно выбрать новую дату');
 assert(transitions.needs_reschedule.includes('offered'));
 assert(transitions.needs_reschedule.includes('cancelled'));
});

test('клиент видит возможность замены до начала и выбранный подвид услуги',()=>{
 const assigned={...order,status:'assigned',assignedWorkerId:'worker-1',crew:['worker-1'],startAt:Date.now()+86400000,catalogService:'kitchen'};
 const view=projectOrder(assigned,{id:'client-1',role:'client'});
 assert.equal(view.canRequestReplacement,true);assert.equal(view.catalogService,'kitchen');
 assert.equal(projectOrder({...assigned,status:'completed'},{id:'client-1',role:'client'}).canRequestReplacement,false);
 assert.equal(projectOrder({...assigned,startAt:Date.now()-1},{id:'client-1',role:'client'}).canRequestReplacement,false);
});

test('несуществующая календарная дата возвращает ошибку входных данных',()=>{
 assert.throws(()=>timeWindow('2030-02-31','10:00','+03:00',2),error=>error.status===400);
 assert.equal(timeWindow('2030-02-28','10:00','+03:00',2).end-Date.parse('2030-02-28T07:00:00Z'),7200000);
});

test('предпочтения учитывают числовые флаги из PostgreSQL и D1',()=>{
 assert.equal(matchesPreferences({fragranceFree:true,pets:true,ownProducts:true},{fragrance_free:1,pet_friendly:1,own_products:1}),true);
 assert.equal(matchesPreferences({fragranceFree:true},{fragrance_free:0}),false);
});
