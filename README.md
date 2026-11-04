# J.A.R.V.I.S. — Asistente personal

Aplicación web personal en español, adaptable a móvil y ordenador. Se puede instalar como aplicación web y dispone de una caché para abrir la interfaz sin conexión después de la primera carga.

## Funciones del prototipo 0.3

- Panel de control futurista y adaptable.
- Comandos locales en español para añadir tareas, guardar notas, consultar tareas y memoria, conocer la fecha y hora y abrir Google Calendar, Drive o Gmail.
- Reconocimiento de voz y respuestas habladas en navegadores compatibles.
- Memoria, tareas y conversación guardadas en el almacenamiento local del navegador.
- Fecha límite y prioridad en tareas.
- Exportar e importar copias de seguridad JSON.
- Ajustes para activar/desactivar voz y guardado del historial.
- Instalación como aplicación web cuando el navegador lo admita.
- Caché de archivos principales para volver a abrir la interfaz sin conexión.

## Publicación

Se ha añadido un flujo de GitHub Actions para publicar el sitio automáticamente. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación. Después de ese único ajuste, cada actualización en la rama `main` podrá publicarse automáticamente.

## Lo que todavía no está conectado

- **IA conversacional real:** el chat actual usa comandos locales; no es un modelo de IA.
- **Sincronización entre dispositivos:** los datos viven en el navegador actual y no se comparten entre móvil y ordenador.
- **Investigación autónoma:** las búsquedas abren Google; JARVIS no rastrea ni resume páginas por sí solo.
- **Control del dispositivo:** una web no puede manejar libremente otras aplicaciones ni leer archivos privados.
- **Automatizaciones en segundo plano:** el navegador puede suspender una página cerrada; las tareas programadas necesitan un servicio adicional.

## Seguridad y privacidad

- No guardes contraseñas ni información especialmente sensible en las notas.
- No publiques claves API ni secretos en este repositorio.
- Para conectar un modelo de IA se necesitará un servidor intermedio seguro; nunca debe ponerse una clave privada en el JavaScript del navegador.
- Las futuras integraciones con archivos o aplicaciones deberán pedir permisos explícitos y confirmación antes de actuar.
- La importación de una copia de seguridad sustituye las notas y tareas locales actuales.

## Próximas fases

1. Backend seguro para conectar una IA.
2. Inicio de sesión y base de datos para sincronización multidispositivo.
3. Conexiones con servicios externos mediante permisos limitados.
4. Recordatorios fiables y automatizaciones en segundo plano.
5. Aplicación complementaria para funciones nativas de Android o escritorio.
