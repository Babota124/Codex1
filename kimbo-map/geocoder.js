/* Открытые адресные данные: метка появляется только при точном адресе здания.
   Не использует коммерческие ключи, не ищет новых клиентов. */
'use strict';
(function(){
 const norm=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim().replace(/\s+/g,' ');
 const house=s=>norm(s).replace(/\s/g,'').replace(/a/g,'а').replace(/b/g,'б');
 const street=s=>norm(s).replace(/^(?:улица|ул\.?)\s+/,'').replace(/\s+(улица|ул\.?)$/,'');
 const locality=s=>norm(s).replace(/^(аул|а\.)\s*/,'');
 function target(p){const m=p.address.match(/ул\.\s*([^,]+),\s*([^,]+)$/i);if(!m||!p.address.includes('Псыж'))throw Error('Автопроверка поддерживает полный адрес в Псыже.');return {street:m[1],house:m[2]};}
 function matches(a,t){return street(a.street)===street(t.street)&&house(a.house)===house(t.house);}
 function polygon(g){return g&&['Polygon','MultiPolygon'].includes(g.type)&&Array.isArray(g.coordinates);}
 function insideRing(p,r){let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x,y]=r[i],[xx,yy]=r[j];if((y>p[1])!==(yy>p[1])&&p[0]<(xx-x)*(p[1]-y)/(yy-y)+x)hit=!hit;}return hit;}
 function inside(p,g){const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;return ps.some(r=>insideRing(p,r[0])&&!r.slice(1).some(h=>insideRing(p,h)));}
 function geometryCenter(g){const r=(g.type==='Polygon'?g.coordinates:g.coordinates[0])[0];if(r.length<4)return null;const pts=r.slice(0,-1);const pos=[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];return inside(pos,g)?pos:null;}
 async function request(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function unique(candidates){return [...new Map(candidates.map(c=>[c.sourceUrl,c])).values()];}
 async function overpass(){const query='[out:json][timeout:20];area["name"="Псыж"]["boundary"="administrative"]->.v;way(area.v)["building"]["addr:housenumber"];out geom;';const data=await request('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query));return (data.elements||[]).filter(e=>e.type==='way'&&e.tags?.building&&e.geometry?.length>=4&&e.geometry[0].lat===e.geometry.at(-1).lat&&e.geometry[0].lon===e.geometry.at(-1).lon).map(e=>({street:e.tags['addr:street'],house:e.tags['addr:housenumber'],geometry:{type:'Polygon',coordinates:[e.geometry.map(p=>[p.lon,p.lat])]},sourceUrl:'https://www.openstreetmap.org/way/'+e.id,method:'OSM: контур здания в административной границе Псыжа'}));}
 async function nominatim(p,t,byName=false){const q=byName?p.name+' '+p.address:p.address;const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&polygon_geojson=1&countrycodes=ru&limit=10&q='+encodeURIComponent(q);const data=await request(url);return data.filter(e=>{const a=e.address||{};return [a.village,a.town,a.city,a.hamlet,a.municipality].some(v=>locality(v)==='псыж')&&matches({street:a.road||a.pedestrian,house:a.house_number},t)&&polygon(e.geojson)&&(e.class==='building'||e.addresstype==='building'||e.type==='house');}).filter(e=>['way','relation'].includes(e.osm_type)&&/^\d+$/.test(String(e.osm_id))).map(e=>({street:t.street,house:t.house,geometry:e.geojson,sourceUrl:'https://www.openstreetmap.org/'+e.osm_type+'/'+e.osm_id,method:'Nominatim/OSM: точный населённый пункт, улица, номер и контур здания'}));}
 async function resolve(points,onProgress){let buildings=[],overpassError='';try{onProgress('Проверка адресных контуров Псыжа…');buildings=await overpass();}catch(e){overpassError=e.message;}
 const results=[];for(const p of points){onProgress('Проверка: '+p.name);try{const t=target(p);let candidates=unique(buildings.filter(b=>matches(b,t)));let errors=[];if(!candidates.length){for(const byName of [false,true]){await sleep(1200);try{candidates=unique(await nominatim(p,t,byName));}catch(e){errors.push(e.message);}if(candidates.length)break;}}
 if(candidates.length!==1){results.push({id:p.id,status:'unresolved',message:candidates.length?'Несколько зданий с этим адресом; метка не установлена.':errors.length?'Источник недоступен: '+errors.join(', '):'Точный адресный контур здания не найден в открытых данных.'});continue;}
 const b=candidates[0],pos=geometryCenter(b.geometry);if(!pos||!pos.every(Number.isFinite)||pos[0]<41.9||pos[0]>42.15||pos[1]<44.1||pos[1]>44.35){results.push({id:p.id,status:'unresolved',message:'Неподходящая геометрия здания; метка не установлена.'});continue;}
 let candidateStatus='';if(p.candidateCoordinates){const c=p.candidateCoordinates;candidateStatus=inside([c.lng,c.lat],b.geometry)?'Предварительные координаты Madu находятся внутри адресного контура OSM.':'Предварительные координаты Madu не совпали с адресным контуром OSM; они не использованы.';}
 results.push({id:p.id,status:'verified-open-data',lat:pos[1],lng:pos[0],sourceUrl:b.sourceUrl,method:b.method,checkedAt:new Date().toISOString(),message:candidateStatus||'Точный адрес сопоставлен с контуром здания в открытых данных.'});
 }catch(e){results.push({id:p.id,status:'unresolved',message:e.message});}}
 return {results,overpassError};}
 window.KimboGeocoder={resolve,matches,inside,geometryCenter};
})();
