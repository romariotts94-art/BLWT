import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAuthIntent} from '../lib/auth-flow-policy.ts';

const profiles=['client','cleaner','admin'];
const checkpoints=['code request','code verification'];
const states=[
 ['new address',false,false,false],
 ['existing customer',true,false,false],
 ['existing worker',true,false,false],
 ['invited address',false,true,false],
 ['admin allowlist',false,false,true],
];
let scenarios=0;

for(const checkpoint of checkpoints)for(const profile of profiles)for(const intent of ['login','register'])for(const [state,hasMember,hasInvite,isAdmin] of states){
 test(`${++scenarios}. ${checkpoint}, ${profile}: ${intent} with ${state}`,()=>{
  const result=resolveAuthIntent({intent,hasMember,hasInvite,isAdmin});
  if(intent==='login'&&state==='new address'){
   assert.equal(result.intent,'login');
   assert.equal(result.error.status,404);
   assert.match(result.error.message,/Проверьте адрес|регистрацию/);
  }else if(intent==='register'&&(hasMember||isAdmin)){
   assert.equal(result.intent,'login');
   assert.equal(result.accountExists,true);
   assert.equal(result.error,undefined);
  }else{
   assert.equal(result.intent,intent);
   assert.equal(result.error,undefined);
  }
 });
}

test('Existing address switches from registration to sign-in on the first request',()=>{
 const result=resolveAuthIntent({intent:'register',hasMember:true,hasInvite:false,isAdmin:false});
 assert.deepEqual(result,{intent:'login',accountExists:true});
});

test('Changing registration role does not affect account-state resolution',()=>{
 for(const profile of profiles){
  const result=resolveAuthIntent({intent:'register',hasMember:true,hasInvite:false,isAdmin:profile==='admin'});
  assert.equal(result.intent,'login');
 }
});
