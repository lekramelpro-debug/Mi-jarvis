# J.A.R.V.I.S. — Asistente personal

Prototipo web adaptable a móviles y ordenadores. Toda la interfaz está en español y puede publicarse con GitHub Pages.

## Funciones disponibles

- Panel de control con diseño futurista y adaptable.
- Chat local con comandos sencillos. **Todavía no está conectado a una inteligencia artificial.**
- Reconocimiento de voz en navegadores compatibles.
- Respuestas habladas en español.
- Notas y tareas guardadas en el almacenamiento local del navegador.
- Búsquedas web que se abren en una pestaña nueva.
- Exportación de una copia de seguridad en formato JSON.
- Accesos directos a Google Calendar, Drive y Gmail.
- Posibilidad de instalarlo como aplicación web cuando el navegador lo permita.

## Cómo publicar JARVIS

1. Abre el repositorio en GitHub.
2. Entra en **Settings (Configuración)**.
3. Abre **Pages**.
4. En «Build and deployment», selecciona **Deploy from a branch**.
5. Elige la rama **main** y la carpeta **/(root)**.
6. Pulsa **Save (Guardar)**.

## Limitaciones actuales

- Las notas y tareas se guardan en el navegador y dispositivo donde las creas. Todavía no se sincronizan entre dispositivos.
- El chat responde a unos pocos comandos programados; no razona como una IA.
- La búsqueda abre Google, pero JARVIS todavía no lee páginas ni resume resultados.
- Una página web no puede controlar libremente otras aplicaciones ni acceder a archivos privados del dispositivo.
- La planificación automática en segundo plano todavía no está implementada.

## Seguridad

- No publiques claves API, contraseñas ni otros secretos en este repositorio.
- La futura conexión con una IA debe realizarse mediante un servidor seguro, nunca exponiendo la clave en el código que se ejecuta en el navegador.
- Las funciones que accedan a otras aplicaciones o archivos deberán pedir permisos claros y confirmación antes de realizar acciones.

## Próximas mejoras

1. Conectar un modelo de inteligencia artificial mediante un servidor seguro.
2. Añadir una cuenta y una base de datos para sincronizar la memoria entre dispositivos.
3. Mejorar la conversación por voz.
4. Crear integraciones seguras con herramientas y aplicaciones.
5. Añadir recordatorios y automatizaciones con permisos configurables.
