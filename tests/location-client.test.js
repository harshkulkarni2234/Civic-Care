import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the actual device-location handlers against a small detached form fixture.
// No device permission, real GPS reading or external service is needed.
const source=readFileSync(new URL('../public/experience.js',import.meta.url),'utf8');
const deviceSource=source.slice(source.indexOf('function deviceLocation(){'),source.indexOf('function placeSearchUi(){'));
const formSource=source.slice(source.indexOf('async function locateForForm(button){'),source.indexOf("document.addEventListener('change',e=>{if(['lat','lng']"));
function setup({profile=true,denied=false,edited=false}={}){
 const calls=[],status={textContent:''},elements={lat:{value:'18.52'},lng:{value:'73.85'},area:{value:edited?'New neighbourhood':'Old neighbourhood'}};
 const form={id:profile?'profile-form':'report-form',isConnected:true,elements},button={disabled:false,closest:()=>form};
 const state={user:{area:'Old neighbourhood'}};let refreshed=false,previewed=false,geoOptions;
 const context=vm.createContext({
  navigator:{geolocation:{getCurrentPosition:(success,error,options)=>{geoOptions=options;if(denied)error({code:1});else success({coords:{latitude:22.5726459,longitude:88.3638953}});}}},
  document:{getElementById:()=>status},state,
  api:async(route,method,b)=>{calls.push({route,method,b});state.user={...state.user,...b};},
  refresh:async render=>{refreshed=render===false;},previewProfileLocation:()=>{previewed=true;},toast:()=>{}
 });
 vm.runInContext(deviceSource+'\n'+formSource,context);
 return {run:()=>context.locateForForm(button),calls,status,elements,button,flags:()=>({refreshed,previewed,geoOptions})};
}
test('profile device location saves immediately without a second submit',async()=>{
 const f=setup();await f.run();assert.equal(f.calls.length,1);assert.equal(f.calls[0].route,'/location');assert.equal(f.calls[0].method,'PATCH');assert.equal(f.calls[0].b.lat,22.572646);assert.equal(f.calls[0].b.lng,88.363895);assert.equal(f.calls[0].b.area,'Current location');assert.equal(f.elements.lat.value,22.572646);assert.ok(f.flags().refreshed&&f.flags().previewed);assert.equal(f.flags().geoOptions.maximumAge,0);assert.equal(f.button.disabled,false);assert.match(f.status.textContent,/Location saved/);
});
test('an edited neighbourhood name is preserved when saving device coordinates',async()=>{
 const f=setup({edited:true});await f.run();assert.equal(f.calls[0].b.area,'New neighbourhood');
});
test('incident forms receive GPS coordinates without overwriting the profile location',async()=>{
 const f=setup({profile:false});await f.run();assert.equal(f.calls.length,0);assert.equal(f.elements.lng.value,88.363895);assert.equal(f.button.disabled,false);
});
test('denied device permission keeps saved coordinates and gives a usable fallback',async()=>{
 const f=setup({denied:true});await assert.rejects(f.run(),/Location access was denied/);assert.equal(f.calls.length,0);assert.equal(f.elements.lat.value,'18.52');assert.match(f.status.textContent,/enter coordinates/);assert.equal(f.button.disabled,false);
});
