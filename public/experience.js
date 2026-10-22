// Presentation, guided tours and isolated practice-demo controls.
let design = localStorage.getItem('civiccare-design-v2') || 'pulse';
if (!['pulse','atlas','board'].includes(design)) design='pulse';
document.body.dataset.design=design;
const designNames={pulse:'City Pulse',atlas:'Map First',board:'Community Board'};
const tour={running:false,index:0,steps:[],frame:0};
let practice={issue:null,request:null,reportStep:0,helpStep:0};
let practiceWorkspace=null;
function syncPractice(){
 if(practiceWorkspace===state.demoWorkspace)return;
 practiceWorkspace=state.demoWorkspace;
 practice={issue:null,request:null,reportStep:0,helpStep:0};
 if(!practiceWorkspace)return;
 try{const saved=JSON.parse(sessionStorage.getItem('civiccare-practice-'+practiceWorkspace));if(saved&&Number.isInteger(saved.reportStep)&&saved.reportStep>=0&&saved.reportStep<=5&&Number.isInteger(saved.helpStep)&&saved.helpStep>=0&&saved.helpStep<=3)practice=saved;}catch{/* Optional scenario progress. */}
}
function savedArea(){return state?.user?.area||'Your neighbourhood';}
function savePractice(){if(practiceWorkspace)sessionStorage.setItem('civiccare-practice-'+practiceWorkspace,JSON.stringify(practice));}

function demoStrip(){return `<section class="demo-strip" aria-label="Practice demo controls"><div><span class="demo-indicator"></span><strong>${state.demo?'PRACTICE DEMO':'LOCAL WORKSPACE'}</strong><span>${state.demo?'Fictional data. Your changes stay in a separate sandbox.':'Explore safely in a separate practice workspace.'}</span></div><div class="demo-strip-actions">${state.demo?`<label class="demo-role-label"><span class="screenreader">Demo role</span><select id="demo-role" aria-label="Demo role"><option value="resident" ${state.user.id===1?'selected':''}>Resident · Aarav</option><option value="volunteer" ${state.user.id===2?'selected':''}>Volunteer · Meera</option><option value="witness" ${state.user.id===4?'selected':''}>Neighbour · Rohan</option><option value="admin" ${state.user.id===3?'selected':''}>Coordinator</option></select></label><button data-experience="lab">Try a scenario</button><button data-experience="reset">Reset demo</button><button data-experience="exit">Exit</button>`:`<button data-experience="enter">Enter practice demo →</button>`}</div></section>`;}

function renderWorkspace(){
  if(!state)return;
  const unread=state.notifications.filter(n=>!n.read).length;
  app.innerHTML=`<div class="city-shell"><header class="city-header"><button class="city-brand" data-view="home" aria-label="CivicCare overview">${logo()}<span class="brand-divider"></span><span class="brand-descriptor">YOUR CITY.<br>YOUR SAY.</span></button><div class="city-header-actions"><button class="design-launch" data-experience="design">${icon('leaf')}<span>${designNames[design]}</span></button><button class="icon-button" data-action="senior" aria-label="Toggle easy mode" aria-pressed="${senior}">${icon('access')}</button><button class="icon-button" data-action="notifications" aria-label="Notifications${unread?', '+unread+' unread':''}">${icon('bell')}${unread?'<i class="notification-dot"></i>':''}</button><button class="avatar" data-view="profile" aria-label="Your profile">${initials(state.user.name)}</button></div></header><div class="city-navigation"><nav class="city-nav" aria-label="Main navigation">${nav.map(([view,i,label])=>`<button data-view="${view}" class="${currentView===view?'active':''}" ${currentView===view?'aria-current="page"':''}>${icon(i)}<span>${view==='home'?'City pulse':view==='volunteer'?'Help nearby':view==='map'?'The map':label}</span></button>`).join('')}</nav><div class="tour-launchers"><button data-experience="quick" aria-label="Quick introduction">▷ <span>Quick introduction</span></button></div></div>${demoStrip()}<main class="city-content" id="view-content">${viewContent()}</main><footer class="city-footer"><span>CivicCare <b> / </b> Small actions. Shared progress.</span><span>${state.demo?'Practice workspace':'Local project'} · ${designNames[design]} edition</span></footer></div>`;
  applyBars();
  if(tour.running)requestAnimationFrame(()=>positionTour());
}

