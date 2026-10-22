import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createPlaceLookup } from './lib/geocoding.js';
const lookupPlaces=createPlaceLookup();

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'civiccare.sqlite'));
const schema = `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'resident',points INTEGER NOT NULL DEFAULT 0,lat REAL DEFAULT 18.5204,lng REAL DEFAULT 73.8567,available INTEGER DEFAULT 0,radius REAL DEFAULT 3,skills TEXT DEFAULT 'Elder support',contact TEXT DEFAULT '',area TEXT NOT NULL DEFAULT 'Pune neighbourhood');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS issues(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,location TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,status TEXT DEFAULT 'Reported',priority TEXT DEFAULT 'Normal',photo TEXT DEFAULT '',user_id INTEGER REFERENCES users(id),created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS verifications(issue_id INTEGER REFERENCES issues(id),user_id INTEGER REFERENCES users(id),PRIMARY KEY(issue_id,user_id));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,issue_id INTEGER REFERENCES issues(id),body TEXT,user_id INTEGER REFERENCES users(id),created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY,title TEXT,description TEXT,category TEXT,location TEXT,lat REAL,lng REAL,user_id INTEGER REFERENCES users(id),volunteer_id INTEGER REFERENCES users(id),status TEXT DEFAULT 'Open',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,title TEXT,body TEXT,user_id INTEGER REFERENCES users(id),created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS replies(id INTEGER PRIMARY KEY,post_id INTEGER REFERENCES posts(id),body TEXT,user_id INTEGER REFERENCES users(id),created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS likes(post_id INTEGER REFERENCES posts(id),user_id INTEGER REFERENCES users(id),PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),body TEXT,read INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),lat REAL,lng REAL,status TEXT DEFAULT 'Active',created TEXT DEFAULT CURRENT_TIMESTAMP);
`;
db.exec(schema);
if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='area'))db.exec("ALTER TABLE users ADD COLUMN area TEXT NOT NULL DEFAULT 'Pune neighbourhood'");
const context = new AsyncLocalStorage();
const sandboxes = new Map();
const activeDb = () => context.getStore()?.db || db;
const run = (sql, ...args) => activeDb().prepare(sql).run(...args);
const get = (sql, ...args) => activeDb().prepare(sql).get(...args);
const all = (sql, ...args) => activeDb().prepare(sql).all(...args);
const cookies = req => Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(pair=>pair.length===2));
const sessionName = () => context.getStore()?.demo ? 'civiccare-demo-auth' : 'civiccare';
function setCookie(res,name,value,age=14400) {
  const previous=res.getHeader('Set-Cookie')||[];
  res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:[previous]),`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.COOKIE_SECURE==='1'?'; Secure':''}`]);
}
function hash(password) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
function check(password, saved) { const [salt, key] = saved.split(':'); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex')); }
function publicUser(u) { if (!u) return null; const { password, ...rest } = u; return rest; }
function notify(id, body) { run('INSERT INTO notifications(user_id,body) VALUES(?,?)', id, body); }
function points(id, n) { run('UPDATE users SET points=points+? WHERE id=?', n, id); }
export function distance(a, b, c, d) { const rad = Math.PI / 180; const x = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2; return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); }

