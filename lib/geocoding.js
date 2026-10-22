// User-triggered, cached place search. Device coordinates are not sent here.
export function createPlaceLookup({transport=fetch,endpoint=process.env.PHOTON_URL||'https://photon.komoot.io/api/'}={}){
 const cache=new Map();let lastRequest=0;
 return async query=>{
  const text=typeof query==='string'?query.trim():'';
  if(text.length<3||text.length>120)throw Object.assign(new Error('Enter a city or landmark using 3–120 characters.'),{status:400});
  const key=text.toLowerCase(),cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return cached.results;
  if(Date.now()-lastRequest<1100)throw Object.assign(new Error('Please wait a moment before searching again.'),{status:429});
  lastRequest=Date.now();
  const url=new URL(endpoint);url.searchParams.set('q',text);url.searchParams.set('limit','6');url.searchParams.set('lang','en');
  try{
   const response=await transport(url,{headers:{'User-Agent':'CivicCare-LocalPrototype/1.0','Accept':'application/json'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('Provider unavailable');
   const data=await response.json();
   if(!Array.isArray(data.features))throw new Error('Unexpected provider response');
   const results=data.features.slice(0,6).filter(f=>f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)&&Number.isFinite(f.geometry.coordinates[0])&&Number.isFinite(f.geometry.coordinates[1])&&Math.abs(f.geometry.coordinates[0])<=180&&Math.abs(f.geometry.coordinates[1])<=90).map(f=>{
    const p=f.properties||{},parts=[p.name,p.street,p.district,p.city,p.state,p.country].filter(v=>typeof v==='string'&&v.trim());
    const label=[...new Set(parts)].join(', ')||'Unnamed location';
    return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],label,area:(p.name||p.city||label).slice(0,80)};
   });
   if(cache.size>=500)cache.delete(cache.keys().next().value);
   cache.set(key,{expires:Date.now()+86400000,results});return results;
  }catch{throw Object.assign(new Error('Place search is unavailable right now. Try again, use your device location, or enter coordinates.'),{status:502});}
 };
}