function urbanArt(){return `<div class="urban-art" aria-hidden="true"><svg viewBox="0 0 460 280"><defs><pattern id="street-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40" fill="none" stroke="#ffffff" stroke-opacity=".12"/></pattern></defs><rect width="460" height="280" fill="url(#street-grid)"/><path d="m25 213 96-43 63 30 114-85 137 51" fill="none" stroke="#8498ff" stroke-width="25"/><path d="m21 208 99-43 63 30 113-85 139 51" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="5 9" stroke-width="2"/><path d="M96 143v-47l34-18 35 18v47l-35 19Z" fill="#ced7ff"/><path d="m96 96 34 19 35-19m-35 19v47" fill="none" stroke="#6178e8" stroke-width="2"/><path d="M212 139V52l36-18 36 18v87l-36 18Z" fill="#8da4ff"/><path d="m212 52 36 18 36-18m-36 18v87m-27-88 19 10m-19 10 19 10m-19 10 19 10m-19 10 19 10m16-48 20-10m-20 30 20-10m-20 30 20-10" fill="none" stroke="#d9e0ff" stroke-width="3"/><path d="m324 209 0-65 32-17 34 17v65l-34 18Z" fill="#ffb088"/><path d="m324 144 32 18 34-18m-34 18v65m-24-61 16 9m-16 10 16 9m15-24 19-10m-19 30 19-10" fill="none" stroke="#ec8654" stroke-width="2"/><ellipse cx="74" cy="225" rx="18" ry="8" fill="#142fac"/><path d="M74 224v-44" stroke="#f8caa5" stroke-width="5"/><circle cx="74" cy="175" r="23" fill="#b7d47c"/><path d="M419 230v-45" stroke="#f8caa5" stroke-width="5"/><circle cx="419" cy="180" r="19" fill="#b7d47c"/><circle cx="296" cy="91" r="29" fill="#ff9b65"/><path d="m284 91 8 8 17-17" fill="none" stroke="#16265c" stroke-width="5" stroke-linecap="round"/><circle cx="171" cy="234" r="17" fill="#f0d573"/><path d="M171 225v18m-9-9h18" stroke="#1a3185" stroke-width="3"/></svg><div class="art-note"><i></i> A city in progress.<br><strong>Built by its people.</strong></div></div>`;}

