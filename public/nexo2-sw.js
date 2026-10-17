/* Service worker mínimo de Nexo: hace que Chrome ofrezca "Instalar app". No guarda nada en caché. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
