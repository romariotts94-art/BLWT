export type AuthIntent = 'login' | 'register';

export function resolveAuthIntent(input:{intent:AuthIntent;hasMember:boolean;hasInvite:boolean;isAdmin:boolean}){
 const registered=input.hasMember||input.isAdmin;
 if(input.intent==='register'&&registered)return {intent:'login' as const,accountExists:true};
 if(input.intent==='login'&&!input.hasMember&&!input.hasInvite&&!input.isAdmin)return {intent:'login' as const,error:{status:404 as const,message:'Аккаунт не найден. Проверьте адрес или выберите регистрацию.'}};
 return {intent:input.intent,accountExists:registered};
}