function cityHome(){
  const open=state.issues.filter(i=>i.status!=='Resolved'),done=state.issues.length-open.length;
  const reports=state.issues.filter(i=>issueFilter==='All'||i.status===issueFilter);
  const issueSection=`<section class="pulse-issues" data-tour="reports"><div class="section-heading"><div><span class="section-index">01 / ON OUR STREETS</span><h2>What needs attention.</h2></div><button class="text-button" data-view="issues">All reports ${icon('arrow')}</button></div><div class="tabs" aria-label="Filter issues">${['All','Reported','In progress','Resolved'].map(s=>`<button class="chip ${issueFilter===s?'active':''}" data-filter="${s}">${s==='All'?'Latest':s}</button>`).join('')}</div><div class="issue-list">${reports.slice(0,3).map(issueCard).join('')||empty('No reports with this status yet.')}</div></section>`;
  const community=`<section class="board-conversations"><div class="section-heading"><div><span class="section-index">03 / NEIGHBOURHOOD VOICES</span><h2>The conversation.</h2></div><button class="text-button" data-view="community">Join in →</button></div>${state.posts.slice(0,2).map(p=>`<button class="conversation-preview" data-action="discussion" data-id="${p.id}"><span class="avatar">${initials(p.author)}</span><div><span class="small muted">${esc(p.author)} · ${date(p.created)}</span><h3>${esc(p.title)}</h3><p>${esc(p.body.slice(0,140))}${p.body.length>140?'…':''}</p></div>${icon('arrow')}</button>`).join('')}</section>`;
  const hero=`<section class="city-hero" data-tour="hero"><div class="city-hero-copy"><span class="hero-label"><i></i> ${esc(savedArea().toUpperCase())} / LOCAL EDITION</span><h1>Your city.<br>Your say.<span class="orange">Your impact.</span></h1><p>Hey ${esc(state.user.name.split(' ')[0])}. A safer street, a helping hand,<br class="desktop-break"> a better place to call home. Start right here.</p><div class="hero-actions"><button class="button coral" data-action="report">Report an issue ${icon('arrow')}</button><button class="hero-secondary" data-view="volunteer">Lend a hand ↗</button></div></div>${urbanArt()}</section>`;
  const score=`<div class="pulse-stats" data-tour="stats">${[[open.length,'Open reports','Every report is a starting point.'],[done,'Resolved','Visible progress on your streets.'],[state.volunteers.filter(v=>v.available).length,'Neighbours helping','A little time. A real difference.'],[state.user.points,'Your care points','Recognition for showing up.']].map(([n,l,s],j)=>`<div><span class="stat-order">0${j+1}</span><strong>${n}<i>${j===3?'✳':''}</i></strong><h3>${l}</h3><p>${s}</p></div>`).join('')}</div>`;
  const side=`<aside class="pulse-side"><section class="neighbourhood-window" data-tour="map"><div class="section-heading"><div><span class="section-index">YOUR PATCH</span><h2>Around the corner.</h2></div><button class="text-button" data-view="map" aria-label="Explore neighbourhood map">↗</button></div>${mapEmbed()}<div class="window-foot"><span>${icon('pin')} ${esc(savedArea())}</span><button data-view="map">Explore the map →</button></div></section><section class="pulse-help" data-tour="help"><div class="section-heading"><div><span class="section-index">02 / SHOW UP FOR SOMEONE</span><h2>A hand would help.</h2></div><button class="text-button" data-action="request" aria-label="Ask for help">${icon('plus')}</button></div>${state.requests.filter(r=>r.status==='Open').slice(0,2).map(r=>helpCard(r,true)).join('')||empty('No open requests right now.')}<button class="button secondary wide mt" data-view="volunteer">See ways to help ${icon('arrow')}</button></section></aside>`;
  const welcome=`<div class="pulse-welcome"><button class="saved-location" data-view="profile" title="Change your saved location">${icon('pin')} ${esc(savedArea())} <span class="location-live">● LOCAL</span></button><button class="sos-button" data-action="sos">${icon('sos')}Community SOS · demo</button></div>`;
  if(design==='atlas')return `${welcome}<div class="atlas-intro"><span class="section-index">MAP FIRST / LOCAL VIEW</span><h1>Your neighbourhood,<br>one place at a time.</h1><p>Find an issue, check its location, and help move it forward.</p><button class="button" data-action="report">${icon('plus')}Report an issue</button></div><div class="atlas-layout"><section class="atlas-map" data-tour="hero">${mapEmbed(null,true)}<div class="window-foot"><strong>${open.length} open reports in this workspace</strong><button class="text-button" data-view="map">Filter and locate reports →</button></div></section>${issueSection}</div>${score}<div class="board-bottom">${community}<section class="pulse-help" data-tour="help"><h2>Help nearby</h2>${state.requests.filter(r=>r.status==='Open').slice(0,2).map(r=>helpCard(r,true)).join('')}</section></div>`;
  if(design==='board')return `${welcome}<section class="board-hero" data-tour="hero"><div><span class="section-index">COMMUNITY BOARD / ${esc(savedArea().toUpperCase())}</span><h1>Good things happen<br>when neighbours connect.</h1><p>Welcome back, ${esc(state.user.name.split(' ')[0])}. There’s room for everyone here.</p></div><div class="board-hero-actions"><button class="button" data-action="new-post">Start a conversation ${icon('chat')}</button><button class="button secondary" data-action="report">Report an issue ${icon('pin')}</button></div></section>${score}<div class="board-layout">${community}${side}</div><div class="mt">${issueSection}</div>`;
  return `${welcome}${hero}${score}<div class="pulse-grid">${issueSection}${side}</div>${community}<section class="city-bottom-note"><span>✳</span><div><h2>Small actions add up.</h2><p>Report what you see. Confirm what you know. Help where you can.</p></div><button class="text-button" data-view="profile">Your contribution →</button></section>`;
}

