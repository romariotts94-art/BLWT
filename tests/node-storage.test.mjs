import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('Node storage preserves content type, bytes, rejects path traversal and deletes idempotently',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'bw-storage-audit-'));
 process.env.FILE_STORAGE_PATH=directory;
 try{
  const {env}=await import('../lib/node-env.ts');
  await env.BUCKET.put('audit-file',new Uint8Array([137,80,78,71]),{httpMetadata:{contentType:'image/png'}});
  const object=await env.BUCKET.get('audit-file');assert.equal(object.httpMetadata.contentType,'image/png');
  assert.deepEqual([...new Uint8Array(await new Response(object.body).arrayBuffer())],[137,80,78,71]);
  await assert.rejects(env.BUCKET.put('../outside',new Uint8Array([1])),/Invalid file key/);
  await env.BUCKET.delete('audit-file');await env.BUCKET.delete('audit-file');
  assert.equal(await env.BUCKET.get('audit-file'),null);assert.deepEqual(await readdir(directory),[]);
 }finally{await rm(directory,{recursive:true,force:true});}
});
