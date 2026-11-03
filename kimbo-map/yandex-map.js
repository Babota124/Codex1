/* Kimbo Map: official Yandex Maps JS API 2.1 adapter.
 * Yandex geocoder results are displayed in Yandex Maps only, NOT persisted/exported.
 * User-supplied coordinates (if any) remain in points.js/localStorage.
 */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const status = $('geocode-status');
let map=null, key='', geocoded=new Map(), markers=new Map(), loading=false;
const input=document.createElement('input');
input.type='text';input.placeholder='Ключ JavaScript API Яндекс Карт';input.autocomplete='off';input.setAttribute('aria-label','API-ключ Яндекс Карт');
const connect=document.createElement('button');connect.textContent='Подключить Яндекс Карты';
const hint=document.createElement('p');hint.className='small muted';
hint.textContent='Нужен ключ JavaScript API Яндекс Карт. Он используется только в этом браузере и не записывается в GitHub. Для работы ключа требуется разрешённый адрес сайта (HTTP Referer).';
const box=document.createElement('div');box.id='yandex-setup';box.append(input,connect,hint);
$('map').append(box);
const canvas=document.createElement('div');canvas.id='yandex-canvas';$('map').prepend(canvas);
const style=document.createElement('style');
style.textContent='#yandex-canvas{position:absolute;inset:0}#yandex-setup{position:absolute;z-index:7;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:22px;width:min(430px,90%);border-radius:14px;box-shadow:0 12px 50px #0002}#yandex-setup input{margin-bottom:10px}#yandex-setup button{width:100%}#yandex-setup p{margin-bottom:0}#map.yandex-active{touch-action:auto}#map.yandex-active #tiles,#map.yandex-active #markers,#map.yandex-active .controls,#map.yandex-active .attribution,#map.yandex-active .map-label{display:none}#map.yandex-active #yandex-setup{display:none}#map.yandex-active #card{z-index:6}#map.yandex-active #map-status{z-index:5;bottom:5px;left:8px;right:auto}';
document.head.append(style);
const notice=s=>{status.textContent=s;$('map-status').textContent=s;};
function loadApi(k){
 return new Promise((resolve,reject)=>{
  if(window.ymaps){window.ymaps.ready(resolve);return;}
  const script=document.createElement('script');
  const timeout=setTimeout(()=>reject(Error('Превышено время загрузки API. Проверьте сеть и разрешённый домен ключа.')),15000);
  script.onload=()=>{clearTimeout(timeout);if(!window.ymaps){reject(Error('API не доступен.'));return;}window.ymaps.ready(resolve);};
  script.onerror=()=>{clearTimeout(timeout);reject(Error('Не удалось загрузить API Яндекс Карт.'));};
  script.src='https://api-maps.yandex.ru/2.1/?apikey='+encodeURIComponent(k)+'&lang=ru_RU';
  document.head.append(script);
 });
}
function userPoints(){return JSON.parse(JSON.stringify(typeof points!=='undefined'?points:window.KIMBO_POINTS));}
function pin(p,coords,source){
 const placemark=new ymaps.Placemark(coords,{hintContent:p.name,balloonContentHeader:p.name,balloonContentBody:p.address+' — '+p.comment},{preset:'islands#redIcon'});
 map.geoObjects.add(placemark);markers.set(p.id,placemark);
 return placemark;
}
function showKnown(){
 if(!map)return;
 for(const p of userPoints()){
  if(p.lat!==null&&p.lng!==null&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&!markers.has(p.id)){
   pin(p,[p.lat,p.lng],'user');
  }
 }
}
function focus(p){
 if(!map)return;
 const coords=(p.lat!==null&&p.lng!==null)?[p.lat,p.lng]:geocoded.get(p.id);
 if(coords){map.setCenter(coords,17,{checkZoomRange:true});const marker=markers.get(p.id);if(marker)marker.balloon.open();}
}
function canonical(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,'').replace(/[.,-]/g,'').replace(/улица|ул\.?/g,'').replace(/шоссе/g,'ш').replace(/\/+/g,'/');}
function expected(p){
 const match=p.address.match(/(?:ул\.?|улица)\s*([^,]+),\s*([^,]+)/i);
 return match?{street:canonical(match[1]),number:canonical(match[2])}:null;
}
async function locate(){
 if(!map){notice('Сначала подключите Яндекс Карты с ключом API.');return;}
 const all=userPoints(),todo=all.filter(p=>p.lat===null);
 if(!todo.length){notice('Для всех точек уже указаны пользовательские координаты.');return;}
 $('locate').disabled=true;
 let ok=0, problems=[];
 for(const p of todo){
  notice('Проверка адресов Яндексом: '+p.name+'…');
  try{
   const result=await ymaps.geocode(p.address,{results:3,kind:'house'});
   const objects=result.geoObjects;
   const exp=expected(p);
   const matching=[];
   for(let i=0;i<objects.getLength();i++){
    const obj=objects.get(i);
    const gotNum=canonical(obj.getPremiseNumber?.()||'');
    const street=canonical(obj.getThoroughfare?.()||'');
    const local=(obj.getLocalities?.()||[]).join(' ').toLowerCase();
    const meta=obj.properties.get('metaDataProperty.GeocoderMetaData')||{};
    const precision=meta.precision||'';
    if(exp && gotNum===exp.number && (street.includes(exp.street)||exp.street.includes(street)&&street.length>3) && local.includes('псыж') && precision==='exact')matching.push(obj);
   }
   if(matching.length!==1){problems.push(p.name+': нет однозначного точного адреса');continue;}
   const coords=matching[0].geometry.getCoordinates();
   if(!coords||coords.length!==2||!coords.every(Number.isFinite)){problems.push(p.name+': координаты не найдены');continue;}
   geocoded.set(p.id,coords);
   if(markers.has(p.id))map.geoObjects.remove(markers.get(p.id));
   pin(p,coords,'yandex');
   ok++;
  }catch(e){problems.push(p.name+': ошибка поиска');}
 }
 $('locate').disabled=false;
 if(ok)map.setBounds(map.geoObjects.getBounds(),{checkZoomRange:true,zoomMargin:60});
 notice('Точные адреса найдены Яндексом: '+ok+' из '+todo.length+'. '+(problems.length?problems.join('; ')+'. ':'')+'Координаты Яндекса не сохраняются в JSON/GitHub. Точность здания по контуру отдельно не проверена.');
}
connect.onclick=async()=>{
 if(loading)return;
 key=input.value.trim();
 if(!key){notice('Введите ключ JavaScript API Яндекс Карт.');return;}
 loading=true;connect.disabled=true;
 try{
  notice('Подключение официального API Яндекс Карт…');
  await loadApi(key);
  map=new ymaps.Map(canvas,{center:[44.223,42.057],zoom:13,controls:['zoomControl']});
  $('map').classList.add('yandex-active');
  showKnown();
  notice('Подложка Яндекс Карт подключена. Нажмите «Проверить адреса автоматически».');
 }catch(err){notice('Карта не загрузилась: '+err.message);}
 finally{loading=false;connect.disabled=false;}
};
$('locate').onclick=locate;
window.KimboYandex={focus,refresh:showKnown};
notice('OSM заблокирован (403). Для перехода на Яндекс Карты подключите официальный API-ключ.');
})();