function renderWelcome(register=false){
 app.innerHTML=`<div class="welcome-shell"><header class="city-header">${logo()}<button class="design-launch" data-experience="design">Explore UI designs ↗</button></header><main class="welcome-grid"><section class="welcome-story"><span class="section-index">CIVICCARE / A COMMUNITY IN MOTION</span><h1>A city is more<br>than streets.<br><em>It’s us.</em></h1><p>Report what needs attention. Show up for a neighbour.<br>Make the place you call home a little better.</p>${urbanArt()}<span class="welcome-bottom">YOUR CITY. YOUR SAY. YOUR IMPACT.</span></section><section class="welcome-form"><div class="eyebrow">A better neighbourhood starts here</div><h2>${register?'Join your community.':'Make yourself at home.'}</h2><p>${register?'Create your own local account.':'Sign in to your workspace, or explore with a guided demo.'}</p><div class="demo-welcome"><span class="demo-tag">NO ACCOUNT NEEDED</span><h3>Take CivicCare for a spin.</h3><p>A real, interactive practice workspace. Try reporting, volunteering, and coordinating — then reset and start again.</p><button class="button" data-action="demo" data-role="resident">Launch practice demo ${icon('arrow')}</button><div class="demo-entry-roles"><button data-action="demo" data-role="volunteer">Explore as a volunteer</button><button data-action="demo" data-role="admin">Explore as a coordinator</button></div></div><div class="login-separator">OR SIGN IN</div><form id="auth-form" data-register="${register}">${register?'<div class="field"><label class="label" for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required minlength="2" maxlength="80"></div>':''}<div class="field"><label class="label" for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label class="label" for="password">Password</label><input id="password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="10" maxlength="128" required placeholder="At least 10 characters"></div><div class="form-error" role="alert"></div><button class="button secondary wide" type="submit">${register?'Create account':'Sign in'} ${icon('arrow')}</button></form><div class="login-switch">${register?'Already registered?':'New here?'}<button data-action="${register?'login':'register'}">${register?'Sign in':'Create an account'}</button></div></section></main></div>`;
}

function designPicker(){
 showModal(`<h2 class="modal-title">Give your neighbourhood a look.</h2><p class="modal-subtitle">Three working designs. Same features, a different way to explore.</p><div class="design-options">${[['pulse','City Pulse','Recommended','Bold blue, warm orange, an editorial city overview. Reports and community action share the spotlight.'],['atlas','Map First','Location led','A wide map starts the page. Ideal when finding nearby issues is your first task.'],['board','Community Board','People led','Warm paper tones, conversations first, and a neighbourly bulletin-board layout.']].map(([id,name,tag,text])=>`<button class="design-option ${design===id?'selected':''}" data-experience="choose-design" data-design="${id}" aria-pressed="${design===id}"><span class="design-mini ${id}"><i></i><b></b><em></em><s></s></span><div><span class="demo-tag">${tag}</span><h3>${name} ${design===id?'✓':''}</h3><p>${text}</p></div></button>`).join('')}</div><p class="form-hint">Your choice is saved in this browser. You can switch back any time.</p>`);
}

