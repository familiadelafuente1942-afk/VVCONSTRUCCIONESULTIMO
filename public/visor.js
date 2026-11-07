/* Visor interno: abre PDFs e imágenes dentro de la app con botón "Volver", y baja archivos con el menú de compartir del celular. */
(function(){
if(window.__visor)return;window.__visor=1;
const ESC=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css=document.createElement('style');css.textContent=`
#vz{position:fixed;inset:0;z-index:99999;background:#101114;color:#eee;display:none;flex-direction:column;font-family:inherit}
#vz.on{display:flex}
#vz .vb{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:#181a1e;border-bottom:1px solid #2a2c31;flex:none}
#vz .vb button{font:inherit;font-weight:600;font-size:15px;color:#eee;background:#262930;border:1px solid #3a3d45;border-radius:999px;padding:9px 14px;cursor:pointer;white-space:nowrap}
#vz .vb .vt{flex:1;min-width:0;text-align:center;font-size:14px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#vz .vbody{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 16px)}
#vz .vin{margin:0 auto;width:100%}
#vz .vpg{background:#fff;margin:0 auto 10px;width:calc(100% - 16px);position:relative;box-shadow:0 2px 10px rgba(0,0,0,.5)}
#vz .vpg canvas{display:block;width:100%;height:auto}
#vz .vim{display:block;width:calc(100% - 16px);margin:0 auto;height:auto}
#vz .vmsg{padding:30px 20px;text-align:center;opacity:.85}
#vz .vmsg a{color:#d9b36a}
.vtoast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:999px;z-index:100000;font-size:14px}`;
document.head.appendChild(css);
let box,cur={url:'',title:''},zoom=1,obs=null,pdf=null,open=false;
function build(){if(box)return;box=document.createElement('div');box.id='vz';
 box.innerHTML='<div class="vb"><button data-v="x">← Volver</button><span class="vt"></span><button data-v="-" aria-label="Alejar">−</button><button data-v="+" aria-label="Acercar">+</button><button data-v="s">Guardar</button></div><div class="vbody"><div class="vin"></div></div>';
 document.body.appendChild(box);
 box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.v;
  if(k==='x')cerrar();else if(k==='+')z(1);else if(k==='-')z(-1);else if(k==='s')bajar(cur.url)})}
function toast(t){const d=document.createElement('div');d.className='vtoast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2500)}
const LV=[1,1.5,2,3];
function z(d){const i=Math.max(0,Math.min(LV.length-1,LV.indexOf(zoom)+d));if(LV[i]===zoom)return;zoom=LV[i];const vin=box.querySelector('.vin');vin.style.width=(zoom*100)+'%';
 if(pdf){box.querySelectorAll('.vpg').forEach(p=>{p.dataset.r='';const c=p.querySelector('canvas');if(c)c.remove();obs&&(obs.unobserve(p),obs.observe(p))})}}
function cerrar(){if(!open)return;if(history.state&&history.state.visor){history.back()}else ocultar()}
function ocultar(){if(!box)return;open=false;box.classList.remove('on');document.body.style.overflow=prevOv||'';if(obs){obs.disconnect();obs=null}if(pdf){try{pdf.destroy()}catch(e){}pdf=null}box.querySelector('.vin').innerHTML=''}
let prevOv='';
window.addEventListener('popstate',()=>{if(open)ocultar()});
function loadPdfjs(){return new Promise((ok,ko)=>{if(window.pdfjsLib)return ok();const s=document.createElement('script');s.src='/vendor/pdfjs/pdf.min.js';s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.js';ok()};s.onerror=ko;document.head.appendChild(s)})}
async function abrir(url,title){build();cur={url,title:title||decodeURIComponent(url.split('?')[0].split('/').pop())};zoom=1;
 const vin=box.querySelector('.vin');vin.style.width='100%';vin.innerHTML='<div class="vmsg">Abriendo…</div>';box.querySelector('.vt').textContent=cur.title;
 prevOv=document.body.style.overflow;document.body.style.overflow='hidden';box.classList.add('on');box.querySelector('.vbody').scrollTop=0;
 if(!open){open=true;try{history.pushState({visor:1},'')}catch(e){}}
 if(/\.pdf(\?|$)/i.test(url)){
  try{await loadPdfjs();const doc=await pdfjsLib.getDocument(url).promise;if(!open)return;pdf=doc;const p1=await doc.getPage(1),v=p1.getViewport({scale:1});vin.innerHTML='';
   obs=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting&&!en.target.dataset.r)pintar(en.target)}),{root:box.querySelector('.vbody'),rootMargin:'800px 0px'});
   for(let n=1;n<=doc.numPages;n++){const d=document.createElement('div');d.className='vpg';d.dataset.n=n;d.style.aspectRatio=v.width+'/'+v.height;vin.appendChild(d);obs.observe(d)}
  }catch(e){vin.innerHTML='<div class="vmsg">No se pudo abrir el archivo acá.<br><br><a href="'+ESC(url)+'" target="_blank" rel="noopener" data-ext="1">Abrir en el navegador</a></div>'}
 }else{vin.innerHTML='<img class="vim" src="'+ESC(url)+'" alt="'+ESC(cur.title)+'">'}}
async function pintar(d){d.dataset.r='1';const p=pdf;if(!p)return;try{const pg=await p.getPage(+d.dataset.n),v0=pg.getViewport({scale:1}),cw=d.clientWidth||320,sc=cw/v0.width*Math.min(window.devicePixelRatio||1,2),v=pg.getViewport({scale:sc}),c=document.createElement('canvas');c.width=Math.floor(v.width);c.height=Math.floor(v.height);d.style.aspectRatio=v0.width+'/'+v0.height;await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise;if(p!==pdf)return;d.innerHTML='';d.appendChild(c)}catch(e){d.dataset.r=''}}
async function bajar(url){const name=decodeURIComponent(url.split('?')[0].split('/').pop());toast('Preparando '+name+'…');
 try{const r=await fetch(url);if(!r.ok)throw 0;const b=await r.blob(),f=new File([b],name,{type:b.type||'application/octet-stream'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}
  const a=document.createElement('a');a.dataset.ext='1';a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)
 }catch(e){if(e&&e.name==='AbortError')return;toast('No se pudo descargar')}}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a||a.dataset.ext)return;
 const h=a.getAttribute('href');if(!h||/^(#|javascript:|mailto:|tel:|https?:\/\/)/i.test(h)&&!h.startsWith(location.origin))return;
 if(a.hasAttribute('download')){e.preventDefault();e.stopPropagation();bajar(a.href);return}
 if(/\.(pdf|jpe?g|png|webp)(\?|$)/i.test(h)&&(a.target==='_blank')){e.preventDefault();e.stopPropagation();const row=a.closest('.row'),t=row&&row.querySelector('span')?row.querySelector('span').firstChild.textContent.trim():'';abrir(a.href,t)}},true);
window.abrirVisor=abrir;window.bajarArchivo=bajar;
})();
