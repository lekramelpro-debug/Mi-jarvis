# J.A.R.V.I.S. — Asistente personal

Aplicación web personal en español, adaptable a móvil y ordenador. Se puede instalar como aplicación web y dispone de caché para abrir la interfaz sin conexión después de la primera carga.

## Funciones actuales

- Chat con IA mediante Cloudflare Workers AI, a través de un Worker seguro.
- Reconocimiento de voz y respuestas habladas en navegadores compatibles.
- Memoria de notas guardadas localmente en el navegador.
- Uso opcional de las notas como contexto de IA: está desactivado por defecto y se activa desde Herramientas.
- Tareas con prioridad y fecha/hora.
- Recordatorios mediante notificaciones del navegador mientras JARVIS permanece abierto.
- Comandos en español para añadir tareas, programar recordatorios, guardar notas, consultar tareas y memoria, conocer fecha/hora y abrir Google Calendar, Drive o Gmail.
- Exportar e importar copias de seguridad JSON.
- Ajustes para voz, guardado del historial y uso de memoria por la IA.
- Instalación como aplicación web cuando el navegador lo admita.

## Publicación de la web

El repositorio incluye un flujo de GitHub Actions para publicar el sitio. En GitHub, abre **Settings → Pages** y comprueba que el origen esté configurado como **GitHub Actions**. Los cambios de `index.html`, `app.js`, `styles.css` y los archivos públicos se publican desde la rama principal cuando termina el flujo.

## Configuración de Cloudflare Workers AI

El archivo `worker.js` utiliza el binding de Workers AI llamado exactamente `AI` y el modelo `@cf/zai-org/glm-4.7-flash`.

Si cambias `worker.js` en GitHub, también debes actualizar el código del Worker en el panel de Cloudflare y pulsar **Deploy**, salvo que hayas configurado despliegues automáticos de Workers desde GitHub.

El Worker solo acepta solicitudes desde el dominio GitHub Pages de este proyecto. Esta restricción de origen ayuda a evitar llamadas desde otras webs, pero no sustituye un sistema de autenticación ni constituye un límite de uso.

## Memoria, privacidad y recordatorios

- Las notas, tareas y conversaciones se guardan en el almacenamiento local del navegador. No se sincronizan entre el ordenador y el móvil.
- La opción **Permitir que la IA consulte mis notas guardadas** está desactivada por defecto. Al activarla, las notas recientes se envían a Cloudflare Workers AI como contexto al conversar.
- No guardes contraseñas, claves API ni información privada o sensible en la memoria.
- Los recordatorios locales necesitan permiso de notificaciones. La página debe seguir abierta; el navegador o el sistema operativo pueden suspender la actividad en segundo plano, por lo que no son avisos garantizados.
- Exporta copias de seguridad periódicamente si quieres conservar tus notas y tareas al cambiar de navegador o dispositivo.

## Límites actuales

- La memoria es local al navegador y no sincroniza dispositivos.
- La investigación abre búsquedas web; JARVIS todavía no navega por páginas ni resume resultados automáticamente.
- JARVIS no puede controlar libremente otras aplicaciones ni acceder a archivos privados del dispositivo.
- Los avisos no funcionan como un servicio de recordatorios en la nube cuando la página está cerrada.
- Para integrar cuentas externas se necesitarán permisos explícitos y conexiones seguras.
