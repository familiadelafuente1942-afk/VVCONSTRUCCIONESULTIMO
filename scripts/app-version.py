#!/usr/bin/env python3
"""Marca versión nueva en las apps (Casa, Terralagos, Barracas, Paseo Colón, Seguimiento, Cotizador, Contratistas).
Correr antes de cada commit: pone <meta name="app-build"> con la fecha en las páginas modificadas (o en las que se pasen como argumento).
Los aparatos abiertos comparan esa marca con la publicada y se actualizan solos (public/app-update.js)."""
import re,sys,time,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parent.parent
APPS=['public/casa-costos.html','public/milano-casa/index.html','public/correo-barracas.html','public/paseo-colon-costos.html','public/seguimiento.html','public/belfast-cotizador.html','public/contratistas.html','public/cotizar.html','public/cotizar-vv.html']
subprocess.run(['python3',str(R/'scripts/cotizar-vv.py')],check=True)
v=time.strftime('%Y%m%d-%H%M%S',time.gmtime())
if len(sys.argv)>1: L=sys.argv[1:]
else:
    ch=subprocess.run(['git','status','--porcelain'],cwd=R,capture_output=True,text=True).stdout
    L=[a for a in APPS if a in ch or a.endswith('cotizar-vv.html') and 'cotizar' in ch]
for a in L:
    p=R/a;s=p.read_text(encoding='utf-8')
    tag='<meta name="app-build" content="%s">'%v
    if '<meta name="app-build"' in s: s=re.sub(r'<meta name="app-build" content="[^"]*">',tag,s,count=1)
    else: s=s.replace('<head>','<head>'+tag,1) if '<head>' in s else re.sub(r'(<head[^>]*>)',r'\1'+tag,s,count=1)
    if '/app-update.js' not in s: s=s.replace('</body>','<script src="/app-update.js"></script></body>',1)
    p.write_text(s,encoding='utf-8');print(a,v)
