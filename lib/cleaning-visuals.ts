export type ServicePhotos = {
 before:string;
 after:string;
 room:string;
 /** Two equally sized photos stacked vertically: before above after. */
 atlas?:{width:number;height:number};
};

export const servicePhotos:Record<string,ServicePhotos>={
 standard:{before:'/media/living-room-bright-before.webp',after:'/media/living-room-bright-after.webp',room:'Гостиная'},
 recurring:{before:'/media/recurring-kitchen-before.webp',after:'/media/recurring-kitchen-after.webp',room:'Кухня-столовая'},
 'one-time':{before:'/media/one-time-entryway-before.webp',after:'/media/one-time-entryway-after.webp',room:'Прихожая'},
 deep:{before:'/media/deep-bathroom-before.webp',after:'/media/deep-bathroom-after.webp',room:'Ванная комната'},
 spring:{before:'/media/seasonal-balcony-before.webp',after:'/media/seasonal-balcony-after.webp',room:'Балкон — зона отдыха'},
 'move-in':{before:'/media/move-in-bedroom-before.webp',after:'/media/move-in-bedroom-after.webp',room:'Спальня после переезда'},
 'move-out':{before:'/media/move-out-furnished-before.webp',after:'/media/move-out-furnished-after-v2.webp',room:'Квартира перед выездом'},
 renovation:{before:'/media/renovation-living-room-before.webp',after:'/media/renovation-living-room-after.webp',room:'Гостиная после ремонта'},
 rental:{before:'/media/rental-bedroom-before.webp',after:'/media/rental-bedroom-after.webp',room:'Квартира для посуточной аренды'},
 event:{before:'/media/event-living-room-before.webp',after:'/media/event-living-room-after.webp',room:'Гостиная после мероприятия'},
 urgent:{before:'/media/urgent-living-room-hourglass-before.webp',after:'/media/urgent-living-room-hourglass-after.webp',room:'Гостиная перед приходом гостей'},
 'office':{before:'/media/catalog-office-scene-v2.webp',after:'/media/catalog-office-scene-v2.webp',room:'Офис',atlas:{width:1024,height:1536}},
 'commercial':{before:'/media/catalog-commercial-scene-v2.webp',after:'/media/catalog-commercial-scene-v2.webp',room:'Кофейня',atlas:{width:1024,height:1536}},
 'garage':{before:'/media/catalog-garage-scene-v2.webp',after:'/media/catalog-garage-scene-v2.webp',room:'Гараж-мастерская',atlas:{width:1024,height:1536}},
 'carpet':{before:'/media/catalog-carpet-scene-v2.webp',after:'/media/catalog-carpet-scene-v2.webp',room:'Гостиная с ковром',atlas:{width:1024,height:1536}},
 'windows':{before:'/media/catalog-windows-scene-v2.webp',after:'/media/catalog-windows-scene-v2.webp',room:'Панорамные окна',atlas:{width:1024,height:1536}},
 'upholstery':{before:'/media/catalog-upholstery-scene-v2.webp',after:'/media/catalog-upholstery-scene-v2.webp',room:'Мягкая мебель',atlas:{width:1024,height:1536}},
 'car':{before:'/media/catalog-car-scene-v2.webp',after:'/media/catalog-car-scene-v2.webp',room:'Салон автомобиля',atlas:{width:1024,height:1536}},
 'household':{before:'/media/catalog-household-scene-v2.webp',after:'/media/catalog-household-scene-v2.webp',room:'Прачечная',atlas:{width:1024,height:1536}},
 'organization':{before:'/media/catalog-organization-scene-v2.webp',after:'/media/catalog-organization-scene-v2.webp',room:'Гардеробная',atlas:{width:1024,height:1536}},
 'pressure-washing':{before:'/media/catalog-pressure-washing-scene-v2.webp',after:'/media/catalog-pressure-washing-scene-v2.webp',room:'Терраса и дорожка',atlas:{width:1024,height:1536}},
 disinfecting:{before:'/media/disinfecting-bedroom-before-v2.webp',after:'/media/disinfecting-bedroom-after-v2.webp',room:'Спальня — иллюстрация обработки'}
};

export const photosForService=(id:string)=>servicePhotos[id]||servicePhotos.standard;

export const costumedKittenSprites:Record<string,{src:string;aspect:number}>={
 'standard':{src:'/media/catalog-standard-kitten.webp',aspect:0.666667},
 'recurring':{src:'/media/catalog-recurring-kitten.webp',aspect:0.666667},
 'one-time':{src:'/media/catalog-one-time-kitten.webp',aspect:0.666667},
 'deep':{src:'/media/catalog-deep-kitten.webp',aspect:0.666667},
 'spring':{src:'/media/catalog-spring-kitten.webp',aspect:0.666667},
 'move-in':{src:'/media/catalog-move-in-kitten.webp',aspect:0.666667},
 'move-out':{src:'/media/catalog-move-out-kitten.webp',aspect:0.666667},
 'renovation':{src:'/media/catalog-renovation-kitten.webp',aspect:0.666667},
 'rental':{src:'/media/catalog-rental-kitten.webp',aspect:0.666667},
 'event':{src:'/media/catalog-event-kitten.webp',aspect:0.666667},
 'commercial':{src:'/media/catalog-commercial-kitten.webp',aspect:0.666667},
 'garage':{src:'/media/catalog-garage-kitten.webp',aspect:0.666667},
 'carpet':{src:'/media/catalog-carpet-kitten.webp',aspect:0.666667},
 'windows':{src:'/media/catalog-windows-kitten.webp',aspect:0.666667},
 'upholstery':{src:'/media/catalog-upholstery-kitten.webp',aspect:0.666667},
 'car':{src:'/media/catalog-car-kitten.webp',aspect:0.666667},
 'household':{src:'/media/catalog-household-kitten.webp',aspect:0.666667},
 'organization':{src:'/media/catalog-organization-kitten.webp',aspect:0.666667},
 'pressure-washing':{src:'/media/catalog-pressure-washing-kitten.webp',aspect:0.666667},
};
