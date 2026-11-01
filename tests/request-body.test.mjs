import test from 'node:test';
import assert from 'node:assert/strict';
import {readJsonBody,readFormBody} from '../lib/request-body.ts';

const request=(body,headers={})=>new Request('http://localhost/api',{method:'POST',body,headers});

test('JSON is read and malformed JSON is a client error',async()=>{
 assert.deepEqual(await readJsonBody(request('{"ok":true}')),{ok:true});
 await assert.rejects(readJsonBody(request('{broken')),error=>error.status===400);
});

test('body limits apply even with missing or dishonest Content-Length',async()=>{
 for(const headers of [{},{'Content-Length':'1'},{'Content-Length':'1000'}])
  await assert.rejects(readJsonBody(request('x'.repeat(100),headers),64),error=>error.status===413);
});

test('oversized streaming upload stops reading before form parsing',async()=>{
 let cancelled=false;
 const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(40));},cancel(){cancelled=true;}});
 const req=new Request('http://localhost/upload',{method:'POST',body,duplex:'half'});
 await assert.rejects(readFormBody(req,64),error=>error.status===413);assert.equal(cancelled,true);
});

test('multipart boundary, unicode filename and file content survive bounded parsing',async()=>{
 const form=new FormData();form.set('purpose','brief');form.set('file',new Blob(['data'],{type:'image/png'}),'пример.png');
 const parsed=await readFormBody(request(form));assert.equal(parsed.get('purpose'),'brief');assert.equal(parsed.get('file').name,'пример.png');assert.equal(await parsed.get('file').text(),'data');
});
