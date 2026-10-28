import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOrder} from '../lib/marketplace-policy.ts';
import {statuses,transitions} from '../lib/domain.ts';

const order={id:'order-1',status:'offered',assignedWorkerId:null,crew:[],clientId:'client-1',city:'Москва',cityId:'city-1',region:'Москва',timezone:'Europe/Moscow',date:'2030-01-10',time:'10:00',service:'standard',area:60,dirt:0,frequency:0,extras:{},urgent:false,quote:{total:5400,hours:3,workers:1,needsEstimate:false},payoutCents:405000,quoteAccepted:true,checklist:[],liveConsent:false,payment:'stub',marketplaceVersion:1,address:'улица Тестовая, дом 12, квартира 8',name:'Клиент QA',phone:'+7 999 123-45-67',notes:'Код домофона 1234',accessNote:'Подъезд 2'};

test('до принятия исполнитель видит город, но не адрес и комментарии',()=>{
 const view=projectOrder(order,{id:'worker-1',role:'cleaner'});
 assert.equal(view.address,'Москва · точный адрес после принятия');
 assert.equal(view.notes,'');assert.equal(view.accessNote,'');
 assert.equal(view.name,undefined);assert.equal(view.phone,undefined);
});

test('точный адрес открывается только исполнителю, за которым закреплён заказ',()=>{
 const assigned={...order,status:'assigned',assignedWorkerId:'worker-1',crew:['worker-1']};
 assert.equal(projectOrder(assigned,{id:'worker-1',role:'cleaner'}).address,order.address);
 assert.equal(projectOrder(assigned,{id:'worker-2',role:'cleaner'}).address,'Москва · точный адрес после принятия');
});

test('просроченный открытый заказ может перейти на повторный подбор',()=>{
 assert.equal(statuses.needs_reschedule,'Нужно выбрать новую дату');
 assert(transitions.needs_reschedule.includes('offered'));
 assert(transitions.needs_reschedule.includes('cancelled'));
});
