#!/bin/sh
# Regenera api/_fincalc.js (cálculo de certificados de Finanzas cliente) desde FinanzasCliente.jsx, para el conector de Claude.
set -e; D=$(mktemp -d); cp FinanzasCliente.jsx $D/Fin.jsx
echo 'export { calcCert as __calcCert, ordenarObras as __ordenarObras };' >> $D/Fin.jsx
printf 'const R={createElement(){return null}};export default R;export const useState=()=>[];export const useEffect=()=>{};export const useRef=()=>({});\n' > $D/react-stub.js
echo 'export { __calcCert as calcCert, __ordenarObras as ordenarObras } from "./Fin.jsx";' > $D/entry.js
./node_modules/.bin/esbuild $D/entry.js --bundle --format=esm --platform=node --alias:react=$D/react-stub.js --loader:.jsx=jsx --outfile=api/_fincalc.js --log-level=warning
sed -i '1i // GENERADO desde FinanzasCliente.jsx (cálculo de certificados) con scripts/fincalc-build.sh. No editar a mano: si cambia el cálculo en la app, volver a generarlo.' api/_fincalc.js
