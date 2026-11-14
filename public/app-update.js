/* Actualización automática de las apps (Casa, Terralagos, Barracas, Paseo Colón, Seguimiento, Cotizador, Contratistas).
   Al abrir guarda una huella de la página; cada minuto (y al volver a la app) la compara con la publicada.
   Si hay versión nueva: se recarga sola si no estás escribiendo ni con una ventana abierta; si no, muestra el cartel. */
(function(){
  if(window.__appUpd)return;window.__appUpd=1;
  var URLP=location.pathname+(location.pathname.endsWith('/')?'index.html':''),base=null,nueva=null,solo=/[?&]solo=/.test(location.search);
  /* cada página lleva <meta name="app-build"> con la fecha de publicación (scripts/app-version.py) */
  function propia(){var m=document.querySelector('meta[name="app-build"]');return m?m.getAttribute('content'):null}
  function traer(){return fetch(URLP+(URLP.indexOf('?')>-1?'&':'?')+'_v='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():null}).then(function(t){var m=t&&/<meta name="app-build" content="([^"]*)"/.exec(t);return m?m[1]:null}).catch(function(){return null})}
  function ocupado(){var a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return true;
    if(window._rec||window._grec||window._gbusy||window._gman||window._vinfb||window._kup&&Object.keys(window._kup).some(function(k){return window._kup[k]>0}))return true;
    if(document.querySelector('#kpdfov,#mopov,#vidov,div[style*="2147483600"],#gpan:not([hidden]),#gsoloov:not([hidden])'))return true;
    if(window._np)return true;return false}
  function recargar(){try{sessionStorage.setItem('appupd_'+URLP,nueva||'')}catch(e){}location.reload()}
  function cartel(){if(document.getElementById('app-upd'))return;var b=document.createElement('button');b.id='app-upd';b.type='button';b.textContent='Hay una versión nueva · Tocá para actualizar';
    b.style.cssText='position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:2147483647;background:#b8893a;color:#fff;border:0;border-radius:999px;padding:10px 18px;font:600 14px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:92vw;cursor:pointer';
    b.onclick=recargar;document.body.appendChild(b)}
  function revisar(){if(document.visibilityState!=='visible'||!base)return;traer().then(function(h){if(!h)return;if(h===base){var c=document.getElementById('app-upd');if(c)c.remove();return}
    nueva=h;var ya='';try{ya=sessionStorage.getItem('appupd_'+URLP)||''}catch(e){}
    if(!solo&&ya!==h&&!ocupado()){recargar();return}cartel()})}
  base=propia();setTimeout(revisar,4000);
  setInterval(revisar,60000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(revisar,800)});
  window.addEventListener('focus',function(){setTimeout(revisar,800)});
})();
