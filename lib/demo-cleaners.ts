// Local design fixtures only. Production enables real published profiles instead.
export const demoCleaners=[
 {id:'example-anna',name:'Анна',avatar:'/media/trust-anna-demo.webp',experienceYears:5,specialties:'Регулярная и генеральная уборка',bio:'Бережный подход к вещам, внимание к деталям и пожеланиям хозяев.'},
 {id:'example-maria',name:'Мария',avatar:'/media/trust-maria-demo.webp',experienceYears:7,specialties:'Квартиры и загородные дома',bio:'Аккуратная работа с разными поверхностями и понятный порядок уборки.'},
 {id:'example-alexey',name:'Алексей',avatar:'/media/trust-alexey-demo.webp',experienceYears:4,specialties:'Генеральная уборка и после ремонта',bio:'Последовательный подход к сложным задачам и внимание к результату.'}
].map(c=>({...c,demo:true,city:'Москва',reviews:[],workPhotos:[],completed:0,verified:false,languages:'Русский',rating:null}));
