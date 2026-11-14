#!/usr/bin/env python3
"""Genera public/cotizar-vv.html (página del proveedor con marca V+V Construcciones) a partir de public/cotizar.html.
La vista previa de WhatsApp (título, ícono e imagen) sale del HTML, por eso V+V necesita su propia página."""
import pathlib,re
R=pathlib.Path(__file__).resolve().parent.parent/'public'
s=(R/'cotizar.html').read_text(encoding='utf-8')
OG_B='<meta property="og:title" content="Cotizador Belfast"><meta property="og:description" content="Pedido de cotización de Belfast Construction Management"><meta property="og:image" content="https://nexoentorno.vercel.app/og-belfast.jpg">'
if 'og:title' not in s:
    s=s.replace('<title>Cotizador Belfast</title>','<title>Cotizador Belfast</title>'+OG_B,1);(R/'cotizar.html').write_text(s,encoding='utf-8')
v=s.replace('<title>Cotizador Belfast</title>','<title>Cotizador V+V Construcciones</title>',1)
v=v.replace(OG_B,'<meta property="og:title" content="Cotizador V+V Construcciones"><meta property="og:description" content="Pedido de cotización de V+V Construcciones"><meta property="og:image" content="https://nexoentorno.vercel.app/og-vv.jpg">',1)
v=v.replace('<link rel="icon" href="/belfast-icon-192.png">','<link rel="icon" href="/vv-icon-192.png"><link rel="apple-touch-icon" href="/vv-icon-180.png">',1)
v=v.replace('<header><img src="/belfast-logo-barracas.png" alt="Belfast"><div><b>Cotizador Belfast</b><span>Belfast Construction Management</span></div></header>','<header><img src="/vv-icon-192.png" alt="V+V Construcciones" style="border-radius:50%"><div><b>Cotizador V+V</b><span>V+V Construcciones</span></div></header>',1)
v=v.replace('Pedile a Belfast','Pedile a V+V Construcciones')
v=v.replace("function marca(){if(P.marca!=='vv')return;","function marca(){window.ORGN='V+V Construcciones';if(P.marca!=='vv')return;",1)
assert 'belfast-logo' not in v and 'Cotizador Belfast' not in v, 'quedó Belfast'
(R/'cotizar-vv.html').write_text(v,encoding='utf-8');print('cotizar-vv.html ok')
