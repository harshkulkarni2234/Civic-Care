import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const directory=mkdtempSync(path.join(os.tmpdir(),'civiccare-test-'));
process.env.DATA_DIR=directory;
const {server,distance}=await import('../server.js');
let base;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));/* SQLite handles are released at process exit; temp data stays outside the project. */});
async function request(route,method='GET',body,cookie=''){const r=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(role){const r=await request('/login','POST',{email:`${role}@civiccare.local`,password:'CivicCare123!'});assert.equal(r.status,200);return r.cookie;}
test('authentication, validation and role permissions',async()=>{
 assert.equal((await request('/dashboard')).status,401);
 assert.equal((await request('/login','POST',{email:'resident@civiccare.local',password:'nottherightpass'})).status,401);
 const resident=await login('resident');const dashboard=await request('/dashboard','GET',null,resident);assert.equal(dashboard.body.issues.length,5);assert.equal(dashboard.body.user.password,undefined);
 assert.equal((await request('/issues/1/status','PATCH',{status:'Resolved'},resident)).status,403);
 assert.equal((await request('/issues','POST',{title:'Test'},resident)).status,400);
 const admin=await login('admin');assert.equal((await request('/issues/1/status','PATCH',{status:'Resolved',note:'Inspected and repaired'},admin)).status,200);
 assert.equal((await request('/issues/1','GET',null,resident)).body.issue.status,'Resolved');
});
test('new accounts, report creation, verification and duplicate detection',async()=>{
 const registered=await request('/register','POST',{name:'Test Neighbour',email:'test@example.com',password:'LongPassword123!'});assert.equal(registered.status,200);const cookie=registered.cookie;
 assert.equal((await request('/register','POST',{name:'Test',email:'test@example.com',password:'LongPassword123!'})).status,409);
 const b={title:'A new pavement problem',description:'A large broken pavement slab near the crossing.',category:'Roads',location:'Test area',lat:19,lng:74,priority:'Normal'};
 const created=await request('/issues','POST',b,cookie);assert.ok(created.body.id);
 assert.equal((await request(`/issues/${created.body.id}/verify`,'POST',{},cookie)).status,400);
 const resident=await login('resident'),volunteer=await login('volunteer');
 assert.equal((await request(`/issues/${created.body.id}/verify`,'POST',{},resident)).status,200);
 assert.equal((await request(`/issues/${created.body.id}/verify`,'POST',{},resident)).status,409);
 assert.equal((await request(`/issues/${created.body.id}/verify`,'POST',{},volunteer)).status,200);
 const detail=await request(`/issues/${created.body.id}`,'GET',null,cookie);assert.equal(detail.body.issue.status,'Verified');assert.equal(detail.body.issue.confirmations,2);
 const duplicate=await request('/issues','POST',b,cookie);assert.equal(duplicate.body.duplicates[0].id,created.body.id);
 const photo=await request('/issues','POST',{...b,confirmDuplicate:true,photo:'data:image/svg+xml;base64,dGVzdA=='},cookie);assert.equal(photo.status,400);
 assert.equal((await request('/dashboard','GET',null,cookie)).body.user.points,10);
});
test('distance matching, request ownership and rewards',async()=>{
 assert.ok(distance(18.52,73.85,18.52,73.85)<0.001);assert.ok(distance(18,73,19,73)>100);
 const resident=await login('resident'),volunteer=await login('volunteer');
 const r=await request('/requests','POST',{title:'Need help with groceries',description:'Please help collect a bag from the nearby shop.',category:'Errands',location:'Pune sample area',lat:18.5204,lng:73.8567},resident);assert.ok(r.body.id);
 assert.equal((await request(`/requests/${r.body.id}/accept`,'POST',{},resident)).status,400);
 assert.equal((await request(`/requests/${r.body.id}/accept`,'POST',{},volunteer)).status,200);
 assert.equal((await request(`/requests/${r.body.id}/complete`,'POST',{},volunteer)).status,403);
 const p=(await request('/dashboard','GET',null,volunteer)).body.user.points;
 assert.equal((await request(`/requests/${r.body.id}/complete`,'POST',{},resident)).status,200);
 assert.equal((await request(`/requests/${r.body.id}/complete`,'POST',{},resident)).status,409);
 assert.equal((await request('/dashboard','GET',null,volunteer)).body.user.points,p+25);
 const distant=await request('/requests','POST',{title:'Far away request',description:'This is outside the volunteer travel radius.',category:'Errands',location:'Far away',lat:28,lng:77},resident);
 assert.equal((await request(`/requests/${distant.body.id}/accept`,'POST',{},volunteer)).status,403);
});
test('discussion replies, likes, notifications and demo SOS',async()=>{
 const cookie=await login('resident');const post=await request('/posts','POST',{title:'Our next community day',body:'Let us share ideas for the next neighbourhood gathering.'},cookie);const id=post.body.id;
 assert.equal((await request(`/posts/${id}/replies`,'POST',{body:'Happy to take part!'},cookie)).status,200);
 assert.equal((await request(`/posts/${id}`,'GET',null,cookie)).body.replies.length,1);
 await request(`/posts/${id}/like`,'POST',{},cookie);assert.equal((await request('/dashboard','GET',null,cookie)).body.posts.find(p=>p.id===id).likes,1);
 await request(`/posts/${id}/like`,'POST',{},cookie);assert.equal((await request('/dashboard','GET',null,cookie)).body.posts.find(p=>p.id===id).likes,0);
 assert.equal((await request('/sos','POST',{lat:18,lng:73},cookie)).status,400);
 const alert=await request('/sos','POST',{lat:18,lng:73,demo:true},cookie);assert.equal(alert.body.demo,true);
 assert.equal((await request('/sos','POST',{lat:18,lng:73,demo:true},cookie)).status,409);
 assert.equal((await request(`/sos/${alert.body.id}/cancel`,'POST',{},cookie)).status,200);
 await request('/notifications/read','POST',{},cookie);assert.ok((await request('/dashboard','GET',null,cookie)).body.notifications.every(n=>n.read===1));
 await request('/logout','POST',{},cookie);assert.equal((await request('/dashboard','GET',null,cookie)).status,401);
});
test('static application and request origin protection',async()=>{
 const r=await fetch(base);assert.equal(r.status,200);assert.match(await r.text(),/CivicCare/);assert.ok(r.headers.get('content-security-policy'));
 const cookie=await login('admin');const blocked=await fetch(base+'/api/posts',{method:'POST',headers:{Cookie:cookie,Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({title:'Cross origin post',body:'Should not be accepted by the server.'})});assert.equal(blocked.status,403);
});
test('saved coordinates move the neighbourhood and survive subsequent requests',async()=>{
 const cookie=await login('resident');const before=(await request('/dashboard','GET',null,cookie)).body.user;
 const saved=await request('/location','PATCH',{lat:22.5726,lng:88.3639,area:'Kolkata test neighbourhood'},cookie);
 assert.equal(saved.status,200);assert.equal(saved.body.user.lat,22.5726);assert.equal(saved.body.user.lng,88.3639);assert.equal(saved.body.user.area,'Kolkata test neighbourhood');
 assert.equal(saved.body.user.name,before.name);assert.equal(saved.body.user.skills,before.skills);assert.equal(saved.body.user.role,before.role);
 const refreshed=(await request('/dashboard','GET',null,cookie)).body;assert.equal(refreshed.user.area,'Kolkata test neighbourhood');assert.equal(refreshed.user.lat,22.5726);assert.ok(refreshed.requests.every(r=>r.distance>100));
 assert.equal((await request('/location','PATCH',{lat:200,lng:88,area:'Invalid'},cookie)).status,400);
 assert.equal((await request('/dashboard','GET',null,cookie)).body.user.lat,22.5726);
 assert.equal((await request('/location','PATCH',{lat:0,lng:0},cookie)).status,200);
 assert.equal((await request('/dashboard','GET',null,cookie)).body.user.lat,0);
 assert.equal((await request('/profile','PATCH',{name:before.name,lat:19.076,lng:72.8777,area:'Mumbai test neighbourhood',radius:before.radius,skills:before.skills,available:Boolean(before.available),contact:before.contact},cookie)).status,200);
 const profile=(await request('/dashboard','GET',null,cookie)).body.user;assert.equal(profile.lng,72.8777);assert.equal(profile.area,'Mumbai test neighbourhood');
});
