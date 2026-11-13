#!/usr/bin/env python3
"""Marca una versión nueva de NEXO 2: correr antes de cada commit que toque public/nexo2.html.
Los aparatos abiertos (PC, iPad, iPhone) comparan su versión con public/nexo2-version.json y se actualizan solos."""
import re,json,time,pathlib
r=pathlib.Path(__file__).resolve().parent.parent/'public'
v=time.strftime('%Y%m%d-%H%M%S',time.gmtime())
p=r/'nexo2.html';s=p.read_text(encoding='utf-8')
s,n=re.subn(r"const NEXO_BUILD='[^']*'","const NEXO_BUILD='%s'"%v,s);assert n==1
p.write_text(s,encoding='utf-8');(r/'nexo2-version.json').write_text(json.dumps({'v':v}))
print(v)
