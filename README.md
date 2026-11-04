# J.A.R.V.I.S. — Asistente personal

Prototipo web adaptable a móvil y ordenador, publicable con GitHub Pages.

## Funciones disponibles
- Interfaz futurista adaptable.
- Chat local con comandos sencillos (todavía no es un modelo de IA).
- Reconocimiento de voz si el navegador admite Web Speech Recognition.
- Respuestas habladas con Speech Synthesis.
- Notas y tareas guardadas en el almacenamiento local del navegador.
- Búsquedas web abiertas en una pestaña nueva.
- Exportación de copia de seguridad JSON.
- Accesos a Calendar, Drive y Gmail.

## Publicación
En GitHub: Settings → Pages → Deploy from a branch → main → /(root) → Save.

## Limitaciones y seguridad
- Notas y tareas se guardan por navegador/dispositivo; aún no se sincronizan.
- No hay conexión a un proveedor de IA ni búsqueda integrada; las búsquedas se abren en Google.
- Una web no puede controlar libremente el sistema operativo ni leer archivos privados. Para ello hará falta un programa local con permisos explícitos.
- No incluyas claves API en el frontend ni en este repositorio. La futura conexión de IA debe pasar por un backend seguro.
- GitHub Pages aloja contenido estático. Sincronización, IA y tareas en segundo plano necesitarán servicios adicionales y estarán sujetos a sus límites gratuitos.
