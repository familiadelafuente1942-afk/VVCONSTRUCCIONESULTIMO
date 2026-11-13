/* Service worker de Nexo: permite instalar la app y recibir avisos (cotizaciones de proveedores). No guarda nada en caché. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Nexo',{body:d.body||'',tag:d.tag||'nexo',icon:'/barracas-icon-192.png',badge:'/barracas-icon-192.png',data:{url:d.url||'/nexo2.html'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'/nexo2.html';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.indexOf('/nexo2.html')>-1&&'focus' in c)return c.focus()}return self.clients.openWindow(url)}))});
