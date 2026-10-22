import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceLookup} from '../lib/geocoding.js';
const fixture={features:[{geometry:{type:'Point',coordinates:[88.3639,22.5726]},properties:{name:'Kolkata',city:'Kolkata',state:'West Bengal',country:'India'}},{geometry:{type:'Point',coordinates:[500,100]},properties:{name:'Invalid record'}}]};
test('place search returns correct latitude/longitude and caches repeated queries',async()=>{
 let calls=0;const lookup=createPlaceLookup({transport:async url=>{calls++;assert.equal(url.searchParams.get('q'),'Kolkata');assert.equal(url.searchParams.get('limit'),'6');return {ok:true,json:async()=>fixture};}});
 const result=await lookup(' Kolkata ');assert.equal(result.length,1);assert.equal(result[0].lat,22.5726);assert.equal(result[0].lng,88.3639);assert.equal(result[0].label,'Kolkata, West Bengal, India');
 assert.deepEqual(await lookup('kolkata'),result);assert.equal(calls,1);
 await assert.rejects(lookup('Mumbai'),error=>error.status===429);
});
test('place search rejects invalid input before contacting the provider',async()=>{
 let calls=0;const lookup=createPlaceLookup({transport:async()=>{calls++;}});
 await assert.rejects(lookup('ab'),error=>error.status===400);await assert.rejects(lookup('x'.repeat(121)),error=>error.status===400);assert.equal(calls,0);
});
test('provider errors return an actionable fallback rather than a wrong marker',async()=>{
 const unavailable=createPlaceLookup({transport:async()=>({ok:false})});await assert.rejects(unavailable('Kolkata'),error=>error.status===502&&error.message.includes('enter coordinates'));
 const malformed=createPlaceLookup({transport:async()=>({ok:true,json:async()=>({notFeatures:[]})})});await assert.rejects(malformed('Kolkata'),error=>error.status===502);
 const empty=createPlaceLookup({transport:async()=>({ok:true,json:async()=>({features:[]})})});assert.deepEqual(await empty('Kolkata'),[]);
});
