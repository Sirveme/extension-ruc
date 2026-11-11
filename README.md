# Ficha RUC · Perú Sistemas Pro (extensión de Chrome)

Selecciona un RUC en cualquier página → clic derecho → **Ficha RUC** → la ficha pública del RUC
aparece en el panel lateral: estado, condición de domicilio, distrito, domicilio y alertas de
riesgo (sin capacidad operativa, deuda en cobranza coactiva…) e información útil (agente de
retención, buen contribuyente…). Si la selección trae varios RUC, muestra una tabla con filtro
"solo con riesgo", copiar y descargar CSV.

Consume la API propia (`https://club.perusistemas.pro/api/v1`). Por detrás usa una llave, pero la
persona **nunca la ve**: de cara a ella es «tu prueba» y «tu acceso».

## 0.2.0 · 15 días gratis → únete al Club
1. **Al instalar, sin que la persona haga nada**, el service worker genera un identificador de la
   instalación (`crypto.randomUUID()`, se guarda una vez) y pide `POST /api/v1/prueba`: recibe una
   credencial de prueba de 15 días y un **código** corto (`K7QM-4XPA`) para dictar por WhatsApp.
2. **Durante la prueba**: aviso discreto en el panel, el popup y Configuración —
   «Prueba gratis · quedan X días. Únete al Club para seguir usándola.» La cuota del mes aplica igual.
3. **Al vencer** (lo decide el SERVIDOR, no la extensión): la API responde `prueba_vencida` y el panel
   muestra el muro «Tu prueba terminó. Únete al Club de Contadores: es gratis.» con:
   - **Únete por WhatsApp** → `wa.me/51938246208` con «Hola, quiero unirme al Club de Contadores. Vengo de
     la extensión Ficha RUC. #RUC-EXT · Código K7QM-4XPA» (cae en la bandeja de TeAtiendo).
   - **Regístrate aquí** (solo si el registro del Club está abierto: lo dice el servidor en `registro_abierto`,
     según `IDENTIDAD_REGISTRO_ABIERTO`; al abrirlo, el botón aparece sin publicar otra versión) → `club.perusistemas.pro/registro?para=contador&sig=/extension/vincular?c=<código>`:
     al terminar el registro, `/extension/vincular` deja anotada la solicitud de esa instalación.
4. **Activación (manual por ahora)**: Duilio la hace en `/panel/llaves` (botón «Activar acceso
   permanente») o con `python api_llave.py activar K7QM-4XPA`. La extensión re-valida sola con `/yo`
   (no consume) al abrir el panel, el popup o Configuración, y al iniciar Chrome: pasa a «activa» sin
   que la persona pegue nada.
- Borrar los datos de la extensión **no reinicia** la prueba: la misma instalación recibe una credencial
  nueva con el mismo vencimiento. Una instalación nueva (otro equipo, reinstalar) sí es otra prueba: se acepta.
- El modo «pegar un código de acceso» quedó en Configuración → *Avanzado* (para quien ya tiene uno).
- `tools/empaquetar.py` rechaza blanco puro, pistas de la fuente y las palabras «llave», «key», «API»,
  «token» y «psp_live» en los textos de pantalla.

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
| `storage` | El acceso, el identificador de la instalación y la cuota (local, este equipo) y lo consultado en la sesión (se borra al cerrar Chrome). |
| `https://club.perusistemas.pro/*` | Llamar a la API (sin cookies: `credentials: "omit"`). |
| `scripting` | Registrar el botón «Ver ficha» **solo si la persona lo activa**. Sin advertencia al instalar. |
| `*://*/*` (**opcional**) | Lo pide Chrome recién al activar el botón «Ver ficha», para todos los sitios o solo los elegidos. Se devuelve al desactivarlo. |

Al instalar no hay advertencia de "leer tus datos en todos los sitios": no pide `tabs`, `activeTab`
ni acceso a sitios de entrada. Ver [PRIVACIDAD.md](PRIVACIDAD.md).

## Botón «Ver ficha» al seleccionar (opcional)
Configuración → *Botón «Ver ficha» al seleccionar* → Activar (todos los sitios o una lista). Al
seleccionar un texto que **es** un RUC válido aparece un botón discreto junto a la selección; un clic
abre la ficha. Se va al hacer clic fuera, al perder la selección o a los 6 s. `src/boton.js` solo mira
la selección, en el equipo, y envía únicamente ese RUC al tocar el botón.
**Límite de Chrome:** en el visor de PDF nativo ninguna extensión puede leer la selección ni dibujar
encima: ahí el botón no aparece; se usa el cuadro "pega RUC" del ícono.

## Estructura
```
manifest.json
src/background.js     service worker: menú, panel, botón y ÚNICO que llama a la API y lee la llave
src/boton.js          botón «Ver ficha» (script de contenido, solo si se activa)
src/lib/api.js        llamadas, errores, cuota, caché de sesión, prueba gratis y estado del acceso
src/lib/acceso.js     textos del acceso ("quedan X días")
src/lib/ruc.js        validación (dígito verificador, igual que el backend) y extracción
src/sidepanel.*       ficha y tabla
src/popup.*           pegar RUC
src/options.*         tu acceso (prueba, código, únete), avanzado, botón «Ver ficha» y privacidad
src/ui.css            tema oscuro del Club (nunca blanco)
icons/                generados con tools/hacer_iconos.py
tests/                npm test (ruc, llave, boton, acceso)
```

## Probar en tu Chrome
1. `chrome://extensions` → activa **Modo de desarrollador** → **Cargar descomprimida** → elige esta carpeta.
2. La prueba gratis se inicia sola (Configuración muestra los días y el código).
3. En cualquier página, selecciona un RUC → clic derecho → **Ficha RUC**.
4. Opcional: Configuración → **Botón «Ver ficha» al seleccionar** → Activar. Selecciona un RUC y toca «Ver ficha».

## Publicar (no listada)
`python tools/empaquetar.py` arma `dist/ficha-ruc-<versión>.zip` (solo lo que va a la tienda).
En el panel de la Chrome Web Store: subir el ZIP, visibilidad **No listada**, política de
privacidad = `https://club.perusistemas.pro/privacidad` (sección de la extensión, ver PRIVACIDAD.md).
