import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=mkdtempSync(path.join(os.tmpdir(),'civiccare-demo-test-'));
const {server}=await import('../server.js');
let base;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>new Promise(resolve=>server.close(resolve)));
function client(){const jar=new Map();return async(route,method='GET',body)=>{
 const response=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined});
 for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const [key,value]=pair.split('=');if(value)jar.set(key,value);else jar.delete(key);}
 return {status:response.status,body:await response.json()};
};}
const report={title:'Practice isolated report',description:'Fictional report created inside an independent practice workspace.',category:'Other',location:'Demo Pune location',lat:18.52,lng:73.85,priority:'Normal',confirmDuplicate:true};
test('practice data is isolated from saved data and other browser demos',async()=>{
 const saved=client(),a=client(),b=client();await saved('/login','POST',{email:'resident@civiccare.local',password:'CivicCare123!'});
 const baseline=(await saved('/dashboard')).body.issues.length;
 assert.equal((await a('/demo/start','POST',{role:'resident'})).status,200);
 assert.equal((await b('/demo/start','POST',{role:'resident'})).status,200);
 assert.equal((await a('/dashboard')).body.demo,true);
 const created=await a('/issues','POST',report);assert.ok(created.body.id);
 assert.equal((await a('/dashboard')).body.issues.length,6);
 assert.equal((await b('/dashboard')).body.issues.length,5);
 assert.equal((await saved('/dashboard')).body.issues.length,baseline);
 const [ra,rb]=await Promise.all([a('/posts','POST',{title:'Sandbox A discussion',body:'Only visible inside the first practice workspace.'}),b('/posts','POST',{title:'Sandbox B discussion',body:'Only visible inside the second practice workspace.'})]);
 assert.equal(ra.status,200);assert.equal(rb.status,200);
 assert.ok(!(await a('/dashboard')).body.posts.some(p=>p.title==='Sandbox B discussion'));
 assert.ok(!(await b('/dashboard')).body.posts.some(p=>p.title==='Sandbox A discussion'));
});
test('role switching completes a report journey and reset restores seed records',async()=>{
 const c=client();await c('/demo/start','POST',{role:'resident'});const id=(await c('/issues','POST',report)).body.id;
 await c('/demo/role','POST',{role:'volunteer'});assert.equal((await c(`/issues/${id}/verify`,'POST',{})).status,200);
 await c('/demo/role','POST',{role:'witness'});assert.equal((await c(`/issues/${id}/verify`,'POST',{})).status,200);
 assert.equal((await c(`/issues/${id}`)).body.issue.status,'Verified');
 await c('/demo/role','POST',{role:'admin'});assert.equal((await c(`/issues/${id}/status`,'PATCH',{status:'Resolved'})).status,200);
 assert.equal((await c(`/issues/${id}`)).body.issue.status,'Resolved');
 assert.equal((await c('/demo/reset','POST',{role:'resident'})).status,200);
 const fresh=(await c('/dashboard')).body;assert.equal(fresh.issues.length,5);assert.equal(fresh.user.points,80);assert.equal(fresh.user.role,'resident');
});
test('demo help workflow rewards once and exit restores the original saved session',async()=>{
 const c=client();await c('/login','POST',{email:'admin@civiccare.local',password:'CivicCare123!'});
 await c('/demo/start','POST',{role:'resident'});
 const id=(await c('/requests','POST',{title:'Practice grocery collection',description:'Fictional help request at a nearby sample shop.',category:'Errands',location:'Demo Pune shop',lat:18.5204,lng:73.8567})).body.id;
 await c('/demo/role','POST',{role:'volunteer'});await c(`/requests/${id}/accept`,'POST',{});
 await c('/demo/role','POST',{role:'resident'});assert.equal((await c(`/requests/${id}/complete`,'POST',{})).status,200);
 assert.equal((await c(`/requests/${id}/complete`,'POST',{})).status,409);
 await c('/demo/role','POST',{role:'volunteer'});assert.equal((await c('/dashboard')).body.user.points,185);
 await c('/demo/exit','POST',{});const saved=(await c('/dashboard')).body;assert.equal(saved.demo,false);assert.equal(saved.user.role,'admin');assert.equal(saved.requests.length,3);
});
test('saved users cannot invoke demo role or reset controls',async()=>{
 const c=client();await c('/login','POST',{email:'resident@civiccare.local',password:'CivicCare123!'});
 assert.equal((await c('/demo/role','POST',{role:'admin'})).status,403);
 assert.equal((await c('/demo/reset','POST',{})).status,403);
 assert.equal((await c('/demo/start','POST',{role:'invented'})).status,400);
});
test('expired practice cookies are cleared during session discovery',async()=>{
 const r=await fetch(base+'/api/me',{headers:{Cookie:'civiccare-demo=expired;civiccare-demo-auth=expired'}});
 assert.equal(r.status,200);assert.equal((await r.json()).user,null);
 assert.ok(r.headers.getSetCookie().some(c=>c.startsWith('civiccare-demo=;')&&c.includes('Max-Age=0')));
});
