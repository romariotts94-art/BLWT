package ru.blackandwhite.mobile;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.widget.*;
import android.view.*;
import java.util.*;

public final class MainActivity extends Activity {
    private WebView web;private TextView status;private ValueCallback<Uri[]> files;private PermissionRequest mediaRequest;private String pendingOrder="";
    @Override public void onCreate(Bundle state){super.onCreate(state);CookieManager.getInstance().setAcceptCookie(true);getWindow().setStatusBarColor(Color.rgb(246,247,242));
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(246,247,242));root.setFitsSystemWindows(true);
        LinearLayout toolbar=new LinearLayout(this);toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(12,0,12,0);TextView title=new TextView(this);title.setText("Black to White");title.setTextColor(Color.rgb(39,52,43));title.setTextSize(18);toolbar.addView(title,new LinearLayout.LayoutParams(0,52,1));Button notifications=new Button(this);notifications.setText("Уведомления");notifications.setTextSize(12);notifications.setOnClickListener(v->settings());toolbar.addView(notifications);root.addView(toolbar);
        status=new TextView(this);status.setTextSize(12);status.setPadding(14,3,14,6);status.setTextColor(Color.rgb(82,100,66));root.addView(status);status.setOnClickListener(v->settings());
        web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSafeBrowsingEnabled(true);s.setMediaPlaybackRequiresUserGesture(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){Uri u=req.getUrl();if(internal(u))return false;if(req.isForMainFrame()&&req.hasGesture()&&Arrays.asList("https","tel","mailto").contains(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}return true;}
            @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();updateStatus();if(!pendingOrder.isEmpty()){String id=pendingOrder;pendingOrder="";showOrder(id);}}
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame()){status.setText("Нет связи с сайтом. Нажмите здесь, чтобы повторить");status.setOnClickListener(x->{web.loadUrl(BuildConfig.ORIGIN+"/#orders");status.setOnClickListener(y->settings());});}}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(files!=null)files.onReceiveValue(null);files=callback;try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,41);}catch(Exception e){files.onReceiveValue(null);files=null;}return true;}
            @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{if(!internal(request.getOrigin())){request.deny();return;}mediaRequest=request;ArrayList<String> needed=new ArrayList<>();for(String r:request.getResources()){if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r))needed.add(Manifest.permission.CAMERA);else if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r))needed.add(Manifest.permission.RECORD_AUDIO);}if(needed.isEmpty()){request.deny();mediaRequest=null;return;}requestPermissions(needed.toArray(new String[0]),43);});}
            @Override public void onPermissionRequestCanceled(PermissionRequest r){if(mediaRequest==r)mediaRequest=null;}
        });
        web.setDownloadListener((url,agent,disposition,type,size)->{if(internal(Uri.parse(url)))new AlertDialog.Builder(this).setTitle("Открыть документ").setMessage("Документ откроется в браузере. Для защищённых файлов может потребоваться вход.").setPositiveButton("Открыть",(d,w)->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)))).setNegativeButton("Отмена",null).show();});
        pendingOrder=getIntent().getStringExtra("order");if(pendingOrder==null)pendingOrder="";
        if(state==null)web.loadUrl(BuildConfig.ORIGIN+"/#orders");else web.restoreState(state);
        updateStatus();
    }
    private boolean internal(Uri u){Uri base=Uri.parse(BuildConfig.ORIGIN);return base.getScheme().equals(u.getScheme())&&base.getHost().equals(u.getHost())&&base.getPort()==u.getPort();}
    private void showOrder(String id){if(!id.matches("[0-9a-fA-F-]{36}"))return;web.evaluateJavascript("(()=>{let n=0;const t=setInterval(()=>{const b=[...document.querySelectorAll('article.op-order')].find(e=>e.textContent.toUpperCase().includes('"+id.substring(0,6).toUpperCase(Locale.ROOT)+"'));if(b){b.click();clearInterval(t)}else if(++n>20)clearInterval(t)},400)})()",null);}
    private void updateStatus(){if(status!=null)status.setText(OrderMonitor.enabled(this)?"Мониторинг заказов включён":"Мониторинг выключен · нажмите, чтобы настроить");}
    private void settings(){String text="При включении приложение проверяет события аккаунта каждые 30 секунд и показывает новые заказы и назначения. Работает с постоянным уведомлением Android.\n\nПри отсутствии сети, принудительной остановке или ограничениях батареи доставка задерживается. Заказы сохраняются на сервере. После перезагрузки телефона откройте приложение.\n\nНа экране блокировки подробности скрыты. Включите уведомления только на своём телефоне.";
        new AlertDialog.Builder(this).setTitle("Уведомления о заказах").setMessage(text).setPositiveButton(OrderMonitor.enabled(this)?"Выключить":"Включить",(d,w)->{if(OrderMonitor.enabled(this)){OrderMonitor.disable(this);updateStatus();}else if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},42);else startMonitor();}).setNeutralButton("Настройки батареи",(d,w)->{try{startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));}catch(Exception e){Toast.makeText(this,"Откройте настройки батареи телефона",Toast.LENGTH_LONG).show();}}).setNegativeButton("Закрыть",null).show();}
    private void startMonitor(){if(!getSystemService(NotificationManager.class).areNotificationsEnabled()){new AlertDialog.Builder(this).setMessage("Разрешите уведомления в настройках Android.").setPositiveButton("Настройки",(d,w)->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()))).setNegativeButton("Отмена",null).show();return;}String cookie=CookieManager.getInstance().getCookie(BuildConfig.ORIGIN);if(cookie==null||!cookie.contains("bw_session=")){Toast.makeText(this,"Сначала войдите в свой аккаунт",Toast.LENGTH_LONG).show();return;}OrderMonitor.prefs(this).edit().putBoolean("enabled",true).apply();startForegroundService(new Intent(this,OrderMonitor.class));updateStatus();}
    @Override protected void onResume(){super.onResume();updateStatus();}
    @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);pendingOrder=i.getStringExtra("order");if(pendingOrder==null)pendingOrder="";web.loadUrl(BuildConfig.ORIGIN+"/#orders");}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==42&&grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)startMonitor();if(request==43&&mediaRequest!=null){ArrayList<String> allowed=new ArrayList<>();for(String r:mediaRequest.getResources()){if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)&&checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)allowed.add(r);if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)allowed.add(r);}if(allowed.isEmpty())mediaRequest.deny();else mediaRequest.grant(allowed.toArray(new String[0]));mediaRequest=null;}}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==41&&files!=null){files.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));files=null;}}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);web.saveState(state);}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(files!=null)files.onReceiveValue(null);if(mediaRequest!=null)mediaRequest.deny();web.destroy();super.onDestroy();}
}
