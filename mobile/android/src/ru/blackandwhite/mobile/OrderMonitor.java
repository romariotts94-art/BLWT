package ru.blackandwhite.mobile;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Explicit, visible monitoring session; no claim of guaranteed cloud push. */
public final class OrderMonitor extends Service {
    static final String STATUS="monitor", EVENTS="orders";
    static final int STATUS_ID=10;
    private ScheduledExecutorService executor;
    private volatile boolean stopped;
    private int failures;
    static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("monitor",MODE_PRIVATE);}
    static boolean enabled(Context c){return prefs(c).getBoolean("enabled",false);}
    static void disable(Context c){prefs(c).edit().putBoolean("enabled",false).apply();c.stopService(new Intent(c,OrderMonitor.class));}
    @Override public IBinder onBind(Intent i){return null;}
    @Override public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel(STATUS,"Мониторинг заказов",NotificationManager.IMPORTANCE_LOW));NotificationChannel events=new NotificationChannel(EVENTS,"Новые заказы и назначения",NotificationManager.IMPORTANCE_HIGH);events.setDescription("События вашего аккаунта Black to White");events.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);nm.createNotificationChannel(events);}
    @Override public int onStartCommand(Intent intent,int flags,int id){
        if(intent!=null&&"STOP".equals(intent.getAction())){prefs(this).edit().putBoolean("enabled",false).apply();stopSelf();return START_NOT_STICKY;}
        if(!enabled(this)){stopSelf();return START_NOT_STICKY;}
        Notification n=status("Подключение к аккаунту…");
        if(Build.VERSION.SDK_INT>=34)startForeground(STATUS_ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(STATUS_ID,n);
        if(executor==null){executor=Executors.newSingleThreadScheduledExecutor();executor.scheduleWithFixedDelay(this::poll,0,30,TimeUnit.SECONDS);}
        return START_STICKY;
    }
    private PendingIntent open(String order){Intent i=new Intent(this,MainActivity.class).putExtra("order",order).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);return PendingIntent.getActivity(this,order.hashCode(),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification status(String message){PendingIntent stop=PendingIntent.getService(this,0,new Intent(this,OrderMonitor.class).setAction("STOP"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new Notification.Builder(this,STATUS).setSmallIcon(R.drawable.ic_stat).setContentTitle("Black to White · мониторинг включён").setContentText(message).setContentIntent(open("")).setOngoing(true).setOnlyAlertOnce(true).addAction(new Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this,R.drawable.ic_stat),"Выключить",stop).build()).build();}
    private void update(String message){if(!stopped)getSystemService(NotificationManager.class).notify(STATUS_ID,status(message));}
    private void poll(){
        if(stopped||!enabled(this))return;
        HttpURLConnection conn=null;
        try{
            String cookies=CookieManager.getInstance().getCookie(BuildConfig.ORIGIN);
            if(cookies==null||!cookies.contains("bw_session=")){update("Войдите в аккаунт в приложении");return;}
            conn=(HttpURLConnection)new URL(BuildConfig.ORIGIN+"/api/platform").openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(12000);conn.setReadTimeout(15000);conn.setRequestProperty("Cookie",cookies);conn.setRequestProperty("Accept","application/json");conn.setRequestProperty("Cache-Control","no-store");
            int status=conn.getResponseCode();
            if(status==401||status==403){prefs(this).edit().remove("user").remove("seen").putBoolean("enabled",false).apply();getSystemService(NotificationManager.class).cancelAll();stopSelf();return;}
            if(status!=200)throw new IOException("HTTP "+status);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] b=new byte[8192];int count;while((count=in.read(b))!=-1){if(bytes.size()+count>12*1024*1024)throw new IOException("Response too large");bytes.write(b,0,count);}}
            JSONObject data=new JSONObject(bytes.toString("UTF-8")),user=data.getJSONObject("user");String uid=user.getString("id");
            android.content.SharedPreferences p=prefs(this);boolean baseline=!uid.equals(p.getString("user",""));
            LinkedHashSet<String> seen=new LinkedHashSet<>();if(!baseline){JSONArray stored=new JSONArray(p.getString("seen","[]"));for(int x=0;x<stored.length();x++)seen.add(stored.getString(x));}
            JSONArray notices=data.optJSONArray("notifications");if(notices==null)notices=new JSONArray();
            for(int x=notices.length()-1;x>=0;x--){JSONObject event=notices.getJSONObject(x);String eid=event.getString("id"),order=event.optString("order_id","");boolean fresh=!seen.contains(eid);seen.add(eid);
                if(!baseline&&fresh&&!order.isEmpty()&&!order.equals("null")&&!stopped){String message=event.optString("text","Обновление заказа");String title="Заказ BW–"+order.substring(0,Math.min(6,order.length())).toUpperCase(Locale.ROOT);
                    if("admin".equals(user.optString("role"))&&message.contains("принял")){String worker=assignedName(data,order);if(!worker.isEmpty())message="Заказ принял: "+worker+". "+message;}
                    Notification n=new Notification.Builder(this,EVENTS).setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open(order)).setGroup("orders").build();
                    getSystemService(NotificationManager.class).notify("event:"+eid,100,n);
                }
            }
            while(seen.size()>2000){Iterator<String> it=seen.iterator();it.next();it.remove();}
            if(!stopped&&enabled(this))p.edit().putString("user",uid).putString("seen",new JSONArray(seen).toString()).apply();
            failures=0;update("Проверка каждые 30 секунд · "+new java.text.SimpleDateFormat("HH:mm",Locale.getDefault()).format(new Date()));
        }catch(Exception e){failures++;update("Нет связи. Повторная попытка через 30 секунд");}finally{if(conn!=null)conn.disconnect();}
    }
    private String assignedName(JSONObject data,String id){JSONArray orders=data.optJSONArray("orders"),people=data.optJSONArray("people");if(orders==null||people==null)return "";for(int i=0;i<orders.length();i++){JSONObject o=orders.optJSONObject(i);if(o==null||!id.equals(o.optString("id")))continue;JSONArray crew=o.optJSONArray("crew");if(crew==null||crew.length()==0)return "";String worker=crew.optString(0);for(int j=0;j<people.length();j++){JSONObject person=people.optJSONObject(j);if(person!=null&&worker.equals(person.optString("id")))return person.optString("name","");}}return "";}
    @Override public void onDestroy(){stopped=true;if(executor!=null)executor.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
