/* Поиск уже существующих организаций на Яндекс Картах + адресный запасной путь.
   Георезультаты остаются в оперативной памяти, не сохраняются в GitHub. */
'use strict';
(function(){
const normalize=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,]/g,' ').replace(/\\s+/g,' ').trim();
const compact=s=>normalize(s).replace(/\\s/g,'').replace(/[^а-яa-z0-9/]/g,'');
const aliases={smoker:['smoker','смокер'],kunzhut:['кунжут','kunzhut'],madu:['madu','маду']};
function addressBits(s){
 const m=s.match(/(?:ул\\.?|улица)\\s*([^,]+),\\s*([^,]+)$/i);
 return m?{street:compact(m[1]),house:compact(m[2]).replace(/a/g,'а').replace(/b/g,'б')}:null;
}
function yandexText(obj){
 const props=obj.properties;
 const strings=['name','description','balloonContentHeader','balloonContentBody','hintContent','text','address','formattedAddress']
 .map(k=>props.get(k)).filter(v=>typeof v==='string');
 try{const meta=props.get('metaDataProperty.GeocoderMetaData');if(meta?.text)strings.push(meta.text);}catch(e){}
 try{const meta=props.get('metaDataProperty.SearchResponseMetaData');if(meta?.text)strings.push(meta.text);}catch(e){}
 return normalize(strings.join(' '));
}
function coords(obj){
 const xy=obj?.geometry?.getCoordinates?.();
 return Array.isArray(xy)&&xy.length===2&&xy.every(Number.isFinite)&&xy[0]>44.1&&xy[0]<44.35&&xy[1]>41.85&&xy[1]<42.25?xy:null;
}
function nearPsyzh(xy){const dy=(xy[0]-44.223)*111;const dx=(xy[1]-42.03)*80;return Math.hypot(dx,dy)<12;}
function classifyOrg(p,obj){
 const xy=coords(obj);if(!xy||!nearPsyzh(xy))return null;
 const label=yandexText(obj),variants=aliases[p.id]||[normalize(p.name)];
 if(!variants.some(v=>label.includes(v)))return null;
 const bits=addressBits(p.address);
 const correctHouse=bits&&label.includes(bits.house)&&label.includes('шоссейн')||bits&&label.includes(bits.house)&&label.includes('побед');
 const correctPlace=label.includes('псыж')||correctHouse;
 return {xy,label,score:(correctPlace?4:0)+(correctHouse?3:0)+(label.includes('псыж')?2:0)};
}
async function searchOrganizations(p){
 if(!aliases[p.id])return null;
 const short=(aliases[p.id][0]==='kunzhut'?'Кунжут':aliases[p.id][0]==='smoker'?'Smoker':'Madu');
 const queries=[short+' Псыж',short+' Шоссейная Псыж',short+' Карачаево-Черкесия'];
 if(p.id==='madu')queries[1]='Madu Победы Псыж';
 for(const q of queries){
  const found=await KimboMap.searchPlaces(q);
  const matches=found.map(o=>classifyOrg(p,o)).filter(Boolean).sort((a,b)=>b.score-a.score);
  if(!matches.length)continue;
  const best=matches[0],second=matches[1];
  if(best.score>=6&&(!second||best.score>second.score||best.xy.join(',')===second.xy.join(',')))return {xy:best.xy,method:'Яндекс: поиск организации по названию',label:best.label};
  // Не угадываем точку, если карточка не содержит адреса или есть несколько равных кандидатов.
 }
 return null;
}
async function geocodeAddress(p){
 const response=await ymaps.geocode(p.address,{results:10});
 const bits=addressBits(p.address);if(!bits)return null;
 const matches=[];
 response.geoObjects.each(obj=>{
  const m=obj.properties.get('metaDataProperty.GeocoderMetaData')||{};
  const components=m.Address?.Components||[];
  const locality=components.some(c=>c.kind==='locality'&&normalize(c.name).includes('псыж'));
  const street=components.some(c=>c.kind==='street'&&compact(c.name).includes(bits.street));
  const house=components.some(c=>c.kind==='house'&&compact(c.name).replace(/a/g,'а').replace(/b/g,'б')===bits.house);
  const xy=coords(obj);
  if(xy&&locality&&street&&house)matches.push(xy);
 });
 return matches.length===1?{xy:matches[0],method:'Яндекс: адрес здания',label:p.address}:null;
}
async function resolve(points,onProgress){
 if(!window.KimboMap?.ready)throw Error('Сначала подключите Яндекс Карты.');
 const results=[];
 for(const p of points){
  onProgress('Поиск на Яндекс Картах: '+p.name);
  let match=null;
  try{match=await searchOrganizations(p);}catch(e){console.warn('Поиск организации',p.id,e);}
  if(!match)try{match=await geocodeAddress(p);}catch(e){console.warn('Поиск адреса',p.id,e);}
  if(match){
   results.push({id:p.id,status:'verified-yandex-address',provider:'yandex',lat:match.xy[0],lng:match.xy[1],method:match.method,checkedAt:new Date().toISOString(),message:'Найдено на Яндекс Картах: '+match.label+'. Координаты действуют только до перезагрузки страницы.'});
  }else results.push({id:p.id,status:'unresolved',message:'Поиск названия и адреса не дал однозначного совпадения. Можно найти организацию через поисковую строку Яндекс Карт прямо на карте.'});
 }
 return {results};
}
window.KimboGeocoder={resolve};
})();