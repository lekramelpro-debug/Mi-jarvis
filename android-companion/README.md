# JARVIS Android Companion

Aplicación Android complementaria para abrir Chrome, ChatGPT y Claude, y gestionar recordatorios locales.

## Qué hace
- Abre la aplicación instalada si Android permite resolver su paquete.
- Si no está instalada, intenta abrir la web correspondiente.
- Permite escribir un recordatorio, elegir fecha y hora y recibir una notificación local.
- Conserva los recordatorios pendientes al reiniciar el teléfono.
- Solicita permiso de notificaciones en Android 13 o posterior.
- No solicita permisos de micrófono, contactos, ubicación, SMS, llamadas ni accesibilidad.
- Los recordatorios se guardan localmente en el dispositivo; todavía no se sincronizan con la web de JARVIS ni con Cloudflare/Gemini.

## Limitaciones
- Android puede retrasar las notificaciones por ahorro de batería, modo No molestar o restricciones del sistema.
- La primera versión usa alarmas no exactas para evitar solicitar el permiso especial de alarmas exactas.
- Comprueba el permiso de notificaciones y los ajustes de batería de la aplicación si no recibes un aviso.

## Compilar
Abre esta carpeta en Android Studio con JDK 17 y deja que Gradle sincronice el proyecto. Después ejecuta el módulo `app` en un dispositivo Android o genera un APK de depuración.

Paquete: `com.jarvis.companion`

La compilación de depuración ya se ha verificado en GitHub Actions. Antes de considerar la app lista, instala el APK en un dispositivo Android de prueba y comprueba permisos, reinicio y recepción de notificaciones.
