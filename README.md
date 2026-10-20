# Ficha RUC · Perú Sistemas Pro (extensión de Chrome)

Selecciona un RUC en cualquier página → clic derecho → **Ficha RUC** → la ficha pública del RUC
aparece en el panel lateral: estado, condición de domicilio, distrito, domicilio y alertas de
riesgo (sin capacidad operativa, deuda en cobranza coactiva…) e información útil (agente de
retención, buen contribuyente…). Si la selección trae varios RUC, muestra una tabla con filtro
"solo con riesgo", copiar y descargar CSV.

Consume la API propia (`https://club.perusistemas.pro/api/v1`) con la llave del usuario.

## Fase 1 (esta versión, 0.1.0)
- Menú contextual sobre el texto seleccionado (uno o varios RUC).
- Caja "pega uno o varios RUC" en el ícono (sirve también para Excel/Sheets/PDF, donde el menú
  de Chrome no aparece).
- Llave: se pega una vez en Configuración, se valida con `/yo` (no consume) y queda en este equipo.
- Cuota visible ("63 de 100 consultas este mes"); con varios RUC se confirma el costo antes.

## Permisos (mínimos)
| Permiso | Para qué |
|---|---|
| `contextMenus` | El menú "Ficha RUC" sobre lo seleccionado. Chrome entrega el texto en el clic: la extensión **no lee páginas**. |
| `sidePanel` | Mostrar la ficha al costado de la página. |
| `storage` | La llave y la cuota (local, este equipo) y lo consultado en la sesión (se borra al cerrar Chrome). |
| `https://club.perusistemas.pro/*` | Llamar a la API (sin cookies: `credentials: "omit"`). |

No pide `tabs`, `activeTab`, `scripting` ni acceso a sitios. Ver [PRIVACIDAD.md](PRIVACIDAD.md).

## Estructura
```
manifest.json
src/background.js     service worker: menú, panel y ÚNICO que llama a la API y lee la llave
src/lib/api.js        llamadas, errores, cuota, caché de sesión
src/lib/ruc.js        validación (dígito verificador, igual que el backend) y extracción
src/sidepanel.*       ficha y tabla
src/popup.*           pegar RUC
src/options.*         la llave y el texto de privacidad
src/ui.css            tema oscuro del Club (nunca blanco)
icons/                generados con tools/hacer_iconos.py
tests/ruc.test.mjs    node --test tests/ruc.test.mjs
```

## Probar en tu Chrome
1. `chrome://extensions` → activa **Modo de desarrollador** → **Cargar descomprimida** → elige esta carpeta.
2. Clic en el ícono → **Configuración** → pega tu llave (créala en `club.perusistemas.pro/panel/llaves`).
3. En cualquier página, selecciona un RUC → clic derecho → **Ficha RUC**.

## Publicar (no listada)
`python tools/empaquetar.py` arma `dist/ficha-ruc-<versión>.zip` (solo lo que va a la tienda).
En el panel de la Chrome Web Store: subir el ZIP, visibilidad **No listada**, política de
privacidad = `https://club.perusistemas.pro/privacidad` (sección de la extensión, ver PRIVACIDAD.md).
