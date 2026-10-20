# Ficha RUC · Privacidad (texto para la Chrome Web Store y para /privacidad)

## Propósito único
Mostrar la ficha pública de un RUC (Registro Único de Contribuyentes del Perú) que el usuario
elige: estado, condición de domicilio, ubicación y alertas de riesgo públicas.

## Qué datos usa la extensión
- **El texto que el usuario selecciona y elige consultar** (o que pega en la extensión). De ese
  texto solo se extraen los números de RUC; solo esos RUC se envían a nuestra API. El resto del
  texto no sale del equipo.
- **La llave de la API del usuario**, guardada solo en su equipo (`chrome.storage.local`, no se
  sincroniza). Solo la usa el service worker de la extensión; las páginas web no pueden leerla.
- **Lo ya consultado en la sesión**, para no gastar la cuota dos veces; se borra al cerrar Chrome.

## Qué NO hace
- No lee el contenido de las páginas que el usuario visita.
- No registra el historial de navegación ni las URL.
- No envía datos a terceros ni muestra publicidad.
- No envía las cookies del navegador con las consultas.
- No muestra buzones ni notificaciones de ningún contribuyente: solo datos públicos del RUC.
- Nuestro servidor registra cuántas consultas hace cada llave (para la cuota), **nunca qué RUC**.

## Justificación de permisos (formulario de la tienda)
- `contextMenus`: ofrecer "Ficha RUC" sobre el texto seleccionado.
- `sidePanel`: mostrar la ficha junto a la página.
- `storage`: guardar la llave y la cuota en el equipo, y lo consultado durante la sesión.
- `https://club.perusistemas.pro/*`: consultar nuestra API de RUC.

## Divulgación de datos (formulario de la tienda)
- Recopila: ninguno de "información personal", "historial web", "contenido del sitio web" salvo lo
  que el usuario elige consultar (RUC, datos públicos de contribuyentes).
- Se usa solo para la función de la extensión; no se vende ni se transfiere a terceros.

Contacto: WhatsApp 967317946 · Perú Sistemas Pro.
