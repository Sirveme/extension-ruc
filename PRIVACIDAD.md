# Ficha RUC · Privacidad (texto para la Chrome Web Store y para /privacidad)

## Propósito único
Mostrar la ficha pública de un RUC (Registro Único de Contribuyentes del Perú) que el usuario
elige: estado, condición de domicilio, ubicación y alertas de riesgo públicas.

## Qué datos usa la extensión
- **El texto que el usuario selecciona y elige consultar** (o que pega en la extensión). De ese
  texto solo se extraen los números de RUC; solo esos RUC se envían a nuestro servidor. El resto del
  texto no sale del equipo.
- **Un identificador al azar de esta instalación** (no contiene datos de la persona ni de lo que
  navega). Al instalarse, la extensión lo envía una sola vez para iniciar la prueba gratis de 15 días,
  y luego para saber si la prueba sigue vigente o si el acceso ya está activo. En el servidor solo se
  guarda junto con la fecha de vencimiento de la prueba; de la conexión, solo una huella cifrada de la
  dirección IP, para limitar cuántas pruebas nuevas se piden por día.
- **El acceso del usuario**, guardado solo en su equipo (`chrome.storage.local`, no se sincroniza).
  Solo lo usa el service worker de la extensión; las páginas web no pueden leerlo.
- **Preferencias, solo en el equipo:** la casilla «Ocultar datos del contribuyente» y la firma opcional
  (nombre, matrícula CPC, teléfono) para las imágenes. No se envían a ningún servidor. Las imágenes y textos para
  compartir se arman en el equipo; los envía la persona, a quien elija, con la app que elija.
- **Lo ya consultado en la sesión**, para no gastar la cuota dos veces; se borra al cerrar Chrome.

- **Opcional, solo si el usuario lo activa — botón «Ver ficha»:** en los sitios que el usuario elige
  (o en todos, si así lo decide) la extensión mira **el texto que el usuario selecciona**, en su equipo,
  para saber si es un RUC y mostrar el botón. No lee el resto de la página. Nada sale del equipo hasta
  que el usuario toca el botón, y entonces solo se envía ese RUC.

## Qué NO hace
- No recorre ni guarda el contenido de las páginas que el usuario visita.
- No registra el historial de navegación ni las URL.
- No envía datos a terceros ni muestra publicidad.
- No envía las cookies del navegador con las consultas.
- No muestra buzones ni notificaciones de ningún contribuyente: solo datos públicos del RUC.
- Nuestro servidor registra cuántas consultas hace cada acceso (para la cuota) y cuántas pruebas se
  inician por día, **nunca qué RUC** se consulta.

## Justificación de permisos (formulario de la tienda)
- `contextMenus`: ofrecer "Ficha RUC" sobre el texto seleccionado.
- `sidePanel`: mostrar la ficha junto a la página.
- `storage`: guardar el acceso, el identificador de la instalación y la cuota en el equipo, y lo
  consultado durante la sesión.
- `https://club.perusistemas.pro/*`: iniciar la prueba gratis y consultar nuestro servicio de RUC.
- `scripting`: registrar el botón «Ver ficha» solo cuando el usuario lo activa.
- Acceso a sitios (`*://*/*`), **opcional**: se pide solo al activar el botón «Ver ficha», para los sitios
  que el usuario elige; se devuelve al desactivarlo. Sirve únicamente para detectar si lo seleccionado
  es un RUC.

## Divulgación de datos (formulario de la tienda)
- Recopila: ninguno de "información personal", "historial web", "contenido del sitio web" salvo lo
  que el usuario elige consultar (RUC, datos públicos de contribuyentes).
- Se usa solo para la función de la extensión; no se vende ni se transfiere a terceros.

Contacto: WhatsApp 967317946 · Perú Sistemas Pro.