function seedDatabase() { if (!get('SELECT id FROM users LIMIT 1')) {
  const residents = [['Aarav Patil','resident@civiccare.local','resident',80,18.5204,73.8567,0,'Elder support'],['Meera Shah','volunteer@civiccare.local','volunteer',160,18.522,73.854,1,'Elder support,Community cleanup,Errands'],['Municipal Coordinator','admin@civiccare.local','admin',0,18.5204,73.8567,0,''],['Rohan Deshmukh','rohan@civiccare.local','volunteer',120,18.516,73.859,1,'Community cleanup,Errands']];
  for (const [name,email,role,p,lat,lng,available,skills] of residents) run('INSERT INTO users(name,email,password,role,points,lat,lng,available,skills) VALUES(?,?,?,?,?,?,?,?,?)',name,email,hash('CivicCare123!'),role,p,lat,lng,available,skills);
  const seed = [
    ['Streetlight out near the garden','The streetlight beside the garden entrance has been out for three evenings. The pathway is very dark after sunset.','Streetlights','Sarasbaug, Pune',18.509,73.853,'In progress','Normal',1],
    ['Overflowing bins on FC Road','Waste bins near the bus stop need collection. Waste is spilling onto the footpath.','Waste','FC Road, Pune',18.524,73.842,'Verified','Normal',2],
    ['Pothole at the market junction','A large pothole is causing traffic to swerve at the junction. Please arrange a road inspection.','Roads','Shivaji Road, Pune',18.518,73.856,'Reported','High',1],
    ['Water leak beside the library','Water is leaking from a roadside pipe and collecting on the pavement.','Water','Deccan, Pune',18.519,73.841,'Reported','Normal',4],
    ['Footpath cleared near the school','The blocked footpath has been cleared after a community report.','Public spaces','Tilak Road, Pune',18.512,73.847,'Resolved','Normal',2]
  ];
  for (const row of seed) { const id = Number(run('INSERT INTO issues(title,description,category,location,lat,lng,status,priority,user_id) VALUES(?,?,?,?,?,?,?,?,?)',...row).lastInsertRowid); run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,'Report submitted to CivicCare',row[8]); if(row[6]!=='Reported') run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,`Status changed to ${row[6]}`,3); }
  run('INSERT INTO verifications VALUES(1,2)'); run('INSERT INTO verifications VALUES(2,1)'); run('INSERT INTO verifications VALUES(2,4)');
  run('INSERT INTO requests(title,description,category,location,lat,lng,user_id) VALUES(?,?,?,?,?,?,?)','Help with a grocery run','Looking for a neighbour who can help collect groceries tomorrow morning.','Errands','Sadashiv Peth, Pune',18.514,73.850,1);
  run('INSERT INTO requests(title,description,category,location,lat,lng,user_id) VALUES(?,?,?,?,?,?,?)','Saturday garden cleanup','Join a small community cleanup at the garden entrance this weekend. Gloves and bags will be provided.','Community cleanup','Sarasbaug, Pune',18.509,73.853,4);
  run('INSERT INTO requests(title,description,category,location,lat,lng,user_id) VALUES(?,?,?,?,?,?,?)','A walk and a little company','An older neighbour would appreciate company for a short evening walk.','Elder support','Deccan, Pune',18.519,73.841,1);
  run('INSERT INTO posts(title,body,user_id) VALUES(?,?,?)','A greener Saturday, together','Our neighbourhood cleanup is this Saturday at 8 am. Bring a water bottle and meet us at the garden entrance. Everyone is welcome!',2);
  run('INSERT INTO posts(title,body,user_id) VALUES(?,?,?)','What would make our streets safer?','Better lighting, clear footpaths, or safer crossings? Share one improvement you would like to see in our neighbourhood.',1);
  run('INSERT INTO replies(post_id,body,user_id) VALUES(?,?,?)',2,'A pedestrian crossing near the market would make a big difference.',4);
  notify(1,'Welcome to CivicCare. Explore the sample neighbourhood or report your first issue.');
} }
seedDatabase();

