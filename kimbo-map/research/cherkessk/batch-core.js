'use strict';
(function(root){
 const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,]/g,' ').replace(/\s+/g,' ').trim();
 const key=s=>norm(s).replace(/улица|проспект|площадь|\bул\b/g,'').replace(/\s+/g,'');
 function classify(item,result){const name=norm(result.name),address=norm(result.address);if(!/черкесск/.test(address))return 'outside-city-or-no-address';if(!item.aliases.some(a=>name===norm(a)||name.startsWith(norm(a)+' ')||name.endsWith(' '+norm(a))))return 'name-not-confirmed';const exact=item.addressHints.some(a=>/\d/.test(a)&&key(address).endsWith(key(a)));return exact&&!item.chain?'name-and-address-candidate':'needs-branch-or-address-review';}
 function cardUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['yandex.ru','yandex.com'].includes(u.hostname)&&/^\/maps\/org\//.test(u.pathname)?u.href:null;}catch{return null;}}
 root.KimboBatch={classify,cardUrl};
})(typeof window==='undefined'?globalThis:window);