const quickSteps=[
 ['home','.demo-strip','Get started','Try it safely','Practice mode has separate fictional records. Switch roles or reset it without changing your saved workspace.'],
 ['issues','.heading-row .button','Report','See a problem? Share it.','Report what you saw, add its location, and follow the updates.','Try opening the report form. Close or submit it to continue.'],
 ['volunteer','.success-note','Help','A neighbour could use a hand','Choose your services and travel radius in your profile. Matching volunteers can accept a request.'],
 ['map','.map-location-tools','Your location','Put your neighbourhood on the map','Use my location saves and recentres the map immediately. You can also enter coordinates in your profile.'],
 ['home','.tour-launchers','All set','You’re ready to explore','Try a scenario, browse reports, or lend a hand. Replay this introduction whenever you need it.']
];
function maybeIntro(){if(!localStorage.getItem('civiccare-tour-v3'))startTour();}
function startTour(){modal.close();stopTour(false);tour.running=true;tour.index=0;tour.steps=quickSteps;showTourStep();}
function stopTour(mark=true){tour.running=false;cancelAnimationFrame(tour.frame);document.getElementById('civic-tour')?.remove();if(mark)localStorage.setItem('civiccare-tour-v3','seen');document.querySelector('[data-experience="quick"]')?.focus();}
function showTourStep(){
 const [view,selector,section,title,description,action]=tour.steps[tour.index];
 navigate(view);
 document.getElementById('civic-tour')?.remove();
 const layer=document.createElement('div');layer.id='civic-tour';layer.className='guided-tour';
 layer.innerHTML=`<div class="tour-blur" aria-hidden="true"><div></div><div></div><div></div><div></div></div><div class="tour-spotlight" aria-hidden="true"></div><section class="tour-coach" role="dialog" aria-modal="false" aria-labelledby="tour-title"><header><span>QUICK INTRODUCTION / ${tour.index+1} OF ${tour.steps.length}</span><button data-experience="tour-close" aria-label="Close guided demo">×</button></header><progress value="${tour.index+1}" max="${tour.steps.length}" aria-label="Tour progress"></progress><span class="section-index">${section}</span><h2 id="tour-title" tabindex="-1">${title}</h2><p>${description}</p>${action?`<div class="tour-try"><strong>YOUR TURN</strong><p>${action}</p></div>`:''}<footer><button data-experience="tour-back">${tour.index?'← Back':'Skip tour'}</button><button class="button" data-experience="tour-next">${tour.index===tour.steps.length-1?'Finish tour':'Next'} →</button></footer></section>`;
 document.body.append(layer);
 const target=document.querySelector(selector);
 if(target){const r=target.getBoundingClientRect();window.scrollBy({top:r.top-Math.max(100,innerHeight*.18),behavior:'instant'});}
 positionTour();document.getElementById('tour-title').focus({preventScroll:true});
}
function positionTour(){
 if(!tour.running)return;
 const layer=document.getElementById('civic-tour');if(!layer)return;
 layer.classList.toggle('tour-hidden',modal.open);
 const target=document.querySelector(tour.steps[tour.index][1]),ring=layer.querySelector('.tour-spotlight'),coach=layer.querySelector('.tour-coach');
 if(modal.open){ring.hidden=true;return;}
 if(!target){ring.hidden=true;paintTourBlur(layer,{left:0,top:0,right:0,bottom:0});return;}
 const r=target.getBoundingClientRect(),width=document.documentElement.clientWidth,height=innerHeight;
 ring.hidden=false;
 Object.assign(ring.style,{left:Math.max(4,r.left-5)+'px',top:Math.max(4,r.top-5)+'px',width:Math.min(width-8,r.width+10)+'px',height:Math.max(0,Math.min(height-8,r.bottom+5)-Math.max(4,r.top-5))+'px'});
 paintTourBlur(layer,{left:Math.max(4,r.left-5),top:Math.max(4,r.top-5),right:Math.min(width-4,r.right+5),bottom:Math.max(4,Math.min(height-4,r.bottom+5))});
 const cw=Math.min(380,width-24),ch=Math.min(coach.offsetHeight,height-24);
 let x=width-cw-18,y=height-ch-18;
 if(width>=800&&r.left>cw+30){x=18;y=Math.max(18,r.top);}
 else if(width>=800&&width-r.right>cw+25){x=r.right+16;y=Math.max(18,r.top);}
 else if(r.top>ch+24){y=12;}
 Object.assign(coach.style,{width:cw+'px',left:Math.max(12,x)+'px',top:Math.max(12,Math.min(y,height-ch-12))+'px',maxHeight:(height-24)+'px'});
}
function paintTourBlur(layer,r){
 const w=document.documentElement.clientWidth,h=innerHeight;
 const rectangles=[{left:0,top:0,width:w,height:r.top},{left:0,top:r.bottom,width:w,height:Math.max(0,h-r.bottom)},{left:0,top:r.top,width:r.left,height:Math.max(0,r.bottom-r.top)},{left:r.right,top:r.top,width:Math.max(0,w-r.right),height:Math.max(0,r.bottom-r.top)}];
 layer.querySelectorAll('.tour-blur>div').forEach((element,i)=>Object.assign(element.style,Object.fromEntries(Object.entries(rectangles[i]).map(([k,v])=>[k,v+'px']))));
}
window.addEventListener('resize',positionTour);window.addEventListener('scroll',()=>{cancelAnimationFrame(tour.frame);tour.frame=requestAnimationFrame(positionTour);},true);
modal.addEventListener('close',()=>{if(tour.running)positionTour();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tour.running&&!modal.open){e.preventDefault();stopTour();}});

