import json,urllib.request,urllib.error,datetime,uuid,concurrent.futures
BASE='http://127.0.0.1:5173'
run_id=uuid.uuid4().hex[:6]
users={'admin':('local_seedy','seedy@sites.test'),'client':('client_'+run_id,'client_'+run_id+'@example.test'),'stranger':('stranger_'+run_id,'stranger_'+run_id+'@example.test'),'worker':('worker_'+run_id,'worker_'+run_id+'@example.test'),'worker2':('worker2_'+run_id,'worker2_'+run_id+'@example.test')}
count=0
def request(role,path='/api/platform',body=None,status=200):
 global count
 headers={'Origin':BASE}
 if role:headers.update({'oai-authenticated-user-id':users[role][0],'oai-authenticated-user-email':users[role][1]})
 if body is not None:headers['Content-Type']='application/json'
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:code=r.status;data=r.read()
 except urllib.error.HTTPError as e:code=e.code;data=e.read()
 assert code==status,(role,path,body and body.get('action'),code,data[:700])
 count+=1
 return json.loads(data)
def act(role,action,status=200,**kw):return request(role,body={'action':action,**kw},status=status)
assert request(None,'/api/platform?public=1')['rates']['services']['standard']['rate']==90
request(None,status=401)
assert request('admin')['user']['role']=='admin'
assert request('client')['user']['role']=='client'
request('stranger')
act('client','team',403,name='Not allowed')
act('client','invite',403,email=users['stranger'][1],name='Nope',role='admin',teamId=None)
act('admin','team',name='QA team '+run_id,skills='Test')
team=next(t for t in request('admin')['teams'] if t['name']=='QA team '+run_id)
for key,role in [('worker','leader'),('worker2','cleaner')]:
 act('admin','invite',email=users[key][1],name='Test '+key,role=role,teamId=team['id'])
 assert request(key)['user']['role']==role
future=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=4)).strftime('%Y-%m-%d')
booking=dict(service='standard',area=60,dirt=0,frequency=0,urgent=False,extras={},workers=0,name='Тестовый клиент',phone='+70000000000',address='Москва, Тестовый адрес, 1',date=future,time='10:00',notes='Синтетический тест. Не реальная заявка.',liveConsent=True,terms=True)
first=act('client','book',input=booking)['id']
second=act('client','book',input={**booking,'time':'11:00'})['id']
request('stranger','/api/platform?order='+first,status=403)
act('stranger','status',403,id=first,status='completed')
act('client','status',400,id=first,status='completed')
for id in [first,second]:act('admin','dispatch',id=id,target=team['id'])
o=next(o for o in request('worker')['orders'] if o['id']==first)
assert o['address'].startswith('Москва · точный адрес после принятия')
assert o['phone']=='' and 'payroll' not in o['quote']
act('worker2','accept',403,id=first)
act('worker','accept',id=first)
act('worker','accept',409,id=second)
o=next(o for o in request('worker')['orders'] if o['id']==first)
assert o['address']==booking['address'] and len(o['crew'])==2
request('client','/api/live?order='+first,status=403)
act('worker','status',id=first,status='en_route')
act('worker','status',id=first,status='in_progress')
request('stranger','/api/live?order='+first,status=403)
request('admin','/api/live?order='+first,status=403)
assert request('worker','/api/live?order='+first)['worker']
assert not request('client','/api/live?order='+first)['worker']
request('worker','/api/live',{'action':'state','order':first,'state':'live','consent':True})
request('worker','/api/live',{'action':'heartbeat','order':first})
live=request('client','/api/live?order='+first)
assert live['states'][users['worker'][0]]['state']=='live'
assert len(live['people'])==2
channel=request('client','/api/live',{'action':'offer','order':first,'worker':users['worker'][0],'offer':json.dumps({'type':'offer','sdp':'synthetic-test-not-media'})})['channel']
request('stranger','/api/live',{'action':'answer','order':first,'channel':channel,'answer':'synthetic-answer'},status=403)
request('worker','/api/live',{'action':'answer','order':first,'channel':channel,'answer':json.dumps({'type':'answer','sdp':'synthetic-test-not-media'})})
assert request('client','/api/live?order='+first)['channels'][0]['answer']
act('client','liveConsent',id=first,value=False)
request('client','/api/live?order='+first,status=403)
act('client','liveConsent',id=first,value=True)
assert request('client','/api/live?order='+first)['channels']==[]
act('worker','status',400,id=first,status='review')
for i in range(6):act('worker','check',id=first,index=i,done=True)
act('worker','message',id=first,text='Тестовое сообщение команды')
act('worker','status',id=first,status='review')
request('worker','/api/live?order='+first,status=403)
act('worker','status',403,id=first,status='completed')
act('client','issue',id=first,text='Тестовое замечание по качеству')
act('admin','resolve',id=first,text='Тестовое замечание устранено')
act('client','status',id=first,status='completed')
act('client','status',400,id=first,status='in_progress')
act('client','status',id=second,status='cancelled')
assert len(request('client')['notifications'])>0
act('client','read')
assert all(n['read'] for n in request('client')['notifications'])
print(json.dumps({'passed_requests':count,'order':first,'checks':['pricing','authentication','role escalation denied','order isolation','offer privacy','leader acceptance','overlap rejection','lifecycle','camera permissions','signaling','consent revocation','checklist gate','chat','quality resolution','notifications']},ensure_ascii=False))