const categories = ['Roads','Waste','Water','Streetlights','Public spaces','Other'];
const helpCategories = ['Elder support','Community cleanup','Errands'];
class ApiError extends Error { constructor(status,message) { super(message); this.status=status; } }
const need = (condition,status,message) => { if(!condition) throw new ApiError(status,message); };
function str(b,k,min=1,max=2000) { need(typeof b[k]==='string',400,`${k} is required`); const s=b[k].trim(); need(s.length>=min&&s.length<=max,400,`${k} must be ${min}–${max} characters`); return s; }
function coords(b) { need(Number.isFinite(b.lat)&&Number.isFinite(b.lng)&&Math.abs(b.lat)<=90&&Math.abs(b.lng)<=180,400,'Enter valid latitude and longitude'); return [b.lat,b.lng]; }
async function body(req) { let content=''; for await (const chunk of req) { content+=chunk; need(Buffer.byteLength(content)<=2200000,413,'Request is too large'); } try { return content?JSON.parse(content):{}; } catch { throw new ApiError(400,'Invalid JSON'); } }
const attempts=new Map();
function auth(req) { const token=cookies(req)[sessionName()]; return token?get('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',token,Date.now()):null; }
function login(res,user) { const token=randomBytes(32).toString('hex'); run('DELETE FROM sessions WHERE expires<?',Date.now()); run('INSERT INTO sessions VALUES(?,?,?)',token,user.id,Date.now()+7*86400000); setCookie(res,sessionName(),token,604800); return {user:publicUser(user),demo:Boolean(context.getStore()?.demo)}; }
function issueList(uid) { return all(`SELECT i.*,u.name AS author,(SELECT COUNT(*) FROM verifications v WHERE v.issue_id=i.id) AS confirmations,EXISTS(SELECT 1 FROM verifications v WHERE v.issue_id=i.id AND v.user_id=?) AS confirmed FROM issues i JOIN users u ON u.id=i.user_id ORDER BY i.id DESC`,uid); }
async function api(req,res,url) {
  const method=req.method, pathname=url.pathname;
  if(!['GET','HEAD'].includes(method)) { const origin=req.headers.origin; need(!origin||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`,403,'Request origin is not allowed'); }
  if(method==='GET'&&pathname==='/api/health') return {ok:true};
  if(method==='GET'&&pathname==='/api/me') {if(cookies(req)['civiccare-demo']&&!context.getStore()?.demo){setCookie(res,'civiccare-demo','',0);setCookie(res,'civiccare-demo-auth','',0);}return {user:publicUser(auth(req)),demo:Boolean(context.getStore()?.demo)};}
  if(method==='POST'&&pathname==='/api/demo/exit') {setCookie(res,'civiccare-demo','',0);setCookie(res,'civiccare-demo-auth','',0);return {ok:true};}
  if(method==='POST'&&['/api/demo/start','/api/demo/role','/api/demo/reset'].includes(pathname)) {
    const b=await body(req),role=b.role||'resident';need(['resident','volunteer','admin','witness'].includes(role),400,'Choose a demo role');
    let store=context.getStore();
    if(pathname!=='/api/demo/start')need(store?.demo&&auth(req),403,'Enter the practice demo first');
    if(!store?.demo||pathname==='/api/demo/reset'){
      for(const [key,entry] of sandboxes)if(entry.expires<Date.now()&&!entry.pending){entry.db.close();sandboxes.delete(key);}
      need(sandboxes.size<50||store?.demo,429,'Demo capacity reached. Please try later.');
      const id=store?.id||randomBytes(24).toString('hex'),database=new DatabaseSync(':memory:');database.exec(schema);
      store={id,workspace:randomBytes(12).toString('hex'),db:database,demo:true,expires:Date.now()+4*3600000,pending:0};
      context.run(store,seedDatabase);sandboxes.set(id,store);setCookie(res,'civiccare-demo',id);
    }
    return context.run(store,()=>login(res,get('SELECT * FROM users WHERE email=?',role==='witness'?'rohan@civiccare.local':`${role}@civiccare.local`)));
  }
  if(method==='POST'&&['/api/login','/api/register'].includes(pathname)) {
    const key=req.socket.remoteAddress; const attempt=attempts.get(key)||{count:0,until:Date.now()+60000}; if(attempt.until<Date.now()){attempt.count=0;attempt.until=Date.now()+60000;} attempts.set(key,attempt); need(++attempt.count<=30,429,'Too many attempts. Please try again in a minute.');
    const b=await body(req), email=str(b,'email',5,254).toLowerCase(), password=str(b,'password',10,128); need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),400,'Enter a valid email address');
    if(pathname==='/api/register') { const name=str(b,'name',2,80); need(!get('SELECT id FROM users WHERE email=?',email),409,'That email is already registered'); const id=Number(run('INSERT INTO users(name,email,password) VALUES(?,?,?)',name,email,hash(password)).lastInsertRowid); return login(res,get('SELECT * FROM users WHERE id=?',id)); }
    const u=get('SELECT * FROM users WHERE email=?',email); need(u&&check(password,u.password),401,'Email or password is incorrect'); return login(res,u);
  }
  const user=auth(req); need(user,401,'Please sign in to continue');
  if(method==='POST'&&pathname==='/api/places/search'){const b=await body(req);return {results:await lookupPlaces(b.query)};}
  if(method==='POST'&&pathname==='/api/logout') { run('DELETE FROM sessions WHERE user_id=?',user.id);setCookie(res,sessionName(),'',0);if(context.getStore()?.demo)setCookie(res,'civiccare-demo','',0);return {ok:true}; }
  if(method==='GET'&&pathname==='/api/dashboard') {
    const issues=issueList(user.id); const requests=all('SELECT r.*,u.name AS author,v.name AS volunteer FROM requests r JOIN users u ON u.id=r.user_id LEFT JOIN users v ON v.id=r.volunteer_id ORDER BY r.id DESC').map(r=>({...r,distance:distance(user.lat,user.lng,r.lat,r.lng),matched:Boolean(user.available&&user.skills.split(',').map(s=>s.trim()).includes(r.category)&&distance(user.lat,user.lng,r.lat,r.lng)<=user.radius)}));
    const posts=all(`SELECT p.*,u.name AS author,(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes,EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC`,user.id);
    return {demo:Boolean(context.getStore()?.demo),demoWorkspace:context.getStore()?.workspace||null,user:publicUser(get('SELECT * FROM users WHERE id=?',user.id)),issues,requests,posts,notifications:all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50',user.id),volunteers:all("SELECT id,name,points,available,skills FROM users WHERE role='volunteer' OR available=1 ORDER BY points DESC"),alerts:all('SELECT * FROM alerts WHERE user_id=? ORDER BY id DESC',user.id)};
  }
  if(method==='PATCH'&&pathname==='/api/location') {
    const b=await body(req);const [lat,lng]=coords(b);
    const area=typeof b.area==='string'?str(b,'area',0,80):'';
    run('UPDATE users SET lat=?,lng=?,area=? WHERE id=?',lat,lng,area||`Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,user.id);
    return {user:publicUser(get('SELECT * FROM users WHERE id=?',user.id))};
  }
  if(method==='PATCH'&&pathname==='/api/profile') {
    const b=await body(req);const [lat,lng]=coords(b);need(Number.isFinite(b.radius)&&b.radius>=0.5&&b.radius<=50,400,'Choose a radius between 0.5 and 50 km'); const skills=str(b,'skills',0,150);need(skills.split(',').filter(Boolean).every(s=>helpCategories.includes(s.trim())),400,'Choose supported services'); need(typeof b.available==='boolean',400,'Availability must be true or false');const name=str(b,'name',2,80),contact=str(b,'contact',0,120);
    const area=b.area===undefined?user.area:str(b,'area',0,80);
    run('UPDATE users SET name=?,lat=?,lng=?,area=?,radius=?,skills=?,available=?,contact=?,role=CASE WHEN role=\'resident\' AND ?=1 THEN \'volunteer\' ELSE role END WHERE id=?',name,lat,lng,area||`Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,b.radius,skills,Number(b.available),contact,Number(b.available),user.id); return {ok:true};
  }
  if(method==='POST'&&pathname==='/api/issues') {
    const b=await body(req),title=str(b,'title',5,120),description=str(b,'description',10,2000),location=str(b,'location',3,160); const [lat,lng]=coords(b); need(categories.includes(b.category),400,'Choose an issue category');need(['Normal','High'].includes(b.priority),400,'Choose a valid priority');const photo=b.photo||'';need(typeof photo==='string'&&photo.length<=2000000&&(!photo||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)),400,'Upload a JPG, PNG or WebP image smaller than 1.4 MB');
    const duplicates=all("SELECT id,title,lat,lng,category FROM issues WHERE status!='Resolved'").filter(i=>i.category===b.category&&distance(lat,lng,i.lat,i.lng)<0.1);
    if(duplicates.length&&!b.confirmDuplicate) return {duplicates};
    const id=Number(run('INSERT INTO issues(title,description,category,location,lat,lng,priority,photo,user_id) VALUES(?,?,?,?,?,?,?,?,?)',title,description,b.category,location,lat,lng,b.priority,photo,user.id).lastInsertRowid);run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,'Report submitted to CivicCare',user.id);points(user.id,10);notify(user.id,`Your report #${id} has been recorded: ${title}`); return {id};
  }
  let match=pathname.match(/^\/api\/issues\/(\d+)(?:\/(verify|status|comments))?$/);
  if(match) { const id=Number(match[1]),action=match[2],issue=get('SELECT * FROM issues WHERE id=?',id);need(issue,404,'Issue not found');
    if(method==='GET'&&!action) return {issue:issueList(user.id).find(i=>i.id===id),events:all('SELECT e.*,u.name AS author FROM events e JOIN users u ON u.id=e.user_id WHERE issue_id=? ORDER BY e.id',id)};
    if(method==='POST'&&action==='verify') { need(issue.user_id!==user.id,400,'Other residents must verify your report');need(issue.status!=='Resolved',409,'This issue is already resolved');need(!get('SELECT 1 FROM verifications WHERE issue_id=? AND user_id=?',id,user.id),409,'You have already confirmed this issue');run('INSERT INTO verifications VALUES(?,?)',id,user.id);points(user.id,5);if(get('SELECT COUNT(*) AS n FROM verifications WHERE issue_id=?',id).n>=2&&issue.status==='Reported'){run("UPDATE issues SET status='Verified' WHERE id=?",id);run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,'Confirmed by two community members',user.id);}notify(issue.user_id,`${user.name} confirmed your report #${id}.`);return {ok:true}; }
    if(method==='PATCH'&&action==='status') {need(user.role==='admin',403,'Only coordinators can change issue status');const b=await body(req);need(['Reported','Verified','In progress','Resolved'].includes(b.status),400,'Choose a valid status');run('UPDATE issues SET status=? WHERE id=?',b.status,id);run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,`Status changed to ${b.status}${b.note?' — '+str(b,'note',1,500):''}`,user.id);notify(issue.user_id,`Report #${id} is now ${b.status.toLowerCase()}.`);return {ok:true}; }
    if(method==='POST'&&action==='comments') {const b=await body(req);run('INSERT INTO events(issue_id,body,user_id) VALUES(?,?,?)',id,str(b,'body',2,1000),user.id);if(user.id!==issue.user_id)notify(issue.user_id,`New update on report #${id}.`);return {ok:true};}
  }
  if(method==='POST'&&pathname==='/api/requests') {const b=await body(req);const [lat,lng]=coords(b);need(helpCategories.includes(b.category),400,'Choose a support category');const title=str(b,'title',5,120),description=str(b,'description',10,2000),location=str(b,'location',3,160);const id=Number(run('INSERT INTO requests(title,description,category,location,lat,lng,user_id) VALUES(?,?,?,?,?,?,?)',title,description,b.category,location,lat,lng,user.id).lastInsertRowid);for(const v of all('SELECT * FROM users WHERE available=1'))if(v.id!==user.id&&v.skills.split(',').map(s=>s.trim()).includes(b.category)&&distance(lat,lng,v.lat,v.lng)<=v.radius)notify(v.id,`A nearby neighbour needs help: ${title}`);return {id};}
  match=pathname.match(/^\/api\/requests\/(\d+)\/(accept|complete|cancel)$/);
  if(method==='POST'&&match){const id=Number(match[1]),r=get('SELECT * FROM requests WHERE id=?',id);need(r,404,'Request not found');
    if(match[2]==='accept'){need(r.status==='Open',409,'This request is no longer open');need(r.user_id!==user.id,400,'You cannot accept your own request');need(user.available&&user.skills.split(',').map(s=>s.trim()).includes(r.category)&&distance(user.lat,user.lng,r.lat,r.lng)<=user.radius,403,'Enable availability and a matching service radius in your profile');run("UPDATE requests SET volunteer_id=?,status='Accepted' WHERE id=?",user.id,id);notify(r.user_id,`${user.name} accepted your request: ${r.title}`);}
    if(match[2]==='complete'){need(r.user_id===user.id,403,'Only the requester can confirm completion');need(r.status==='Accepted',409,'Only accepted requests can be completed');run("UPDATE requests SET status='Completed' WHERE id=?",id);points(r.volunteer_id,25);notify(r.volunteer_id,`Your help was confirmed complete. Thank you! +25 points.`);}
    if(match[2]==='cancel'){need(r.user_id===user.id,403,'Only the requester can cancel');need(['Open','Accepted'].includes(r.status),409,'Request is already closed');run("UPDATE requests SET status='Cancelled' WHERE id=?",id);if(r.volunteer_id)notify(r.volunteer_id,`The request "${r.title}" was cancelled.`);}return {ok:true};}
  if(method==='POST'&&pathname==='/api/posts'){const b=await body(req);return {id:Number(run('INSERT INTO posts(title,body,user_id) VALUES(?,?,?)',str(b,'title',5,120),str(b,'body',10,2000),user.id).lastInsertRowid)};}
  match=pathname.match(/^\/api\/posts\/(\d+)(?:\/(like|replies))?$/);
  if(match){const id=Number(match[1]);need(get('SELECT id FROM posts WHERE id=?',id),404,'Discussion not found');if(method==='GET')return {replies:all('SELECT r.*,u.name AS author FROM replies r JOIN users u ON u.id=r.user_id WHERE post_id=? ORDER BY r.id',id)};if(method==='POST'&&match[2]==='like'){if(get('SELECT 1 FROM likes WHERE post_id=? AND user_id=?',id,user.id))run('DELETE FROM likes WHERE post_id=? AND user_id=?',id,user.id);else run('INSERT INTO likes VALUES(?,?)',id,user.id);return {ok:true};}if(method==='POST'&&match[2]==='replies'){const b=await body(req);run('INSERT INTO replies(post_id,body,user_id) VALUES(?,?,?)',id,str(b,'body',2,1000),user.id);return {ok:true};}}
  if(method==='POST'&&pathname==='/api/notifications/read'){run('UPDATE notifications SET read=1 WHERE user_id=?',user.id);return {ok:true};}
  if(method==='POST'&&pathname==='/api/sos'){const b=await body(req);const [lat,lng]=coords(b);need(b.demo===true,400,'Only demo community alerts are supported');need(!get("SELECT id FROM alerts WHERE user_id=? AND status='Active'",user.id),409,'You already have an active demo alert');const id=Number(run('INSERT INTO alerts(user_id,lat,lng) VALUES(?,?,?)',user.id,lat,lng).lastInsertRowid);notify(user.id,'Demo SOS recorded. No emergency service, SMS or push notification was contacted.');return {id,demo:true};}
  match=pathname.match(/^\/api\/sos\/(\d+)\/cancel$/);if(method==='POST'&&match){need(get("SELECT id FROM alerts WHERE id=? AND user_id=? AND status='Active'",Number(match[1]),user.id),404,'Active alert not found');run("UPDATE alerts SET status='Cancelled' WHERE id=?",Number(match[1]));return {ok:true};}
  throw new ApiError(404,'Endpoint not found');
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
export const server=http.createServer(async(req,res)=>{try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; form-action 'self'");
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    res.setHeader('Cache-Control','no-store');const demoId=cookies(req)['civiccare-demo'];const store=sandboxes.get(demoId);
    if(demoId&&(!store||store.expires<Date.now())&&!['/api/demo/start','/api/demo/exit','/api/me','/api/health'].includes(url.pathname))throw new ApiError(401,'Practice demo expired. Exit and start a new demo.');
    const selected=store&&store.expires>Date.now()?store:{db,demo:false};if(selected.demo)selected.pending++;
    let result;try{result=await context.run(selected,()=>api(req,res,url));}finally{if(selected.demo){selected.pending--;if(!selected.pending&&sandboxes.get(selected.id)!==selected)selected.db.close();}}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
  }
  need(req.method==='GET'||req.method==='HEAD',405,'Method not allowed');const requested=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);const file=path.resolve(root,'public','.'+requested);need(file.startsWith(path.join(root,'public')+path.sep)&&existsSync(file),404,'File not found');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
}catch(err){res.writeHead(err.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:err.status?err.message:'Something went wrong. Please try again.'}));if(!err.status)console.error(err);}});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT)||3000;server.listen(port,'127.0.0.1',()=>console.log(`CivicCare is running at http://localhost:${port}`));}