function demoLab(){
 if(!state.demo){showModal(`<h2 class="modal-title">Try a real workflow.</h2><p class="modal-subtitle">Enter the separate practice demo to test scenarios.</p><button class="button" data-experience="enter">Enter practice demo →</button>`);return;}
 showModal(`<h2 class="modal-title">From “what if” to “try it”.</h2><p class="modal-subtitle">These scenarios run real actions in your practice database, switching roles along the way.</p><div class="scenario-card"><span class="section-index">01 / REPORT TO RESOLUTION</span><h3>A broken crossing signal.</h3><ol class="scenario-steps">${['Aarav reports the issue','Meera confirms what she saw','Rohan adds an independent confirmation','Coordinator starts work','Coordinator resolves the report'].map((s,i)=>`<li class="${practice.reportStep>i?'complete':''}">${practice.reportStep>i?'✓ ':''}${s}</li>`).join('')}</ol><button class="button" data-experience="scenario-report" ${practice.reportStep>=5?'disabled':''}>${practice.reportStep>=5?'Journey complete':'Run step '+(practice.reportStep+1)} →</button>${practice.issue?`<button class="text-button" data-action="issue" data-id="${practice.issue}">View report #${practice.issue} →</button>`:''}</div><div class="scenario-card"><span class="section-index">02 / A HELPING HAND</span><h3>A grocery run for a neighbour.</h3><ol class="scenario-steps">${['Aarav asks for help','Meera accepts a nearby matching request','Aarav confirms completion · Meera earns 25 points'].map((s,i)=>`<li class="${practice.helpStep>i?'complete':''}">${practice.helpStep>i?'✓ ':''}${s}</li>`).join('')}</ol><button class="button secondary" data-experience="scenario-help" ${practice.helpStep>=3?'disabled':''}>${practice.helpStep>=3?'Help complete':'Run step '+(practice.helpStep+1)} →</button></div><p class="form-hint">Prefer to do it yourself? Close this panel, switch Demo role, and use the normal forms. Reset demo clears practice changes only.</p>`);
}
async function switchDemo(role){await api('/demo/role','POST',{role});await refresh();}
async function runScenario(kind){
 if(kind==='report'){
  const step=practice.reportStep;
  if(step===0){await switchDemo('resident');const r=await api('/issues','POST',{title:'Practice: broken crossing signal',description:'Fictional scenario: the pedestrian crossing signal beside the market needs inspection.',category:'Streetlights',location:'Sample market crossing, Pune',lat:18.5204,lng:73.8567,priority:'High',confirmDuplicate:true});practice.issue=r.id;}
  else if(step===1||step===2){await switchDemo(step===1?'volunteer':'witness');await api(`/issues/${practice.issue}/verify`,'POST',{});}
  else {await switchDemo('admin');await api(`/issues/${practice.issue}/status`,'PATCH',{status:step===3?'In progress':'Resolved',note:step===3?'Demo coordinator assigned a site inspection.':'Demo scenario: signal repaired and checked.'});}
  practice.reportStep++;navigate('issues');
 }else{
  const step=practice.helpStep;
  if(step===0){await switchDemo('resident');const r=await api('/requests','POST',{title:'Practice: a grocery run',description:'Fictional request: collect a small grocery bag from the nearby shop this afternoon.',category:'Errands',location:'Sample shop, Pune',lat:18.5204,lng:73.8567});practice.request=r.id;}
  else if(step===1){await switchDemo('volunteer');await api(`/requests/${practice.request}/accept`,'POST',{});}
  else {await switchDemo('resident');await api(`/requests/${practice.request}/complete`,'POST',{});}
  practice.helpStep++;navigate('volunteer');
 }
 savePractice();await refresh();demoLab();toast('Step completed in your practice workspace.');
}
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-experience]');if(!button)return;const action=button.dataset.experience;
 try{
  if(action==='design')designPicker();
  if(action==='choose-design'){design=button.dataset.design;document.body.dataset.design=design;localStorage.setItem('civiccare-design-v2',design);modal.close();if(state){navigate('home');}else renderWelcome();toast(`${designNames[design]} selected.`);}
  if(action==='quick')startTour();
  if(action==='tour-close')stopTour();
  if(action==='tour-back'){if(tour.index===0)stopTour();else{tour.index--;showTourStep();}}
  if(action==='tour-next'){if(tour.index===tour.steps.length-1){stopTour();navigate('home');toast('You’re ready. Try a scenario or explore on your own.');}else{tour.index++;showTourStep();}}
  if(action==='enter'){stopTour(false);await api('/demo/start','POST',{role:'resident'});practice={issue:null,request:null,reportStep:0,helpStep:0};modal.close();currentView='home';await refresh();maybeIntro();}
  if(action==='exit'){stopTour();await api('/demo/exit','POST',{});modal.close();practice={issue:null,request:null,reportStep:0,helpStep:0};currentView='home';await start();toast('Practice demo closed. Your saved workspace is unchanged.');}
  if(action==='reset'){stopTour(false);showModal(`<h2 class="modal-title">A fresh practice workspace.</h2><p class="modal-subtitle">Restore the original fictional records and reset scenario progress. Your saved accounts and reports will stay as they are.</p><div class="form-actions"><button class="button secondary" data-action="close">Keep exploring</button><button class="button" data-experience="confirm-reset">Reset practice demo</button></div>`);}
  if(action==='confirm-reset'){await api('/demo/reset','POST',{role:'resident'});practice={issue:null,request:null,reportStep:0,helpStep:0};modal.close();currentView='home';await refresh();toast('Practice demo reset. Ready for another run.');}
  if(action==='lab')demoLab();
  if(action==='scenario-report'||action==='scenario-help'){button.disabled=true;await runScenario(action==='scenario-report'?'report':'help');}
 }catch(error){button.disabled=false;toast(error.message);}
});
document.addEventListener('change',async e=>{if(e.target.id==='demo-role'){try{await switchDemo(e.target.value);toast(`Now exploring as ${state.user.name}.`);}catch(error){toast(error.message);}}});
function deviceLocation(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Location is unavailable in this browser. Enter latitude and longitude in your profile.'));return;}
  navigator.geolocation.getCurrentPosition(resolve,error=>reject(new Error({1:'Location access was denied. Allow it in your browser settings, or enter coordinates in your profile.',2:'Your device could not find a location. Try again or enter coordinates in your profile.',3:'Finding your location took too long. Try again or enter coordinates in your profile.'}[error.code]||'Location is unavailable. Please try again.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
 });
}
function placeSearchUi(){return `<section class="place-search"><label class="label" for="place-query">Find your city or landmark</label><div class="place-search-input"><input id="place-query" name="placeQuery" placeholder="e.g. NMIMS Mumbai or Kolkata" minlength="3" maxlength="120" autocomplete="off"><button type="button" class="button" data-experience="search-place">${icon('search')}Search</button></div><p class="form-hint">Choose a result to save its location and update your maps. Search uses <a href="https://github.com/komoot/photon" target="_blank" rel="noopener noreferrer">Photon</a> with <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap data</a>.</p><div id="place-search-results" aria-live="polite"></div></section>`;}
function previewProfileLocation(form){
 const lat=Number(form.elements.lat.value),lng=Number(form.elements.lng.value);
 if(!form.elements.lat.value||!form.elements.lng.value||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
 const saved=lat===state.user.lat&&lng===state.user.lng;
 const preview=document.getElementById('profile-map-preview');
 if(preview)preview.innerHTML=`${mapEmbed({lat,lng,location:form.elements.area.value||'Selected location'})}<p class="form-hint">${saved?'Saved location':'Preview only — select Save preferences to update your maps'} · ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>`;
}
async function locateForForm(button){
 const form=button.closest('form');
 if(!form)throw new Error('Open your profile to set a location.');
 const isProfile=form.id==='profile-form',status=document.getElementById('profile-location-status');
 button.disabled=true;
 if(isProfile&&status)status.textContent='Finding your location…';
 try{
  const position=await deviceLocation();const lat=Number(position.coords.latitude.toFixed(6)),lng=Number(position.coords.longitude.toFixed(6));
  if(!form.isConnected)return;
  form.elements.lat.value=lat;form.elements.lng.value=lng;
  if(isProfile){
   const editedArea=form.elements.area.value.trim();const area=editedArea&&editedArea!==state.user.area?editedArea:'Current location';
   await api('/location','PATCH',{lat,lng,area});await refresh(false);form.elements.area.value=state.user.area;previewProfileLocation(form);
   status.textContent='Location saved. Your overview and neighbourhood map now use this marker.';toast('Location saved and maps updated.');
  }else toast('Coordinates updated for this form. Submit to record them.');
 }catch(error){if(isProfile&&status)status.textContent=error.message;throw error;}
 finally{button.disabled=false;}
}
document.addEventListener('change',e=>{if(['lat','lng'].includes(e.target.name)&&e.target.closest('#profile-form'))previewProfileLocation(e.target.closest('form'));});
let previewTimer;
document.addEventListener('input',e=>{
 if(!['lat','lng'].includes(e.target.name)||!e.target.closest('#profile-form'))return;
 const form=e.target.closest('form');clearTimeout(previewTimer);
 previewTimer=setTimeout(()=>{if(form.isConnected)previewProfileLocation(form);},350);
});
document.addEventListener('keydown',e=>{if(e.target.id==='place-query'&&e.key==='Enter'){e.preventDefault();e.target.closest('.place-search').querySelector('[data-experience="search-place"]').click();}});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-experience]');if(!button)return;
 if(button.dataset.experience==='centre-map'){
  document.getElementById('large-map').innerHTML=mapEmbed(null,true);document.getElementById('map-centre-label').textContent=savedArea();toast('Map centred on your saved location.');
 }
 if(button.dataset.experience==='map-gps'){
  button.disabled=true;const status=document.getElementById('map-location-status');status.textContent='Finding your location…';
  try{const position=await deviceLocation();await api('/location','PATCH',{lat:Number(position.coords.latitude.toFixed(6)),lng:Number(position.coords.longitude.toFixed(6)),area:'Current location'});await refresh();toast('Location saved. Map centred on your current location.');}
  catch(error){status.textContent=error.message;toast(error.message);}
  finally{button.disabled=false;}
 }
 if(button.dataset.experience==='search-place'){
  const panel=button.closest('.place-search'),query=panel.querySelector('#place-query').value.trim(),box=panel.querySelector('#place-search-results');
  if(query.length<3){box.textContent='Enter at least three characters, including a city for more specific results.';return;}
  button.disabled=true;box.textContent='Finding matching places…';
  try{const {results}=await api('/places/search','POST',{query});if(!panel.isConnected)return;box.innerHTML=results.length?`<p class="form-hint">Choose the place you mean:</p>${results.map(r=>`<button type="button" class="place-result" data-experience="choose-place" data-lat="${r.lat}" data-lng="${r.lng}" data-area="${esc(r.area)}">${icon('pin')}<span><strong>${esc(r.label)}</strong><small>${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</small></span>${icon('arrow')}</button>`).join('')}`:'No matching place found. Try a nearby city or a more specific landmark, or use coordinates below.';}
  catch(error){box.textContent=error.message;}
  finally{button.disabled=false;}
 }
 if(button.dataset.experience==='choose-place'){
  button.disabled=true;const form=button.closest('#profile-form');
  try{
   await api('/location','PATCH',{lat:Number(button.dataset.lat),lng:Number(button.dataset.lng),area:button.dataset.area});await refresh(!form);
   if(form?.isConnected){form.elements.lat.value=state.user.lat;form.elements.lng.value=state.user.lng;form.elements.area.value=state.user.area;previewProfileLocation(form);document.getElementById('profile-location-status').textContent='Selected location saved. Your maps now use this marker.';form.querySelector('#place-search-results').innerHTML='<p class="success-note">Location saved and maps updated.</p>';}
   toast('Location saved. Your maps have been updated.');
  }catch(error){button.disabled=false;toast(error.message);}
 }
});
// Keep the tour visible after renders, but put normal form dialogs above it.
const observeModal=new MutationObserver(()=>{if(tour.running)positionTour();});
observeModal.observe(modal,{attributes:true,attributeFilter:['open']});
start();
