'use strict';
(function(){let map=null,collection=null,loading=false,last=[],searchControl=null;
const status=s=>document.getElementById('map-status').textContent=s;
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function draw(points,onSelect){
 last=[points,onSelect];
 if(!map)return;
 collection.removeAll();
 for(const p of points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng))){
  const address=esc(p.address),name=esc(p.name);
  const url=(typeof p.yandexUrl==='string'&&/^https:\/\/yandex\.ru\/maps\//.test(p.yandexUrl))?p.yandexUrl:null;
  const link=url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Открыть полную карточку Яндекса с фото</a>':'';
  const placemark=new ymaps.Placemark([p.lat,p.lng],{
   hintContent:name+' · Kimbo',
   balloonContentHeader:name,
   balloonContentBody:address+'<p>'+esc(p.comment||'')+'</p>'+link,
   iconCaption:name
  },{preset:'islands#redCoffeeIcon',iconColor:'#b3222b'});
  placemark.events.add('click',e=>{
   // A direct visitor click opens the existing official business profile.
   // The Yandex balloon remains as a fallback for browsers blocking new tabs.
   if(url){
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(!opened){placemark.balloon.open();}
   } else {
    onSelect(p);
   }
  });
  collection.add(placemark);
 }
}
async function connect(key){if(loading||map)return;key=key.trim();if(!/^[a-zA-Z0-9_-]{10,200}$/.test(key))throw Error('Введите действующий браузерный API-ключ Яндекс.');if(location.protocol==='file:')throw Error('Откройте проект через HTTP/HTTPS. Ограниченный доменом ключ не проверяется на file://.');loading=true;status('Загрузка официального API Яндекс Карт…');try{await new Promise((resolve,reject)=>{const script=document.createElement('script');const timer=setTimeout(()=>reject(Error('API не ответил за 25 секунд. Проверьте доступ к Яндекс и ограничения ключа.')),25000);script.src='https://api-maps.yandex.ru/2.1/?apikey='+encodeURIComponent(key)+'&lang=ru_RU&load=package.full';script.onload=()=>{if(window.ymaps)ymaps.ready(()=>{clearTimeout(timer);resolve();},e=>{clearTimeout(timer);reject(Error('Ошибка инициализации API Яндекс.'));});else{clearTimeout(timer);reject(Error('API Яндекс недоступен.'));}};script.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось загрузить API Яндекс. Проверьте ключ, домен и сеть.'));};document.head.append(script);});map=new ymaps.Map('yandex-map',{center:[44.223,42.03],zoom:13,controls:['zoomControl','fullscreenControl']},{suppressMapOpenBlock:false,yandexMapDisablePoiInteractivity:false});collection=new ymaps.GeoObjectCollection();map.geoObjects.add(collection);searchControl=new ymaps.control.SearchControl({options:{provider:'yandex#search',noPlacemark:true,noCentering:true,resultsPerPage:20,searchCoordOrder:'latlong'}});map.controls.add(searchControl);if(last.length){draw(...last);const pinPoints=last[0].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(pinPoints.length)window.KimboMap.fit(pinPoints);}status('На карте четыре метки Kimbo. Нажмите метку, чтобы открыть оригинальную карточку организации на Яндексе с фотографиями.');document.dispatchEvent(new Event('kimbo-map-ready'));}finally{loading=false;}}
window.KimboMap={connect,draw,get ready(){return !!map;},focus(p){if(map&&p.lat!==null)map.setCenter([p.lat,p.lng],18,{duration:250});},fit(points){if(!map)return;const p=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(p.length===1)map.setCenter([p[0].lat,p[0].lng],17);else if(p.length)map.setBounds(ymaps.util.bounds.fromPoints(p.map(p=>[p.lat,p.lng])),{checkZoomRange:true,zoomMargin:55});else map.setCenter([44.223,42.03],13);},resize(){map?.container.fitToViewport();},async findOnMap(query){if(!searchControl)throw Error('Сначала подключите Яндекс Карты.');await searchControl.search(query);if(searchControl.getResultsCount())searchControl.showResult(0);return searchControl.getResultsCount();},async searchPlaces(query){if(!searchControl)throw Error('Поиск организаций Яндекс не подключён.');await searchControl.search(query);const n=Math.min(searchControl.getResultsCount(),20),results=[];for(let i=0;i<n;i++){try{const o=await searchControl.getResult(i);if(o)results.push(o);}catch(e){console.warn('Не удалось прочитать результат Яндекса',e);}}return results;}};
})();
