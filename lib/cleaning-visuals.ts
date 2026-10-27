export type ServicePhotos = {
 before:string;
 after:string;
 room:string;
 /** Two equally sized photos stacked vertically: before above after. */
 atlas?:{width:number;height:number};
};

export const servicePhotos:Record<string,ServicePhotos>={
 standard:{before:'/media/living-room-bright-before.png',after:'/media/living-room-bright-after.png',room:'Гостиная'},
 recurring:{before:'/media/recurring-kitchen-before.png',after:'/media/recurring-kitchen-after.png',room:'Кухня-столовая'},
 'one-time':{before:'/media/one-time-entryway-before.png',after:'/media/one-time-entryway-after.png',room:'Прихожая'},
 deep:{before:'/media/deep-bathroom-before.png',after:'/media/deep-bathroom-after.png',room:'Ванная комната'},
 spring:{before:'/media/seasonal-balcony-before.png',after:'/media/seasonal-balcony-after.png',room:'Балкон — зона отдыха'},
 'move-in':{before:'/media/move-in-bedroom-before.png',after:'/media/move-in-bedroom-after.png',room:'Спальня после переезда'},
 'move-out':{before:'/media/move-out-furnished-before.png',after:'/media/move-out-furnished-after-v2.png',room:'Квартира перед выездом'},
 renovation:{before:'/media/renovation-living-room-before.png',after:'/media/renovation-living-room-after.png',room:'Гостиная после ремонта'},
 rental:{before:'/media/rental-bedroom-before.png',after:'/media/rental-bedroom-after.png',room:'Квартира для посуточной аренды'},
 event:{before:'/media/event-living-room-before.png',after:'/media/event-living-room-after.png',room:'Гостиная после мероприятия'},
 urgent:{before:'/media/urgent-living-room-hourglass-before.png',after:'/media/urgent-living-room-hourglass-after.png',room:'Гостиная перед приходом гостей'},
 'office':{before:'/media/catalog-office-scene-v2.png',after:'/media/catalog-office-scene-v2.png',room:'Офис',atlas:{width:1024,height:1536}},
 'commercial':{before:'/media/catalog-commercial-scene-v2.png',after:'/media/catalog-commercial-scene-v2.png',room:'Кофейня',atlas:{width:1024,height:1536}},
 'garage':{before:'/media/catalog-garage-scene-v2.png',after:'/media/catalog-garage-scene-v2.png',room:'Гараж-мастерская',atlas:{width:1024,height:1536}},
 'carpet':{before:'/media/catalog-carpet-scene-v2.png',after:'/media/catalog-carpet-scene-v2.png',room:'Гостиная с ковром',atlas:{width:1024,height:1536}},
 'windows':{before:'/media/catalog-windows-scene-v2.png',after:'/media/catalog-windows-scene-v2.png',room:'Панорамные окна',atlas:{width:1024,height:1536}},
 'upholstery':{before:'/media/catalog-upholstery-scene-v2.png',after:'/media/catalog-upholstery-scene-v2.png',room:'Мягкая мебель',atlas:{width:1024,height:1536}},
 'car':{before:'/media/catalog-car-scene-v2.png',after:'/media/catalog-car-scene-v2.png',room:'Салон автомобиля',atlas:{width:1024,height:1536}},
 'household':{before:'/media/catalog-household-scene-v2.png',after:'/media/catalog-household-scene-v2.png',room:'Прачечная',atlas:{width:1024,height:1536}},
 'organization':{before:'/media/catalog-organization-scene-v2.png',after:'/media/catalog-organization-scene-v2.png',room:'Гардеробная',atlas:{width:1024,height:1536}},
 'pressure-washing':{before:'/media/catalog-pressure-washing-scene-v2.png',after:'/media/catalog-pressure-washing-scene-v2.png',room:'Терраса и дорожка',atlas:{width:1024,height:1536}},
 disinfecting:{before:'/media/disinfecting-bedroom-before-v2.png',after:'/media/disinfecting-bedroom-after-v2.png',room:'Спальня — иллюстрация обработки'}
};

export const photosForService=(id:string)=>servicePhotos[id]||servicePhotos.standard;

export const costumedKittenSprites:Record<string,{src:string;aspect:number}>={
 'standard':{src:'/media/catalog-standard-kitten.png',aspect:0.666667},
 'recurring':{src:'/media/catalog-recurring-kitten.png',aspect:0.666667},
 'one-time':{src:'/media/catalog-one-time-kitten.png',aspect:0.666667},
 'deep':{src:'/media/catalog-deep-kitten.png',aspect:0.666667},
 'spring':{src:'/media/catalog-spring-kitten.png',aspect:0.666667},
 'move-in':{src:'/media/catalog-move-in-kitten.png',aspect:0.666667},
 'move-out':{src:'/media/catalog-move-out-kitten.png',aspect:0.666667},
 'renovation':{src:'/media/catalog-renovation-kitten.png',aspect:0.666667},
 'rental':{src:'/media/catalog-rental-kitten.png',aspect:0.666667},
 'event':{src:'/media/catalog-event-kitten.png',aspect:0.666667},
 'commercial':{src:'/media/catalog-commercial-kitten.png',aspect:0.666667},
 'garage':{src:'/media/catalog-garage-kitten.png',aspect:0.666667},
 'carpet':{src:'/media/catalog-carpet-kitten.png',aspect:0.666667},
 'windows':{src:'/media/catalog-windows-kitten.png',aspect:0.666667},
 'upholstery':{src:'/media/catalog-upholstery-kitten.png',aspect:0.666667},
 'car':{src:'/media/catalog-car-kitten.png',aspect:0.666667},
 'household':{src:'/media/catalog-household-kitten.png',aspect:0.666667},
 'organization':{src:'/media/catalog-organization-kitten.png',aspect:0.666667},
 'pressure-washing':{src:'/media/catalog-pressure-washing-kitten.png',aspect:0.666667},
};
